import mongoose from 'mongoose'
import { ATTENDANCE_STATUS } from '../constants/workforceConstants.js'

const earningsLedgerSchema = new mongoose.Schema(
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
    date: {
      type: Date,
      required: true,
    },
    attendanceStatus: {
      type: String,
      enum: Object.values(ATTENDANCE_STATUS),
      required: true,
    },
    rateApplied: {
      type: Number,
      required: true,
      min: 0,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['accrued', 'included_in_payout', 'paid'],
      default: 'accrued',
      index: true,
    },
    payoutBatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PayoutBatch',
      default: null,
      index: true,
    },
    attendanceRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AttendanceRecord',
      required: true,
      unique: true,
    },
  },
  { timestamps: true }
)

// Ensure one ledger entry per attendance record
earningsLedgerSchema.index({ labourId: 1, projectId: 1, date: 1 }, { unique: true })

export const EarningsLedger = mongoose.models.EarningsLedger || mongoose.model('EarningsLedger', earningsLedgerSchema)
