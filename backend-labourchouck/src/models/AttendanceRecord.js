import mongoose from 'mongoose'
import { ATTENDANCE_STATUS } from '../constants/workforceConstants.js'

const attendanceRecordSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      index: true,
    },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkforceRequest', index: true },
    enterpriseApplicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'EnterpriseApplication', index: true },
    enterpriseJobId: { type: mongoose.Schema.Types.ObjectId, ref: 'EnterpriseJob', index: true },
    enterpriseId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    corporateId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site' },
    shiftDate: { type: Date, required: true, index: true },
    checkInAt: Date,
    checkOutAt: Date,
    totalHours: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    attendanceStatus: {
      type: String,
      enum: Object.values(ATTENDANCE_STATUS),
      default: ATTENDANCE_STATUS.ABSENT,
    },
    projectStatus: {
      type: String,
      enum: ['assigned', 'working', 'completed'],
      default: 'assigned',
    },
    billableUnits: { type: Number, default: 0, min: 0 },
    verifiedBy: { type: String, enum: ['admin', 'vendor_supervisor', 'auto', 'labour'], default: 'labour' },
    verifiedAt: Date,
    notes: { type: String, trim: true, maxlength: 300 },
    status: {
      type: String,
      enum: ['not_checked_in', 'otp_pending', 'checked_in', 'completed'],
      default: 'not_checked_in',
    },
    otpVerified: { type: Boolean, default: false },
    workingHoursStartedAt: Date,
    workingHoursEndedAt: Date,
    totalWorkingMinutes: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid'],
      default: 'pending',
      index: true,
    },
    settledAt: Date,
    settledAmount: Number,
  },
  { timestamps: true },
)

attendanceRecordSchema.index({ shiftDate: 1, requestId: 1 })

export const AttendanceRecord = mongoose.model('AttendanceRecord', attendanceRecordSchema)
