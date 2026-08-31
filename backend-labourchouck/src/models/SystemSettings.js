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
    // Dynamic Enterprise Payment Configuration (Admin Controlled)
    minimumEnterpriseSecurityBalance: {
      type: Number,
      default: 0,
    },
    isEnterpriseSecurityBalanceEnabled: {
      type: Boolean,
      default: false,
    },
    // Labour worker wallet — minimum balance required to accept bookings
    minimumLabourWalletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    advancePaymentPercentage: {
      type: Number,
      default: 0,
    },
    remainingPaymentPercentage: {
      type: Number,
      default: 100,
    },
    platformFeeType: {
      type: String,
      enum: ['fixed', 'percentage'],
      default: 'percentage',
    },
    platformFeeValue: {
      type: Number,
      default: 10,
    },
    isGstEnabled: {
      type: Boolean,
      default: true,
    },
    gstPercentage: {
      type: Number,
      default: 18,
    },
    paymentDueRule: {
      type: String,
      enum: ['before_joining', 'after_x_days', 'after_x_attendance_days', 'project_midpoint', 'project_completion'],
      default: 'before_joining',
    },
    advanceInvoiceDueDays: {
      type: Number,
      default: 7,
    },
    remainingInvoiceDueDays: {
      type: Number,
      default: 15,
    },
    remainingAttendanceDaysTrigger: {
      type: Number,
      default: 15,
    },
    enterpriseInvoiceDueDays: {
      type: Number,
      default: 15,
    },
    enterpriseInvoiceGracePeriodDays: {
      type: Number,
      default: 3,
    },
    reminderFrequencyHours: {
      type: Number,
      default: 24,
    },
    enableEnterpriseOverdueRestrictions: {
      type: Boolean,
      default: true,
    },
    restrictJobCreationOnOverdue: {
      type: Boolean,
      default: true,
    },
    restrictOfferSendOnOverdue: {
      type: Boolean,
      default: true,
    },
    freezeAccountOnOverdue: {
      type: Boolean,
      default: false,
    },
    blockAttendanceOnOverdue: {
      type: Boolean,
      default: false,
    },
    requireManualApprovalOnOverdue: {
      type: Boolean,
      default: true,
    },
    // Enterprise Job Timeline Configuration
    timelineConfig: {
      defaultApplicationWindowDays: { type: Number, default: 10 },
      defaultInterviewGapDays: { type: Number, default: 2 },
      defaultJoiningGapDays: { type: Number, default: 5 },
      defaultProjectDurationDays: { type: Number, default: 90 },
      advancePaymentDueBufferHours: { type: Number, default: 48 }, // 48h before expectedJoiningDate
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
    },
    // Enterprise Real-Time Job Notification Settings
    jobNotificationConfig: {
      enablePushNotifications: { type: Boolean, default: true },
      enableInAppNotifications: { type: Boolean, default: true },
      defaultNotificationRadiusKm: { type: Number, default: 50 },
      maxNotificationsPerWorkerPerDay: { type: Number, default: 20 },
      requireKycApprovedForJobNotifications: { type: Boolean, default: true },
    }
  },
  { timestamps: true }
)

export const SystemSettings = mongoose.models.SystemSettings || mongoose.model('SystemSettings', systemSettingsSchema)
