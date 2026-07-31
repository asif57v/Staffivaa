import mongoose from 'mongoose'

const enterpriseFinancialAuditLogSchema = new mongoose.Schema(
  {
    enterpriseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: [
        'wallet_recharge',
        'invoice_generated',
        'invoice_paid',
        'escrow_secured',
        'admin_verified',
        'joining_activated',
        'refund_issued',
        'payment_reminder_sent',
        'offer_expired',
        'manual_adjustment',
      ],
      required: true,
      index: true,
    },
    amount: { type: Number, default: 0 },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    relatedInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EnterpriseJoiningInvoice',
    },
    relatedApplicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EnterpriseApplication',
    },
    relatedEscrowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EnterpriseEscrowTransaction',
    },
    details: { type: mongoose.Schema.Types.Mixed },
    ipAddress: { type: String },
  },
  { timestamps: true }
)

export const EnterpriseFinancialAuditLog = mongoose.model('EnterpriseFinancialAuditLog', enterpriseFinancialAuditLogSchema)
