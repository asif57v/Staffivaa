import { EnterpriseWallet } from '../models/EnterpriseWallet.js'
import { EnterpriseWalletTransaction } from '../models/EnterpriseWalletTransaction.js'
import { User } from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { USER_ROLES } from '../constants/roles.js'
import { logAudit } from '../utils/auditLogger.js'

/** GET /api/admin/enterprise-wallets - List all company wallets for Admin */
export const getAdminEnterpriseWallets = asyncHandler(async (req, res) => {
  const wallets = await EnterpriseWallet.find()
    .populate('enterpriseId', 'fullName email phone enterpriseProfile')
    .sort({ balance: -1 })
    .lean()

  // Also include companies without wallet initialized yet
  const allCompanies = await User.find({ role: USER_ROLES.ENTERPRISE }).select('fullName email phone enterpriseProfile').lean()

  const walletMap = new Map(wallets.map((w) => [String(w.enterpriseId?._id), w]))

  const fullWalletsList = allCompanies.map((comp) => {
    const existing = walletMap.get(String(comp._id))
    if (existing) return existing
    return {
      enterpriseId: comp,
      balance: 0,
      status: 'active',
      lowBalanceThreshold: 5000,
      totalRecharged: 0,
      totalSpent: 0,
      totalRefunded: 0,
    }
  })

  return sendSuccess(res, { data: fullWalletsList })
})

/** PATCH /api/admin/enterprise-wallets/:enterpriseId/status - Freeze / Unfreeze company wallet */
export const toggleWalletFreezeStatus = asyncHandler(async (req, res) => {
  const { enterpriseId } = req.params
  const { status } = req.body // 'active' | 'frozen'

  if (!['active', 'frozen'].includes(status)) {
    return sendError(res, { message: 'Invalid wallet status', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  let wallet = await EnterpriseWallet.findOne({ enterpriseId })
  if (!wallet) {
    wallet = await EnterpriseWallet.create({ enterpriseId, balance: 0 })
  }

  wallet.status = status
  await wallet.save()

  await logAudit({
    adminId: req.user._id,
    action: `${status === 'frozen' ? 'Froze' : 'Unfroze'} Enterprise Wallet for ${enterpriseId}`,
    module: 'Admin Wallet Management',
    req,
  })

  return sendSuccess(res, {
    message: `Enterprise wallet status changed to ${status.toUpperCase()}`,
    data: wallet,
  })
})

/** POST /api/admin/enterprise-wallets/:enterpriseId/adjust - Admin Manual Credit / Debit Adjustment */
export const adjustEnterpriseWalletBalance = asyncHandler(async (req, res) => {
  const { enterpriseId } = req.params
  const { action, amount, reason } = req.body // action: 'credit' | 'debit'

  const numAmount = Number(amount)
  if (!numAmount || numAmount <= 0) {
    return sendError(res, { message: 'Enter a valid positive amount', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  if (!reason || !reason.trim()) {
    return sendError(res, { message: 'Reason for balance adjustment is required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  let wallet = await EnterpriseWallet.findOne({ enterpriseId })
  if (!wallet) {
    wallet = await EnterpriseWallet.create({ enterpriseId, balance: 0 })
  }

  if (action === 'debit' && wallet.balance < numAmount) {
    return sendError(res, {
      message: `Insufficient wallet balance. Available balance: ₹${wallet.balance}`,
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  if (action === 'credit') {
    wallet.balance += numAmount
    wallet.totalRecharged += numAmount
  } else {
    wallet.balance -= numAmount
    wallet.totalSpent += numAmount
  }
  wallet.lastTransactionAt = new Date()
  await wallet.save()

  const transactionId = `ADM-ADJ-${Date.now()}`
  const transaction = await EnterpriseWalletTransaction.create({
    transactionId,
    enterpriseId,
    amount: numAmount,
    type: action === 'credit' ? 'credit' : 'debit',
    status: 'success',
    paymentMethod: 'Wallet Adjustment',
    description: `Admin Adjustment (${action.toUpperCase()}): ${reason}`,
    balanceAfter: wallet.balance,
    referenceNumber: `ADM-${req.user._id}`,
  })

  await logAudit({
    adminId: req.user._id,
    action: `Adjusted Enterprise Wallet (${action.toUpperCase()} ₹${numAmount})`,
    module: 'Admin Wallet Management',
    req,
  })

  return sendSuccess(res, {
    message: `Wallet balance ${action === 'credit' ? 'credited' : 'debited'} by ₹${numAmount} successfully`,
    data: { wallet, transaction },
  })
})

/** GET /api/admin/enterprise-wallets/transactions - Admin Master Transaction Log */
export const getAdminEnterpriseWalletTransactions = asyncHandler(async (req, res) => {
  const { startDate, endDate, type, status, search, page = 1, limit = 20 } = req.query
  const query = {}

  if (type && type !== 'all') query.type = type
  if (status && status !== 'all') query.status = status

  if (startDate || endDate) {
    query.createdAt = {}
    if (startDate) query.createdAt.$gte = new Date(startDate)
    if (endDate) query.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999))
  }

  if (search) {
    const q = search.trim()
    query.$or = [
      { transactionId: { $regex: q, $options: 'i' } },
      { referenceNumber: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
    ]
  }

  const skip = (Number(page) - 1) * Number(limit)
  const transactions = await EnterpriseWalletTransaction.find(query)
    .populate('enterpriseId', 'fullName email phone enterpriseProfile.companyName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean()

  const total = await EnterpriseWalletTransaction.countDocuments(query)

  return sendSuccess(res, {
    data: {
      transactions,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)) || 1,
      },
    },
  })
})
