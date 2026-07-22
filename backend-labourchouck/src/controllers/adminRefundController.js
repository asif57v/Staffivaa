import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { RefundRequest } from '../models/RefundRequest.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { Wallet } from '../models/Wallet.js'
import { User } from '../models/User.js'
import { sendNotificationToUser } from '../services/notificationService.js'

/**
 * Admin: List all refund requests
 */
export const listRefundRequests = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query
  const query = {}
  
  if (status) {
    query.status = status
  }

  const skip = (Number(page) - 1) * Number(limit)
  
  const refunds = await RefundRequest.find(query)
    .populate('bookingId', 'reference title status platformFeePaymentLifecycle')
    .populate('userId', 'fullName phone role')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))

  const total = await RefundRequest.countDocuments(query)

  sendSuccess(res, {
    data: {
      refunds,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    },
  })
})

/**
 * Admin: Approve a refund request
 */
export const approveRefundRequest = asyncHandler(async (req, res) => {
  const { id } = req.params

  const refundReq = await RefundRequest.findById(id)
  if (!refundReq) {
    return sendError(res, { message: 'Refund request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (refundReq.status !== 'PENDING') {
    return sendError(res, { message: `Cannot approve request with status: ${refundReq.status}`, statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const amount = refundReq.amount

  // 1. Debit Admin Wallet Liability
  let adminWallet = await Wallet.findOne({ singletonId: 'ADMIN_WALLET' })
  if (adminWallet) {
    adminWallet.pendingRefundLiability = Math.max(0, adminWallet.pendingRefundLiability - amount)
    // Actual balance decreases
    adminWallet.balance = Math.max(0, adminWallet.balance - amount)
    await adminWallet.save()
  }

  // 2. Credit User Wallet
  await User.findByIdAndUpdate(refundReq.userId, { $inc: { walletBalance: amount } })

  // 3. Update Status
  refundReq.status = 'APPROVED'
  refundReq.processedAt = new Date()
  await refundReq.save()

  // 4. Update Wallet Transaction to Completed
  await WalletTransaction.findOneAndUpdate(
    { referenceModel: 'RefundRequest', referenceId: refundReq._id },
    { status: 'Completed', source: 'Refund Approved' }
  )

  // 5. Notify User
  sendNotificationToUser(
    refundReq.userId.toString(),
    'Refund Approved',
    `Your refund of ₹${amount} has been approved and credited to your wallet.`,
    { url: '/app/wallet' }
  )

  sendSuccess(res, { message: 'Refund approved successfully', data: { refundReq } })
})

/**
 * Admin: Reject a refund request
 */
export const rejectRefundRequest = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { adminNote } = req.body

  const refundReq = await RefundRequest.findById(id)
  if (!refundReq) {
    return sendError(res, { message: 'Refund request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (refundReq.status !== 'PENDING') {
    return sendError(res, { message: `Cannot reject request with status: ${refundReq.status}`, statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const amount = refundReq.amount

  // 1. Convert Liability back to Revenue (Since money is forfeited)
  let adminWallet = await Wallet.findOne({ singletonId: 'ADMIN_WALLET' })
  if (adminWallet) {
    adminWallet.pendingRefundLiability = Math.max(0, adminWallet.pendingRefundLiability - amount)
    adminWallet.totalRevenue += amount // Claimed as platform revenue now
    await adminWallet.save()
  }

  // 2. Update Status
  refundReq.status = 'REJECTED'
  refundReq.adminNote = adminNote || 'Rejected by Admin'
  refundReq.processedAt = new Date()
  await refundReq.save()

  // 3. Update Wallet Transaction to Failed
  await WalletTransaction.findOneAndUpdate(
    { referenceModel: 'RefundRequest', referenceId: refundReq._id },
    { status: 'Failed', source: `Refund Rejected: ${adminNote || 'Contact support'}` }
  )

  // 4. Notify User
  sendNotificationToUser(
    refundReq.userId.toString(),
    'Refund Rejected',
    `Your refund of ₹${amount} was rejected. Reason: ${refundReq.adminNote}`,
    { url: '/app/wallet' }
  )

  sendSuccess(res, { message: 'Refund rejected successfully', data: { refundReq } })
})
