import { User } from '../models/User.js'
import { EnterpriseJob } from '../models/EnterpriseJob.js'
import { EnterpriseApplication } from '../models/EnterpriseApplication.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { USER_ROLES, ENTERPRISE_STATUS } from '../constants/roles.js'
import { logAudit } from '../utils/auditLogger.js'
import { emitToRole } from '../utils/socket.js'

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
  if (isLive !== undefined) job.isLive = isLive

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
