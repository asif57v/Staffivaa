import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { RefundRequest } from '../models/RefundRequest.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { triggerNotification } from '../utils/notificationTrigger.js'

/**
 * Get all refund eligibilities/requests for the logged in user
 */
export const getMyRefundRequests = asyncHandler(async (req, res) => {
  const refunds = await RefundRequest.find({ userId: req.user._id })
    .populate('bookingId', 'reference status title')
    .sort({ createdAt: -1 })
  
  sendSuccess(res, { data: { refunds } })
})

/**
 * Request a refund for an ELIGIBLE request
 */
export const requestRefund = asyncHandler(async (req, res) => {
  const { bookingId } = req.params

  const refundReq = await RefundRequest.findOne({
    bookingId,
    userId: req.user._id,
  })

  if (!refundReq) {
    return sendError(res, {
      message: 'No refund eligibility found for this booking.',
      statusCode: HTTP_STATUS.NOT_FOUND,
    })
  }

  if (refundReq.status !== 'ELIGIBLE') {
    return sendError(res, {
      message: `Refund is already in status: ${refundReq.status}`,
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  // Update status to PENDING
  refundReq.status = 'PENDING'
  refundReq.requestedAt = new Date()
  await refundReq.save()

  // Find the associated pending wallet transaction and update source/description if needed
  await WalletTransaction.findOneAndUpdate(
    { referenceModel: 'RefundRequest', referenceId: refundReq._id },
    { source: 'Refund Requested - Pending Admin Approval' }
  )

  // ── Send notification to all admins ────────────────────────────────────
  const booking = await WorkforceRequest.findById(bookingId).select('reference').lean()
  const bookingRef = booking?.reference || bookingId
  const userName = req.user.fullName || 'A client'

  triggerNotification({
    userId: null, // null = broadcast to all admins
    title: 'New Refund Request',
    body: `${userName} has requested a refund of ₹${refundReq.amount} for booking ${bookingRef}. Please review.`,
    type: 'REFUND_REQUESTED',
    relatedId: refundReq._id,
    relatedModel: 'RefundRequest',
  })

  sendSuccess(res, {
    message: 'Refund requested successfully. It is pending admin approval.',
    data: { refundReq },
  })
})

