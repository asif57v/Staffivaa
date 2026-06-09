import mongoose from 'mongoose'
import { ATTENDANCE_STATUS } from '../constants/workforceConstants.js'

const attendanceRecordSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true,
      index: true,
    },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkforceRequest', required: true, index: true },
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    corporateId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site' },
    shiftDate: { type: Date, required: true, index: true },
    checkInAt: Date,
    checkOutAt: Date,
    totalHours: { type: Number, default: 0 },
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
  },
  { timestamps: true },
)

attendanceRecordSchema.index({ shiftDate: 1, requestId: 1 })

export const AttendanceRecord = mongoose.model('AttendanceRecord', attendanceRecordSchema)
