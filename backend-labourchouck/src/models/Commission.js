import mongoose from 'mongoose'

const commissionSchema = new mongoose.Schema(
  {
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkforceRequest', required: true, index: true },
    quotationId: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorQuotation', required: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    
    quotationAmount: { type: Number, required: true },
    commissionType: { type: String, enum: ['percentage', 'fixed'], required: true },
    commissionValue: { type: Number, required: true },
    commissionAmount: { type: Number, required: true },
    
    status: {
      type: String,
      enum: ['generated', 'pending_payment', 'paid', 'overdue', 'waived'],
      default: 'generated',
      index: true
    },
    
    generatedAt: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    paidAt: { type: Date },
    waivedAt: { type: Date },
    
    paymentMethod: { type: String }, // 'razorpay', 'wallet', 'offline'
    transactionId: { type: String },
    paymentGatewayOrderId: { type: String },
    
    notes: { type: String, trim: true },
  },
  { timestamps: true }
)

commissionSchema.index({ vendorId: 1, status: 1 })
commissionSchema.index({ dueDate: 1, status: 1 }) // Useful for background jobs

export const Commission = mongoose.model('Commission', commissionSchema)
