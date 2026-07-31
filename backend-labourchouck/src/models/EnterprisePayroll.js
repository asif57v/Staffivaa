import mongoose from 'mongoose'

const enterprisePayrollSchema = new mongoose.Schema(
  {
    enterpriseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EnterpriseJob',
      index: true,
    },
    escrowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EnterpriseEscrowTransaction',
      index: true,
    },
    
    // Period
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    // Attendance Breakdown
    totalWorkingDays: { type: Number, default: 26 },
    presentDays: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },
    halfDays: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    lateEntries: { type: Number, default: 0 },
    leaveDays: { type: Number, default: 0 },
    totalWorkingHours: { type: Number, default: 0 },
    
    // Financials & Breakdowns
    grossSalary: { type: Number, required: true }, // Agreed salary pool
    attendanceDeduction: { type: Number, default: 0 },
    overtimeBonus: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    otherDeductions: { type: Number, default: 0 },
    
    // Statutory Deductions (if enabled)
    pfDeduction: { type: Number, default: 0 },
    esicDeduction: { type: Number, default: 0 },
    ptDeduction: { type: Number, default: 0 }, // Professional Tax
    tdsDeduction: { type: Number, default: 0 },
    
    // Staffivaa Commission (Charged separately to Enterprise, NOT deducted from worker agreed salary)
    platformCommission: { type: Number, default: 0 },
    
    // Final Net Payable to Labour
    netSalary: { type: Number, required: true },
    
    // Lifecycle Governance Status
    status: {
      type: String,
      enum: ['draft', 'under_review', 'approved', 'on_hold', 'rejected', 'released', 'paid', 'failed'],
      default: 'draft',
      index: true,
    },
    
    // Admin Review & Release Audit Trail
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    releasedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    releasedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
    adminNotes: { type: String, trim: true },

    // Payment Details
    paymentReference: { type: String, trim: true },
    paidAt: { type: Date },
    walletTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction' },
    
    // Payslip Document URL
    payslipUrl: { type: String, trim: true }
  },
  { timestamps: true }
)

// Ensure one payroll per worker per month for a given enterprise
enterprisePayrollSchema.index({ workerId: 1, month: 1, year: 1, enterpriseId: 1 }, { unique: true })

export const EnterprisePayroll = mongoose.model('EnterprisePayroll', enterprisePayrollSchema)
