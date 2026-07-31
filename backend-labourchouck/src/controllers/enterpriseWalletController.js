import crypto from 'crypto'
import { EnterpriseWallet } from '../models/EnterpriseWallet.js'
import { EnterpriseWalletTransaction } from '../models/EnterpriseWalletTransaction.js'
import { razorpay } from '../config/razorpay.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { USER_ROLES } from '../constants/roles.js'
import { logAudit } from '../utils/auditLogger.js'

/** GET /api/enterprise/wallet/summary - Get wallet summary & balance */
export const getEnterpriseWalletSummary = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  // Find or auto-initialize Enterprise Wallet
  let wallet = await EnterpriseWallet.findOne({ enterpriseId: req.user._id })
  if (!wallet) {
    wallet = await EnterpriseWallet.create({
      enterpriseId: req.user._id,
      balance: 0,
    })
  }

  // Calculate live financial summary metrics
  const lastTransaction = await EnterpriseWalletTransaction.findOne({ enterpriseId: req.user._id })
    .sort({ createdAt: -1 })
    .lean()

  const pendingTransactions = await EnterpriseWalletTransaction.find({
    enterpriseId: req.user._id,
    status: 'pending',
  }).lean()

  const pendingPaymentsAmount = pendingTransactions.reduce((acc, curr) => acc + (curr.amount || 0), 0)

  const isLowBalance = wallet.balance < (wallet.lowBalanceThreshold || 5000)

  return sendSuccess(res, {
    data: {
      walletId: wallet._id,
      balance: wallet.balance,
      status: wallet.status,
      lowBalanceThreshold: wallet.lowBalanceThreshold,
      isLowBalance,
      totalRecharged: wallet.totalRecharged,
      totalSpent: wallet.totalSpent,
      totalRefunded: wallet.totalRefunded,
      pendingPaymentsCount: pendingTransactions.length,
      pendingPaymentsAmount,
      lastRechargeAt: wallet.lastRechargeAt,
      lastTransactionAt: wallet.lastTransactionAt || lastTransaction?.createdAt,
      lastTransaction,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    },
  })
})

