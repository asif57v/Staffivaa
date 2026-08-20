import crypto from 'crypto'
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
      const wasAlreadyPaid =
        (isLabourOrder && request.labourPaymentStatus === 'paid') ||
        (isUserOrder && request.userPaymentStatus === 'paid')

      if (isLabourOrder) {
        request.labourPaymentStatus = 'paid'
      } else if (isUserOrder) {
        request.userPaymentStatus = 'paid'
      }

      const isLabourPaidOrWaived = request.labourPaymentStatus === 'paid' || (request.labourPlatformFee !== undefined && request.labourPlatformFee === 0);

      // Both parties must settle platform fee before booking unlocks (unless labour fee is ₹0).
      if (request.userPaymentStatus === 'paid' && isLabourPaidOrWaived) {
        request.platformFeePaymentLifecycle = 'completed'
        if (request.status !== 'quotation_unlocked') {
          request.status = request.sourceType === 'corporate' ? 'project_active' : 'confirmed'
        }
        request.cancelReason = null

        import('../models/Assignment.js').then(({ Assignment }) => {
          Assignment.updateMany({ requestId: request._id, status: 'cancelled' }, { status: 'accepted' }).catch(e => console.error(e));
        }).catch(e => console.error(e));
      } else if (request.userPaymentStatus === 'paid' || request.labourPaymentStatus === 'paid') {
        request.platformFeePaymentLifecycle = 'partial'
        // Individual bookings must stay locked until labour also pays
        if (request.sourceType !== 'corporate' && !['on_site', 'in_progress', 'completed'].includes(request.status)) {
          request.status = 'platform_fee_pending'
        }
      }

      await request.save()
      emitRequestStatusUpdate(request._id.toString(), {
        requestId: request._id.toString(),
        requestStatus: request.status
      })

      // Dedicated push for individual dual-payment flow (skip if this order was already marked paid)
      if (!wasAlreadyPaid && request.sourceType !== 'corporate') {
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
    }
  }

  res.status(200).send('Webhook received')
}
