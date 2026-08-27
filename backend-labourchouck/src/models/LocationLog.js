import mongoose from 'mongoose'

const locationLogSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkforceRequest',
      required: true,
      index: true,
    },
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    heading: { type: Number, default: 0 },
    speed: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

// Automatically expire location trail breadcrumbs after 24 hours to prevent DB bloat
locationLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 })

export const LocationLog = mongoose.model('LocationLog', locationLogSchema)
