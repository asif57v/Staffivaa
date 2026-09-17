import crypto from 'crypto'
import mongoose from 'mongoose'
import { razorpay } from '../config/razorpay.js'
import { User } from '../models/User.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { Withdrawal } from '../models/Withdrawal.js'
import { SystemSettings } from '../models/SystemSettings.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { triggerNotification } from '../utils/notificationTrigger.js'
import { emitToUser } from '../utils/socket.js'

import { paymentService } from '../services/paymentService.js'
import { logRazorpayVerifyAttempt } from '../utils/paymentLogger.js'

export const createAddMoneyOrder = asyncHandler(async (req, res) => {
  const amount = Number(req.body.amount)

  if (!Number.isFinite(amount) || amount < 10) {
    return res.status(400).json({ status: 'fail', message: 'Minimum amount is ₹10' })
  }

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return res.status(503).json({
      status: 'fail',
      message: 'Razorpay payment gateway is not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the server.',
    })
  }

  const idempotencyKey = req.body.idempotencyKey || req.headers['x-idempotency-key'] || null
  const { payment } = await paymentService.createOrGetPayment({
    userId: req.user._id,
    amount,
    currency: 'INR',
    purpose: 'WALLET_TOPUP',
    idempotencyKey,
    metadata: { role: req.user.role },
  })

  res.status(200).json({
    status: 'success',
    data: {
      orderId: payment.gatewayOrderId,
      systemOrderId: payment.orderId,
      amount: Math.round(payment.amount * 100),
      currency: payment.currency,
      key: process.env.RAZORPAY_KEY_ID,
      keyId: process.env.RAZORPAY_KEY_ID,
    },
  })
})

export const verifyAddMoneyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body

  logRazorpayVerifyAttempt({
    endpoint: '/wallet/razorpay/verify',
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    amount,
    userId: req.user?._id,
    purpose: 'WALLET_TOPUP',
  })

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !amount) {
    return res.status(400).json({ status: 'fail', message: 'Missing payment verification data' })
  }

  const isAuthentic = paymentService.verifyPaymentSignature({
    gatewayOrderId: razorpay_order_id,
    gatewayPaymentId: razorpay_payment_id,
    gatewaySignature: razorpay_signature,
  })

  if (!isAuthentic) {
    await paymentService.recordPaymentFailure({
      gatewayOrderId: razorpay_order_id,
      failureReason: 'Payment verification failed: Invalid signature',
    })
    return res.status(400).json({ status: 'fail', message: 'Payment verification failed: Invalid signature' })
  }

  // Idempotently process payment & credit wallet
  const result = await paymentService.processPaymentSuccess({
    gatewayOrderId: razorpay_order_id,
    gatewayPaymentId: razorpay_payment_id,
    paymentMethod: 'razorpay',
    source: 'frontend',
  })

  const user = await User.findById(req.user._id)
  if (!user) {
    return res.status(404).json({ status: 'fail', message: 'User not found' })
  }

  const transaction = await WalletTransaction.findOne({
    razorpayOrderId: razorpay_order_id,
  }).sort({ createdAt: -1 })

  res.status(200).json({
    status: 'success',
    message: result.alreadyProcessed
      ? 'Payment already verified and wallet updated'
      : 'Payment successful, wallet updated',
    data: {
      balance: user.walletBalance,
      transaction,
    },
  })
})

