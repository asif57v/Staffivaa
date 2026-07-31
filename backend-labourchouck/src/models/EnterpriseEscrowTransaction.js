import mongoose from 'mongoose'

const enterpriseEscrowTransactionSchema = new mongoose.Schema(
  {
    escrowNumber: {
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
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EnterpriseJoiningInvoice',
      required: true,
      index: true,
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EnterpriseApplication',
      required: true,
      index: true,
    },
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    amount: { type: Number, required: true },
    workerSalaryPool: { type: Number, required: true, default: 5000 }, // Worker's agreed salary, zero platform fee deducted
    platformRevenue: { type: Number, required: true, default: 1000 }, // Separate platform commission charged to enterprise
    gstAmount: { type: Number, required: true, default: 1080 }, // GST charged on transaction
    securedAt: { type: Date, default: Date.now },

    status: {
      type: String,
      enum: ['secured', 'released', 'refunded'],
      default: 'secured',
      index: true,
    },

    // Verification & Admin Actions
    adminVerifiedAt: { type: Date },
    adminVerifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    releasedAt: { type: Date },
    refundedAt: { type: Date },
    refundReason: { type: String },
    adminNotes: { type: String },
  },
  { timestamps: true }
)

export const EnterpriseEscrowTransaction = mongoose.model('EnterpriseEscrowTransaction', enterpriseEscrowTransactionSchema)
