import 'dotenv/config'
import { connectDb } from '../config/db.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { User } from '../models/User.js'

async function backfillNames() {
  await connectDb()
  console.log('[Backfill] Checking WalletTransaction records with missing payerName...')

  const transactions = await WalletTransaction.find({
    $or: [{ payerName: null }, { payerName: '' }, { payerName: { $exists: false } }],
  })

  console.log(`[Backfill] Found ${transactions.length} transactions needing name backfill.`)

  let updatedCount = 0

  for (const tx of transactions) {
    let resolvedName = null
    let resolvedId = tx.payerId || tx.labourId || tx.clientId || tx.userId

    // 1. If bookingId exists, check WorkforceRequest
    if (tx.bookingId) {
      const booking = await WorkforceRequest.findById(tx.bookingId)
        .populate('labourId', 'fullName')
        .populate('clientId', 'fullName companyName')
        .lean()

      if (booking) {
        if (tx.source?.toLowerCase().includes('labour') && booking.labourId?.fullName) {
          resolvedName = booking.labourId.fullName
          resolvedId = resolvedId || booking.labourId._id
        } else if (booking.clientId?.fullName || booking.clientId?.companyName) {
          resolvedName = booking.clientId.companyName || booking.clientId.fullName
          resolvedId = resolvedId || booking.clientId._id
        } else if (booking.labourId?.fullName) {
          resolvedName = booking.labourId.fullName
          resolvedId = resolvedId || booking.labourId._id
        }
      }
    }

    // 2. If still not resolved, check resolvedId
    if (!resolvedName && resolvedId) {
      const user = await User.findById(resolvedId).lean()
      if (user) {
        resolvedName = user.enterpriseProfile?.companyName || user.fullName || user.phone
      }
    }

    // 3. If transaction matches TXN-LFEE, it's a labour platform fee
    if (!resolvedName && tx.transactionId?.startsWith('TXN-LFEE') && tx.bookingId) {
      const booking = await WorkforceRequest.findById(tx.bookingId).populate('labourId', 'fullName').lean()
      if (booking?.labourId?.fullName) {
        resolvedName = booking.labourId.fullName
        resolvedId = resolvedId || booking.labourId._id
      }
    }

    if (resolvedName) {
      tx.payerName = resolvedName
      if (resolvedId && !tx.payerId) {
        tx.payerId = resolvedId
      }
      await tx.save()
      updatedCount++
    }
  }

  console.log(`[Backfill] Successfully updated ${updatedCount} transactions with resolved names!`)
  process.exit(0)
}

backfillNames().catch((err) => {
  console.error('[Backfill Error]:', err)
  process.exit(1)
})
