import mongoose from 'mongoose'

const refundRequestSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkforceRequest',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userRole: {
      type: String,
      enum: ['user', 'labour', 'corporate', 'contractor', 'vendor'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentTransactionId: {
      type: String,
      required: true,
    },
    cancellationReason: {
      type: String,
      default: 'Timeout/Incomplete dual payment',
    },
    status: {
      type: String,
      enum: ['ELIGIBLE', 'PENDING', 'APPROVED', 'REJECTED'],
      default: 'ELIGIBLE',
      index: true,
    },
    adminNote: {
      type: String,
    },
    requestedAt: {
      type: Date,
    },
    processedAt: {
      type: Date,
    },
  },
  { timestamps: true },
)

export const RefundRequest = mongoose.models.RefundRequest || mongoose.model('RefundRequest', refundRequestSchema)
