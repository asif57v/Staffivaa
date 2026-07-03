import mongoose from 'mongoose'

const systemSettingsSchema = new mongoose.Schema(
  {
    singletonId: {
      type: String,
      default: 'SYSTEM_SETTINGS',
      unique: true,
      immutable: true,
    },
    otpProvider: {
      type: String,
      enum: ['twilio', 'msg91', 'mock'],
      default: 'mock',
    },
    paymentGateway: {
      type: String,
      enum: ['razorpay', 'stripe', 'mock'],
      default: 'razorpay',
    },
    enableVendorAutoAssignment: {
      type: Boolean,
      default: false,
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    supportEmail: {
      type: String,
      default: 'support@staffivaa.com',
    },
  },
  { timestamps: true }
)

export const SystemSettings = mongoose.models.SystemSettings || mongoose.model('SystemSettings', systemSettingsSchema)
