import crypto from 'crypto'
import { paymentService } from '../services/paymentService.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { emitRequestStatusUpdate } from '../utils/socket.js'
import { triggerNotification } from '../utils/notificationTrigger.js'
import {
  paymentSuccessUserNotif,
  paymentSuccessLabourNotif,
  counterpartPaidUserNotif,
  counterpartPaidLabourNotif,
  bookingConfirmedUserNotif,
  bookingConfirmedLabourNotif,
} from '../utils/bookingNotificationCopy.js'

export const razorpayWebhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ? process.env.RAZORPAY_WEBHOOK_SECRET.trim() : null

  if (!secret) {
    console.warn('[Webhook] RAZORPAY_WEBHOOK_SECRET is not configured on the server.')
    return res.status(200).send('Webhook secret not configured')
  }

  const signature = req.headers['x-razorpay-signature']
  if (!signature) {
    return res.status(400).send('Missing x-razorpay-signature header')
  }

  // Use the raw byte stream buffer captured by express verify callback, or fallback to JSON stringify
  const payloadToVerify = req.rawBody ? req.rawBody : JSON.stringify(req.body)
  const expectedSignature = crypto.createHmac('sha256', secret).update(payloadToVerify).digest('hex')

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
    console.error('[Webhook] Invalid Razorpay webhook signature')
    return res.status(400).send('Invalid signature')
  }

  const event = req.body?.event
  const paymentPayload = req.body?.payload?.payment?.entity
  const orderId = paymentPayload?.order_id || req.body?.payload?.order?.entity?.id

  console.log(`[Webhook] Received Razorpay event: ${event} for order: ${orderId}`)

  if (event === 'payment.captured' || event === 'order.paid') {
    if (orderId && paymentPayload) {
      try {
        // Universal payment service handles User Wallet, Enterprise Wallet, Booking, and Commission idempotently
        await paymentService.processPaymentSuccess({
          gatewayOrderId: orderId,
          gatewayPaymentId: paymentPayload.id,
          paymentMethod: paymentPayload.method || 'razorpay',
          source: 'webhook',
          gatewayResponse: paymentPayload,
        })
      } catch (svcErr) {
        console.error('[Webhook] paymentService.processPaymentSuccess error:', svcErr)
      }
    }

    // Direct WorkforceRequest notifications fallback check
    if (orderId) {
      try {
        const request = await WorkforceRequest.findOne({
          $or: [{ labourRazorpayOrderId: orderId }, { userRazorpayOrderId: orderId }],
        })

        if (request) {
          const isLabourOrder = request.labourRazorpayOrderId === orderId
          const isUserOrder = request.userRazorpayOrderId === orderId
          const reqRef = request.reference || request._id.toString().slice(-6)

          const bothPaid =
            request.userPaymentStatus === 'paid' &&
            (request.labourPaymentStatus === 'paid' ||
              (request.labourPlatformFee !== undefined && request.labourPlatformFee === 0))

          if (bothPaid) {
            if (request.clientId) {
              const copy = bookingConfirmedUserNotif(reqRef)
              triggerNotification({
                userId: request.clientId,
                title: copy.title,
                body: copy.body,
                type: copy.type,
                relatedId: request._id,
                relatedModel: 'WorkforceRequest',
                url: '/app/bookings',
              }).catch(() => {})
            }
            if (request.labourId) {
              const copy = bookingConfirmedLabourNotif(reqRef)
              triggerNotification({
                userId: request.labourId,
                title: copy.title,
                body: copy.body,
                type: copy.type,
                relatedId: request._id,
                relatedModel: 'WorkforceRequest',
                url: '/app/jobs',
              }).catch(() => {})
            }
          } else if (isUserOrder) {
            if (request.clientId) {
              const copy = paymentSuccessUserNotif()
              triggerNotification({
                userId: request.clientId,
                title: copy.title,
                body: copy.body,
                type: copy.type,
                relatedId: request._id,
                relatedModel: 'WorkforceRequest',
                url: '/app/bookings',
              }).catch(() => {})
            }
            if (request.labourId && request.labourPaymentStatus !== 'paid') {
              const copy = counterpartPaidLabourNotif()
              triggerNotification({
                userId: request.labourId,
                title: copy.title,
                body: copy.body,
                type: copy.type,
                relatedId: request._id,
                relatedModel: 'WorkforceRequest',
                url: '/app/jobs',
              }).catch(() => {})
            }
          } else if (isLabourOrder) {
            if (request.labourId) {
              const copy = paymentSuccessLabourNotif()
              triggerNotification({
                userId: request.labourId,
                title: copy.title,
                body: copy.body,
                type: copy.type,
                relatedId: request._id,
                relatedModel: 'WorkforceRequest',
                url: '/app/jobs',
              }).catch(() => {})
            }
            if (request.clientId && request.userPaymentStatus !== 'paid') {
              const copy = counterpartPaidUserNotif()
              triggerNotification({
                userId: request.clientId,
                title: copy.title,
                body: copy.body,
                type: copy.type,
                relatedId: request._id,
                relatedModel: 'WorkforceRequest',
                url: '/app/bookings',
              }).catch(() => {})
            }
          }
        }
      } catch (notifErr) {
        console.error('[Webhook] Booking notification error:', notifErr.message)
      }
    }
  } else if (event === 'payment.failed') {
    if (orderId && paymentPayload) {
      try {
        await paymentService.recordPaymentFailure({
          gatewayOrderId: orderId,
          failureReason: paymentPayload.error_description || 'Payment failed on gateway',
          gatewayResponse: paymentPayload,
        })
      } catch (err) {
        console.error('[Webhook] recordPaymentFailure error:', err)
      }
    }
  }

  // Always return 200 OK to acknowledge receipt to Razorpay
  res.status(200).send('Webhook processed successfully')
}
