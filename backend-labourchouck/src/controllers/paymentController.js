import Razorpay from 'razorpay'
import crypto from 'crypto'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { USER_ROLES } from '../constants/roles.js'
import { emitRequestStatusUpdate } from '../utils/socket.js'

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
  const request = await WorkforceRequest.findById(id)
  
  if (!request) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  
  const isLabour = req.user.role === USER_ROLES.LABOUR;
  const isClient = String(request.clientId._id || request.clientId) === String(req.user._id);

  if (!isLabour && !isClient && req.user.role !== USER_ROLES.ADMIN) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  let totalAmount = 0;
  if (isLabour) {
    if (request.labourPaymentStatus === 'paid') return sendError(res, { message: 'Already paid by labour', statusCode: HTTP_STATUS.BAD_REQUEST });
    totalAmount = request.labourPlatformFee !== undefined ? request.labourPlatformFee : 20;
    
    // Bypass Razorpay if fee is exactly 0
    if (totalAmount === 0) {
      request.labourPaymentStatus = 'paid';
      if (request.userPaymentStatus === 'paid') {
        request.status = 'confirmed';
        emitRequestStatusUpdate(request._id.toString(), { requestStatus: request.status });
      }
      await request.save();
      return sendSuccess(res, { data: { bypassPayment: true } });
    }
  } else {
    if (request.userPaymentStatus === 'paid') return sendError(res, { message: 'Already paid by user', statusCode: HTTP_STATUS.BAD_REQUEST });
    totalAmount = request.userPlatformFee || 49;
  }

  const razorpay = getRazorpayInstance()
  
  const options = {
    amount: totalAmount * 100, // Amount in paise
    currency: 'INR',
    receipt: `${request.reference}-${isLabour ? 'LAB' : 'USR'}`,
  }

  const order = await razorpay.orders.create(options)

  if (isLabour) {
    request.labourRazorpayOrderId = order.id;
  } else {
    request.userRazorpayOrderId = order.id;
  }
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

  const isLabourOrder = request.labourRazorpayOrderId === razorpay_order_id;
  const isUserOrder = request.userRazorpayOrderId === razorpay_order_id;

  if (generatedSignature !== razorpay_signature) {
    if (isLabourOrder) request.labourPaymentStatus = 'failed';
    else if (isUserOrder) request.userPaymentStatus = 'failed';
    else request.paymentStatus = 'failed';

    await request.save()
    return sendError(res, { message: 'Payment verification failed', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  if (isLabourOrder) {
    request.labourPaymentStatus = 'paid';
  } else if (isUserOrder) {
    request.userPaymentStatus = 'paid';
  } else {
    request.paymentStatus = 'paid';
  }

  request.razorpayPaymentId = razorpay_payment_id
  request.razorpaySignature = razorpay_signature
  
  // Overall status check
  if (request.userPaymentStatus === 'paid' && request.labourPaymentStatus === 'paid') {
    request.status = 'confirmed'; // Assuming CONFIRMED status is lowercase 'confirmed' (from REQUEST_STATUS)
    emitRequestStatusUpdate(request._id.toString(), { requestStatus: request.status })
  }

  await request.save()

  sendSuccess(res, { data: { request } })
})
