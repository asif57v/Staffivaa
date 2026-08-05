import mongoose from 'mongoose'

const withdrawalSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    payoutType: {
      type: String,
      enum: ['bank_transfer', 'upi'],
      default: 'bank_transfer',
    },
    status: {
      type: String,
      required: true,
      enum: ['Pending', 'Processing', 'Approved', 'Completed', 'Rejected', 'Hold'],
      default: 'Pending',
    },
    bankDetails: {
      accountNumber: String,
      ifscCode: String,
      bankName: String,
      accountHolderName: String,
    },
    upiDetails: {
      upiId: String,
      accountHolderName: String,
    },
    utrNumber: {
      type: String,
    },
    rejectionReason: {
      type: String,
    },
    adminNotes: {
      type: String,
    },
    walletBalanceBefore: {
      type: Number,
    },
    walletBalanceAfter: {
      type: Number,
    },
    enterpriseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EnterpriseJob',
    },
    payrollMonth: {
      type: String,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
  },
  { timestamps: true }
)

export const Withdrawal = mongoose.models.Withdrawal || mongoose.model('Withdrawal', withdrawalSchema)
