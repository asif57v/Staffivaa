import { User } from '../models/User.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { Allocation } from '../models/Allocation.js'
import { Quotation } from '../models/Quotation.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { Withdrawal } from '../models/Withdrawal.js'
import { Notification } from '../models/Notification.js'
import { REQUEST_STATUS } from '../constants/workforceConstants.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { emitToRole } from '../utils/socket.js'

function requireApprovedVendor(user) {
  if (user.role !== 'contractor') return 'Vendor account required'
  if (user.contractorProfile?.verificationStatus !== 'approved') {
    return 'Vendor must be verified before this action'
  }
  return null
}

// Helper to calculate settlement figures for a request
async function getSettlementCalculations(request, vendorId) {
  // Find approved quotation
  const quotation = await Quotation.findOne({ requestId: request._id, vendorId, status: 'approved' }).lean()
  
  let grossEarnings = 0
  if (quotation) {
    grossEarnings = quotation.grandTotal || quotation.labourCost || 0
  } else {
    grossEarnings = request.labourCharge || 0
  }

  const platformFee = request.labourPlatformFee || 0
  const gst = quotation?.gst || 0
  const otherDeductions = 0 // Add any other custom admin deductions if stored
  const netSettlement = grossEarnings - platformFee - gst - otherDeductions

  return {
    grossEarnings,
    platformFee,
    gst,
    otherDeductions,
    netSettlement
  }
}

export const getWalletSummary = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  const vendorId = req.user._id

  // 1. Available Balance
  const user = await User.findById(vendorId).select('walletBalance').lean()
  const availableBalance = user?.walletBalance || 0

  const { Settlement } = await import('../models/Settlement.js')
  
  // Aggregate from Settlement collection
  const settlements = await Settlement.find({ vendorId }).lean()

  let pendingSettlement = 0
  let onHoldSettlement = 0
  let lifetimeEarnings = 0
  let totalSettlements = 0

  for (const s of settlements) {
    if (s.status === 'settlement_pending') {
      pendingSettlement += s.financials?.netSettlement || 0
    }
    if (s.status === 'settlement_on_hold') {
      onHoldSettlement += s.financials?.netSettlement || 0
    }
    if (['settlement_completed', 'settlement_pending', 'settlement_on_hold'].includes(s.status)) {
      lifetimeEarnings += s.financials?.grossEarnings || 0
    }
    if (s.status === 'settlement_completed') {
      totalSettlements += 1
    }
  }

  // Active Projects is still from WorkforceRequest
  const allocations = await Allocation.find({ vendorId }).lean()
  const requestIds = allocations.map(a => a.requestId)
  const activeProjectsCount = await WorkforceRequest.countDocuments({
    _id: { $in: requestIds },
    status: { $in: [
      REQUEST_STATUS.PROJECT_ACTIVE, 
      REQUEST_STATUS.IN_PROGRESS, 
      REQUEST_STATUS.ON_SITE, 
      REQUEST_STATUS.ATTENDANCE, 
      REQUEST_STATUS.BILLING, 
      REQUEST_STATUS.PAYMENT_PENDING
    ]}
  })

  // Calculate Total Withdrawn
  const withdrawals = await Withdrawal.aggregate([
    { $match: { requestedBy: vendorId, status: 'Completed' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ])
  const totalWithdrawn = withdrawals.length > 0 ? withdrawals[0].total : 0

  sendSuccess(res, {
    data: {
      availableBalance,
      pendingSettlement,
      onHoldSettlement,
      lifetimeEarnings,
      totalWithdrawn,
      totalSettlements,
      activeProjects: activeProjectsCount
    }
  })
})

export const getSettlements = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  const vendorId = req.user._id

  // Return BOTH un-paid requests (as Waiting for Corporate Payment) AND actual settlements
  const allocations = await Allocation.find({ vendorId }).lean()
  const requestIds = allocations.map(a => a.requestId)

  const unpaidRequests = await WorkforceRequest.find({
    _id: { $in: requestIds },
    status: { $in: [REQUEST_STATUS.PAYMENT_PENDING] }
  })
  .populate('clientId', 'corporateProfile.companyName fullName')
  .populate('projectId', 'name')
  .sort({ updatedAt: -1 })
  .lean()

  const { Settlement } = await import('../models/Settlement.js')
  const actualSettlements = await Settlement.find({ vendorId })
  .populate('clientId', 'corporateProfile.companyName fullName')
  .populate('projectId', 'name')
  .populate('requestId')
  .sort({ createdAt: -1 })
  .lean()

  let finalSettlementsList = []

  // Add Unpaid requests (Placeholder settlements)
  for (const req of unpaidRequests) {
    // Calculate project duration
    let duration = 0
    if (req.startDate && req.endDate) {
      const ms = new Date(req.endDate) - new Date(req.startDate)
      duration = Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1
    } else {
      duration = 1
    }

    finalSettlementsList.push({
      _id: req._id,
      isPlaceholder: true,
      reference: req.reference,
      projectName: req.projectId?.name || 'Unknown Project',
      corporateName: req.clientId?.corporateProfile?.companyName || req.clientId?.fullName,
      status: 'waiting_for_corporate_payment',
      date: req.updatedAt,
      durationDays: duration,
      workerCount: req.lines?.reduce((sum, line) => sum + line.quantity, 0) || 0,
      financials: null // No financials yet!
    })
  }

  // Add actual Settlements
  for (const s of actualSettlements) {
    const req = s.requestId
    
    // Calculate project duration
    let duration = 0
    if (req && req.startDate && req.endDate) {
      const ms = new Date(req.endDate) - new Date(req.startDate)
      duration = Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1
    } else {
      duration = 1
    }
    
    finalSettlementsList.push({
      _id: s._id,
      isPlaceholder: false,
      reference: s.reference,
      projectName: s.projectId?.name || 'Unknown Project',
      corporateName: s.clientId?.corporateProfile?.companyName || s.clientId?.fullName,
      status: s.status,
      date: s.createdAt,
      durationDays: duration,
      workerCount: req?.lines?.reduce((sum, line) => sum + line.quantity, 0) || 0,
      financials: s.financials,
      milestone: s.milestone
    })
  }

  // Sort combined list by date descending
  finalSettlementsList.sort((a, b) => new Date(b.date) - new Date(a.date))

  sendSuccess(res, { data: { settlements: finalSettlementsList } })
})

