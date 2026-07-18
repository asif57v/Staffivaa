import mongoose from 'mongoose'

// Subschemas representing the individual configuration blocks
const UserBookingPricingSchema = new mongoose.Schema({
  platformFee: {
    type: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    value: { type: Number, default: 10, min: 0 },
    minFee: { type: Number, default: 20, min: 0 },
    maxFee: { type: Number, default: 500, min: 0 }
  },
  convenienceFee: {
    enabled: { type: Boolean, default: true },
    amount: { type: Number, default: 20, min: 0 }
  },
  cancellation: {
    user: { type: Number, default: 50, min: 0 },
    labour: { type: Number, default: 100, min: 0 }
  },
  gst: {
    enabled: { type: Boolean, default: true },
    rate: { type: Number, default: 18, min: 0, max: 100 }
  }
}, { _id: false })

const CorporatePricingSchema = new mongoose.Schema({
  platformFee: {
    type: { type: String, enum: ['percentage', 'fixed', 'perWorker', 'perWorkerPerDay'], default: 'percentage' },
    value: { type: Number, default: 5, min: 0 },
    minFee: { type: Number, default: 0, min: 0 },
    maxFee: { type: Number, default: 0, min: 0 }
  },
  advancePercentage: { type: Number, default: 30, min: 0, max: 100 },
  paymentDueBeforeStartHours: { type: Number, enum: [24, 48, 72], default: 48 },
  autoReminder: { type: Boolean, default: true },
  settlementCycle: { type: String, enum: ['weekly', 'fortnightly', 'monthly'], default: 'weekly' },
  latePenalty: { type: Number, default: 2, min: 0, max: 100 },
  gst: {
    enabled: { type: Boolean, default: true },
    rate: { type: Number, default: 18, min: 0, max: 100 }
  }
}, { _id: false })

const VendorPricingSchema = new mongoose.Schema({
  registrationFee: { type: Number, default: 999, min: 0 },
  renewalFee: { type: Number, default: 999, min: 0 },
  platformCommission: {
    type: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    value: { type: Number, default: 2, min: 0 }
  },
  settlementProcessingFee: { type: Number, default: 0, min: 0 },
  withdrawalFee: { type: Number, default: 0, min: 0 },
  gst: {
    enabled: { type: Boolean, default: true },
    rate: { type: Number, default: 18, min: 0, max: 100 }
  }
}, { _id: false })

const LabourPricingSchema = new mongoose.Schema({
  verificationFee: { type: Number, default: 99, min: 0 },
  walletWithdrawalFee: { type: Number, default: 10, min: 0 },
  walletTransferFee: { type: Number, default: 5, min: 0 },
  platformFee: {
    type: { type: String, enum: ['percentage', 'fixed', 'distance'], default: 'fixed' },
    value: { type: Number, default: 20, min: 0 },
    slabs: {
      type: [{
        minDistance: { type: Number, default: 0, min: 0 },
        maxDistance: { type: Number, default: null },
        fee: { type: Number, default: 0, min: 0 }
      }],
      default: () => [
        { minDistance: 0, maxDistance: 2, fee: 20 },
        { minDistance: 2, maxDistance: 5, fee: 15 },
        { minDistance: 5, maxDistance: 10, fee: 10 },
        { minDistance: 10, maxDistance: 15, fee: 5 },
        { minDistance: 15, maxDistance: null, fee: 0 }
      ]
    }
  },
  gst: {
    enabled: { type: Boolean, default: true },
    rate: { type: Number, default: 18, min: 0, max: 100 }
  }
}, { _id: false })

const GSTSettingsSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true },
  percentage: { type: Number, default: 18, min: 0, max: 100 },
  gstNumber: { type: String, default: '29ABCDE1234F1Z5' },
  taxIncluded: { type: Boolean, default: false }
}, { _id: false })

const SettlementRulesSchema = new mongoose.Schema({
  corporateSettlementCycle: { type: String, enum: ['weekly', 'fortnightly', 'monthly'], default: 'weekly' },
  vendorSettlementDelay: { type: Number, enum: [3, 5, 7], default: 3 },
  labourSalaryCycle: { type: String, enum: ['weekly', '15 Days', 'monthly'], default: 'weekly' },
  minWithdrawal: { type: Number, default: 100, min: 0 },
  maxWithdrawal: { type: Number, default: 50000, min: 0 },
  approvalType: { type: String, enum: ['automatic', 'manual'], default: 'manual' }
}, { _id: false })

const pricingSettingsSchema = new mongoose.Schema(
  {
    // Singleton pattern
    singletonId: {
      type: String,
      default: 'SYSTEM_PRICING',
      unique: true,
      immutable: true
    },
    userBooking: { type: UserBookingPricingSchema, default: () => ({}) },
    corporate: { type: CorporatePricingSchema, default: () => ({}) },
    vendor: { type: VendorPricingSchema, default: () => ({}) },
    labour: { type: LabourPricingSchema, default: () => ({}) },
    gstSettings: { type: GSTSettingsSchema, default: () => ({}) },
    settlementRules: { type: SettlementRulesSchema, default: () => ({}) }
  },
  { timestamps: true }
)

export const SystemPricing = mongoose.model('SystemPricing', pricingSettingsSchema)
export { UserBookingPricingSchema, CorporatePricingSchema, VendorPricingSchema, LabourPricingSchema, GSTSettingsSchema, SettlementRulesSchema }
