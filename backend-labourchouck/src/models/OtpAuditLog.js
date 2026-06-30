import mongoose from 'mongoose'

const otpAuditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    attendanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AttendanceRecord',
      required: true,
      index: true,
    },
    otpAttempted: {
      type: String,
      required: true,
    },
    result: {
      type: String,
      enum: ['success', 'incorrect_otp', 'expired', 'not_found'],
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    ipAddress: String,
    userAgent: String,
  },
  { timestamps: true }
)

export const OtpAuditLog = mongoose.model('OtpAuditLog', otpAuditLogSchema)
