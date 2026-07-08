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

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest('hex')

  const isAuthentic = expectedSignature === razorpay_signature

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
