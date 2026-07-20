import { Commission } from '../models/Commission.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import CommissionService from '../services/CommissionService.js'
import crypto from 'crypto'
import Razorpay from 'razorpay'
import dotenv from 'dotenv'

dotenv.config()

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

// --- Vendor APIs ---

export const getVendorCommissions = asyncHandler(async (req, res) => {
  const commissions = await Commission.find({ vendorId: req.user._id })
    .populate('requestId', 'reference')
    .populate('clientId', 'fullName companyName')
    .sort({ createdAt: -1 })
    .lean()
  sendSuccess(res, { data: { commissions } })
})

export const createRazorpayOrder = asyncHandler(async (req, res) => {
  const commission = await Commission.findOne({ _id: req.params.id, vendorId: req.user._id })
  if (!commission) return sendError(res, { message: 'Commission not found', statusCode: HTTP_STATUS.NOT_FOUND })
  if (commission.status === 'paid' || commission.status === 'waived') {
    return sendError(res, { message: 'Commission already paid or waived', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const options = {
    amount: Math.round(commission.commissionAmount * 100), // in paise
    currency: 'INR',
    receipt: `comm_rcpt_${commission._id}`
  }

  const order = await razorpay.orders.create(options)
  commission.paymentGatewayOrderId = order.id
  await commission.save()

  sendSuccess(res, { data: { orderId: order.id, amount: options.amount } })
})

export const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body
  const commission = await Commission.findOne({ _id: req.params.id, vendorId: req.user._id })
  if (!commission) return sendError(res, { message: 'Commission not found', statusCode: HTTP_STATUS.NOT_FOUND })

  const body = razorpay_order_id + '|' + razorpay_payment_id
  const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(body.toString()).digest('hex')

  if (expectedSignature === razorpay_signature) {
    const updated = await CommissionService.processPayment(
      commission._id,
      commission.commissionAmount,
      'razorpay',
      { transactionId: razorpay_payment_id, orderId: razorpay_order_id }
    )
    sendSuccess(res, { data: { commission: updated } })
  } else {
    sendError(res, { message: 'Invalid payment signature', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
})

// --- Admin APIs ---

export const getAdminCommissions = asyncHandler(async (req, res) => {
  const filters = {}
  if (req.query.status) filters.status = req.query.status

  const commissions = await Commission.find(filters)
    .populate('requestId', 'reference')
    .populate('vendorId', 'fullName companyName phone')
    .populate('clientId', 'fullName companyName')
    .sort({ createdAt: -1 })
    .lean()

  sendSuccess(res, { data: { commissions } })
})

export const markCommissionPaidOffline = asyncHandler(async (req, res) => {
  const { transactionId, notes } = req.body
  const commission = await Commission.findById(req.params.id)
  if (!commission) return sendError(res, { message: 'Commission not found', statusCode: HTTP_STATUS.NOT_FOUND })

  const updated = await CommissionService.processPayment(
    commission._id,
    commission.commissionAmount,
    'offline',
    { transactionId }
  )
  if (notes) {
    updated.notes = notes
    await updated.save()
  }

  sendSuccess(res, { message: 'Marked as paid', data: { commission: updated } })
})

export const waiveCommission = asyncHandler(async (req, res) => {
  const { notes } = req.body
  const commission = await Commission.findById(req.params.id)
  if (!commission) return sendError(res, { message: 'Commission not found', statusCode: HTTP_STATUS.NOT_FOUND })

  commission.status = 'waived'
  commission.waivedAt = new Date()
  if (notes) commission.notes = notes
  await commission.save()

  sendSuccess(res, { message: 'Commission waived', data: { commission } })
})
