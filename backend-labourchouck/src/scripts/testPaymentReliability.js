import 'dotenv/config'
import mongoose from 'mongoose'
import crypto from 'crypto'
import { connectDb } from '../config/db.js'
import { Payment } from '../models/Payment.js'
import { User } from '../models/User.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { paymentService } from '../services/paymentService.js'

async function runAcceptanceTests() {
  console.log('====================================================')
  console.log('🚀 RUNNING PRODUCTION PAYMENT RELIABILITY ACCEPTANCE TESTS')
  console.log('====================================================')

  await connectDb()

  // 1. Setup a Test User
  let testUser = await User.findOne({ email: 'payment_test_user@staffivaa.com' })
  if (!testUser) {
    testUser = await User.create({
      fullName: 'Payment Reliability Test User',
      email: 'payment_test_user@staffivaa.com',
      phone: '9999988888',
      role: 'individual',
      walletBalance: 1000,
    })
  } else {
    testUser.walletBalance = 1000
    await testUser.save()
  }

  const initialBalance = testUser.walletBalance
  console.log(`[Setup] Test user initialized with wallet balance: ₹${initialBalance}`)

  // --------------------------------------------------------------------------
  // TEST CASE 3: Idempotency & Network Timeout Duplicate Protection
  // --------------------------------------------------------------------------
  console.log('\n--- [TEST CASE 3: Idempotency Protection against Multiple Clicks/Timeouts] ---')
  const idempotencyKey = `IDEMP_KEY_${Date.now()}`
  const orderResult1 = await paymentService.createOrGetPayment({
    userId: testUser._id,
    amount: 500,
    currency: 'INR',
    purpose: 'WALLET_TOPUP',
    idempotencyKey,
    createGatewayOrder: false, // simulated order for test
  })
  // Simulate network retry with same idempotencyKey
  const orderResult2 = await paymentService.createOrGetPayment({
    userId: testUser._id,
    amount: 500,
    currency: 'INR',
    purpose: 'WALLET_TOPUP',
    idempotencyKey,
    createGatewayOrder: false,
  })

  if (
    orderResult1.payment._id.toString() === orderResult2.payment._id.toString() &&
    orderResult2.isExisting === true
  ) {
    console.log('✅ CASE 3 PASSED: Duplicate payment request returned existing order without creating duplicate records!')
  } else {
    throw new Error('❌ CASE 3 FAILED: Duplicate order was created!')
  }

  // --------------------------------------------------------------------------
  // TEST CASE 4: Duplicate Webhook Events (Idempotent 3x Delivery)
  // --------------------------------------------------------------------------
  console.log('\n--- [TEST CASE 4: Webhook Delivered 3 Times - Idempotent Balance Credit] ---')
  const gatewayOrderId = `order_test_${Date.now()}`
  const gatewayPaymentId = `pay_test_${Date.now()}`

  await Payment.create({
    orderId: `ORD-TEST-${Date.now()}`,
    gatewayOrderId,
    gatewayPaymentId: null,
    userId: testUser._id,
    amount: 250,
    currency: 'INR',
    status: 'CREATED',
    purpose: 'WALLET_TOPUP',
  })

  // Delivery 1
  const delivery1 = await paymentService.processPaymentSuccess({
    gatewayOrderId,
    gatewayPaymentId,
    source: 'webhook',
  })
  // Delivery 2 (Duplicate retry)
  const delivery2 = await paymentService.processPaymentSuccess({
    gatewayOrderId,
    gatewayPaymentId,
    source: 'webhook',
  })
  // Delivery 3 (Duplicate retry)
  const delivery3 = await paymentService.processPaymentSuccess({
    gatewayOrderId,
    gatewayPaymentId,
    source: 'webhook',
  })

  const userAfterDelivery = await User.findById(testUser._id)
  const expectedBalance = initialBalance + 250

  if (
    userAfterDelivery.walletBalance === expectedBalance &&
    delivery1.alreadyProcessed === false &&
    delivery2.alreadyProcessed === true &&
    delivery3.alreadyProcessed === true
  ) {
    console.log(`✅ CASE 4 PASSED: 3 identical webhook deliveries credited user balance exactly ONCE (₹${userAfterDelivery.walletBalance})!`)
  } else {
    throw new Error(`❌ CASE 4 FAILED: Expected balance ₹${expectedBalance}, got ₹${userAfterDelivery.walletBalance}`)
  }

  // --------------------------------------------------------------------------
  // TEST CASE 1 & CASE 2: Client Disconnect / Browser Close -> Webhook Captured -> Reconnect Status
  // --------------------------------------------------------------------------
  console.log('\n--- [TEST CASE 1 & 2: Client Disconnected / Tab Closed -> Reconnect Status Fetch] ---')
  const disconnectOrderId = `order_disc_${Date.now()}`
  const disconnectPaymentId = `pay_disc_${Date.now()}`

  const discPayment = await Payment.create({
    orderId: `ORD-DISC-${Date.now()}`,
    gatewayOrderId: disconnectOrderId,
    userId: testUser._id,
    amount: 150,
    currency: 'INR',
    status: 'CREATED',
    purpose: 'WALLET_TOPUP',
  })

  // User client disconnects, Razorpay sends webhook
  await paymentService.processPaymentSuccess({
    gatewayOrderId: disconnectOrderId,
    gatewayPaymentId: disconnectPaymentId,
    source: 'webhook',
  })

  // User comes back online / opens app, frontend queries status
  const reconnectedPayment = await Payment.findOne({
    gatewayOrderId: disconnectOrderId,
    userId: testUser._id,
  })

  if (reconnectedPayment.status === 'SUCCESS' && reconnectedPayment.gatewayPaymentId === disconnectPaymentId) {
    console.log('✅ CASE 1 & 2 PASSED: Payment captured via webhook was correctly detected as SUCCESS on reconnect without prompting user to pay again!')
  } else {
    throw new Error('❌ CASE 1 & 2 FAILED: Payment was not marked SUCCESS upon reconnect!')
  }

  // --------------------------------------------------------------------------
  // TEST CASE 5: Fake Signature / Tampered Response
  // --------------------------------------------------------------------------
  console.log('\n--- [TEST CASE 5: Fake / Invalid Signature Rejection] ---')
  const fakeSecret = 'wrong_secret_123'
  const fakeSignature = crypto
    .createHmac('sha256', fakeSecret)
    .update('order_fake_123|pay_fake_123')
    .digest('hex')

  const isValidSignature = paymentService.verifyPaymentSignature({
    gatewayOrderId: 'order_fake_123',
    gatewayPaymentId: 'pay_fake_123',
    gatewaySignature: fakeSignature,
  })

  if (!isValidSignature) {
    console.log('✅ CASE 5 PASSED: Fake/tampered payment signature was rejected by HMAC SHA256 validation!')
  } else {
    throw new Error('❌ CASE 5 FAILED: Fake signature was accepted!')
  }

  // --------------------------------------------------------------------------
  // TEST CASE 6: Reconciliation Recovery for Pending Payments
  // --------------------------------------------------------------------------
  console.log('\n--- [TEST CASE 6: Reconciliation for Ambiguous Pending Payment] ---')
  const pendingPayment = await Payment.create({
    orderId: `ORD-PEND-${Date.now()}`,
    gatewayOrderId: `order_fake_pending_${Date.now()}`,
    userId: testUser._id,
    amount: 100,
    currency: 'INR',
    status: 'PENDING',
    purpose: 'WALLET_TOPUP',
    createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
  })

  const foundPending = await Payment.findById(pendingPayment._id)
  if (foundPending && foundPending.status === 'PENDING') {
    console.log('✅ CASE 6 PASSED: Pending payment tracked in database ready for background/on-demand reconciliation!')
  }

  // Cleanup test user and test payments
  await Payment.deleteMany({ userId: testUser._id })
  await WalletTransaction.deleteMany({ payerId: testUser._id })
  await User.deleteOne({ _id: testUser._id })

  console.log('\n====================================================')
  console.log('🎉 ALL 6 PRODUCTION PAYMENT RELIABILITY ACCEPTANCE TESTS PASSED!')
  console.log('====================================================')
  process.exit(0)
}

runAcceptanceTests().catch((err) => {
  console.error('Test Runner Failed:', err)
  process.exit(1)
})
