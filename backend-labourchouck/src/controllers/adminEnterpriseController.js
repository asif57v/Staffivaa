import { User } from '../models/User.js'
import { EnterpriseJob } from '../models/EnterpriseJob.js'
import { EnterpriseApplication } from '../models/EnterpriseApplication.js'
import { normalizeIndianPhone } from '../utils/phone.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { USER_ROLES, ENTERPRISE_STATUS } from '../constants/roles.js'
import { logAudit } from '../utils/auditLogger.js'
import { emitToRole, emitToUser } from '../utils/socket.js'
import { triggerNotification } from '../utils/notificationTrigger.js'
import { parseWorkerPayRate } from './enterpriseDirectPaymentController.js'

/** GET /api/admin/enterprise/companies */
export const getEnterpriseCompanies = asyncHandler(async (req, res) => {
  const companies = await User.find({ role: USER_ROLES.ENTERPRISE })
    .sort({ createdAt: -1 })
    .select('-passwordHash')

  return sendSuccess(res, { data: companies })
})

/** PUT /api/admin/enterprise/companies/:id/status */
export const updateEnterpriseCompanyStatus = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { status, reviewNote } = req.body

  if (!Object.values(ENTERPRISE_STATUS).includes(status)) {
    return sendError(res, { message: 'Invalid status', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const company = await User.findOne({ _id: id, role: USER_ROLES.ENTERPRISE })
  if (!company || !company.enterpriseProfile) {
    return sendError(res, { message: 'Company not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  company.enterpriseProfile.status = status
  company.enterpriseProfile.reviewedAt = new Date()
  if (reviewNote !== undefined) company.enterpriseProfile.reviewNote = reviewNote

  await company.save()

  await logAudit({
    adminId: req.user._id,
    action: `Updated Enterprise Company Status to ${status}`,
    module: 'Enterprise Admin',
    req,
  })

  return sendSuccess(res, { message: `Company status updated to ${status}`, data: company })
})

/** GET /api/admin/enterprise/jobs */
export const getEnterpriseJobs = asyncHandler(async (req, res) => {
  const jobs = await EnterpriseJob.find()
    .populate('enterpriseId', 'fullName enterpriseProfile.companyName email phone')
    .populate('categoryId', 'name')
    .sort({ createdAt: -1 })

  // Compute live applicant & placement stats for Admin
  const jobsWithStats = await Promise.all(
    jobs.map(async (job) => {
      const jobObj = job.toObject()
      const totalApplications = await EnterpriseApplication.countDocuments({ jobId: job._id })
      const acceptedCount = await EnterpriseApplication.countDocuments({
        jobId: job._id,
        status: { $in: ['offer_accepted', 'joining_pending', 'joined'] },
      })
      const joinedCount = await EnterpriseApplication.countDocuments({
        jobId: job._id,
        status: 'joined',
      })
      jobObj.totalApplications = totalApplications
      jobObj.acceptedCount = acceptedCount
      jobObj.joinedCount = joinedCount
      return jobObj
    })
  )

  return sendSuccess(res, { data: jobsWithStats })
})

/** PUT /api/admin/enterprise/jobs/:id/status */
export const updateEnterpriseJobStatus = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { status, adminReviewNote, isLive } = req.body

  const job = await EnterpriseJob.findById(id)
  if (!job) {
    return sendError(res, { message: 'Job not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (status) job.status = status
  if (adminReviewNote !== undefined) job.adminReviewNote = adminReviewNote
  // Daily/hourly requests are fulfilled by Admin and must never be published to the labour feed
  if (isLive !== undefined) job.isLive = job.dispatchMode === 'admin' ? false : isLive

  await job.save()

  emitToRole('labour', 'enterprise_jobs_updated', { type: 'job_status_changed', jobId: job._id, status: job.status })

  await logAudit({
    adminId: req.user._id,
    action: `Updated Enterprise Job Status to ${status || job.status}`,
    module: 'Enterprise Admin',
    req,
  })

  return sendSuccess(res, { message: 'Job updated', data: job })
})

/** GET /api/admin/enterprise/applications - Master Admin Applications & Placements View */
export const getAdminEnterpriseApplications = asyncHandler(async (req, res) => {
  const { status, search } = req.query
  const query = {}

  if (status && status !== 'all') {
    query.status = status
  }

  let applications = await EnterpriseApplication.find(query)
    .populate({
      path: 'workerId',
      select: 'fullName phone email profileImageUrl labourProfile',
    })
    .populate({
      path: 'jobId',
      select: 'jobTitle salary salaryType locationText categoryId department',
    })
    .populate({
      path: 'enterpriseId',
      select: 'fullName enterpriseProfile.companyName email phone',
    })
    .sort({ createdAt: -1 })

  if (search) {
    const q = search.toLowerCase()
    applications = applications.filter((app) => {
      const workerName = app.workerId?.fullName?.toLowerCase() || ''
      const companyName = app.enterpriseId?.enterpriseProfile?.companyName?.toLowerCase() || ''
      const jobTitle = app.jobId?.jobTitle?.toLowerCase() || ''
      return workerName.includes(q) || companyName.includes(q) || jobTitle.includes(q)
    })
  }

  const allApps = await EnterpriseApplication.find()
  const stats = {
    total: allApps.length,
    applied: allApps.filter((a) => a.status === 'applied').length,
    shortlisted: allApps.filter((a) => ['shortlisted', 'under_review'].includes(a.status)).length,
    interviewed: allApps.filter((a) => a.status === 'interview_scheduled').length,
    offered: allApps.filter((a) => a.status === 'offered').length,
    accepted: allApps.filter((a) => ['offer_accepted', 'joining_pending'].includes(a.status)).length,
    joined: allApps.filter((a) => a.status === 'joined').length,
  }

  return sendSuccess(res, {
    data: {
      applications,
      stats,
    },
  })
})

/** GET /api/admin/enterprise/direct-requests - Daily/Hourly enterprise requirements routed to Admin */
export const getEnterpriseDirectRequests = asyncHandler(async (req, res) => {
  const { status } = req.query
  const query = { dispatchMode: 'admin' }
  if (status && status !== 'all') query.adminRequestStatus = status

  const [requests, counts] = await Promise.all([
    EnterpriseJob.find(query)
      .populate('enterpriseId', 'fullName email phone profileImageUrl enterpriseProfile')
      .populate('categoryId', 'name')
      .populate('adminRespondedBy', 'fullName')
      .populate('assignedWorkers.workerId', ASSIGNED_WORKER_SELECT)
      .sort({ createdAt: -1 }),
    EnterpriseJob.aggregate([
      { $match: { dispatchMode: 'admin' } },
      { $group: { _id: '$adminRequestStatus', count: { $sum: 1 } } },
    ]),
  ])

  const stats = { pending: 0, accepted: 0, rejected: 0 }
  counts.forEach((c) => {
    if (c._id in stats) stats[c._id] = c.count
  })

  return sendSuccess(res, { data: { requests, stats } })
})

/** PATCH /api/admin/enterprise/direct-requests/:id/respond - Admin accepts or rejects a daily/hourly request */
export const respondEnterpriseDirectRequest = asyncHandler(async (req, res) => {
  const { action, note } = req.body // action: 'accept' | 'reject'
  if (!['accept', 'reject'].includes(action)) {
    return sendError(res, { message: 'Invalid action', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const job = await EnterpriseJob.findOne({ _id: req.params.id, dispatchMode: 'admin' })
  if (!job) {
    return sendError(res, { message: 'Request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  if (job.adminRequestStatus !== 'pending') {
    return sendError(res, { message: `Request is already ${job.adminRequestStatus}`, statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  if (action === 'reject' && !note?.trim()) {
    return sendError(res, { message: 'Please provide a reason for rejecting', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const accepted = action === 'accept'
  job.adminRequestStatus = accepted ? 'accepted' : 'rejected'
  job.status = accepted ? 'approved' : 'rejected'
  job.isLive = false
  job.adminRespondedAt = new Date()
  job.adminRespondedBy = req.user._id
  if (note !== undefined) job.adminResponseNote = note.trim()
  await job.save()

  triggerNotification({
    userId: job.enterpriseId,
    title: accepted ? 'Request Accepted by Staffivaa ✅' : 'Request Declined by Staffivaa',
    body: accepted
      ? `Your ${job.salaryType} requirement "${job.jobTitle}" (${job.numberOfWorkers} worker(s)) has been accepted by Staffivaa Admin.`
      : `Your ${job.salaryType} requirement "${job.jobTitle}" was declined. Reason: ${job.adminResponseNote}`,
    type: accepted ? 'ENTERPRISE_DIRECT_REQUEST_ACCEPTED' : 'ENTERPRISE_DIRECT_REQUEST_REJECTED',
    relatedId: job._id,
    relatedModel: 'EnterpriseJob',
  }).catch((err) => console.error('[Notification Error]:', err.message))

  emitToUser('enterprise', String(job.enterpriseId), 'enterprise_jobs_updated', {
    type: 'direct_request_responded',
    jobId: job._id,
    adminRequestStatus: job.adminRequestStatus,
  })

  await logAudit({
    adminId: req.user._id,
    action: `${accepted ? 'Accepted' : 'Rejected'} Enterprise Daily/Hourly Request`,
    module: 'Enterprise Admin',
    details: { jobId: job._id, title: job.jobTitle, note: job.adminResponseNote },
    req,
  })

  return sendSuccess(res, {
    message: accepted ? 'Request accepted' : 'Request rejected',
    data: job,
  })
})

const ASSIGNED_WORKER_SELECT = 'fullName phone profileImageUrl labourProfile.availabilityStatus labourProfile.kycStatus'
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** GET /api/admin/enterprise/direct-requests/:id/matching-workers - Labour whose skills match the request */
export const getDirectRequestMatchingWorkers = asyncHandler(async (req, res) => {
  const job = await EnterpriseJob.findOne({ _id: req.params.id, dispatchMode: 'admin' }).populate('categoryId', 'name')
  if (!job) {
    return sendError(res, { message: 'Request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const { search, showAll } = req.query
  const and = [
    { role: USER_ROLES.LABOUR },
    { isActive: { $ne: false } },
    { $or: [{ accountStatus: 'active' }, { accountStatus: { $exists: false } }] },
  ]

  // Skill match: same category, or a free-text skill matching the category name / job title
  if (showAll !== 'true') {
    const skillTerms = [job.categoryId?.name, job.jobTitle].filter(Boolean).map((t) => new RegExp(escapeRegex(t), 'i'))
    const matchOr = [{ 'labourProfile.skills': { $in: skillTerms } }]
    if (job.categoryId?._id) matchOr.push({ 'labourProfile.categoryIds': job.categoryId._id })
    and.push({ $or: matchOr })
  }

  if (search?.trim()) {
    const rx = new RegExp(escapeRegex(search.trim()), 'i')
    and.push({ $or: [{ fullName: rx }, { phone: rx }] })
  }

  const workers = await User.find({ $and: and })
    .select('fullName phone profileImageUrl labourProfile.availabilityStatus labourProfile.kycStatus labourProfile.skills labourProfile.categoryIds')
    .populate('labourProfile.categoryIds', 'name')
    .sort({ fullName: 1 })
    .limit(100)
    .lean()

  const assignedIds = new Set(job.assignedWorkers.filter((w) => w.workerId).map((w) => String(w.workerId)))

  return sendSuccess(res, {
    data: workers.map((w) => ({ ...w, isAssigned: assignedIds.has(String(w._id)) })),
  })
})

/** POST /api/admin/enterprise/direct-requests/:id/assign-workers - Assign registered and/or off-app workers */
export const assignDirectRequestWorkers = asyncHandler(async (req, res) => {
  const { workerIds = [], externalWorkers = [] } = req.body

  const job = await EnterpriseJob.findOne({ _id: req.params.id, dispatchMode: 'admin' })
  if (!job) {
    return sendError(res, { message: 'Request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  if (job.adminRequestStatus !== 'accepted') {
    return sendError(res, { message: 'Accept the request before assigning workers', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Pay the admin sets for these workers (shown to them; credited on payout). Defaults to the enterprise rate.
  const { payRate, error: payError } = parseWorkerPayRate(job, req.body.payRate)
  if (payError) return sendError(res, { message: payError, statusCode: HTTP_STATUS.BAD_REQUEST })

  const alreadyIds = new Set(job.assignedWorkers.filter((w) => w.workerId).map((w) => String(w.workerId)))
  const alreadyPhones = new Set(job.assignedWorkers.map((w) => w.phone).filter(Boolean))

  // Registered workers
  const uniqueIds = [...new Set(workerIds.map(String))].filter((id) => !alreadyIds.has(id))
  const registered = uniqueIds.length
    ? await User.find({ _id: { $in: uniqueIds }, role: USER_ROLES.LABOUR }).select('fullName phone')
    : []
  if (registered.length !== uniqueIds.length) {
    return sendError(res, { message: 'One or more selected workers were not found', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Off-app workers captured by name + phone
  const external = []
  for (const w of externalWorkers) {
    const name = String(w?.name || '').trim()
    const phone = normalizeIndianPhone(String(w?.phone || ''))
    if (!name || !phone) {
      return sendError(res, {
        message: `Enter a valid name and 10-digit mobile number for "${w?.name || 'worker'}"`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
      })
    }
    if (alreadyPhones.has(phone) || external.some((e) => e.phone === phone) || registered.some((r) => r.phone === phone)) continue
    external.push({ name, phone })
  }

  const newEntries = [
    ...registered.map((u) => ({
      workerId: u._id,
      isExternal: false,
      name: u.fullName,
      phone: u.phone,
      payRate,
      assignedBy: req.user._id,
    })),
    ...external.map((e) => ({ ...e, isExternal: true, payRate, assignedBy: req.user._id })),
  ]

  if (newEntries.length === 0) {
    return sendError(res, { message: 'No new workers to assign', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  if (job.assignedWorkers.length + newEntries.length > job.numberOfWorkers) {
    return sendError(res, {
      message: `This request needs ${job.numberOfWorkers} worker(s); ${job.assignedWorkers.length} already assigned.`,
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  job.assignedWorkers.push(...newEntries)
  await job.save()
  await job.populate('assignedWorkers.workerId', ASSIGNED_WORKER_SELECT)

  const names = newEntries.map((e) => e.name).join(', ')
  triggerNotification({
    userId: job.enterpriseId,
    title: 'Workers Assigned to Your Request 👷',
    body: `Staffivaa assigned ${newEntries.length} worker(s) to "${job.jobTitle}": ${names}.`,
    type: 'ENTERPRISE_DIRECT_REQUEST_WORKERS_ASSIGNED',
    relatedId: job._id,
    relatedModel: 'EnterpriseJob',
  }).catch((err) => console.error('[Notification Error]:', err.message))

  const joiningStr = job.timeline?.expectedJoiningDate
    ? new Date(job.timeline.expectedJoiningDate).toLocaleDateString('en-IN')
    : 'TBD'
  for (const u of registered) {
    triggerNotification({
      userId: u._id,
      title: 'New Work Assignment 🏗️',
      body: `You have been assigned to "${job.jobTitle}" at ${job.locationText}. Joining: ${joiningStr}. Pay: ₹${payRate.toLocaleString('en-IN')} / ${job.salaryType === 'hourly' ? 'hour' : 'day'}.`,
      type: 'ENTERPRISE_DIRECT_ASSIGNMENT',
      relatedId: job._id,
      relatedModel: 'EnterpriseJob',
    }).catch((err) => console.error('[Notification Error]:', err.message))
  }

  emitToUser('enterprise', String(job.enterpriseId), 'enterprise_jobs_updated', { type: 'direct_request_workers_assigned', jobId: job._id })

  await logAudit({
    adminId: req.user._id,
    action: 'Assigned Workers to Enterprise Daily/Hourly Request',
    module: 'Enterprise Admin',
    details: { jobId: job._id, payRate, workers: newEntries.map((e) => ({ name: e.name, phone: e.phone, isExternal: e.isExternal })) },
    req,
  })

  return sendSuccess(res, { message: `${newEntries.length} worker(s) assigned`, data: job })
})

/** DELETE /api/admin/enterprise/direct-requests/:id/assigned-workers/:entryId - Remove an assigned worker */
export const removeDirectRequestWorker = asyncHandler(async (req, res) => {
  const job = await EnterpriseJob.findOne({ _id: req.params.id, dispatchMode: 'admin' })
  if (!job) {
    return sendError(res, { message: 'Request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  const entry = job.assignedWorkers.id(req.params.entryId)
  if (!entry) {
    return sendError(res, { message: 'Assigned worker not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const removedName = entry.name
  entry.deleteOne()
  await job.save()
  await job.populate('assignedWorkers.workerId', ASSIGNED_WORKER_SELECT)

  emitToUser('enterprise', String(job.enterpriseId), 'enterprise_jobs_updated', { type: 'direct_request_workers_assigned', jobId: job._id })

  await logAudit({
    adminId: req.user._id,
    action: 'Removed Worker from Enterprise Daily/Hourly Request',
    module: 'Enterprise Admin',
    details: { jobId: job._id, worker: removedName },
    req,
  })

  return sendSuccess(res, { message: `${removedName} removed`, data: job })
})

/**
 * PATCH /api/admin/enterprise/direct-requests/:id/assigned-workers/:entryId  { payRate }
 * Change an assigned worker's pay. Applies to future payouts only — already-paid days keep their amounts.
 */
export const updateDirectRequestWorkerPay = asyncHandler(async (req, res) => {
  const job = await EnterpriseJob.findOne({ _id: req.params.id, dispatchMode: 'admin' })
  if (!job) {
    return sendError(res, { message: 'Request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  const entry = job.assignedWorkers.id(req.params.entryId)
  if (!entry) {
    return sendError(res, { message: 'Assigned worker not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const { payRate, error } = parseWorkerPayRate(job, req.body?.payRate)
  if (error) return sendError(res, { message: error, statusCode: HTTP_STATUS.BAD_REQUEST })

  const previous = Number(entry.payRate) > 0 ? Number(entry.payRate) : Number(job.salary)
  entry.payRate = payRate
  await job.save()
  await job.populate('assignedWorkers.workerId', ASSIGNED_WORKER_SELECT)

  const unit = job.salaryType === 'hourly' ? 'hour' : 'day'
  if (entry.workerId && !entry.isExternal && previous !== payRate) {
    const workerId = String(entry.workerId._id || entry.workerId)
    triggerNotification({
      userId: workerId,
      title: 'Your pay was updated 💼',
      body: `Pay for "${job.jobTitle}" is now ₹${payRate.toLocaleString('en-IN')} / ${unit}.`,
      type: 'ENTERPRISE_DIRECT_PAY_UPDATED',
      relatedId: job._id,
      relatedModel: 'EnterpriseJob',
      url: '/app/enterprise-jobs',
    }).catch((err) => console.error('[Notification Error]:', err.message))
    emitToUser('labour', workerId, 'enterprise_direct_assignment_updated', { type: 'pay_updated', jobId: job._id })
  }

  await logAudit({
    adminId: req.user._id,
    action: 'Updated Worker Pay (Enterprise Daily/Hourly Request)',
    module: 'Enterprise Admin',
    details: { jobId: job._id, worker: entry.name, previous, payRate },
    req,
  })

  return sendSuccess(res, { message: `${entry.name || 'Worker'}'s pay set to ₹${payRate} / ${unit}`, data: job })
})
