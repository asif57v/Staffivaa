import crypto from 'crypto'
import { EnterpriseJob } from '../models/EnterpriseJob.js'
import { AttendanceRecord } from '../models/AttendanceRecord.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { USER_ROLES } from '../constants/roles.js'
import { ATTENDANCE_STATUS } from '../constants/workforceConstants.js'
import { emitToUser } from '../utils/socket.js'
import { triggerNotification } from '../utils/notificationTrigger.js'

/**
 * Daily attendance for admin-assigned (daily/hourly) enterprise work.
 * Flow per worker per day:
 *   1. Worker taps "Check in" (or enterprise generates it) → check-in OTP shown to the enterprise
 *   2. Worker enters that OTP → record created and the work timer starts (workingHoursStartedAt)
 *   3. Worker taps "End job"                                  → endRequestedAt + check-out OTP for enterprise
 *   4. Worker enters the check-out OTP                         → completed, hours computed
 * Records are normal AttendanceRecords (enterpriseId set), so admin enterprise attendance shows them too.
 */

export const DIRECT_SOURCE = 'enterprise_direct'
const OTP_TTL_MS = 30 * 60 * 1000
const OTP_MAX_ATTEMPTS = 5

export function istDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date)
}

/** Midnight IST of the given day, stored as the record's shiftDate. */
export function shiftDateFor(dateKey) {
  return new Date(`${dateKey}T00:00:00+05:30`)
}

function newOtp() {
  const now = new Date()
  return {
    code: String(crypto.randomInt(1000, 10000)),
    generatedAt: now,
    expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    attempts: 0,
  }
}

function otpActive(otp) {
  return Boolean(otp?.code && (!otp.expiresAt || new Date(otp.expiresAt) > new Date()))
}

/** Day state the apps render from. `includeOtpCode` only for the enterprise. */
export function summarizeDirectRecord(rec, { includeOtpCode = false } = {}) {
  if (!rec) return null
  const completed = rec.status === 'completed'
  let state = 'checked_in'
  if (completed) state = 'completed'
  else if (rec.endRequestedAt) state = 'checkout_pending'
  else if (rec.workingHoursStartedAt) state = 'working'
  return {
    _id: rec._id,
    workerId: rec.workerId?._id || rec.workerId,
    dateKey: istDateKey(new Date(rec.shiftDate)),
    state,
    checkInAt: rec.checkInAt || null,
    startedAt: rec.workingHoursStartedAt || null,
    endRequestedAt: rec.endRequestedAt || null,
    endedAt: rec.workingHoursEndedAt || null,
    checkOutAt: rec.checkOutAt || null,
    totalWorkingMinutes: rec.totalWorkingMinutes || 0,
    totalHours: rec.totalHours || 0,
    overtimeHours: rec.overtimeHours || 0,
    checkOutOtp:
      state === 'checkout_pending' && otpActive(rec.checkOutOtp)
        ? { expiresAt: rec.checkOutOtp.expiresAt, ...(includeOtpCode ? { code: rec.checkOutOtp.code } : {}) }
        : null,
  }
}

/** Creates (or returns) today's record once the check-in OTP is verified. */
export async function createDirectCheckInRecord({ job, workerId, dateKey, verifiedAt }) {
  const shiftDate = shiftDateFor(dateKey)
  const existing = await AttendanceRecord.findOne({ source: DIRECT_SOURCE, enterpriseJobId: job._id, workerId, shiftDate })
  if (existing) {
    // Records from the older flow waited for a separate "Start job" tap — start the timer from check-in
    if (!existing.workingHoursStartedAt && existing.status !== 'completed') {
      existing.workingHoursStartedAt = existing.checkInAt || verifiedAt
      existing.projectStatus = 'working'
      await existing.save()
    }
    return existing
  }
  return AttendanceRecord.create({
    source: DIRECT_SOURCE,
    enterpriseJobId: job._id,
    enterpriseId: job.enterpriseId,
    workerId,
    shiftDate,
    checkInAt: verifiedAt,
    status: 'checked_in',
    otpVerified: true,
    verifiedBy: 'labour',
    verifiedAt,
    attendanceStatus: ATTENDANCE_STATUS.PRESENT,
    // Work timer starts the moment the check-in OTP is verified
    workingHoursStartedAt: verifiedAt,
    projectStatus: 'working',
  })
}

