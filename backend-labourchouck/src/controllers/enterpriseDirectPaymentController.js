import mongoose from 'mongoose'
import { EnterpriseJob } from '../models/EnterpriseJob.js'
import { EnterpriseDirectPayment } from '../models/EnterpriseDirectPayment.js'
import { EnterpriseWallet } from '../models/EnterpriseWallet.js'
import { EnterpriseWalletTransaction } from '../models/EnterpriseWalletTransaction.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { User } from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { USER_ROLES } from '../constants/roles.js'
import { logAudit } from '../utils/auditLogger.js'
import { emitToRole, emitToUser } from '../utils/socket.js'
import { triggerNotification } from '../utils/notificationTrigger.js'

const PERIOD_KEY_RE = /^\d{4}-\d{2}-\d{2}$/
const PAYOUT_MODES = ['wallet', 'cash', 'upi', 'bank', 'other']
const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`

/** Only accepted daily/hourly (admin dispatch) jobs take part in this flow. */
const isDirectJob = (job) =>
  job && job.dispatchMode === 'admin' && ['daily', 'hourly'].includes(job.salaryType)

const payableWorkersCount = (job) => (job.assignedWorkers?.length || 0) || job.numberOfWorkers

const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Admin-set worker pay (per day / per hour) for an assignment. Must be > 0 and not above the enterprise rate.
 * Returns { payRate } or { error }.
 */
export function parseWorkerPayRate(job, raw) {
  const payRate = raw === undefined || raw === null || raw === '' ? Number(job.salary) : Math.round(Number(raw))
  const unit = job.salaryType === 'hourly' ? 'hour' : 'day'
  if (!Number.isFinite(payRate) || payRate <= 0) {
    return { error: `Enter the worker's pay per ${unit}` }
  }
  if (payRate > Number(job.salary)) {
    return { error: `Worker pay can't be more than the enterprise rate (${inr(job.salary)} / ${unit})` }
  }
  return { payRate }
}

/** Per-worker payout for one paid period: worker gets payRate × units, Staffivaa keeps the rest. */
function workerPayoutSplit(entry, payment) {
  const grossAmount = Math.round(payment.rate * payment.units)
  const rate = Number(entry.payRate) > 0 ? Number(entry.payRate) : payment.rate
  const amount = Math.min(grossAmount, Math.round(rate * payment.units))
  const commissionAmount = grossAmount - amount
  const commissionPercent = grossAmount > 0 ? Math.round((commissionAmount / grossAmount) * 10000) / 100 : 0
  return { grossAmount, amount, commissionAmount, commissionPercent }
}

function computeAmount(job, units) {
  const workersCount = payableWorkersCount(job)
  const rate = job.salary
  const hours = job.salaryType === 'hourly' ? units : 1
  return { workersCount, rate, units: hours, amount: Math.round(rate * workersCount * hours) }
}

