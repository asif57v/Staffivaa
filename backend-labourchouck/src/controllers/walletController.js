import crypto from 'crypto'
import { razorpay } from '../config/razorpay.js'
import { User } from '../models/User.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { asyncHandler } from '../utils/asyncHandler.js'

export const createAddMoneyOrder = asyncHandler(async (req, res) => {
  const { amount } = req.body

  if (!amount || amount < 10) {
    return res.status(400).json({ status: 'fail', message: 'Minimum amount is ₹10' })
  }

  const options = {
    amount: amount * 100, // Razorpay works in paise
    currency: 'INR',
    receipt: `receipt_${req.user._id}_${Date.now()}`,
  }

  const order = await razorpay.orders.create(options)

  res.status(200).json({
    status: 'success',
    data: {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    },
  })
})

export const verifyAddMoneyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !amount) {
    return res.status(400).json({ status: 'fail', message: 'Missing payment verification data' })
  }

  const body = razorpay_order_id + '|' + razorpay_payment_id

  const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(body.toString()).digest('hex')

  let isAuthentic = false;
  try {
    const generatedBuffer = Buffer.from(expectedSignature, 'hex');
    const providedBuffer = Buffer.from(razorpay_signature, 'hex');
    if (generatedBuffer.length === providedBuffer.length) {
      isAuthentic = crypto.timingSafeEqual(generatedBuffer, providedBuffer);
    }
  } catch (err) {
    isAuthentic = false;
  }

  if (!isAuthentic) {
    return res.status(400).json({ status: 'fail', message: 'Invalid payment signature' })
  }

  // Payment is successful, add money to wallet
  const user = await User.findById(req.user._id)
  
  if (!user) {
    return res.status(404).json({ status: 'fail', message: 'User not found' })
  }

  user.walletBalance = (user.walletBalance || 0) + amount
  await user.save()

  // Create WalletTransaction
  const transaction = await WalletTransaction.create({
    transactionId: razorpay_payment_id,
    payerId: user._id,
    payerName: user.fullName,
    payerType: 'user', // Can be user, labour, corporate, etc based on role. We can simplify by just using 'user'.
    type: 'Credit',
    source: 'Razorpay Add Money',
    amount: amount,
    status: 'Completed',
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
  })

  res.status(200).json({
    status: 'success',
    message: 'Payment successful, wallet updated',
    data: {
      balance: user.walletBalance,
      transaction,
    },
  })
})

export const getWalletBalance = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('walletBalance')
  
  if (!user) {
    return res.status(404).json({ status: 'fail', message: 'User not found' })
  }

  const transactions = await WalletTransaction.find({ payerId: user._id })
    .sort({ createdAt: -1 })
    .limit(20)

  res.status(200).json({
    status: 'success',
    data: {
      balance: user.walletBalance || 0,
      transactions,
    },
  })
})

export const requestWithdrawal = asyncHandler(async (req, res) => {
  const { amount, bankDetails } = req.body

  if (!amount || amount <= 0) {
    return res.status(400).json({ status: 'fail', message: 'Invalid withdrawal amount' })
  }

  if (!bankDetails || !bankDetails.accountNumber || !bankDetails.ifscCode || !bankDetails.accountHolderName) {
    return res.status(400).json({ status: 'fail', message: 'Incomplete bank details provided' })
  }

  const user = await User.findById(req.user._id)
  if (!user || (user.walletBalance || 0) < amount) {
    return res.status(400).json({ status: 'fail', message: 'Insufficient wallet balance' })
  }

  // Deduct from wallet balance
  user.walletBalance -= amount
  await user.save()

  // Create withdrawal record
  const { Withdrawal } = await import('../models/Withdrawal.js')
  const withdrawal = await Withdrawal.create({
    amount,
    bankDetails,
    requestedBy: req.user._id,
    status: 'Pending'
  })

  // Create WalletTransaction
  const transactionId = `WD-${user.role.substring(0, 3).toUpperCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  await WalletTransaction.create({
    transactionId,
    payerId: req.user._id,
    payerName: user.fullName || 'User',
    payerType: user.role,
    type: 'Withdrawal',
    source: 'Wallet Withdrawal Request',
    amount,
    status: 'Pending'
  })

  res.status(200).json({
    status: 'success',
    message: 'Withdrawal request submitted successfully',
    data: { withdrawal, walletBalance: user.walletBalance }
  })
})
