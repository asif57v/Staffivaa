import { User } from '../models/User.js'
import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'

/**
 * Atomically deduct amount from a user's wallet.
 * Returns { success, balanceAfter } or { success: false }.
 */
export async function deductWalletBalance({ userId, amount }) {
  const numericAmount = Number(amount)
  if (!numericAmount || numericAmount <= 0) {
    return { success: true, balanceAfter: null, amount: 0 }
  }

  const updated = await User.findOneAndUpdate(
    {
      _id: userId,
      isWalletFrozen: { $ne: true },
      walletBalance: { $gte: numericAmount },
    },
    { $inc: { walletBalance: -numericAmount } },
    { new: true, select: 'walletBalance fullName role' },
  )

  if (!updated) {
    return { success: false }
  }

  return {
    success: true,
    balanceAfter: updated.walletBalance || 0,
    amount: numericAmount,
    userName: updated.fullName,
    userRole: updated.role,
  }
}

/** Refund a prior wallet deduction (e.g. when booking accept fails after debit). */
export async function refundWalletBalance({ userId, amount }) {
  const numericAmount = Number(amount)
  if (!numericAmount || numericAmount <= 0) return

  await User.findByIdAndUpdate(userId, { $inc: { walletBalance: numericAmount } })
}

/** Record labour platform fee debit + credit admin platform wallet. */
export async function recordLabourPlatformFeeDeduction({
  userId,
  userName,
  bookingId,
  amount,
  balanceAfter,
}) {
  const numericAmount = Number(amount)
  if (!numericAmount || numericAmount <= 0) return null

  const txn = await WalletTransaction.create({
    transactionId: `LFEE-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    bookingId,
    payerId: userId,
    payerName: userName || 'Worker',
    payerType: 'labour',
    labourId: userId,
    platform_fee: true,
    type: 'Debit',
    source: 'Platform Fee Deduction',
    amount: numericAmount,
    balanceAfter,
    status: 'Completed',
    referenceModel: 'WorkforceRequest',
    referenceId: bookingId,
  })

  try {
    await Wallet.findOneAndUpdate(
      { singletonId: 'ADMIN_WALLET' },
      {
        $inc: {
          totalRevenue: numericAmount,
          totalCredits: numericAmount,
          totalPlatformRevenue: numericAmount,
          labourRevenue: numericAmount,
          platformEarnings: numericAmount,
        },
      },
      { upsert: true },
    )

    await WalletTransaction.create({
      transactionId: `TXN-LFEE-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      bookingId,
      payerType: 'system',
      platform_fee: true,
      type: 'Credit',
      source: 'Labour Platform Fee',
      amount: numericAmount,
      status: 'Completed',
      referenceModel: 'WorkforceRequest',
      referenceId: bookingId,
    })
  } catch (err) {
    console.error('[Wallet] Admin ledger update failed for labour platform fee:', err.message)
  }

  return txn
}