async function loadEnterpriseDirectJob(req, res) {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
    return null
  }
  const job = await EnterpriseJob.findOne({ _id: req.params.id, enterpriseId: req.user._id })
  if (!job) {
    sendError(res, { message: 'Job not found', statusCode: HTTP_STATUS.NOT_FOUND })
    return null
  }
  if (!isDirectJob(job) || job.adminRequestStatus !== 'accepted') {
    sendError(res, {
      message: 'Payments are only available for accepted daily/hourly requests',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
    return null
  }
  return job
}

/** GET /api/enterprise/jobs/:id/direct-payments - payment history + a quote for the next period */
export const getJobDirectPayments = asyncHandler(async (req, res) => {
  const job = await loadEnterpriseDirectJob(req, res)
  if (!job) return

  const payments = await EnterpriseDirectPayment.find({ jobId: job._id }).sort({ periodKey: -1 })
  const quote = computeAmount(job, job.salaryType === 'hourly' ? job.workingHours || 1 : 1)
  return sendSuccess(res, {
    data: { payments, quote: { ...quote, salaryType: job.salaryType, defaultPeriodKey: todayKey() } },
  })
})

/** POST /api/enterprise/jobs/:id/direct-payments - pay one day (daily) or the hours of one day (hourly) from the enterprise wallet */
export const payDirectJob = asyncHandler(async (req, res) => {
  const job = await loadEnterpriseDirectJob(req, res)
  if (!job) return

  const { periodKey, hours } = req.body || {}
  if (!PERIOD_KEY_RE.test(periodKey || '')) {
    return sendError(res, { message: 'A valid work date is required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  if (job.assignedWorkers.length === 0) {
    return sendError(res, { message: 'Workers are not assigned yet', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  let units = 1
  if (job.salaryType === 'hourly') {
    units = Number(hours)
    if (!Number.isFinite(units) || units <= 0 || units > 24) {
      return sendError(res, { message: 'Hours must be between 1 and 24', statusCode: HTTP_STATUS.BAD_REQUEST })
    }
  }

  const { workersCount, rate, amount } = computeAmount(job, units)
  if (amount <= 0) {
    return sendError(res, { message: 'Invalid payment amount', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Unique (jobId, periodKey) index guards against double payment, even for concurrent requests
  let payment
  try {
    payment = await EnterpriseDirectPayment.create({
      jobId: job._id,
      enterpriseId: req.user._id,
      salaryType: job.salaryType,
      periodKey,
      units,
      rate,
      workersCount,
      amount,
    })
  } catch (err) {
    if (err?.code === 11000) {
      return sendError(res, { message: 'This period is already paid', statusCode: HTTP_STATUS.CONFLICT })
    }
    throw err
  }

  const wallet = await EnterpriseWallet.findOneAndUpdate(
    { enterpriseId: req.user._id, status: 'active', balance: { $gte: amount } },
    { $inc: { balance: -amount, totalSpent: amount }, $set: { lastTransactionAt: new Date() } },
    { new: true }
  )
  if (!wallet) {
    await EnterpriseDirectPayment.deleteOne({ _id: payment._id })
    return sendError(res, {
      message: `Insufficient wallet balance. Please recharge your wallet with at least ${inr(amount)}.`,
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  const txn = await EnterpriseWalletTransaction.create({
    transactionId: `EWTXN-DIR-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    enterpriseId: req.user._id,
    amount,
    type: 'debit',
    status: 'success',
    paymentMethod: 'Wallet',
    description: `Payment for "${job.jobTitle}" (${periodKey}${job.salaryType === 'hourly' ? `, ${units}h` : ''})`,
    balanceAfter: wallet.balance,
    metaData: { jobId: job._id, periodKey, directPaymentId: payment._id },
  })
  payment.walletTransactionId = txn._id
  await payment.save()

  emitToRole('admin', 'admin_notification', {
    type: 'ENTERPRISE_DIRECT_PAYMENT',
    message: `${req.user.fullName || 'An enterprise'} paid ${inr(amount)} for "${job.jobTitle}" (${periodKey}).`,
  })
  // Persistent admin alert: the assigned workers can now be paid out to their wallets
  const admins = await User.find({ role: USER_ROLES.ADMIN, isActive: true }).select('_id').lean()
  for (const admin of admins) {
    triggerNotification({
      userId: admin._id,
      title: 'Enterprise payment received 💰',
      body: `${req.user.fullName || 'An enterprise'} paid ${inr(amount)} for "${job.jobTitle}" (${periodKey}, ${workersCount} worker(s)). Add the payout to the workers' wallets.`,
      type: 'ENTERPRISE_DIRECT_PAYMENT',
      relatedId: job._id,
      relatedModel: 'EnterpriseJob',
      url: '/admin/enterprise-requests',
      recipientRole: 'admin',
    }).catch((err) => console.error('[Admin Notification Error]:', err.message))
  }

  return sendSuccess(res, { message: `${inr(amount)} paid successfully`, data: { payment, walletBalance: wallet.balance } })
})

/** GET /api/admin/enterprise/direct-payments?from=&to= - all enterprise payments for daily/hourly jobs */
export const getAdminDirectPayments = asyncHandler(async (req, res) => {
  const query = {}
  const from = req.query.from ? new Date(req.query.from) : null
  const to = req.query.to ? new Date(req.query.to) : null
  if (from && !Number.isNaN(from.getTime())) query.paidAt = { ...query.paidAt, $gte: from }
  if (to && !Number.isNaN(to.getTime())) query.paidAt = { ...query.paidAt, $lte: to }
  if (req.query.jobId && mongoose.isValidObjectId(req.query.jobId)) query.jobId = req.query.jobId

  const payments = await EnterpriseDirectPayment.find(query)
    .populate('enterpriseId', 'fullName phone enterpriseProfile')
    .populate('jobId', 'jobTitle salaryType')
    .sort({ paidAt: -1 })
    .limit(500)

  const total = payments.reduce((sum, p) => sum + p.amount, 0)
  return sendSuccess(res, { data: { payments, total } })
})

/** POST /api/admin/enterprise/direct-requests/:id/send-reminder - "job ends in N hours" push to the enterprise */
export const sendJobEndReminder = asyncHandler(async (req, res) => {
  const job = await EnterpriseJob.findById(req.params.id)
  if (!job) return sendError(res, { message: 'Request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  if (!isDirectJob(job) || job.adminRequestStatus !== 'accepted') {
    return sendError(res, { message: 'Reminders are only for accepted daily/hourly requests', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const hoursBefore = Number(req.body?.hoursBefore)
  if (!Number.isFinite(hoursBefore) || hoursBefore <= 0 || hoursBefore > 72) {
    return sendError(res, { message: 'Hours must be between 1 and 72', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const customNote = String(req.body?.note || '').trim().slice(0, 200)
  const message =
    `Your job "${job.jobTitle}" ends in ${hoursBefore} hour${hoursBefore === 1 ? '' : 's'}.` +
    `${customNote ? ` ${customNote}` : ''} Please complete the payment if pending.`

  job.reminders.push({ hoursBefore, message, sentBy: req.user._id })
  await job.save()

  triggerNotification({
    userId: job.enterpriseId,
    title: 'Job Ending Soon ⏰',
    body: message,
    type: 'ENTERPRISE_JOB_END_REMINDER',
    relatedId: job._id,
    relatedModel: 'EnterpriseJob',
  }).catch((err) => console.error('[Notification Error]:', err.message))

  emitToUser('enterprise', String(job.enterpriseId), 'enterprise_jobs_updated', { type: 'job_end_reminder', jobId: job._id })

  await logAudit({
    adminId: req.user._id,
    action: 'Sent Job-End Reminder to Enterprise',
    module: 'Enterprise Admin',
    newValue: { jobId: job._id, hoursBefore },
    req,
  })

  return sendSuccess(res, { message: 'Reminder sent to the enterprise', data: job.reminders })
})

/** POST /api/admin/enterprise/direct-requests/:id/assigned-workers/:entryId/payout - pay one worker for one period */
export const payoutAssignedWorker = asyncHandler(async (req, res) => {
  const job = await EnterpriseJob.findById(req.params.id)
  if (!job) return sendError(res, { message: 'Request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  if (!isDirectJob(job)) {
    return sendError(res, { message: 'Payouts are only for daily/hourly requests', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const entry = job.assignedWorkers.id(req.params.entryId)
  if (!entry) return sendError(res, { message: 'Assigned worker not found', statusCode: HTTP_STATUS.NOT_FOUND })

  const { periodKey, note } = req.body || {}
  if (!PERIOD_KEY_RE.test(periodKey || '')) {
    return sendError(res, { message: 'A valid work date is required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Clearance rule: the enterprise must have paid that period first
  const payment = await EnterpriseDirectPayment.findOne({ jobId: job._id, periodKey })
  if (!payment) {
    return sendError(res, { message: 'The enterprise has not paid for this period yet', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  if (entry.payouts.some((p) => p.periodKey === periodKey)) {
    return sendError(res, { message: 'This worker is already paid for this period', statusCode: HTTP_STATUS.CONFLICT })
  }

  // The worker gets the pay the admin set at assignment (payRate × units); the rest is Staffivaa's margin
  const { grossAmount, amount, commissionAmount, commissionPercent } = workerPayoutSplit(entry, payment)
  const isRegistered = Boolean(entry.workerId) && !entry.isExternal
  const mode = isRegistered ? 'wallet' : String(req.body?.mode || '').toLowerCase()
  if (!PAYOUT_MODES.includes(mode) || (!isRegistered && mode === 'wallet')) {
    return sendError(res, { message: 'Select how this worker was paid (cash / upi / bank / other)', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Claim the slot atomically so two admins cannot pay the same worker/period twice
  const claim = await EnterpriseJob.updateOne(
    { _id: job._id, assignedWorkers: { $elemMatch: { _id: entry._id, 'payouts.periodKey': { $ne: periodKey } } } },
    {
      $push: {
        'assignedWorkers.$.payouts': {
          periodKey,
          amount,
          grossAmount,
          commissionPercent,
          commissionAmount,
          mode,
          note: String(note || '').trim().slice(0, 300),
          paidAt: new Date(),
          paidBy: req.user._id,
        },
      },
    }
  )
  if (claim.modifiedCount === 0) {
    return sendError(res, { message: 'This worker is already paid for this period', statusCode: HTTP_STATUS.CONFLICT })
  }

  let walletTxn = null
  if (isRegistered) {
    try {
      const worker = await User.findOneAndUpdate({ _id: entry.workerId }, { $inc: { walletBalance: amount } }, { new: true })
      if (!worker) throw new Error('Worker account not found')
      walletTxn = await WalletTransaction.create({
        transactionId: `WTXN-DIR-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        labourId: worker._id,
        payerName: 'Staffivaa',
        payerType: 'system',
        type: 'Credit',
        source: `Enterprise job payout · ${job.jobTitle} · ${periodKey}`,
        amount,
        balanceAfter: worker.walletBalance,
        status: 'Completed',
        referenceId: job._id,
        referenceModel: 'EnterpriseJob',
      })
      await EnterpriseJob.updateOne(
        { _id: job._id, 'assignedWorkers._id': entry._id },
        { $set: { 'assignedWorkers.$[w].payouts.$[p].walletTransactionId': walletTxn._id } },
        { arrayFilters: [{ 'w._id': entry._id }, { 'p.periodKey': periodKey }] }
      )

      triggerNotification({
        userId: worker._id,
        title: `${inr(amount)} Credited to Your Wallet 💰`,
        body: `Payment for "${job.jobTitle}" (${periodKey}) — ${inr(amount)} has been added to your Staffivaa wallet.`,
        type: 'ENTERPRISE_DIRECT_PAYOUT',
        relatedId: job._id,
        relatedModel: 'EnterpriseJob',
        url: '/app/enterprise-jobs',
      }).catch((err) => console.error('[Notification Error]:', err.message))
      // Refresh the worker's job card + wallet instantly
      emitToUser('labour', String(worker._id), 'enterprise_direct_assignment_updated', { type: 'payout', jobId: job._id })
      emitToUser('labour', String(worker._id), 'wallet_updated', { balance: worker.walletBalance })
    } catch (err) {
      // Roll back the claim so the admin can retry
      await EnterpriseJob.updateOne(
        { _id: job._id, 'assignedWorkers._id': entry._id },
        { $pull: { 'assignedWorkers.$.payouts': { periodKey } } }
      )
      throw err
    }
  }

  await logAudit({
    adminId: req.user._id,
    action: isRegistered ? 'Credited Worker Wallet (Daily/Hourly Job)' : 'Marked Worker Paid Manually (Daily/Hourly Job)',
    module: 'Enterprise Admin',
    newValue: { jobId: job._id, entryId: entry._id, periodKey, grossAmount, commissionPercent, commissionAmount, amount, mode },
    req,
  })

  emitToUser('enterprise', String(job.enterpriseId), 'enterprise_jobs_updated', { type: 'worker_paid', jobId: job._id })

  const fresh = await EnterpriseJob.findById(job._id).select('assignedWorkers')
  const marginNote = commissionAmount ? ` · Staffivaa keeps ${inr(commissionAmount)}` : ''
  return sendSuccess(res, {
    message: isRegistered
      ? `${inr(amount)} added to ${entry.name || 'worker'}'s wallet${marginNote}`
      : `Marked as paid ${inr(amount)} (${mode})${marginNote}`,
    data: fresh.assignedWorkers.id(entry._id),
  })
})