async function loadMyJobAndToday(req, res) {
  if (req.user.role !== USER_ROLES.LABOUR) {
    sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
    return null
  }
  const job = await EnterpriseJob.findOne({
    _id: req.params.jobId,
    dispatchMode: 'admin',
    'assignedWorkers.workerId': req.user._id,
  })
  if (!job) {
    sendError(res, { message: 'Assignment not found', statusCode: HTTP_STATUS.NOT_FOUND })
    return null
  }
  const record = await AttendanceRecord.findOne({
    source: DIRECT_SOURCE,
    enterpriseJobId: job._id,
    workerId: req.user._id,
    shiftDate: shiftDateFor(istDateKey()),
  })
  if (!record) {
    sendError(res, {
      message: 'Verify the check-in OTP from your employer first.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
    return null
  }
  return { job, record }
}

function notifyEnterprise(job, type, title, body) {
  emitToUser('enterprise', String(job.enterpriseId), 'enterprise_jobs_updated', { type, jobId: job._id })
  if (title) {
    triggerNotification({
      userId: job.enterpriseId,
      title,
      body,
      type: `ENTERPRISE_DIRECT_${type.toUpperCase()}`,
      relatedId: job._id,
      relatedModel: 'EnterpriseJob',
    }).catch((err) => console.error('[Notification Error]:', err.message))
  }
}

function workerName(job, workerId) {
  return job.assignedWorkers.find((w) => String(w.workerId) === String(workerId))?.name || 'Your worker'
}

/** POST /api/enterprise/my-direct-assignments/:jobId/start-work */
export const startDirectWork = asyncHandler(async (req, res) => {
  const ctx = await loadMyJobAndToday(req, res)
  if (!ctx) return
  const { job, record } = ctx
  if (record.workingHoursStartedAt) {
    return sendError(res, { message: 'Work already started today', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  record.workingHoursStartedAt = new Date()
  record.projectStatus = 'working'
  await record.save()

  notifyEnterprise(job, 'work_started', 'Work started ▶️', `${workerName(job, req.user._id)} started work on "${job.jobTitle}".`)
  return sendSuccess(res, { message: 'Job started', data: summarizeDirectRecord(record) })
})

/** POST /api/enterprise/my-direct-assignments/:jobId/end-work — sends a check-out OTP to the enterprise. */
export const endDirectWork = asyncHandler(async (req, res) => {
  const ctx = await loadMyJobAndToday(req, res)
  if (!ctx) return
  const { job, record } = ctx
  if (!record.workingHoursStartedAt) {
    return sendError(res, { message: 'Start the job first', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  if (record.status === 'completed') {
    return sendError(res, { message: 'Work for today is already completed', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  if (!record.endRequestedAt) record.endRequestedAt = new Date()
  record.checkOutOtp = newOtp()
  await record.save()

  notifyEnterprise(
    job,
    'checkout_otp',
    'Check-out OTP 🔐',
    `${workerName(job, req.user._id)} ended work on "${job.jobTitle}". Open the job to see the check-out OTP and share it with them.`,
  )
  return sendSuccess(res, { message: 'Ask your employer for the check-out OTP', data: summarizeDirectRecord(record) })
})

/** POST /api/enterprise/my-direct-assignments/:jobId/verify-checkout-otp  { code } */
export const verifyDirectCheckoutOtp = asyncHandler(async (req, res) => {
  const code = String(req.body?.code || '').trim()
  if (!/^\d{4}$/.test(code)) {
    return sendError(res, { message: 'Enter the 4-digit OTP', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  const ctx = await loadMyJobAndToday(req, res)
  if (!ctx) return
  const { job, record } = ctx

  if (record.status === 'completed') {
    return sendError(res, { message: 'Work for today is already completed', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  const otp = record.checkOutOtp
  if (!record.endRequestedAt || !otp?.code) {
    return sendError(res, { message: 'Tap "End job" first to request the check-out OTP.', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  if (!otpActive(otp)) {
    return sendError(res, { message: 'OTP expired. Ask your employer to generate a new one.', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  if ((otp.attempts || 0) >= OTP_MAX_ATTEMPTS) {
    return sendError(res, { message: 'Too many wrong attempts. Ask your employer for a new OTP.', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  if (otp.code !== code) {
    otp.attempts = (otp.attempts || 0) + 1
    await record.save()
    const left = OTP_MAX_ATTEMPTS - otp.attempts
    return sendError(res, {
      message: left > 0 ? `OTP does not match. ${left} attempt(s) left.` : 'OTP does not match. Ask your employer for a new OTP.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  const now = new Date()
  const startedAt = record.workingHoursStartedAt
  const endedAt = record.endRequestedAt
  const minutes = Math.max(0, Math.round((endedAt - startedAt) / 60000))
  const hours = Math.round((minutes / 60) * 100) / 100
  const standardHours = Number(job.workingHours) || 8

  record.workingHoursEndedAt = endedAt
  record.checkOutAt = now
  record.totalWorkingMinutes = minutes
  record.totalHours = hours
  record.overtimeHours = Math.max(0, Math.round((hours - standardHours) * 100) / 100)
  record.billableUnits = 1
  record.attendanceStatus = hours > 0 && hours < standardHours / 2 ? ATTENDANCE_STATUS.HALF_DAY : ATTENDANCE_STATUS.PRESENT
  record.status = 'completed'
  record.projectStatus = 'completed'
  record.checkOutOtp = undefined
  await record.save()

  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  notifyEnterprise(
    job,
    'checkout_verified',
    'Work completed ✅',
    `${workerName(job, req.user._id)} checked out from "${job.jobTitle}" after ${h}h ${m}m.`,
  )
  return sendSuccess(res, { message: 'Checked out — attendance recorded', data: summarizeDirectRecord(record) })
})

/** POST /api/enterprise/jobs/:id/assigned-workers/:entryId/checkout-otp — enterprise regenerates an expired OTP. */
export const regenerateDirectCheckoutOtp = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }
  const job = await EnterpriseJob.findOne({ _id: req.params.id, enterpriseId: req.user._id, dispatchMode: 'admin' })
  if (!job) return sendError(res, { message: 'Job not found', statusCode: HTTP_STATUS.NOT_FOUND })
  const entry = job.assignedWorkers.id(req.params.entryId)
  if (!entry?.workerId) return sendError(res, { message: 'Assigned worker not found', statusCode: HTTP_STATUS.NOT_FOUND })

  const record = await AttendanceRecord.findOne({
    source: DIRECT_SOURCE,
    enterpriseJobId: job._id,
    workerId: entry.workerId,
    shiftDate: shiftDateFor(istDateKey()),
  })
  if (!record?.endRequestedAt || record.status === 'completed') {
    return sendError(res, { message: 'The worker has not ended work yet', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  record.checkOutOtp = newOtp()
  await record.save()

  emitToUser('labour', String(entry.workerId), 'enterprise_direct_assignment_updated', { type: 'checkout_otp', jobId: job._id })
  return sendSuccess(res, { message: 'New check-out OTP generated', data: summarizeDirectRecord(record, { includeOtpCode: true }) })
})

/** Attendance records for these jobs, grouped by job id (newest first). */
export async function loadDirectAttendanceByJob(jobIds, { workerId = null, limitPerJob = 60 } = {}) {
  if (!jobIds.length) return {}
  const filter = { source: DIRECT_SOURCE, enterpriseJobId: { $in: jobIds } }
  if (workerId) filter.workerId = workerId
  const records = await AttendanceRecord.find(filter).sort({ shiftDate: -1 }).limit(jobIds.length * limitPerJob).lean()
  const byJob = {}
  for (const r of records) {
    const key = String(r.enterpriseJobId)
    ;(byJob[key] ||= []).push(r)
  }
  return byJob
}
