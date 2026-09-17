import { Router } from 'express'
import { protect } from '../middleware/auth.js'
import { paymentService } from '../services/paymentService.js'
import { Payment } from '../models/Payment.js'
import { sendSuccess, sendError, HTTP_STATUS } from '../utils/apiResponse.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

/**
 * GET /api/v1/payments/status/:orderId
 * Fetches status of a payment. If pending/created, attempts live reconciliation with Razorpay.
 */
router.get(
  '/status/:orderId',
  protect,
  asyncHandler(async (req, res) => {
    const { orderId } = req.params

    let payment = await Payment.findOne({
      $or: [{ orderId }, { gatewayOrderId: orderId }],
      userId: req.user._id,
    })

    if (!payment && req.user.role === 'admin') {
      payment = await Payment.findOne({
        $or: [{ orderId }, { gatewayOrderId: orderId }],
      })
    }

    if (!payment) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Payment record not found',
      })
    }

    // If still in CREATED or PENDING state, reconcile with Gateway (throttled to at most once per 5 seconds)
    if (['CREATED', 'PENDING'].includes(payment.status) && payment.gatewayOrderId) {
      const lastCheckAgeMs = payment.lastCheckedAt
        ? Date.now() - new Date(payment.lastCheckedAt).getTime()
        : Infinity

      if (lastCheckAgeMs > 5000) {
        const reconcileResult = await paymentService.reconcilePaymentWithGateway(payment.gatewayOrderId)
        if (reconcileResult.success && reconcileResult.payment) {
          payment = reconcileResult.payment
        }
      }
    }

    return sendSuccess(res, {
      data: {
        orderId: payment.orderId,
        gatewayOrderId: payment.gatewayOrderId,
        gatewayPaymentId: payment.gatewayPaymentId,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        purpose: payment.purpose,
        paymentMethod: payment.paymentMethod,
        paidAt: payment.paidAt,
        failureReason: payment.failureReason,
        createdAt: payment.createdAt,
      },
    })
  }),
)

/**
 * POST /api/v1/payments/reconcile/:orderId
 * Explicitly triggers gateway reconciliation
 */
router.post(
  '/reconcile/:orderId',
  protect,
  asyncHandler(async (req, res) => {
    const { orderId } = req.params

    const result = await paymentService.reconcilePaymentWithGateway(orderId)
    if (!result.success) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: result.message || result.error || 'Reconciliation failed',
      })
    }

    return sendSuccess(res, {
      message: result.message,
      data: result.payment,
    })
  }),
)

export default router
