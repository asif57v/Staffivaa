import mongoose from 'mongoose'

const walletTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkforceRequest',
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    labourId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    payerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    payerName: {
      type: String,
    },
    payerType: {
      type: String,
      enum: ['user', 'labour', 'vendor', 'corporate', 'system'],
    },
    platform_fee: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      required: true,
      enum: ['Credit', 'Debit', 'Refund', 'Settlement', 'Commission', 'Withdrawal'],
    },
    source: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['Pending', 'Completed', 'Failed'],
      default: 'Completed',
    },
    razorpayOrderId: {
      type: String,
    },
    razorpayPaymentId: {
      type: String,
    },
  },
  { timestamps: true }
)

export const WalletTransaction = mongoose.models.WalletTransaction || mongoose.model('WalletTransaction', walletTransactionSchema)
