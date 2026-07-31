import mongoose from 'mongoose'

const enterpriseWalletTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    enterpriseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'recharge',
        'joining_payment',
        'invoice_payment',
        'payroll_payment',
        'refund',
        'adjustment',
        'debit',
        'credit',
      ],
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['success', 'pending', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },
    paymentMethod: {
      type: String,
      default: 'Razorpay', // Razorpay, UPI, Credit Card, Debit Card, Net Banking, Wallet Adjustment
    },
    description: {
      type: String,
      trim: true,
    },
    balanceAfter: {
      type: Number,
      default: 0,
    },
    referenceNumber: {
      type: String,
      trim: true,
    },
    razorpayOrderId: {
      type: String,
      trim: true,
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
    },
    razorpaySignature: {
      type: String,
      trim: true,
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
    },
    metaData: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
)

export const EnterpriseWalletTransaction =
  mongoose.models.EnterpriseWalletTransaction ||
  mongoose.model('EnterpriseWalletTransaction', enterpriseWalletTransactionSchema)
