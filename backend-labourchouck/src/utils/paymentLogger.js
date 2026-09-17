/**
 * Payment Logger Utility for Razorpay & UPI QR Transactions
 * Formats and prints distinct, highlighted log blocks in terminal and records audit trails.
 */

export function logRazorpayPaymentSuccess({
  orderId,
  paymentId,
  amount,
  currency = 'INR',
  method,
  vpa,
  contact,
  email,
  rrn,
  purpose,
  userId,
  userName,
  userPhone,
  userRole,
  source = 'frontend_verification',
  timestamp = new Date(),
  alreadyProcessed = false,
}) {
  const isUpiOrQr =
    method === 'upi' ||
    Boolean(vpa) ||
    (typeof method === 'string' && method.toLowerCase().includes('qr'))

  const modeBadge = isUpiOrQr
    ? '📱 [UPI QR CODE / SCAN & PAY]'
    : `💳 [${(method || 'CARD / NETBANKING').toUpperCase()}]`

  const divider = '='.repeat(74)
  const subDivider = '-'.repeat(74)

  console.log('\n' + divider)
  console.log(`✅ [PAYMENT SUCCESS] Razorpay Transaction Verified`)
  console.log(`   ${modeBadge}${alreadyProcessed ? ' (Already Processed)' : ''}`)
  console.log(subDivider)
  console.log(`📌 Gateway Order ID  : ${orderId || 'N/A'}`)
  console.log(`🆔 Payment ID        : ${paymentId || 'N/A'}`)
  console.log(`💰 Amount Received   : ₹${Number(amount || 0).toLocaleString('en-IN')} ${currency}`)
  console.log(`💳 Payment Method    : ${method || (isUpiOrQr ? 'upi' : 'razorpay')}`)

  if (isUpiOrQr) {
    console.log(`📱 UPI VPA / Handle  : ${vpa || 'Paid via UPI QR'}`)
  }
  if (rrn) {
    console.log(`🏦 Acquirer RRN (Ref): ${rrn}`)
  }
  if (contact || userPhone) {
    console.log(`📞 Payer Phone       : ${contact || userPhone}`)
  }
  if (email) {
    console.log(`📧 Payer Email       : ${email}`)
  }
  console.log(`🎯 Payment Purpose   : ${purpose || 'WALLET_TOPUP'}`)
  if (userId) {
    const userInfo = [userName, userRole ? `Role: ${userRole}` : null].filter(Boolean).join(' | ')
    console.log(`👤 Customer / User   : ${userId} ${userInfo ? `(${userInfo})` : ''}`)
  }
  console.log(`🌐 Verification Via  : ${source}`)
  console.log(`⏰ Timestamp         : ${new Date(timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)`)
  console.log(divider + '\n')
}

export function logRazorpayPaymentFailure({
  orderId,
  paymentId,
  amount,
  currency = 'INR',
  reason,
  source = 'frontend',
  userId,
  timestamp = new Date(),
}) {
  const divider = '='.repeat(74)
  const subDivider = '-'.repeat(74)

  console.log('\n' + divider)
  console.log(`❌ [PAYMENT FAILED / REJECTED] Razorpay Payment Event`)
  console.log(subDivider)
  if (orderId) console.log(`📌 Gateway Order ID  : ${orderId}`)
  if (paymentId) console.log(`🆔 Payment ID        : ${paymentId}`)
  if (amount) console.log(`💰 Attempted Amount  : ₹${Number(amount).toLocaleString('en-IN')} ${currency}`)
  console.log(`⚠️ Failure Reason    : ${reason || 'Payment verification failed'}`)
  if (userId) console.log(`👤 User ID           : ${userId}`)
  console.log(`🌐 Verification Via  : ${source}`)
  console.log(`⏰ Timestamp         : ${new Date(timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)`)
  console.log(divider + '\n')
}

export function logRazorpayVerifyAttempt({
  orderId,
  paymentId,
  amount,
  userId,
  purpose,
  endpoint,
}) {
  console.log(
    `🔍 [Payment Verify Inbound] Endpoint: ${endpoint || 'verify'} | Order: ${orderId || 'N/A'} | Payment: ${paymentId || 'N/A'} | Amount: ₹${amount || 'N/A'} | User: ${userId || 'N/A'}`
  )
}

export function logRazorpayWebhookEvent({
  event,
  orderId,
  paymentId,
  amount,
  method,
  vpa,
}) {
  const isQr = method === 'upi' || Boolean(vpa)
  console.log(
    `🔔 [Razorpay Webhook Event] ${event} | Order: ${orderId || 'N/A'} | Payment: ${paymentId || 'N/A'} | Method: ${method || 'N/A'}${isQr ? ' (UPI QR/App)' : ''} | Amount: ₹${amount ? amount / 100 : 'N/A'}`
  )
}
