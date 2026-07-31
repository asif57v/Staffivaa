import mongoose from 'mongoose'
import { EnterprisePayroll } from '../models/EnterprisePayroll.js'
import { EnterpriseAttendance } from '../models/EnterpriseAttendance.js'
import { EnterpriseJob } from '../models/EnterpriseJob.js'
import { EnterpriseApplication } from '../models/EnterpriseApplication.js'
import { EnterpriseEscrowTransaction } from '../models/EnterpriseEscrowTransaction.js'
import { EnterpriseFinancialAuditLog } from '../models/EnterpriseFinancialAuditLog.js'
import { User } from '../models/User.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { USER_ROLES } from '../constants/roles.js'
import { emitToRole } from '../utils/socket.js'
import { triggerNotification } from '../utils/notificationTrigger.js'

// ─── Enterprise HR Controllers ──────────────────────────────────────────────

/** POST /api/enterprise/payroll/calculate - Automatically compute monthly payroll based on attendance logs */
export const calculateEnterpriseMonthlyPayroll = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const {
    workerId,
    jobId,
    month = new Date().getMonth() + 1,
    year = new Date().getFullYear(),
    bonus = 0,
    otherDeductions = 0,
    applyPf = false,
    applyEsic = false,
    applyPt = false,
    applyTds = false,
    tdsRate = 1,
  } = req.body

  if (!workerId || !month || !year) {
    return sendError(res, { message: 'Worker ID, Month, and Year are required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Verify worker exists and is engaged with this enterprise
  const worker = await User.findById(workerId)
  if (!worker) {
    return sendError(res, { message: 'Worker not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Find active employment / application or escrow to get agreed gross salary
  const application = await EnterpriseApplication.findOne({
    enterpriseId: req.user._id,
    workerId,
    status: { $in: ['joining_activated', 'completed', 'joining_pending'] },
  }).sort({ updatedAt: -1 })

  let escrow = null
  let grossSalary = 25000 // Default fallback if no salary found
  let platformCommission = 1000

  if (application && application.escrowId) {
    escrow = await EnterpriseEscrowTransaction.findById(application.escrowId)
    if (escrow && escrow.workerSalaryPool) {
      grossSalary = escrow.workerSalaryPool
      platformCommission = escrow.platformRevenue || 0
    }
  }

  if (req.body.customGrossSalary) {
    grossSalary = Number(req.body.customGrossSalary)
  }

  // Calculate month boundaries for attendance query
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59)

  // Fetch actual attendance logs for this worker under this enterprise for the month
  const attendanceLogs = await EnterpriseAttendance.find({
    enterpriseId: req.user._id,
    workerId,
    date: { $gte: startDate, $lte: endDate },
  })

  let presentDays = 0
  let absentDays = 0
  let halfDays = 0
  let lateEntries = 0
  let leaveDays = 0
  let overtimeHours = 0
  let totalWorkingHours = 0

  attendanceLogs.forEach((log) => {
    if (log.status === 'present') presentDays++
    if (log.status === 'absent') absentDays++
    if (log.status === 'half-day') halfDays++
    if (log.status === 'late') {
      presentDays++
      lateEntries++
    }
    if (log.status === 'leave') leaveDays++
    if (log.overtimeHours) overtimeHours += Number(log.overtimeHours)
    if (log.totalHours) totalWorkingHours += Number(log.totalHours)
  })

  // If no attendance logs exist yet, assume standard present month for calculation simulation or let user customize
  const totalWorkingDays = 26
  if (attendanceLogs.length === 0 && !req.body.strictAttendance) {
    presentDays = 26
  }

  // Compute attendance deduction (Daily Rate = Gross / 26)
  const dailyRate = Math.round((grossSalary / totalWorkingDays) * 100) / 100
  const attendanceDeduction = Math.round((absentDays * dailyRate + halfDays * (dailyRate * 0.5)) * 100) / 100

  // Compute Overtime Bonus (Overtime Hourly Rate = Daily Rate / 8 * 1.5x)
  const overtimeRate = Math.round(((dailyRate / 8) * 1.5) * 100) / 100
  const overtimeBonus = Math.round((overtimeHours * overtimeRate) * 100) / 100

  // Statutory Deductions (if enabled by HR)
  const pfDeduction = applyPf ? Math.round(grossSalary * 0.12) : 0
  const esicDeduction = applyEsic && grossSalary <= 21000 ? Math.round(grossSalary * 0.0075) : 0
  const ptDeduction = applyPt ? 200 : 0
  const tdsDeduction = applyTds ? Math.round(grossSalary * (tdsRate / 100)) : 0

  // CRITICAL RULE: Platform Fee is NOT deducted from worker's agreed salary pool!
  const netSalary = Math.round(
    grossSalary -
      attendanceDeduction -
      pfDeduction -
      esicDeduction -
      ptDeduction -
      tdsDeduction -
      Number(otherDeductions) +
      overtimeBonus +
      Number(bonus)
  )

  // Save or Update EnterprisePayroll Draft
  const payrollData = {
    enterpriseId: req.user._id,
    workerId,
    jobId: jobId || (application ? application.jobId : undefined),
    escrowId: escrow ? escrow._id : undefined,
    month,
    year,
    totalWorkingDays,
    presentDays,
    absentDays,
    halfDays,
    overtimeHours,
    lateEntries,
    leaveDays,
    totalWorkingHours,
    grossSalary,
    attendanceDeduction,
    overtimeBonus,
    bonus: Number(bonus),
    otherDeductions: Number(otherDeductions),
    pfDeduction,
    esicDeduction,
    ptDeduction,
    tdsDeduction,
    platformCommission, // Recorded for enterprise billing, zero deduction from labour net salary
    netSalary: Math.max(0, netSalary),
    status: 'draft',
  }

  const payroll = await EnterprisePayroll.findOneAndUpdate(
    { enterpriseId: req.user._id, workerId, month, year },
    { $set: payrollData },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )

  return sendSuccess(res, {
    message: 'Monthly payroll computed successfully! Ready for submission or admin review.',
    data: payroll,
  })
})

/** GET /api/enterprise/payroll - Get all generated payrolls for the enterprise */
export const getEnterprisePayrolls = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const { month, year, status } = req.query
  const filter = { enterpriseId: req.user._id }
  if (month) filter.month = Number(month)
  if (year) filter.year = Number(year)
  if (status && status !== 'all') filter.status = status

  const payrolls = await EnterprisePayroll.find(filter)
    .populate('workerId', 'fullName profileImageUrl phone email labourProfile')
    .populate('jobId', 'jobTitle workLocation')
    .sort({ year: -1, month: -1, createdAt: -1 })

  return sendSuccess(res, { data: payrolls })
})

/** POST /api/enterprise/payroll/:id/submit - Submit payroll draft for Admin Review & Escrow Release */
export const submitPayrollForReview = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const payroll = await EnterprisePayroll.findOne({ _id: req.params.id, enterpriseId: req.user._id })
  if (!payroll) {
    return sendError(res, { message: 'Payroll record not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (['approved', 'released', 'paid'].includes(payroll.status)) {
    return sendError(res, { message: `Payroll is already ${payroll.status}`, statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  payroll.status = 'under_review'
  await payroll.save()

  // Audit and Notifications
  await EnterpriseFinancialAuditLog.create({
    enterpriseId: req.user._id,
    action: 'payroll_submitted_review',
    amount: payroll.netSalary,
    performedBy: req.user._id,
    details: { payrollId: payroll._id, month: payroll.month, year: payroll.year },
  })

  emitToRole('admin', 'admin_notification', {
    type: 'ENTERPRISE_PAYROLL_SUBMITTED',
    message: `Enterprise submitted payroll for Month ${payroll.month}/${payroll.year} (₹${payroll.netSalary.toLocaleString('en-IN')}) for review & release.`,
  })

  return sendSuccess(res, {
    message: 'Payroll submitted to Staffivaa Admin for verification and Escrow release.',
    data: payroll,
  })
})

// ─── Admin HR & Payout Controllers ──────────────────────────────────────────

/** GET /api/admin/enterprise-payroll - Get all enterprise payrolls across organizations */
export const getAdminEnterprisePayrolls = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ADMIN) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const { month, year, status, enterpriseId } = req.query
  const filter = {}
  if (month) filter.month = Number(month)
  if (year) filter.year = Number(year)
  if (status && status !== 'all') filter.status = status
  if (enterpriseId) filter.enterpriseId = enterpriseId

  const payrolls = await EnterprisePayroll.find(filter)
    .populate('enterpriseId', 'fullName companyName email phone profileImageUrl enterpriseProfile')
    .populate('workerId', 'fullName profileImageUrl phone email labourProfile')
    .populate('jobId', 'jobTitle workLocation')
    .populate('escrowId', 'escrowNumber amount workerSalaryPool status')
    .sort({ createdAt: -1 })

  return sendSuccess(res, { data: payrolls })
})

/** PATCH /api/admin/enterprise-payroll/:id/review - Review, Approve, Hold, or Reject payroll */
export const reviewEnterprisePayroll = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ADMIN) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const { action, adminNotes, rejectionReason } = req.body // action: approve | hold | reject
  const payroll = await EnterprisePayroll.findById(req.params.id)
  if (!payroll) {
    return sendError(res, { message: 'Payroll not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (['released', 'paid'].includes(payroll.status)) {
    return sendError(res, { message: 'Cannot modify payroll that has already been released to Labour wallet.', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  if (action === 'approve') {
    payroll.status = 'approved'
  } else if (action === 'hold') {
    payroll.status = 'on_hold'
  } else if (action === 'reject') {
    if (!rejectionReason) {
      return sendError(res, { message: 'Rejection reason is required when rejecting payroll', statusCode: HTTP_STATUS.BAD_REQUEST })
    }
    payroll.status = 'rejected'
    payroll.rejectionReason = rejectionReason
  } else {
    return sendError(res, { message: 'Invalid review action', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  payroll.reviewedBy = req.user._id
  payroll.reviewedAt = new Date()
  if (adminNotes) payroll.adminNotes = adminNotes
  await payroll.save()

  // Notify Enterprise HR & Labour
  triggerNotification({
    userId: payroll.enterpriseId,
    title: `Payroll ${payroll.status.toUpperCase()}`,
    body: `Your payroll for worker ${payroll.workerId} (Month ${payroll.month}/${payroll.year}) has been marked as ${payroll.status.replace('_', ' ')}.`,
    type: 'PAYROLL_REVIEWED',
    relatedId: payroll._id,
    relatedModel: 'EnterprisePayroll',
  }).catch((err) => console.error('[Notification Error]:', err.message))

  return sendSuccess(res, {
    message: `Payroll status updated to ${payroll.status.replace('_', ' ')} successfully.`,
    data: payroll,
  })
})

/** POST /api/admin/enterprise-payroll/:id/release - Atomic Payout Execution: Transfer Salary from Escrow to Labour Wallet */
export const releaseEnterpriseSalary = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ADMIN) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const payroll = await EnterprisePayroll.findById(req.params.id)
    .populate('enterpriseId', 'fullName email companyName')
    .populate('workerId', 'fullName email phone walletBalance')

  if (!payroll) {
    return sendError(res, { message: 'Payroll record not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (['released', 'paid'].includes(payroll.status)) {
    return sendError(res, { message: 'Salary has already been released and credited to worker wallet.', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Ensure atomic payout using Mongoose ACID Transaction (Reusing existing vendor payout pattern)
  const session = await mongoose.startSession()
  session.startTransaction()
  let lockedWorker
  try {
    lockedWorker = await User.findById(payroll.workerId._id || payroll.workerId).session(session)
    if (!lockedWorker) {
      await session.abortTransaction()
      return sendError(res, { message: 'Target labour worker account not found', statusCode: HTTP_STATUS.NOT_FOUND })
    }

    const previousBalance = lockedWorker.walletBalance || 0
    lockedWorker.walletBalance = previousBalance + payroll.netSalary
    await lockedWorker.save({ session })

    // Create wallet transaction ledger entry for labour
    const walletTxn = await WalletTransaction.create([{
      userId: lockedWorker._id,
      type: 'Credit',
      amount: payroll.netSalary,
      balanceBefore: previousBalance,
      balanceAfter: lockedWorker.walletBalance,
      status: 'Completed',
      referenceId: payroll._id,
      referenceModel: 'EnterprisePayroll',
      description: `Enterprise Salary Payout for Month ${payroll.month}/${payroll.year} via Staffivaa Escrow Release`,
      metadata: {
        month: payroll.month,
        year: payroll.year,
        enterpriseId: payroll.enterpriseId._id || payroll.enterpriseId,
        escrowId: payroll.escrowId,
      }
    }], { session })

    // Update Escrow status if attached
    if (payroll.escrowId) {
      await EnterpriseEscrowTransaction.findByIdAndUpdate(
        payroll.escrowId,
        { $set: { status: 'released', releasedAt: new Date() } },
        { session }
      )
    }

    // Update Payroll record status
    payroll.status = 'paid'
    payroll.releasedBy = req.user._id
    payroll.releasedAt = new Date()
    payroll.paidAt = new Date()
    payroll.paymentReference = `TXN-SAL-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`
    payroll.walletTransactionId = walletTxn[0]._id
    await payroll.save({ session })

    await EnterpriseFinancialAuditLog.create([{
      enterpriseId: payroll.enterpriseId._id || payroll.enterpriseId,
      action: 'escrow_funds_released',
      amount: payroll.netSalary,
      performedBy: req.user._id,
      relatedEscrowId: payroll.escrowId,
      details: {
        payrollId: payroll._id,
        workerId: lockedWorker._id,
        netSalaryCredited: payroll.netSalary,
        paymentReference: payroll.paymentReference,
        workerWalletAfter: lockedWorker.walletBalance,
      },
    }], { session })

    await session.commitTransaction()
  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    session.endSession()
  }

  // Real-time Push & Socket Notification to Labour worker
  triggerNotification({
    userId: lockedWorker._id,
    title: '🎉 Salary Credited to Your Wallet!',
    body: `Your salary of ₹${payroll.netSalary.toLocaleString('en-IN')} for Month ${payroll.month}/${payroll.year} has been credited to your Staffivaa wallet. You can withdraw to your bank account instantly!`,
    type: 'SALARY_RELEASED',
    relatedId: payroll._id,
    relatedModel: 'EnterprisePayroll',
  }).catch((err) => console.error('[Notification Error]:', err.message))

  emitToRole('admin', 'admin_notification', {
    type: 'SALARY_RELEASED_SUCCESS',
    message: `₹${payroll.netSalary.toLocaleString('en-IN')} released to worker ${lockedWorker.fullName}'s wallet.`,
  })

  return sendSuccess(res, {
    message: `Salary of ₹${payroll.netSalary.toLocaleString('en-IN')} successfully released from Escrow and credited to worker wallet!`,
    data: {
      payroll,
      workerNewWalletBalance: lockedWorker.walletBalance,
      paymentReference: payroll.paymentReference,
    },
  })
})

// ─── Labour Employee Controllers ─────────────────────────────────────────────

/** GET /api/labour/my-enterprise-payrolls - Get salary history and slips for logged in worker */
export const getMyEnterprisePayrolls = asyncHandler(async (req, res) => {
  const workerId = req.user._id
  const { year } = req.query
  const filter = { workerId, status: { $in: ['under_review', 'approved', 'released', 'paid', 'on_hold'] } }
  if (year) filter.year = Number(year)

  const payrolls = await EnterprisePayroll.find(filter)
    .populate('enterpriseId', 'fullName companyName email phone profileImageUrl enterpriseProfile')
    .populate('jobId', 'jobTitle workLocation')
    .populate('walletTransactionId', 'amount balanceAfter createdAt description')
    .sort({ year: -1, month: -1, createdAt: -1 })

  return sendSuccess(res, { data: payrolls })
})
