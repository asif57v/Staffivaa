import mongoose from 'mongoose'

const enterprisePayrollInvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    enterpriseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    payrollIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EnterprisePayroll',
    }],

    // Period
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    // Financial Breakdown
    totalWorkerSalary: { type: Number, required: true },   // Sum of all workers' net salaries
    platformCommission: { type: Number, default: 0 },      // Staffivaa's fee
    gstAmount: { type: Number, default: 0 },               // GST if applicable
    grandTotal: { type: Number, required: true },           // totalWorkerSalary + platformCommission + gst

    // Worker Details Summary
    workerCount: { type: Number, default: 0 },
    workerSummary: [{
      workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      workerName: String,
      netSalary: Number,
      payrollId: { type: mongoose.Schema.Types.ObjectId, ref: 'EnterprisePayroll' },
    }],

    // Payment Status Lifecycle
    status: {
      type: String,
      enum: ['payment_pending', 'paid', 'verified', 'salary_released', 'cancelled', 'overdue'],
      default: 'payment_pending',
      index: true,
    },

    // Payment Details (Razorpay / Wallet)
    paymentMethod: {
      type: String,
      enum: ['razorpay', 'enterprise_wallet', 'hybrid', 'offline_bank_transfer'],
    },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    walletAmountUsed: { type: Number, default: 0 },
    onlineAmountUsed: { type: Number, default: 0 },
    paidAt: { type: Date },

    // Due Date
    dueDate: { type: Date },
    gracePeriodEndDate: { type: Date },

    // Admin Trail
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },  // Admin who sent the request
    adminNotes: { type: String, trim: true },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date },
  },
  { timestamps: true }
)

// One invoice per enterprise per month
enterprisePayrollInvoiceSchema.index({ enterpriseId: 1, month: 1, year: 1 })

export const EnterprisePayrollInvoice = mongoose.model('EnterprisePayrollInvoice', enterprisePayrollInvoiceSchema)
