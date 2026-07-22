import mongoose from 'mongoose'

const walletSchema = new mongoose.Schema(
  {
    // A single document to act as the global admin wallet singleton
    singletonId: {
      type: String,
      default: 'ADMIN_WALLET',
      unique: true,
      immutable: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalRevenue: {
      type: Number,
      default: 0,
    },
    platformEarnings: {
      type: Number,
      default: 0,
    },
    pendingSettlements: {
      type: Number,
      default: 0,
      min: 0,
    },
    // The amount eligible for refund (e.g. from cancelled bookings where one party paid) that hasn't been approved or rejected yet.
    pendingRefundLiability: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCredits: {
      type: Number,
      default: 0,
    },
    totalDebits: {
      type: Number,
      default: 0,
    },
    totalPlatformRevenue: {
      type: Number,
      default: 0,
    },
    userRevenue: {
      type: Number,
      default: 0,
    },
    labourRevenue: {
      type: Number,
      default: 0,
    },
    vendorRevenue: {
      type: Number,
      default: 0,
    },
    corporateRevenue: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
)

export const Wallet = mongoose.models.Wallet || mongoose.model('Wallet', walletSchema)
