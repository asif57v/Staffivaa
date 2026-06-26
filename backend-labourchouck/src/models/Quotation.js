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
    labourWage: { type: Number, required: true, min: 0 },
    vendorServiceCharge: { type: Number, required: true, min: 0 },
    transportation: { type: Number, default: 0, min: 0 },
    accommodation: { type: Number, default: 0, min: 0 },
    food: { type: Number, default: 0, min: 0 },
    safetyEquipment: { type: Number, default: 0, min: 0 },
    otherCharges: { type: Number, default: 0, min: 0 },
    
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
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    }
  },
  { timestamps: true }
)

export const Quotation = mongoose.model('Quotation', quotationSchema)