export const getWalletActivity = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  const transactions = await WalletTransaction.find({ payerId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean()

  sendSuccess(res, { data: { transactions } })
})

export const getSettlementDetails = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  const id = req.params.settlementId
  const { Settlement } = await import('../models/Settlement.js')
  
  // It could be an actual Settlement ID, or a WorkforceRequest ID (if it's a placeholder)
  let settlementDoc = null;
  if(id && id.length === 24) {
    settlementDoc = await Settlement.findById(id)
      .populate('clientId', 'corporateProfile.companyName fullName')
      .populate('projectId', 'name')
      .lean()
  }

  if (settlementDoc) {
    sendSuccess(res, {
      data: {
        settlement: {
          _id: settlementDoc._id,
          isPlaceholder: false,
          reference: settlementDoc.reference,
          status: settlementDoc.status,
          milestone: settlementDoc.milestone,
          projectName: settlementDoc.projectId?.name,
          corporateName: settlementDoc.clientId?.corporateProfile?.companyName || settlementDoc.clientId?.fullName,
          timeline: settlementDoc.timeline,
          financials: settlementDoc.financials,
          holdReason: settlementDoc.holdReason
        }
      }
    })
    return
  }

  // Fallback: check if it's a placeholder (WorkforceRequest ID)
  const request = await WorkforceRequest.findById(id)
    .populate('clientId', 'corporateProfile.companyName fullName')
    .populate('projectId', 'name')
    .lean()

  if (!request) {
    return sendError(res, { message: 'Settlement not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  sendSuccess(res, {
    data: {
      settlement: {
        _id: request._id,
        isPlaceholder: true,
        reference: request.reference,
        status: 'waiting_for_corporate_payment',
        projectName: request.projectId?.name,
        corporateName: request.clientId?.corporateProfile?.companyName || request.clientId?.fullName,
        timeline: {
          createdAt: request.createdAt,
          acceptedAt: request.acceptedAt,
          updatedAt: request.updatedAt,
        },
        financials: null
      }
    }
  })
})

export const requestWithdrawal = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  const { amount, bankDetails } = req.body
  if (!amount || amount <= 0) {
    return sendError(res, { message: 'Invalid withdrawal amount', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const user = await User.findById(req.user._id)
  if (!user || user.walletBalance < amount) {
    return sendError(res, { message: 'Insufficient Available Balance', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Deduct immediately
  user.walletBalance -= amount
  await user.save()

  const withdrawal = await Withdrawal.create({
    amount,
    bankDetails,
    requestedBy: req.user._id,
    status: 'Pending'
  })

  await WalletTransaction.create({
    transactionId: `WD-${Date.now()}`,
    payerId: req.user._id,
    payerName: req.user.fullName || 'Vendor',
    payerType: 'vendor',
    type: 'Debit', // Using standard terminology
    source: 'Withdrawal Requested',
    amount,
    status: 'Pending',
    referenceModel: 'Withdrawal',
    referenceId: withdrawal._id
  })

  sendSuccess(res, { data: { withdrawal, walletBalance: user.walletBalance } })
})

export const getWithdrawals = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  const withdrawals = await Withdrawal.find({ requestedBy: req.user._id })
    .sort({ createdAt: -1 })
    .lean()

  sendSuccess(res, { data: { withdrawals } })
})

export const remindAdminForSettlement = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  const settlementId = req.params.settlementId
  const request = await WorkforceRequest.findById(settlementId)

  if (!request) {
    return sendError(res, { message: 'Settlement not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (request.status !== REQUEST_STATUS.SETTLEMENT_PENDING) {
    return sendError(res, { message: 'Can only send reminders for pending settlements', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Create notification for Admin
  const notification = await Notification.create({
    title: 'Settlement Reminder',
    body: `${req.user.fullName} has requested the release of settlement for project ${request.reference}.`,
    type: 'SETTLEMENT_PENDING',
    relatedId: request._id,
    relatedModel: 'WorkforceRequest'
  })

  // Emit real-time socket event to all admins
  emitToRole('admin', 'new_notification', notification)

  // Optionally, record this in the request notes to prevent spam
  request.adminFinanceNotes.push({
    note: `Vendor requested settlement release via the app.`,
    adminName: 'System (Vendor Trigger)',
    date: new Date()
  })
  await request.save()

  sendSuccess(res, { message: 'Reminder sent to admin successfully.' })
})
