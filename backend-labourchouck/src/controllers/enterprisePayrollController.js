import mongoose from 'mongoose'
import { razorpay } from '../config/razorpay.js'
import crypto from 'crypto'
import { EnterprisePayroll } from '../models/EnterprisePayroll.js'
import { EnterprisePayrollInvoice } from '../models/EnterprisePayrollInvoice.js'
import { EnterpriseAttendance } from '../models/EnterpriseAttendance.js'
import { EnterpriseJob } from '../models/EnterpriseJob.js'
import { EnterpriseApplication } from '../models/EnterpriseApplication.js'
import { EnterpriseEscrowTransaction } from '../models/EnterpriseEscrowTransaction.js'
import { EnterpriseFinancialAuditLog } from '../models/EnterpriseFinancialAuditLog.js'
import { EnterpriseWallet } from '../models/EnterpriseWallet.js'
import { EnterpriseWalletTransaction } from '../models/EnterpriseWalletTransaction.js'
import { SystemSettings } from '../models/SystemSettings.js'
import { User } from '../models/User.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { USER_ROLES } from '../constants/roles.js'
import { emitToRole } from '../utils/socket.js'
import { AttendanceRecord } from '../models/AttendanceRecord.js'
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
  let attendanceLogs = await AttendanceRecord.find({
    workerId,
    enterpriseId: req.user._id,
    shiftDate: { $gte: startDate, $lte: endDate },
  }).lean()

  if (!attendanceLogs || attendanceLogs.length === 0) {
    attendanceLogs = await EnterpriseAttendance.find({
      enterpriseId: req.user._id,
      workerId,
      date: { $gte: startDate, $lte: endDate },
    }).lean()
  }

  let presentDays = 0
  let absentDays = 0
  let halfDays = 0
  let lateEntries = 0
  let leaveDays = 0
  let overtimeHours = 0
  let totalWorkingHours = 0

  attendanceLogs.forEach((log) => {
    const st = log.attendanceStatus || log.status
    if (st === 'present' || log.checkInAt) presentDays++
    if (st === 'absent') absentDays++
    if (st === 'half-day') halfDays++
    if (st === 'late') {
      presentDays++
      lateEntries++
    }
    if (st === 'leave') leaveDays++
    if (log.overtimeHours) overtimeHours += Number(log.overtimeHours)
    if (log.totalHours) totalWorkingHours += Number(log.totalHours)
  })

  // Look up job details for accurate salaryType & working hours
  const jobDoc = (jobId || application?.jobId) ? await EnterpriseJob.findById(jobId || application?.jobId).lean() : null
  const isHourly = jobDoc?.salaryType === 'hourly'
  const isDaily = jobDoc?.salaryType === 'daily'

  // Total working days
  let totalWorkingDays = 26
  if (isHourly || isDaily) {
    totalWorkingDays = Math.max(1, presentDays + absentDays + halfDays)
  } else if (attendanceLogs.length > 0) {
    totalWorkingDays = Math.max(1, presentDays + absentDays + halfDays + leaveDays)
  } else if (attendanceLogs.length === 0 && !req.body.strictAttendance) {
    presentDays = 26
  }

  // For hourly job, compute gross salary based on actual hours or shift duration
  if (isHourly && jobDoc?.salary) {
    const hourlyRate = Number(jobDoc.salary)
    const billableHours = totalWorkingHours > 0 ? totalWorkingHours : Math.max(1, presentDays * (jobDoc.workingHours || 1))
    grossSalary = Math.round(billableHours * hourlyRate)
  } else if (isDaily && jobDoc?.salary) {
    grossSalary = Math.round(presentDays * Number(jobDoc.salary))
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

  const enterpriseUser = await User.findById(req.user._id).select('fullName enterpriseProfile')
  const companyName = enterpriseUser?.enterpriseProfile?.companyName || enterpriseUser?.fullName || 'Enterprise Client'

  // Trigger Push Notification, In-App DB Notification and Socket Alert for all Admin Users
  const adminUsers = await User.find({ role: USER_ROLES.ADMIN }).select('_id')
  const notifTitle = 'New Enterprise Payroll Submitted 💼'
  const notifBody = `${companyName} submitted Monthly Payroll for Month ${payroll.month}/${payroll.year} (₹${payroll.netSalary.toLocaleString('en-IN')}) for verification & Escrow release.`

  for (const admin of adminUsers) {
    triggerNotification({
      userId: admin._id,
      title: notifTitle,
      body: notifBody,
      type: 'ENTERPRISE_PAYROLL_SUBMITTED',
      relatedId: payroll._id,
      relatedModel: 'EnterprisePayroll',
    }).catch((err) => console.error('[Admin Notification Error]:', err.message))
  }

  emitToRole('admin', 'admin_notification', {
    type: 'ENTERPRISE_PAYROLL_SUBMITTED',
    message: notifBody,
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

  // 🔄 Auto-Sync: ONLY create payroll entries for attendance records that are actually PAID (settled via Razorpay)
  try {
    const paidAttendanceRecords = await AttendanceRecord.find({
      paymentStatus: 'paid',
      enterpriseId: { $exists: true, $ne: null },
      workerId: { $exists: true, $ne: null },
    }).lean()

    // Group by unique (workerId + enterpriseId + jobId + month + year) to avoid duplicates
    const groupKey = (r) => {
      const sd = r.shiftDate ? new Date(r.shiftDate) : new Date(r.settledAt || r.createdAt)
      return `${r.workerId}_${r.enterpriseId}_${r.enterpriseJobId || 'nojob'}_${sd.getMonth() + 1}_${sd.getFullYear()}`
    }

    const grouped = {}
    for (const r of paidAttendanceRecords) {
      const key = groupKey(r)
      if (!grouped[key]) {
        grouped[key] = { records: [], workerId: r.workerId, enterpriseId: r.enterpriseId, jobId: r.enterpriseJobId }
      }
      grouped[key].records.push(r)
    }

    for (const key of Object.keys(grouped)) {
      const g = grouped[key]
      const firstRecord = g.records[0]
      const sd = firstRecord.shiftDate ? new Date(firstRecord.shiftDate) : new Date(firstRecord.settledAt || firstRecord.createdAt)
      const m = sd.getMonth() + 1
      const y = sd.getFullYear()

      const existing = await EnterprisePayroll.findOne({
        workerId: g.workerId,
        enterpriseId: g.enterpriseId,
        month: m,
        year: y,
      })

      if (!existing) {
        // Aggregate real stats from all paid attendance records in this group
        const totalHrs = g.records.reduce((sum, r) => sum + (r.totalHours || 0), 0)
        const totalOT = g.records.reduce((sum, r) => sum + (r.overtimeHours || 0), 0)
        const totalSettled = g.records.reduce((sum, r) => sum + (r.settledAmount || 0), 0)
        const presentDays = g.records.filter(r => r.attendanceStatus === 'present' || r.checkInAt).length

        await EnterprisePayroll.create({
          enterpriseId: g.enterpriseId,
          workerId: g.workerId,
          jobId: g.jobId || undefined,
          month: m,
          year: y,
          presentDays,
          totalWorkingHours: parseFloat(totalHrs.toFixed(2)),
          overtimeHours: parseFloat(totalOT.toFixed(2)),
          grossSalary: totalSettled,
          netSalary: totalSettled,
          status: 'approved',
          paidAt: firstRecord.settledAt || new Date(),
          paymentReference: `PAY-SETTLE-${firstRecord._id.toString().slice(-6)}`,
        })
      }
    }
  } catch (syncErr) {
    console.error('Auto-sync payroll error:', syncErr)
  }

  const { month, year, status, enterpriseId } = req.query
  const filter = {}
  if (month) filter.month = Number(month)
  if (year) filter.year = Number(year)
  if (status && status !== 'all') filter.status = status
  if (enterpriseId) filter.enterpriseId = enterpriseId

  const payrolls = await EnterprisePayroll.find(filter)
    .populate('enterpriseId', 'fullName companyName email phone profileImageUrl enterpriseProfile')
    .populate('workerId', 'fullName profileImageUrl phone email labourProfile walletBalance bankAccountDetails upiDetails accountStatus')
    .populate('jobId', 'jobTitle workLocation workingHours salary salaryType')
    .populate('escrowId', 'escrowNumber amount workerSalaryPool status')
    .sort({ createdAt: -1 })
    .lean()

  // Attach daily attendance logs for each payroll record — query by workerId + enterpriseId (+ optional jobId)
  const enrichedPayrolls = await Promise.all(
    payrolls.map(async (p) => {
      const wId = p.workerId?._id || p.workerId
      const eId = p.enterpriseId?._id || p.enterpriseId
      const jId = p.jobId?._id || p.jobId

      const attendanceQuery = { workerId: wId, enterpriseId: eId }
      if (jId) attendanceQuery.enterpriseJobId = jId

      const records = await AttendanceRecord.find(attendanceQuery)
        .sort({ shiftDate: -1, checkInAt: -1 })
        .limit(31)
        .lean()

      const enrichedRecords = records.map((r) => {
        const totalH =
          r.totalHours != null && r.totalHours > 0
            ? r.totalHours
            : r.checkInAt && r.checkOutAt
            ? parseFloat(((new Date(r.checkOutAt) - new Date(r.checkInAt)) / 3600000).toFixed(2))
            : 0
        const otH =
          r.overtimeHours != null && r.overtimeHours > 0
            ? r.overtimeHours
            : Math.max(0, parseFloat((totalH - (p.jobId?.workingHours || 8)).toFixed(2)))
        return {
          ...r,
          totalHours: totalH,
          overtimeHours: otH,
        }
      })

      // Recalculate real attendance summary from actual records
      const realPresentDays = enrichedRecords.filter(r => r.checkInAt).length
      const realTotalHours = enrichedRecords.reduce((sum, r) => sum + (r.totalHours || 0), 0)
      const realOvertimeHours = enrichedRecords.reduce((sum, r) => sum + (r.overtimeHours || 0), 0)

      const isHourlyOrDaily = p.jobId?.salaryType === 'hourly' || p.jobId?.salaryType === 'daily'
      const realTotalWorkingDays = isHourlyOrDaily
        ? Math.max(1, realPresentDays)
        : (p.absentDays === 0 && realPresentDays > 0 && realPresentDays < (p.totalWorkingDays || 26) ? realPresentDays : p.totalWorkingDays || 26)

      return {
        ...p,
        totalWorkingDays: realTotalWorkingDays,
        presentDays: realPresentDays || p.presentDays,
        totalWorkingHours: parseFloat(realTotalHours.toFixed(2)) || p.totalWorkingHours,
        overtimeHours: parseFloat(realOvertimeHours.toFixed(2)) || p.overtimeHours,
        attendanceLogs: enrichedRecords || [],
      }
    })
  )

  return sendSuccess(res, { data: enrichedPayrolls })
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

  // 🔒 PAYMENT GATE: Block salary release unless Enterprise has paid the payroll invoice
  if (payroll.payrollInvoiceId) {
    const payrollInvoice = await EnterprisePayrollInvoice.findById(payroll.payrollInvoiceId)
    if (!payrollInvoice || payrollInvoice.status === 'payment_pending') {
      return sendError(res, {
        message: 'Cannot release salary — Enterprise has not yet paid the payroll invoice. Please wait for Enterprise payment before releasing.',
        statusCode: HTTP_STATUS.BAD_REQUEST,
      })
    }
  } else if (!['payment_received', 'approved'].includes(payroll.status)) {
    // If no invoice linked and not in approved/payment_received state, check for any pending invoice
    const pendingInvoice = await EnterprisePayrollInvoice.findOne({
      payrollIds: payroll._id,
      status: 'payment_pending',
    })
    if (pendingInvoice) {
      return sendError(res, {
        message: 'Cannot release salary — Enterprise has a pending payroll invoice. Please wait for Enterprise payment.',
        statusCode: HTTP_STATUS.BAD_REQUEST,
      })
    }
  }

  // Parse optional admin deductions from request body
  const {
    adminDeductionType = 'fixed',  // 'fixed' | 'percent'
    adminDeductionValue = 0,
    platformCommission = 0,
    tdsDeduction = 0,
    pfDeduction = 0,
    esicDeduction = 0,
    ptDeduction = 0,
    adminNotes = '',
  } = req.body || {}

  // Calculate admin custom deduction
  let adminDeductionAmount = 0
  if (adminDeductionType === 'percent') {
    adminDeductionAmount = Math.round((payroll.netSalary * Number(adminDeductionValue)) / 100)
  } else {
    adminDeductionAmount = Math.round(Number(adminDeductionValue) || 0)
  }

  // Calculate total statutory deductions
  const totalStatutory = Math.round(Number(tdsDeduction) + Number(pfDeduction) + Number(esicDeduction) + Number(ptDeduction))
  const totalPlatformComm = Math.round(Number(platformCommission))

  // Final credit amount to worker
  const totalDeductions = adminDeductionAmount + totalStatutory + totalPlatformComm
  const creditAmount = Math.max(0, payroll.netSalary - totalDeductions)

  if (creditAmount <= 0) {
    return sendError(res, { message: 'Final credit amount after deductions cannot be zero or negative', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Save deduction breakdown on the payroll record
  payroll.platformCommission = totalPlatformComm
  payroll.tdsDeduction = Math.round(Number(tdsDeduction))
  payroll.pfDeduction = Math.round(Number(pfDeduction))
  payroll.esicDeduction = Math.round(Number(esicDeduction))
  payroll.ptDeduction = Math.round(Number(ptDeduction))
  payroll.otherDeductions = adminDeductionAmount
  if (adminNotes) payroll.adminNotes = adminNotes

  // Ensure atomic payout using Mongoose ACID Transaction
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
    lockedWorker.walletBalance = previousBalance + creditAmount
    await lockedWorker.save({ session })

    // Create wallet transaction ledger entry for labour
    const walletTxn = await WalletTransaction.create([{
      transactionId: `WTXN-SAL-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      userId: lockedWorker._id,
      labourId: lockedWorker._id,
      payerId: lockedWorker._id,
      payerName: lockedWorker.fullName || 'Worker',
      payerType: 'labour',
      type: 'Credit',
      source: 'Enterprise Payroll Escrow Payout',
      amount: creditAmount,
      balanceBefore: previousBalance,
      balanceAfter: lockedWorker.walletBalance,
      status: 'Completed',
      referenceId: payroll._id,
      referenceModel: 'EnterprisePayroll',
      description: `Enterprise Salary Payout for Month ${payroll.month}/${payroll.year} via Staffivaa Escrow Release${totalDeductions > 0 ? ` (₹${totalDeductions} deducted)` : ''}`,
      metadata: {
        month: payroll.month,
        year: payroll.year,
        enterpriseId: payroll.enterpriseId._id || payroll.enterpriseId,
        escrowId: payroll.escrowId,
        grossSalary: payroll.grossSalary,
        totalDeductions,
        creditAmount,
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

    // Update Payroll record status with final credited amount
    payroll.netSalary = creditAmount
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

  // 🔔 Real-time Dual Push & In-App Notification to Labour worker
  const totalDeds = (payroll.otherDeductions || 0) + (payroll.platformCommission || 0) + (payroll.tdsDeduction || 0) + (payroll.pfDeduction || 0) + (payroll.esicDeduction || 0) + (payroll.ptDeduction || 0)
  const dedNote = totalDeds > 0 ? ` (after ₹${totalDeds.toLocaleString('en-IN')} deductions)` : ''

  triggerNotification({
    userId: lockedWorker._id,
    title: `🎉 ₹${payroll.netSalary.toLocaleString('en-IN')} Salary Credited!`,
    body: `Your net salary of ₹${payroll.netSalary.toLocaleString('en-IN')}${dedNote} for Month ${payroll.month}/${payroll.year} has been credited to your Staffivaa wallet. Tap to view details or withdraw!`,
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

// ─── Admin: Live Enterprise Attendance Monitoring ─────────────────────────────

/** GET /api/admin/enterprise/attendance - Live attendance across all enterprises */
export const getAdminEnterpriseAttendance = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ADMIN) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const { enterpriseId, workerId, date, startDate, endDate, status, page = 1, limit = 50 } = req.query
  const filter = {}

  if (enterpriseId) filter.enterpriseId = enterpriseId
  if (workerId) filter.workerId = workerId
  if (status) filter.attendanceStatus = status

  // Date filtering with timezone tolerance
  if (date) {
    const d = new Date(date)
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
    const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
    // 14 hours buffer on each side to absorb UTC vs local IST offset
    const startBuffer = new Date(startOfDay.getTime() - 14 * 60 * 60 * 1000)
    const endBuffer = new Date(endOfDay.getTime() + 14 * 60 * 60 * 1000)
    filter.shiftDate = { $gte: startBuffer, $lte: endBuffer }
  } else if (startDate && endDate) {
    filter.shiftDate = { $gte: new Date(startDate), $lte: new Date(endDate) }
  }

  // Only enterprise-linked attendance
  filter.enterpriseId = filter.enterpriseId || { $exists: true, $ne: null }

  const skip = (Number(page) - 1) * Number(limit)
  const totalCount = await AttendanceRecord.countDocuments(filter)

  const records = await AttendanceRecord.find(filter)
    .populate('workerId', 'fullName profileImageUrl phone email labourProfile')
    .populate('enterpriseId', 'fullName profileImageUrl enterpriseProfile phone email')
    .populate('enterpriseJobId', 'jobTitle workLocation salary salaryType workingHours')
    .sort({ shiftDate: -1, checkInAt: -1, createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean()

  // Compute summary stats across all enterprise records
  const allEnterpriseRecords = await AttendanceRecord.find({ enterpriseId: { $exists: true, $ne: null } }).lean()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const todayRecords = allEnterpriseRecords.filter(r => 
    (r.shiftDate && new Date(r.shiftDate) >= todayStart) || 
    (r.checkInAt && new Date(r.checkInAt) >= last24h)
  )
  const activeRecords = records.length > 0 ? records : allEnterpriseRecords

  const summary = {
    totalRecords: allEnterpriseRecords.length,
    todayTotal: todayRecords.length,
    todayPresent: activeRecords.filter(r => r.attendanceStatus === 'present' || r.checkInAt).length,
    todayAbsent: activeRecords.filter(r => r.attendanceStatus === 'absent').length,
    todayLate: activeRecords.filter(r => r.attendanceStatus === 'late').length,
    todayCheckedIn: activeRecords.filter(r => r.checkInAt && !r.checkOutAt).length, // Currently working
    todayCompleted: activeRecords.filter(r => r.checkInAt && r.checkOutAt).length,
    avgHoursToday: activeRecords.length > 0
      ? parseFloat((activeRecords.reduce((s, r) => s + (r.totalHours || 0), 0) / Math.max(1, activeRecords.filter(r => r.totalHours > 0).length)).toFixed(1))
      : 0,
  }

  return sendSuccess(res, {
    data: {
      records,
      summary,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / Number(limit)),
      },
    },
  })
})

/** GET /api/admin/enterprise/attendance/:workerId - Detailed attendance for a specific worker */
export const getAdminWorkerAttendanceDetail = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ADMIN) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const { month, year, enterpriseId } = req.query
  const filter = { workerId: req.params.workerId, enterpriseId: { $exists: true, $ne: null } }
  if (enterpriseId) filter.enterpriseId = enterpriseId

  if (month && year) {
    const startDate = new Date(Number(year), Number(month) - 1, 1)
    const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59)
    filter.shiftDate = { $gte: startDate, $lte: endDate }
  }

  const records = await AttendanceRecord.find(filter)
    .populate('enterpriseId', 'fullName enterpriseProfile')
    .populate('enterpriseJobId', 'jobTitle workLocation salary')
    .sort({ shiftDate: -1 })
    .limit(62) // 2 months max
    .lean()

  const worker = await User.findById(req.params.workerId).select('fullName profileImageUrl phone email labourProfile').lean()

  // Calculate summary
  const presentDays = records.filter(r => r.attendanceStatus === 'present' || (r.checkInAt && r.attendanceStatus !== 'absent')).length
  const absentDays = records.filter(r => r.attendanceStatus === 'absent').length
  const totalHours = records.reduce((s, r) => s + (r.totalHours || 0), 0)
  const totalOT = records.reduce((s, r) => s + (r.overtimeHours || 0), 0)

  return sendSuccess(res, {
    data: {
      records,
      worker,
      summary: {
        totalRecords: records.length,
        presentDays,
        absentDays,
        totalHours: parseFloat(totalHours.toFixed(1)),
        totalOvertimeHours: parseFloat(totalOT.toFixed(1)),
        avgHoursPerDay: presentDays > 0 ? parseFloat((totalHours / presentDays).toFixed(1)) : 0,
      },
    },
  })
})

// ─── Admin: Payroll Payment Request Flow ──────────────────────────────────────

/** POST /api/admin/enterprise/payrolls/:id/send-payment-request - Send payment request to Enterprise for approved payroll */
export const sendPayrollPaymentRequest = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ADMIN) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const { adminNotes, dueDays = 7, includePlatformFee = true } = req.body

  const payroll = await EnterprisePayroll.findById(req.params.id)
    .populate('workerId', 'fullName')
    .populate('enterpriseId', 'fullName enterpriseProfile')

  if (!payroll) {
    return sendError(res, { message: 'Payroll record not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (!['approved', 'under_review'].includes(payroll.status)) {
    return sendError(res, { message: `Cannot send payment request for payroll with status: ${payroll.status}`, statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Check if payment request already exists for this payroll
  const existingInvoice = await EnterprisePayrollInvoice.findOne({
    payrollIds: payroll._id,
    status: { $in: ['payment_pending', 'paid'] },
  })
  if (existingInvoice) {
    return sendError(res, { message: `Payment request already sent (Invoice #${existingInvoice.invoiceNumber}). Status: ${existingInvoice.status}`, statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Calculate amounts
  const settings = await SystemSettings.findOne({ singletonId: 'SYSTEM_SETTINGS' })
  const platformFeeType = settings?.platformFeeType || 'percentage'
  const platformFeeValue = settings?.platformFeeValue ?? 10
  const isGstEnabled = settings?.isGstEnabled ?? true
  const gstRate = settings?.gstPercentage ?? 18

  const totalWorkerSalary = payroll.netSalary
  let platformCommission = 0
  if (includePlatformFee) {
    if (platformFeeType === 'fixed') {
      platformCommission = Number(platformFeeValue)
    } else {
      platformCommission = Math.round(totalWorkerSalary * (platformFeeValue / 100))
    }
  }

  const subtotal = totalWorkerSalary + platformCommission
  const gstAmount = isGstEnabled ? Math.round(subtotal * (gstRate / 100)) : 0
  const grandTotal = subtotal + gstAmount

  const invoiceDate = new Date()
  const dueDate = new Date(invoiceDate.getTime() + Number(dueDays) * 24 * 60 * 60 * 1000)
  const gracePeriodEndDate = new Date(dueDate.getTime() + 3 * 24 * 60 * 60 * 1000)
  const invNumber = `SAL-INV-${payroll.year}${String(payroll.month).padStart(2, '0')}-${Date.now().toString().slice(-4)}-${Math.floor(100 + Math.random() * 900)}`

  const workerName = payroll.workerId?.fullName || 'Worker'

  const invoice = await EnterprisePayrollInvoice.create({
    invoiceNumber: invNumber,
    enterpriseId: payroll.enterpriseId._id || payroll.enterpriseId,
    payrollIds: [payroll._id],
    month: payroll.month,
    year: payroll.year,
    totalWorkerSalary,
    platformCommission,
    gstAmount,
    grandTotal,
    workerCount: 1,
    workerSummary: [{
      workerId: payroll.workerId._id || payroll.workerId,
      workerName,
      netSalary: totalWorkerSalary,
      payrollId: payroll._id,
    }],
    status: 'payment_pending',
    dueDate,
    gracePeriodEndDate,
    createdBy: req.user._id,
    adminNotes: adminNotes || '',
  })

  // Update payroll status
  payroll.status = 'payment_requested'
  payroll.payrollInvoiceId = invoice._id
  await payroll.save()

  // Audit log
  await EnterpriseFinancialAuditLog.create({
    enterpriseId: payroll.enterpriseId._id || payroll.enterpriseId,
    action: 'payroll_payment_requested',
    amount: grandTotal,
    performedBy: req.user._id,
    details: {
      invoiceNumber: invNumber,
      payrollId: payroll._id,
      month: payroll.month,
      year: payroll.year,
      workerName,
      dueDate,
    },
  })

  // Notify Enterprise HR
  const companyName = payroll.enterpriseId?.enterpriseProfile?.companyName || payroll.enterpriseId?.fullName || 'Enterprise'
  triggerNotification({
    userId: payroll.enterpriseId._id || payroll.enterpriseId,
    title: '💰 Salary Payment Request from Staffivaa',
    body: `Payment of ₹${grandTotal.toLocaleString('en-IN')} is requested for ${workerName}'s salary (Month ${payroll.month}/${payroll.year}). Invoice #${invNumber}. Due by ${dueDate.toLocaleDateString('en-IN')}.`,
    type: 'PAYROLL_PAYMENT_REQUEST',
    relatedId: invoice._id,
    relatedModel: 'EnterprisePayrollInvoice',
  }).catch((err) => console.error('[Notification Error]:', err.message))

  emitToRole('enterprise', 'enterprise_payroll_invoice', {
    type: 'payment_request',
    invoiceId: invoice._id,
    enterpriseId: payroll.enterpriseId._id || payroll.enterpriseId,
  })

  return sendSuccess(res, {
    message: `Payment request sent to ${companyName}! Invoice #${invNumber} (₹${grandTotal.toLocaleString('en-IN')}) generated.`,
    data: { invoice, payroll },
  })
})

// ─── Enterprise: Payroll Invoice & Payment ────────────────────────────────────

/** GET /api/enterprise/payroll-invoices - Enterprise views their salary payment invoices */
export const getEnterprisePayrollInvoices = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const { status } = req.query
  const filter = { enterpriseId: req.user._id }
  if (status && status !== 'all') filter.status = status

  const invoices = await EnterprisePayrollInvoice.find(filter)
    .populate('payrollIds')
    .populate('createdBy', 'fullName')
    .populate('workerSummary.workerId', 'fullName profileImageUrl phone')
    .sort({ createdAt: -1 })

  // Summary metrics
  const allInvoices = await EnterprisePayrollInvoice.find({ enterpriseId: req.user._id })
  const pendingAmount = allInvoices.filter(i => i.status === 'payment_pending').reduce((s, i) => s + (i.grandTotal || 0), 0)
  const paidAmount = allInvoices.filter(i => ['paid', 'verified', 'salary_released'].includes(i.status)).reduce((s, i) => s + (i.grandTotal || 0), 0)

  return sendSuccess(res, {
    data: invoices,
    metrics: {
      totalInvoices: allInvoices.length,
      pendingCount: allInvoices.filter(i => i.status === 'payment_pending').length,
      pendingAmount,
      paidAmount,
    },
  })
})

/** POST /api/enterprise/payroll-invoices/:id/pay - Enterprise pays payroll invoice via Razorpay or Wallet */
export const payPayrollInvoice = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const invoice = await EnterprisePayrollInvoice.findOne({
    _id: req.params.id,
    enterpriseId: req.user._id,
  })

  if (!invoice) {
    return sendError(res, { message: 'Invoice not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (invoice.status !== 'payment_pending') {
    return sendError(res, { message: `Invoice is already ${invoice.status}`, statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Check Enterprise Wallet balance
  let wallet = await EnterpriseWallet.findOne({ enterpriseId: req.user._id })
  if (!wallet) {
    wallet = await EnterpriseWallet.create({ enterpriseId: req.user._id, balance: 0 })
  }

  const availableBalance = wallet.balance || 0
  const walletAmountUsed = Math.min(availableBalance, invoice.grandTotal)
  const remainingAmount = invoice.grandTotal - walletAmountUsed

  // CASE 1: Full wallet payment
  if (remainingAmount === 0) {
    const session = await mongoose.startSession()
    session.startTransaction()
    try {
      const lockedWallet = await EnterpriseWallet.findOne({ enterpriseId: req.user._id }).session(session)
      if (lockedWallet.balance < invoice.grandTotal) {
        await session.abortTransaction()
        return sendError(res, { message: 'Insufficient wallet balance', statusCode: HTTP_STATUS.BAD_REQUEST })
      }

      lockedWallet.balance -= invoice.grandTotal
      await lockedWallet.save({ session })

      await EnterpriseWalletTransaction.create([{
        transactionId: `TXN_SAL_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
        enterpriseId: req.user._id,
        type: 'payroll_payment',
        amount: invoice.grandTotal,
        balanceAfter: lockedWallet.balance,
        description: `Salary Payment for Invoice #${invoice.invoiceNumber} (Month ${invoice.month}/${invoice.year})`,
        status: 'success',
      }], { session })

      invoice.status = 'paid'
      invoice.paidAt = new Date()
      invoice.paymentMethod = 'enterprise_wallet'
      invoice.walletAmountUsed = invoice.grandTotal
      invoice.onlineAmountUsed = 0
      await invoice.save({ session })

      // Update all linked payrolls
      await EnterprisePayroll.updateMany(
        { _id: { $in: invoice.payrollIds } },
        { $set: { status: 'payment_received' } },
        { session }
      )

      await session.commitTransaction()
    } catch (err) {
      await session.abortTransaction()
      throw err
    } finally {
      session.endSession()
    }

    // Notify Admin
    const adminUsers = await User.find({ role: USER_ROLES.ADMIN }).select('_id')
    for (const admin of adminUsers) {
      triggerNotification({
        userId: admin._id,
        title: 'Enterprise Salary Payment Received 💳',
        body: `Payment of ₹${invoice.grandTotal.toLocaleString('en-IN')} received for Invoice #${invoice.invoiceNumber} via Enterprise Wallet.`,
        type: 'PAYROLL_PAYMENT_RECEIVED',
        relatedId: invoice._id,
        relatedModel: 'EnterprisePayrollInvoice',
      }).catch((err) => console.error('[Notification Error]:', err.message))
    }

    emitToRole('admin', 'admin_notification', {
      type: 'PAYROLL_PAYMENT_RECEIVED',
      message: `Enterprise paid ₹${invoice.grandTotal.toLocaleString('en-IN')} for salary Invoice #${invoice.invoiceNumber}`,
    })

    return sendSuccess(res, {
      message: 'Salary invoice paid fully from Enterprise Wallet!',
      data: { invoice, paymentStatus: 'paid', walletBalance: wallet.balance - invoice.grandTotal },
    })
  }

  // CASE 2: Razorpay order (partial or full online payment)
  const receiptId = `RCPT_SAL_${invoice.invoiceNumber}_${Date.now().toString().slice(-4)}`
  const order = await razorpay.orders.create({
    amount: Math.round(remainingAmount * 100), // paise
    currency: 'INR',
    receipt: receiptId,
    notes: {
      invoiceId: String(invoice._id),
      enterpriseId: String(req.user._id),
      walletAmountUsed: String(walletAmountUsed),
      remainingAmount: String(remainingAmount),
      purpose: 'Enterprise Monthly Salary Payment',
    },
  })

  invoice.walletAmountUsed = walletAmountUsed
  invoice.onlineAmountUsed = remainingAmount
  invoice.razorpayOrderId = order.id
  await invoice.save()

  return sendSuccess(res, {
    message: walletAmountUsed > 0
      ? `Applying ₹${walletAmountUsed.toLocaleString('en-IN')} from Wallet. Pay remaining ₹${remainingAmount.toLocaleString('en-IN')} via Gateway.`
      : `Please pay ₹${remainingAmount.toLocaleString('en-IN')} via Payment Gateway.`,
    data: {
      paymentStatus: 'requires_online_payment',
      invoice,
      walletAmountUsed,
      remainingAmount,
      razorpayOrder: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID || '',
      },
    },
  })
})

/** POST /api/enterprise/payroll-invoices/:id/verify - Verify Razorpay payment for salary invoice */
export const verifyPayrollInvoicePayment = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return sendError(res, { message: 'Missing Razorpay payment details', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const invoice = await EnterprisePayrollInvoice.findOne({
    _id: req.params.id,
    enterpriseId: req.user._id,
    razorpayOrderId: razorpay_order_id,
  })

  if (!invoice) {
    return sendError(res, { message: 'Invoice not found or order mismatch', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Verify Razorpay Signature
  const generatedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex')

  if (generatedSignature !== razorpay_signature) {
    return sendError(res, { message: 'Invalid payment signature. Verification failed.', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Atomic wallet debit + invoice update
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    // Debit wallet portion if applicable
    if (invoice.walletAmountUsed > 0) {
      const lockedWallet = await EnterpriseWallet.findOne({ enterpriseId: req.user._id }).session(session)
      if (lockedWallet && lockedWallet.balance >= invoice.walletAmountUsed) {
        lockedWallet.balance -= invoice.walletAmountUsed
        await lockedWallet.save({ session })

        await EnterpriseWalletTransaction.create([{
          transactionId: `TXN_SAL_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
          enterpriseId: req.user._id,
          type: 'payroll_payment',
          amount: invoice.walletAmountUsed,
          balanceAfter: lockedWallet.balance,
          description: `Wallet portion for Salary Invoice #${invoice.invoiceNumber}`,
          status: 'success',
        }], { session })
      }
    }

    invoice.status = 'paid'
    invoice.paidAt = new Date()
    invoice.paymentMethod = invoice.walletAmountUsed > 0 ? 'hybrid' : 'razorpay'
    invoice.razorpayPaymentId = razorpay_payment_id
    invoice.razorpaySignature = razorpay_signature
    await invoice.save({ session })

    // Update all linked payrolls
    await EnterprisePayroll.updateMany(
      { _id: { $in: invoice.payrollIds } },
      { $set: { status: 'payment_received' } },
      { session }
    )

    await session.commitTransaction()
  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    session.endSession()
  }

  // Notify Admin
  const adminUsers = await User.find({ role: USER_ROLES.ADMIN }).select('_id')
  for (const admin of adminUsers) {
    triggerNotification({
      userId: admin._id,
      title: 'Enterprise Salary Payment Verified ✅',
      body: `₹${invoice.grandTotal.toLocaleString('en-IN')} verified for Invoice #${invoice.invoiceNumber}. You can now release worker salaries.`,
      type: 'PAYROLL_PAYMENT_VERIFIED',
      relatedId: invoice._id,
      relatedModel: 'EnterprisePayrollInvoice',
    }).catch((err) => console.error('[Notification Error]:', err.message))
  }

  emitToRole('admin', 'admin_notification', {
    type: 'PAYROLL_PAYMENT_VERIFIED',
    message: `Salary payment of ₹${invoice.grandTotal.toLocaleString('en-IN')} verified for Invoice #${invoice.invoiceNumber}`,
  })

  return sendSuccess(res, {
    message: 'Payment verified successfully! Staffivaa Admin will now release worker salaries.',
    data: { invoice },
  })
})
