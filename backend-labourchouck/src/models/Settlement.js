import mongoose from 'mongoose'

const settlementSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
    },
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkforceRequest',
      required: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
    },
    milestone: {
      type: String,
      enum: ['advance', 'final', 'custom'],
      required: true,
    },
    status: {
      type: String,
      enum: ['payment_pending', 'settlement_pending', 'settlement_on_hold', 'settlement_completed'],
      default: 'settlement_pending',
    },
    holdReason: {
      type: String,
    },
    financials: {
      grossEarnings: { type: Number, default: 0 },
      platformFee: { type: Number, default: 0 },
      gst: { type: Number, default: 0 },
      otherDeductions: { type: Number, default: 0 },
      netSettlement: { type: Number, default: 0 },
    },
    timeline: {
      createdAt: { type: Date, default: Date.now },
      releasedAt: { type: Date },
    },
  },
  { timestamps: true }
)

export const Settlement = mongoose.model('Settlement', settlementSchema)
