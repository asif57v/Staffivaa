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

  // Find all allocations for this vendor
  const allocations = await Allocation.find({ vendorId }).lean()
  const requestIds = allocations.map(a => a.requestId)

  // Fetch related requests
  const requests = await WorkforceRequest.find({ _id: { $in: requestIds } }).lean()

  let pendingSettlement = 0
  let onHoldSettlement = 0
  let lifetimeEarnings = 0
  let totalSettlements = 0
  let activeProjects = 0

  for (const req of requests) {
    const calc = await getSettlementCalculations(req, vendorId)

    if (req.status === REQUEST_STATUS.SETTLEMENT_PENDING || req.status === REQUEST_STATUS.PAYMENT_PENDING) {
      pendingSettlement += calc.netSettlement
    }
    
    if (req.status === REQUEST_STATUS.SETTLEMENT_ON_HOLD) {
      onHoldSettlement += calc.netSettlement
    }

    if ([REQUEST_STATUS.SETTLEMENT_COMPLETED, REQUEST_STATUS.PARTIALLY_RELEASED, REQUEST_STATUS.SETTLEMENT_PENDING, REQUEST_STATUS.SETTLEMENT_ON_HOLD].includes(req.status)) {
      lifetimeEarnings += calc.grossEarnings
    }

    if (req.status === REQUEST_STATUS.SETTLEMENT_COMPLETED) {
      totalSettlements += 1
    }

    if ([REQUEST_STATUS.PROJECT_ACTIVE, REQUEST_STATUS.IN_PROGRESS, REQUEST_STATUS.ON_SITE, REQUEST_STATUS.ATTENDANCE, REQUEST_STATUS.BILLING, REQUEST_STATUS.PAYMENT_PENDING].includes(req.status)) {
      activeProjects += 1
    }
  }

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
      activeProjects
    }
  })
})

export const getSettlements = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  const vendorId = req.user._id

  const allocations = await Allocation.find({ vendorId }).lean()
  const requestIds = allocations.map(a => a.requestId)

  const requests = await WorkforceRequest.find({
    _id: { $in: requestIds },
    status: { $in: [
      REQUEST_STATUS.PAYMENT_PENDING,
      REQUEST_STATUS.SETTLEMENT_PENDING,
      REQUEST_STATUS.SETTLEMENT_ON_HOLD,
      REQUEST_STATUS.PARTIALLY_RELEASED,
      REQUEST_STATUS.SETTLEMENT_COMPLETED,
      REQUEST_STATUS.COMPLETED
    ]}
  })
  .populate('clientId', 'corporateProfile.companyName fullName')
  .populate('projectId', 'name')
  .sort({ updatedAt: -1 })
  .lean()

  const settlements = await Promise.all(requests.map(async req => {
    const calc = await getSettlementCalculations(req, vendorId)

    // Calculate project duration
    let duration = 0
    if (req.startDate && req.endDate) {
      const ms = new Date(req.endDate) - new Date(req.startDate)
      duration = Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1
    } else {
      duration = 1
    }

    return {
      _id: req._id,
      reference: req.reference,
      projectName: req.projectId?.name || 'Unknown Project',
      corporateName: req.clientId?.corporateProfile?.companyName || req.clientId?.fullName,
      status: req.status,
      date: req.updatedAt,
      durationDays: duration,
      workerCount: req.lines?.reduce((sum, line) => sum + line.quantity, 0) || 0,
      financials: calc
    }
  }))

  sendSuccess(res, { data: { settlements } })
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

  const settlementId = req.params.settlementId
  const request = await WorkforceRequest.findById(settlementId)
    .populate('clientId', 'corporateProfile.companyName fullName')
    .populate('projectId', 'name')
    .lean()

  if (!request) {
    return sendError(res, { message: 'Settlement not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const calc = await getSettlementCalculations(request, req.user._id)
  const quotation = await Quotation.findOne({ requestId: request._id, vendorId: req.user._id, status: 'approved' }).lean()

  sendSuccess(res, {
    data: {
      settlement: {
        _id: request._id,
        reference: request.reference,
        status: request.status,
        projectName: request.projectId?.name,
        corporateName: request.clientId?.corporateProfile?.companyName || request.clientId?.fullName,
        timeline: {
          createdAt: request.createdAt,
          acceptedAt: request.acceptedAt,
          updatedAt: request.updatedAt,
        },
        financials: calc,
        quotationDetails: quotation,
        ledger: request.settlementLedger || [],
        holdReason: request.holdReason
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
  await Notification.create({
    title: 'Settlement Reminder',
    body: `${req.user.fullName} has requested the release of settlement for project ${request.reference}.`,
    type: 'SETTLEMENT_PENDING',
    relatedId: request._id,
    relatedModel: 'WorkforceRequest'
  })

  // Optionally, record this in the request notes to prevent spam
  request.adminFinanceNotes.push({
    note: `Vendor requested settlement release via the app.`,
    adminName: 'System (Vendor Trigger)',
    date: new Date()
  })
  await request.save()

  sendSuccess(res, { message: 'Reminder sent to admin successfully.' })
})
