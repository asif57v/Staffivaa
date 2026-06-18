import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { Withdrawal } from '../models/Withdrawal.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess, sendError, HTTP_STATUS } from '../utils/apiResponse.js'

export const getWalletSummary = asyncHandler(async (req, res) => {
  let wallet = await Wallet.findOne({ singletonId: 'ADMIN_WALLET' })
  if (!wallet) {
    wallet = await Wallet.create({ singletonId: 'ADMIN_WALLET' })
  }
  
  // Aggregate credits and debits to ensure accurate totals if needed
  const totals = await WalletTransaction.aggregate([
    {
      $group: {
        _id: null,
        totalCredits: { $sum: { $cond: [{ $eq: ['$type', 'Credit'] }, '$amount', 0] } },
        totalDebits: { $sum: { $cond: [{ $in: ['$type', ['Debit', 'Withdrawal', 'Settlement', 'Refund']] }, '$amount', 0] } },
        totalRefunds: { $sum: { $cond: [{ $eq: ['$type', 'Refund'] }, '$amount', 0] } },
      }
    }
  ])

  const stats = totals[0] || { totalCredits: 0, totalDebits: 0, totalRefunds: 0 }
  
  sendSuccess(res, {
    data: {
      availableBalance: wallet.balance,
      totalRevenue: wallet.totalRevenue,
      pendingSettlements: wallet.pendingSettlements,
      platformEarnings: wallet.platformEarnings,
      userRevenue: wallet.userRevenue,
      labourRevenue: wallet.labourRevenue,
      vendorRevenue: wallet.vendorRevenue,
      corporateRevenue: wallet.corporateRevenue,
      totalCredits: stats.totalCredits,
      totalDebits: stats.totalDebits,
      totalRefunds: stats.totalRefunds,
    }
  })
})

export const getTransactions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, type, status, dateFrom, dateTo, search, payerType } = req.query
  const query = {}

  if (type) query.type = type
  if (status) query.status = status
  if (payerType) query.payerType = payerType
  
  if (dateFrom || dateTo) {
    query.createdAt = {}
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom)
    if (dateTo) {
      const end = new Date(dateTo)
      end.setHours(23, 59, 59, 999)
      query.createdAt.$lte = end
    }
  }

  if (search) {
    query.$or = [
      { transactionId: { $regex: search, $options: 'i' } },
      { source: { $regex: search, $options: 'i' } },
      { payerName: { $regex: search, $options: 'i' } },
      { razorpayPaymentId: { $regex: search, $options: 'i' } },
    ]
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)
  
  const transactions = await WalletTransaction.find(query)
    .populate('bookingId', 'title reference projectName')
    .populate('clientId', 'fullName email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean()

  const total = await WalletTransaction.countDocuments(query)

  sendSuccess(res, {
    data: {
      transactions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    }
  })
})

export const createWithdrawal = asyncHandler(async (req, res) => {
  const { amount, bankDetails } = req.body
  
  if (!amount || amount <= 0) {
    return sendError(res, { message: 'Invalid amount', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const wallet = await Wallet.findOne({ singletonId: 'ADMIN_WALLET' })
  if (!wallet || wallet.balance < amount) {
    return sendError(res, { message: 'Insufficient balance', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const withdrawal = await Withdrawal.create({
    amount,
    bankDetails,
    requestedBy: req.user._id,
    status: 'Pending'
  })

  // Deduct from wallet balance and create a transaction immediately as pending
  wallet.balance -= amount
  await wallet.save()

  await WalletTransaction.create({
    transactionId: `WD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type: 'Withdrawal',
    source: 'Admin Withdrawal',
    amount,
    status: 'Pending'
  })

  sendSuccess(res, { data: { withdrawal } })
})

export const getWithdrawals = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query
  const skip = (parseInt(page) - 1) * parseInt(limit)
  
  const withdrawals = await Withdrawal.find()
    .populate('requestedBy', 'fullName email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))

  const total = await Withdrawal.countDocuments()

  sendSuccess(res, {
    data: {
      withdrawals,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    }
  })
})

export const getReports = asyncHandler(async (req, res) => {
  const now = new Date()
  
  // Today
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  // Weekly
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0,0,0,0)

  // Monthly
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  
  // Yearly
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  const getRevenue = async (startDate) => {
    const result = await WalletTransaction.aggregate([
      { $match: { type: 'Credit', status: 'Completed', createdAt: { $gte: startDate } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])
    return result[0]?.total || 0
  }

  const todayRevenue = await getRevenue(startOfToday)
  const weeklyRevenue = await getRevenue(startOfWeek)
  const monthlyRevenue = await getRevenue(startOfMonth)
  const yearlyRevenue = await getRevenue(startOfYear)

  // Trend (last 6 months)
  const trend = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const mRev = await WalletTransaction.aggregate([
      { $match: { type: 'Credit', status: 'Completed', createdAt: { $gte: d, $lt: nextD } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])
    trend.push({
      name: d.toLocaleString('default', { month: 'short' }),
      revenue: mRev[0]?.total || 0
    })
  }

  // Credits vs Debits overall
  const overall = await WalletTransaction.aggregate([
    { $match: { status: 'Completed' } },
    { $group: { 
        _id: '$type', 
        total: { $sum: '$amount' } 
    }}
  ])

  let credits = 0
  let debits = 0
  overall.forEach(item => {
    if (item._id === 'Credit') credits += item.total
    else debits += item.total // Withdrawals, Settlements, Refunds
  })

  const creditsVsDebits = [
    { name: 'Credits', value: credits },
    { name: 'Debits', value: debits }
  ]

  // Revenue by Payer Type
  const payerBreakdown = await WalletTransaction.aggregate([
    { $match: { status: 'Completed', platform_fee: true } },
    { $group: {
        _id: '$payerType',
        total: { $sum: '$amount' }
    }}
  ])

  const revenueByPayerType = payerBreakdown.map(item => ({
    name: item._id ? item._id.charAt(0).toUpperCase() + item._id.slice(1) : 'Unknown',
    value: item.total
  }))

  sendSuccess(res, {
    data: {
      cards: {
        todayRevenue,
        weeklyRevenue,
        monthlyRevenue,
        yearlyRevenue
      },
      charts: {
        revenueTrend: trend,
        creditsVsDebits,
        revenueByPayerType
      }
    }
  })
})