/** POST /api/enterprise/wallet/recharge/init - Create Razorpay Order */
export const createRechargeOrder = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const { amount } = req.body
  const numAmount = Number(amount)

  if (!numAmount || numAmount < 100) {
    return sendError(res, { message: 'Minimum recharge amount is ₹100', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const wallet = await EnterpriseWallet.findOne({ enterpriseId: req.user._id })
  if (wallet?.status === 'frozen') {
    return sendError(res, {
      message: 'Your Enterprise Wallet is currently frozen by Admin. Contact support.',
      statusCode: HTTP_STATUS.FORBIDDEN,
    })
  }

  const receiptId = `RCPT_ENT_${Date.now()}`
  const options = {
    amount: Math.round(numAmount * 100), // Razorpay amount in paise
    currency: 'INR',
    receipt: receiptId,
    notes: {
      enterpriseId: String(req.user._id),
      companyName: req.user.enterpriseProfile?.companyName || req.user.fullName || 'Enterprise',
      purpose: 'Wallet Recharge',
    },
  }

  const order = await razorpay.orders.create(options)
  const transactionId = `ENT-TXN-${Date.now()}`

  // Create pending transaction record
  await EnterpriseWalletTransaction.create({
    transactionId,
    enterpriseId: req.user._id,
    amount: numAmount,
    type: 'recharge',
    status: 'pending',
    paymentMethod: 'Razorpay',
    description: 'Enterprise Wallet Recharge via Razorpay',
    razorpayOrderId: order.id,
    referenceNumber: receiptId,
  })

  return sendSuccess(res, {
    message: 'Recharge order created successfully',
    data: {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      transactionId,
      companyName: req.user.enterpriseProfile?.companyName || req.user.fullName,
      email: req.user.email,
      phone: req.user.phone,
    },
  })
})

/** POST /api/enterprise/wallet/recharge/verify - Verify Razorpay signature & credit wallet */
export const verifyRechargePayment = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentMethod } = req.body

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return sendError(res, { message: 'Incomplete payment parameters', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Signature verification using HMAC SHA256
  const generatedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex')

  const isSignatureValid = crypto.timingSafeEqual(
    Buffer.from(generatedSignature, 'hex'),
    Buffer.from(razorpay_signature, 'hex')
  )

  const transaction = await EnterpriseWalletTransaction.findOne({ razorpayOrderId: razorpay_order_id })
  if (!transaction) {
    return sendError(res, { message: 'Transaction record not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (!isSignatureValid) {
    transaction.status = 'failed'
    transaction.gatewayResponse = { error: 'Invalid payment signature' }
    await transaction.save()
    return sendError(res, { message: 'Payment signature verification failed', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Credit Wallet
  let wallet = await EnterpriseWallet.findOne({ enterpriseId: req.user._id })
  if (!wallet) {
    wallet = await EnterpriseWallet.create({ enterpriseId: req.user._id, balance: 0 })
  }

  wallet.balance += transaction.amount
  wallet.totalRecharged += transaction.amount
  wallet.lastRechargeAt = new Date()
  wallet.lastTransactionAt = new Date()
  await wallet.save()

  // Update Transaction Record
  transaction.status = 'success'
  transaction.razorpayPaymentId = razorpay_payment_id
  transaction.razorpaySignature = razorpay_signature
  transaction.paymentMethod = paymentMethod || 'Razorpay'
  transaction.balanceAfter = wallet.balance
  transaction.gatewayResponse = { status: 'captured', paymentId: razorpay_payment_id }
  await transaction.save()

  await logAudit({
    adminId: req.user._id,
    action: `Wallet Recharged by ₹${transaction.amount}`,
    module: 'Enterprise Wallet',
    req,
  })

  return sendSuccess(res, {
    message: `₹${transaction.amount.toLocaleString('en-IN')} added to wallet successfully!`,
    data: {
      balance: wallet.balance,
      transaction,
    },
  })
})

/** GET /api/enterprise/wallet/transactions - List wallet transactions with filters */
export const getEnterpriseWalletTransactions = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const { startDate, endDate, type, status, search, page = 1, limit = 20 } = req.query
  const query = { enterpriseId: req.user._id }

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

/** GET /api/enterprise/wallet/transactions/:id - Transaction Detail */
export const getTransactionDetails = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const transaction = await EnterpriseWalletTransaction.findOne({
    _id: req.params.id,
    enterpriseId: req.user._id,
  }).populate('enterpriseId', 'fullName enterpriseProfile.companyName email phone')

  if (!transaction) {
    return sendError(res, { message: 'Transaction not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  return sendSuccess(res, { data: transaction })
})

/** GET /api/enterprise/wallet/statement - Export Wallet Statement */
export const downloadWalletStatement = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const { period, startDate, endDate } = req.query
  const query = { enterpriseId: req.user._id }

  const now = new Date()
  if (period === 'current_month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    query.createdAt = { $gte: firstDay, $lte: now }
  } else if (period === 'last_month') {
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
    query.createdAt = { $gte: firstDayLastMonth, $lte: lastDayLastMonth }
  } else if (startDate || endDate) {
    query.createdAt = {}
    if (startDate) query.createdAt.$gte = new Date(startDate)
    if (endDate) query.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999))
  }

  const transactions = await EnterpriseWalletTransaction.find(query).sort({ createdAt: -1 }).lean()

  // Generate CSV Header & Rows
  const csvHeaders = 'Transaction ID,Date,Description,Type,Amount (INR),Balance After (INR),Status,Payment Method,Ref Number\n'
  const csvRows = transactions
    .map(
      (t) =>
        `"${t.transactionId}","${new Date(t.createdAt).toLocaleString('en-IN')}","${t.description || ''}","${t.type}","${t.amount}","${t.balanceAfter || 0}","${t.status}","${t.paymentMethod || ''}","${t.referenceNumber || ''}"`
    )
    .join('\n')

  const csvContent = csvHeaders + csvRows

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename=Staffivaa_Wallet_Statement_${Date.now()}.csv`)
  return res.status(200).send(csvContent)
})