export const getWalletBalance = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('walletBalance bankAccountDetails upiDetails fullName phone email role')
  
  if (!user) {
    return res.status(404).json({ status: 'fail', message: 'User not found' })
  }

  const { type, startDate, endDate } = req.query
  const txnFilter = {
    $or: [{ payerId: user._id }, { labourId: user._id }],
    // Exclude admin revenue ledger duplicates (not worker wallet credits)
    source: { $nin: ['Labour Platform Fee', 'Lead Generation Platform Fee'] },
  }

  if (type === 'recharge') {
    txnFilter.type = 'Credit'
    txnFilter.source = { $regex: /add money|recharge/i }
  } else if (type === 'deduction') {
    txnFilter.type = 'Debit'
    txnFilter.platform_fee = true
  } else if (type === 'credit') {
    txnFilter.type = { $in: ['Credit', 'Refund'] }
  } else if (type === 'debit') {
    txnFilter.type = 'Debit'
  }

  if (startDate || endDate) {
    txnFilter.createdAt = {}
    if (startDate) txnFilter.createdAt.$gte = new Date(startDate)
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      txnFilter.createdAt.$lte = end
    }
  }

  const transactionsRaw = await WalletTransaction.find(txnFilter)
    .sort({ createdAt: -1 })
    .limit(100)
    .lean()

  const validBookingIds = [
    ...new Set(
      transactionsRaw
        .map((txn) => txn.bookingId)
        .filter((id) => id && mongoose.Types.ObjectId.isValid(String(id))),
    ),
  ]

  let bookingMap = new Map()
  if (validBookingIds.length > 0) {
    const bookings = await WorkforceRequest.find({ _id: { $in: validBookingIds } })
      .select('reference status')
      .lean()
    bookingMap = new Map(bookings.map((booking) => [String(booking._id), booking]))
  }

  const transactions = transactionsRaw.map((txn) => ({
    ...txn,
    bookingId:
      txn.bookingId && bookingMap.has(String(txn.bookingId))
        ? bookingMap.get(String(txn.bookingId))
        : txn.bookingId,
  }))

  const settingsDoc = await SystemSettings.findOne({ singletonId: 'SYSTEM_SETTINGS' })
    .select('minimumLabourWalletBalance')
    .lean()

  const minimumRequired = settingsDoc?.minimumLabourWalletBalance ?? 0

  const pendingWithdrawals = await Withdrawal.find({
    requestedBy: user._id,
    status: { $in: ['Pending', 'Processing', 'Approved', 'Hold'] },
  })

  const completedWithdrawals = await Withdrawal.find({
    requestedBy: user._id,
    status: 'Completed',
  })

  const pendingBalance = pendingWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0)
  const totalWithdrawn = completedWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0)

  const lifetimeEarningsAgg = await WalletTransaction.aggregate([
    {
      $match: {
        $or: [{ payerId: user._id }, { labourId: user._id }],
        type: 'Credit',
        status: 'Completed',
        source: { $nin: ['Labour Platform Fee', 'Lead Generation Platform Fee'] },
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ])

  const lifetimeEarnings = lifetimeEarningsAgg[0]?.total || 0

  res.status(200).json({
    status: 'success',
    data: {
      balance: user.walletBalance || 0,
      availableBalance: user.walletBalance || 0,
      minimumLabourWalletBalance: minimumRequired,
      pendingBalance,
      totalWithdrawn,
      lifetimeEarnings,
      bankAccountDetails: user.bankAccountDetails || null,
      upiDetails: user.upiDetails || null,
      transactions,
    },
  })
})

