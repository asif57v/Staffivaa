import Razorpay from 'razorpay'
import crypto from 'crypto'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { USER_ROLES } from '../constants/roles.js'

// Cache the instance
let razorpayInstance = null
function getRazorpayInstance() {
  if (!razorpayInstance) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay keys not configured')
    }
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  }
  return razorpayInstance
}

export const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { id } = req.params
  const request = await WorkforceRequest.findById(id).populate('lines.categoryId')
  
  if (!request) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  
  // Verify ownership
  if (String(request.clientId) !== String(req.user._id) && req.user.role !== USER_ROLES.ADMIN) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  if (request.paymentStatus === 'paid') {
    return sendError(res, { message: 'Already paid', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Calculate amount
  let serviceCost = 0
  request.lines?.forEach(line => {
    const rate = line.categoryId?.baseRate || 800
    serviceCost += rate * (line.quantity || 1)
  })
  const platformFee = Math.round(serviceCost * 0.1)
  const taxes = Math.round((serviceCost + platformFee) * 0.18)
  const totalAmount = serviceCost + platformFee + taxes

  const razorpay = getRazorpayInstance()
  
  const options = {
    amount: totalAmount * 100, // Amount in paise
    currency: 'INR',
    receipt: request.reference,
  }

  const order = await razorpay.orders.create(options)

  request.razorpayOrderId = order.id
  await request.save()

  sendSuccess(res, { data: { keyId: process.env.RAZORPAY_KEY_ID, orderId: order.id, amount: options.amount, currency: options.currency } })
})

export const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body

  const request = await WorkforceRequest.findById(id)
  
  if (!request) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const secret = process.env.RAZORPAY_KEY_SECRET
  
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(razorpay_order_id + "|" + razorpay_payment_id)
  const generatedSignature = hmac.digest('hex')

  if (generatedSignature !== razorpay_signature) {
    request.paymentStatus = 'failed'
    await request.save()
    return sendError(res, { message: 'Payment verification failed', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  request.paymentStatus = 'paid'
  request.razorpayPaymentId = razorpay_payment_id
  request.razorpaySignature = razorpay_signature
  await request.save()

  sendSuccess(res, { data: { request } })
})
