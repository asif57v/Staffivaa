import crypto from 'crypto'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { emitRequestStatusUpdate } from '../utils/socket.js'
import { Wallet } from '../models/Wallet.js'

export const razorpayWebhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET

  if (!secret) return res.status(200).send('Webhook secret not configured')

  const signature = req.headers['x-razorpay-signature']
  const body = JSON.stringify(req.body)

  const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex')

  let isAuthentic = false
  try {
    const generatedBuffer = Buffer.from(expectedSignature, 'hex')
    const providedBuffer = Buffer.from(signature, 'hex')
    if (generatedBuffer.length === providedBuffer.length) {
      isAuthentic = crypto.timingSafeEqual(generatedBuffer, providedBuffer)
    }
  } catch (err) {
    isAuthentic = false
  }

  if (!isAuthentic) {
    return res.status(400).send('Invalid signature')
  }

  const event = req.body.event
  const paymentEntity = req.body.payload.payment.entity
  const orderId = paymentEntity.order_id

  if (event === 'payment.captured') {
    // Find the request with this order ID
    const request = await WorkforceRequest.findOne({
      $or: [
        { labourRazorpayOrderId: orderId },
        { userRazorpayOrderId: orderId }
      ]
    })

    if (request) {
      const isLabourOrder = request.labourRazorpayOrderId === orderId
      const isUserOrder = request.userRazorpayOrderId === orderId

      if (isLabourOrder) {
        request.labourPaymentStatus = 'paid'
      } else if (isUserOrder) {
        request.userPaymentStatus = 'paid'
      }

      if (request.userPaymentStatus === 'paid' && request.labourPaymentStatus === 'paid') {
        request.platformFeePaymentLifecycle = 'completed'
        if (request.status !== 'quotation_unlocked') {
          request.status = request.sourceType === 'corporate' ? 'project_active' : 'confirmed'
        }
      } else if (request.userPaymentStatus === 'paid' || request.labourPaymentStatus === 'paid') {
        request.platformFeePaymentLifecycle = 'partial'
      }

      await request.save()
      emitRequestStatusUpdate(request._id.toString(), {
        requestId: request._id.toString(),
        requestStatus: request.status
      })
    }
  }

  res.status(200).send('Webhook received')
}