export const requestWithdrawal = asyncHandler(async (req, res) => {
  const { amount, payoutType = 'bank_transfer', bankDetails, upiDetails, enterpriseId, jobId, payrollMonth } = req.body

  const numericAmount = Number(amount)
  if (!numericAmount || numericAmount < 100) {
    return res.status(400).json({ status: 'fail', message: 'Minimum withdrawal amount is ₹100' })
  }

  if (payoutType === 'bank_transfer') {
    if (!bankDetails || !bankDetails.accountNumber || !bankDetails.ifscCode || !bankDetails.accountHolderName) {
      return res.status(400).json({ status: 'fail', message: 'Incomplete bank details provided. Account Number, IFSC Code, and Holder Name are required.' })
    }
  } else if (payoutType === 'upi') {
    if (!upiDetails || !upiDetails.upiId || !upiDetails.accountHolderName) {
      return res.status(400).json({ status: 'fail', message: 'Incomplete UPI details provided. UPI ID and Holder Name are required.' })
    }
  } else {
    return res.status(400).json({ status: 'fail', message: 'Invalid payout type. Choose bank_transfer or upi.' })
  }

  const user = await User.findById(req.user._id)
  if (!user) {
    return res.status(404).json({ status: 'fail', message: 'User not found' })
  }

  const currentBalance = user.walletBalance || 0
  if (currentBalance < numericAmount) {
    return res.status(400).json({ status: 'fail', message: `Insufficient wallet balance. Your available balance is ₹${currentBalance.toLocaleString('en-IN')}.` })
  }

  // Double withdrawal protection check: ensure no active duplicate request within 30 seconds
  const recentDuplicate = await Withdrawal.findOne({
    requestedBy: user._id,
    amount: numericAmount,
    status: 'Pending',
    createdAt: { $gte: new Date(Date.now() - 30000) },
  })

  if (recentDuplicate) {
    return res.status(400).json({ status: 'fail', message: 'Duplicate withdrawal request detected. Please wait a moment.' })
  }

  // Update user default bank / UPI details for future convenience
  if (payoutType === 'bank_transfer') {
    user.bankAccountDetails = {
      accountNumber: bankDetails.accountNumber.trim(),
      ifscCode: bankDetails.ifscCode.trim().toUpperCase(),
      bankName: bankDetails.bankName ? bankDetails.bankName.trim() : 'Bank Account',
      accountHolderName: bankDetails.accountHolderName.trim(),
      isVerified: user.bankAccountDetails?.isVerified || false,
    }
  } else if (payoutType === 'upi') {
    user.upiDetails = {
      upiId: upiDetails.upiId.trim().toLowerCase(),
      accountHolderName: upiDetails.accountHolderName.trim(),
      isVerified: user.upiDetails?.isVerified || false,
    }
  }

  // Deduct from wallet balance atomically to lock funds
  const balanceBefore = currentBalance
  user.walletBalance = balanceBefore - numericAmount
  const balanceAfter = user.walletBalance
  await user.save()

  // Create withdrawal record
  const withdrawal = await Withdrawal.create({
    amount: numericAmount,
    payoutType,
    bankDetails: payoutType === 'bank_transfer' ? bankDetails : undefined,
    upiDetails: payoutType === 'upi' ? upiDetails : undefined,
    walletBalanceBefore: balanceBefore,
    walletBalanceAfter: balanceAfter,
    enterpriseId,
    jobId,
    payrollMonth,
    requestedBy: req.user._id,
    status: 'Pending',
  })

  // Create WalletTransaction ledger entry
  const transactionId = `WD-${user.role.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`
  await WalletTransaction.create({
    transactionId,
    payerId: req.user._id,
    userId: req.user._id,
    labourId: req.user._id,
    payerName: user.fullName || 'User',
    payerType: user.role,
    type: 'Withdrawal',
    source: `Wallet Withdrawal Request (${payoutType === 'upi' ? 'UPI' : 'Bank Transfer'})`,
    amount: numericAmount,
    balanceAfter,
    status: 'Pending',
    referenceModel: 'Withdrawal',
    referenceId: withdrawal._id,
  })

  // Trigger Notification to User
  triggerNotification({
    userId: user._id,
    title: 'Withdrawal Requested 💸',
    body: `Your withdrawal request of ₹${numericAmount.toLocaleString('en-IN')} has been submitted successfully and is pending Staffivaa Admin review.`,
    type: 'WITHDRAWAL_REQUESTED',
    relatedId: withdrawal._id,
    relatedModel: 'Withdrawal',
  }).catch((err) => console.error('[Notification Error]:', err.message))

  // Trigger Notification to Admin
  triggerNotification({
    userId: null, // Broadcast to admin room
    title: 'New Withdrawal Request',
    body: `${user.fullName || 'A user'} requested a withdrawal of ₹${numericAmount.toLocaleString('en-IN')}. Please review.`,
    type: 'WITHDRAWAL_REQUESTED',
    relatedId: withdrawal._id,
    relatedModel: 'Withdrawal',
  }).catch((err) => console.error('[Admin Notification Error]:', err.message))

  res.status(200).json({
    status: 'success',
    message: 'Withdrawal request submitted successfully',
    data: { withdrawal, walletBalance: user.walletBalance },
  })
})
