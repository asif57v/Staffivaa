import mongoose from 'mongoose'

// Enterprise payment for one period (a day, or the hours of a day) of a daily/hourly admin-dispatch job
const enterpriseDirectPaymentSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'EnterpriseJob', required: true, index: true },
    enterpriseId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    salaryType: { type: String, enum: ['daily', 'hourly'], required: true },
    periodKey: { type: String, required: true }, // YYYY-MM-DD of the work day
    units: { type: Number, required: true, min: 1 }, // 1 for daily, hours for hourly
    rate: { type: Number, required: true }, // per worker per unit
    workersCount: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['paid'], default: 'paid' },
    paidAt: { type: Date, default: Date.now },
    walletTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'EnterpriseWalletTransaction' },
  },
  { timestamps: true }
)

// One payment per job per period: prevents double payment
enterpriseDirectPaymentSchema.index({ jobId: 1, periodKey: 1 }, { unique: true })

export const EnterpriseDirectPayment =
  mongoose.models.EnterpriseDirectPayment || mongoose.model('EnterpriseDirectPayment', enterpriseDirectPaymentSchema)
