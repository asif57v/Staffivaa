import mongoose from 'mongoose'

const enterpriseJoiningInvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
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
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EnterpriseJob',
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

    // Milestone & Dynamic Fee Breakdowns (Admin Configured)
    invoiceType: {
      type: String,
      enum: ['advance_50', 'remaining_50', 'full'],
      default: 'advance_50',
      index: true,
    },
    totalProjectValue: { type: Number, required: true, default: 0 },
    advancePercentage: { type: Number, default: 50 },
    remainingPercentage: { type: Number, default: 50 },
    advanceAmount: { type: Number, required: true, default: 0 },
    remainingAmount: { type: Number, required: true, default: 0 },
    platformFeeType: { type: String, enum: ['fixed', 'percentage'], default: 'percentage' },
    platformFeeValue: { type: Number, default: 10 },
    platformFee: { type: Number, required: true, default: 0 },
    grossSubtotal: { type: Number, default: 0 },
    isGstApplied: { type: Boolean, default: true },
    gstRate: { type: Number, default: 18 },
    gstAmount: { type: Number, required: true, default: 0 },
    totalAmount: { type: Number, required: true, default: 0 },
    securityDeposit: { type: Number, required: true, default: 0 },

    parentInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EnterpriseJoiningInvoice',
    },
    joiningDate: { type: Date },
    projectDurationDays: { type: Number, default: 30 },

    // Due & Expiration Configured Dynamically
    invoiceDate: { type: Date, default: Date.now },
    configuredDueDays: { type: Number, default: 7 },
    configuredGracePeriodDays: { type: Number, default: 3 },
    dueDate: { type: Date, required: true },
    gracePeriodEndDate: { type: Date },
    extendedDueDate: { type: Date },
    overdueRestrictedAt: { type: Date },
    adminNotes: { type: String },

    status: {
      type: String,
      enum: ['payment_pending', 'paid', 'failed', 'overdue', 'cancelled', 'refunded'],
      default: 'payment_pending',
      index: true,
    },

    // Payment Tracking
    paidAt: { type: Date },
    paymentMethod: { type: String, default: 'enterprise_wallet' }, // enterprise_wallet, razorpay, split_wallet_razorpay
    walletAmountUsed: { type: Number, default: 0 },
    onlineAmountUsed: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },
    razorpayOrderId: { type: String, trim: true },
    razorpayPaymentId: { type: String, trim: true },
    razorpaySignature: { type: String, trim: true },
    walletTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EnterpriseWalletTransaction',
    },
    escrowTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EnterpriseEscrowTransaction',
    },
    paymentGatewayResponse: { type: mongoose.Schema.Types.Mixed },

    // Reminders & Expiration
    remindersSent: [
      {
        type: { type: String, enum: ['24h', '48h', '72h_expired'] },
        sentAt: { type: Date, default: Date.now },
      },
    ],
    expiredAt: { type: Date },
    failureReason: { type: String },
  },
  { timestamps: true }
)

export const EnterpriseJoiningInvoice = mongoose.model('EnterpriseJoiningInvoice', enterpriseJoiningInvoiceSchema)
