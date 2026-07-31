import mongoose from 'mongoose'

const enterpriseAttendanceSchema = new mongoose.Schema(
  {
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
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
    },
    
    // Check in/out data
    checkInTime: { type: Date },
    checkOutTime: { type: Date },
    
    // Status
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'half-day', 'leave'],
      required: true,
    },
    
    // Biometrics/Location Verification
    checkInLocation: {
      lat: Number,
      lng: Number,
      address: String
    },
    checkOutLocation: {
      lat: Number,
      lng: Number,
      address: String
    },
    
    // For QR or Face verification (Future Architecture)
    verificationMethod: {
      type: String,
      enum: ['manual', 'gps', 'otp', 'qr', 'face'],
      default: 'manual'
    },
    
    // Overtime
    overtimeHours: { type: Number, default: 0 },
    
    // Remarks
    notes: { type: String, trim: true },
  },
  { timestamps: true }
)

// Ensure only one attendance record per worker per day for a specific enterprise
enterpriseAttendanceSchema.index({ workerId: 1, date: 1, enterpriseId: 1 }, { unique: true })

export const EnterpriseAttendance = mongoose.model('EnterpriseAttendance', enterpriseAttendanceSchema)
