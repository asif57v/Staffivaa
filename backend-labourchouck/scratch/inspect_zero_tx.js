import 'dotenv/config'
import { connectDb } from '../src/config/db.js'
import { WalletTransaction } from '../src/models/WalletTransaction.js'
import { Payment } from '../src/models/Payment.js'
import { WorkforceRequest } from '../src/models/WorkforceRequest.js'

async function inspect() {
  await connectDb()
  console.log('Inspecting 0 amount transactions...')

  const zeroTxns = await WalletTransaction.find({ amount: 0 }).limit(10).lean()
  console.log(`Found ${zeroTxns.length} zero-amount transactions.`)

  for (const tx of zeroTxns) {
    console.log('\n----------------------------------------')
    console.log('Tx ID:', tx.transactionId)
    console.log('Booking ID:', tx.bookingId)
    console.log('Payer:', tx.payerName, 'PayerType:', tx.payerType)
    console.log('Source:', tx.source, 'Amount:', tx.amount)

    if (tx.bookingId) {
      const reqDoc = await WorkforceRequest.findById(tx.bookingId).lean()
      if (reqDoc) {
        console.log(' WorkforceRequest fields:', {
          reference: reqDoc.reference,
          userPlatformFee: reqDoc.userPlatformFee,
          labourPlatformFee: reqDoc.labourPlatformFee,
          vendorPlatformFeeAmount: reqDoc.vendorPlatformFeeAmount,
          userRazorpayOrderId: reqDoc.userRazorpayOrderId,
          labourRazorpayOrderId: reqDoc.labourRazorpayOrderId,
          userPaymentStatus: reqDoc.userPaymentStatus,
          labourPaymentStatus: reqDoc.labourPaymentStatus,
        })

        if (reqDoc.userRazorpayOrderId || reqDoc.labourRazorpayOrderId) {
          const pmts = await Payment.find({
            $or: [
              { gatewayOrderId: reqDoc.userRazorpayOrderId },
              { gatewayOrderId: reqDoc.labourRazorpayOrderId },
              { orderId: reqDoc.userRazorpayOrderId },
              { orderId: reqDoc.labourRazorpayOrderId },
            ]
          }).lean()
          console.log(' Matching Payment records count:', pmts.length)
          for (const p of pmts) {
            console.log('  Payment:', { id: p.orderId, gatewayOrderId: p.gatewayOrderId, amount: p.amount, status: p.status, purpose: p.purpose })
          }
        }
      }
    }
  }

  process.exit(0)
}

inspect().catch(err => {
  console.error('Inspection error:', err)
  process.exit(1)
})
