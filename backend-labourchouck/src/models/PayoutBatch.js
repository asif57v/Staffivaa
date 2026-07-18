import mongoose from 'mongoose'

const payoutBatchSchema = new mongoose.Schema(
  {
    labourId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending_approval', 'insufficient_funds', 'approved', 'paid'],
      default: 'pending_approval',
      index: true,
    },
    approvedAt: {
      type: Date,
    },
    paidAt: {
      type: Date,
    },
  },
  { timestamps: true }
)

payoutBatchSchema.index({ vendorId: 1, status: 1 })
payoutBatchSchema.index({ labourId: 1, projectId: 1 })

export const PayoutBatch = mongoose.models.PayoutBatch || mongoose.model('PayoutBatch', payoutBatchSchema)
