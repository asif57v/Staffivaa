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
    // Revenue & Commission Config (Phase 2)
    revenueModel: {
      type: String,
      default: 'platform_fee_plus_commission',
    },
    commissionEnabled: {
      type: Boolean,
      default: true,
    },
    commissionType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage',
    },
    commissionValue: {
      type: Number,
      default: 5,
    },
    commissionTrigger: {
      type: String,
      enum: ['after_quotation_accepted', 'after_project_completed'],
      default: 'after_quotation_accepted',
    },
    commissionDueDays: {
      type: Number,
      default: 7,
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    supportEmail: {
      type: String,
      default: 'support@staffivaa.com',
    },
    // Dynamic Radius Module Config
    radiusConfig: {
      defaultVendorRadius: { type: Number, default: 15 },
      minVendorRadius: { type: Number, default: 5 },
      maxVendorRadius: { type: Number, default: 100 },
      defaultCorporateSearchRadius: { type: Number, default: 25 },
      allowUnlimitedRadius: { type: Boolean, default: true },
      enableRadiusMatching: { type: Boolean, default: true },
      enableRealtimeLocationUpdates: { type: Boolean, default: true },
      maxLocationAgeMinutes: { type: Number, default: 5 }
    }
  },
  { timestamps: true }
)

export const SystemSettings = mongoose.models.SystemSettings || mongoose.model('SystemSettings', systemSettingsSchema)
