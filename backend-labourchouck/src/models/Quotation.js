import mongoose from 'mongoose'

const quotationSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkforceRequest',
      required: true,
      index: true
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    // Vendor editable fields
    labourRatePerWorker: { type: Number, required: true, min: 0 },
    numberOfWorkers: { type: Number, required: true, min: 1 },
    workingDays: { type: Number, required: true, min: 1 },
    transportationCharges: { type: Number, default: 0, min: 0 },
    equipmentCharges: { type: Number, default: 0, min: 0 },
    foodCharges: { type: Number, default: 0, min: 0 },
    accommodationCharges: { type: Number, default: 0, min: 0 },
    otherCharges: { type: Number, default: 0, min: 0 },
    gstPercentage: { type: Number, default: 18, min: 0 },
    gst: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    notes: { type: String, trim: true },
    
    // Calculated fields
    labourCost: { type: Number, required: true, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },

    // Keep legacy fields for backward compatibility
    labourWage: { type: Number, min: 0 },
    vendorServiceCharge: { type: Number, min: 0 },
    transportation: { type: Number, min: 0 },
    accommodation: { type: Number, min: 0 },
    food: { type: Number, min: 0 },
    safetyEquipment: { type: Number, min: 0 },
    
    // Admin locks (Pricing snapshot at creation)
    pricingSnapshot: {
      platformFee: {
        type: { type: String },
        value: { type: Number },
        minFee: { type: Number },
        maxFee: { type: Number }
      },
      gst: {
        enabled: { type: Boolean },
        rate: { type: Number }
      },
      settlementRules: {
        corporateSettlementCycle: { type: String },
        vendorSettlementDelay: { type: Number },
        labourSalaryCycle: { type: String }
      }
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'under_review', 'revision_requested', 'revised', 'approved', 'rejected', 'expired', 'pending'],
      default: 'draft'
    },
    feedback: { type: String, trim: true },
    revisions: [mongoose.Schema.Types.Mixed]
  },
  { timestamps: true }
)

export const Quotation = mongoose.model('Quotation', quotationSchema)

