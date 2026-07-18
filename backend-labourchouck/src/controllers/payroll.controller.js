import { payrollService } from '../services/payroll.service.js'
import { WageAssignment } from '../models/WageAssignment.js'
import { EarningsLedger } from '../models/EarningsLedger.js'
import { PayoutBatch } from '../models/PayoutBatch.js'
import { asyncHandler } from '../utils/asyncHandler.js'

export const setDailyWageRate = asyncHandler(async (req, res) => {
  const { labourId, projectId, dailyRate } = req.body
  const vendorId = req.user.id

  if (!labourId || !projectId || dailyRate === undefined) {
    return res.status(400).json({ success: false, message: 'Missing required fields' })
  }

  const rate = await payrollService.setDailyWageRate({
    vendorId,
    labourId,
    projectId,
    dailyRate: Number(dailyRate),
    setById: vendorId,
  })

  res.status(200).json({ success: true, rate })
})

export const getLabourProjectEarnings = asyncHandler(async (req, res) => {
  const { projectId } = req.params
  const labourId = req.user.id

  const activeRate = await WageAssignment.findOne({
    labourId,
    projectId,
    status: 'active',
  })

  const ledgers = await EarningsLedger.find({ labourId, projectId })
  
  const accruedAmount = ledgers.filter(l => l.status === 'accrued').reduce((acc, l) => acc + l.amount, 0)
  const pendingAmount = ledgers.filter(l => l.status === 'included_in_payout').reduce((acc, l) => acc + l.amount, 0)
  const paidAmount = ledgers.filter(l => l.status === 'paid').reduce((acc, l) => acc + l.amount, 0)

  // Find next expected payout date (simplification: +7 days from last paid or today)
  const nextPayoutDate = new Date()
  nextPayoutDate.setDate(nextPayoutDate.getDate() + 7)

  res.status(200).json({
    success: true,
    summary: {
      dailyRate: activeRate ? activeRate.dailyRate : 0,
      accruedAmount,
      pendingAmount,
      paidAmount,
      nextPayoutDate,
    },
    ledgers,
  })
})

export const getVendorPayoutBatches = asyncHandler(async (req, res) => {
  const vendorId = req.user.id
  const batches = await PayoutBatch.find({ vendorId }).sort({ createdAt: -1 }).populate('labourId', 'firstName lastName')
  res.status(200).json({ success: true, batches })
})

export const approvePayoutBatch = asyncHandler(async (req, res) => {
  const { batchId } = req.params
  const vendorId = req.user.id

  const result = await payrollService.approvePayoutBatch(vendorId, batchId)
  
  if (!result.success) {
    return res.status(400).json(result)
  }

  res.status(200).json({ success: true, message: 'Batch approved and funds transferred', batch: result.batch })
})
