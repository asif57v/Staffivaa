import mongoose from 'mongoose'

const auditLogSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    previousValue: {
      type: mongoose.Schema.Types.Mixed,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
    },
    module: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    browser: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
)

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema)
