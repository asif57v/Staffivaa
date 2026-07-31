import mongoose from 'mongoose'

const enterpriseWalletSchema = new mongoose.Schema(
  {
    enterpriseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'frozen'],
      default: 'active',
    },
    lowBalanceThreshold: {
      type: Number,
      default: 5000,
    },
    totalRecharged: {
      type: Number,
      default: 0,
    },
    totalSpent: {
      type: Number,
      default: 0,
    },
    totalRefunded: {
      type: Number,
      default: 0,
    },
    lastRechargeAt: {
      type: Date,
    },
    lastTransactionAt: {
      type: Date,
    },
  },
  { timestamps: true }
)

export const EnterpriseWallet =
  mongoose.models.EnterpriseWallet || mongoose.model('EnterpriseWallet', enterpriseWalletSchema)
