import mongoose from 'mongoose'
import crypto from 'crypto'
import { razorpay } from '../config/razorpay.js'
import { EnterpriseJob } from '../models/EnterpriseJob.js'
import { EnterpriseApplication } from '../models/EnterpriseApplication.js'
import { User } from '../models/User.js'
import { EnterpriseJoiningInvoice } from '../models/EnterpriseJoiningInvoice.js'
import { EnterpriseEscrowTransaction } from '../models/EnterpriseEscrowTransaction.js'
import { EnterpriseFinancialAuditLog } from '../models/EnterpriseFinancialAuditLog.js'
import { EnterpriseWallet } from '../models/EnterpriseWallet.js'
import { EnterpriseWalletTransaction } from '../models/EnterpriseWalletTransaction.js'
import { SystemSettings } from '../models/SystemSettings.js'
import { AttendanceRecord } from '../models/AttendanceRecord.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { USER_ROLES } from '../constants/roles.js'
import { logAudit } from '../utils/auditLogger.js'
import { emitToRole } from '../utils/socket.js'
import { triggerNotification } from '../utils/notificationTrigger.js'

// ─── Helper: Safe Populate Constants ─────────────────────────────────────────
const COMPANY_SELECT = 'fullName profileImageUrl enterpriseProfile phone email'
const WORKER_SELECT = 'fullName profileImageUrl phone email labourProfile accountStatus createdAt'
const CATEGORY_SELECT = 'name'

/** Helper: Check if Enterprise has overdue invoices and should be restricted from hiring */
export async function checkEnterpriseOverdueRestrictions(enterpriseId) {
  let settings = await SystemSettings.findOne({ singletonId: 'SYSTEM_SETTINGS' })
  const isRestrictionEnabled = settings?.enableEnterpriseOverdueRestrictions ?? true

  if (!isRestrictionEnabled) {
    return { isRestricted: false }
  }

  const now = new Date()

  // Auto-fix any improperly created invoices where dueDate/gracePeriodEndDate was set in the past on creation date
  const pendingInvoices = await EnterpriseJoiningInvoice.find({
    enterpriseId,
    status: 'payment_pending',
  })

  for (const inv of pendingInvoices) {
    const invDate = inv.invoiceDate || inv.createdAt || now
    const configuredDays = inv.configuredDueDays || settings?.advanceInvoiceDueDays || 7
    const configuredGrace = inv.configuredGracePeriodDays || settings?.enterpriseInvoiceGracePeriodDays || 3
    const expectedDueDate = new Date(new Date(invDate).getTime() + configuredDays * 24 * 60 * 60 * 1000)
    const expectedGraceDate = new Date(expectedDueDate.getTime() + configuredGrace * 24 * 60 * 60 * 1000)

    // If dueDate was set equal to or earlier than creation date, update it to the proper future due date
    if (!inv.dueDate || new Date(inv.dueDate) <= new Date(invDate) || new Date(inv.dueDate) < new Date(now.getTime() - 24 * 60 * 60 * 1000)) {
      if (new Date(invDate).getTime() > now.getTime() - configuredDays * 24 * 60 * 60 * 1000) {
        inv.dueDate = expectedDueDate
        inv.gracePeriodEndDate = expectedGraceDate
        await inv.save()
      }
    }
  }

  // An invoice is truly overdue ONLY if explicitly status 'overdue' OR past gracePeriodEndDate & unpaid
  const overdueInvoice = await EnterpriseJoiningInvoice.findOne({
    enterpriseId,
    $or: [
      { status: 'overdue' },
      {
        status: 'payment_pending',
        gracePeriodEndDate: { $lt: now },
        dueDate: { $lt: now },
      },
    ],
  }).populate('jobId', 'jobTitle')

  if (overdueInvoice) {
    const invNum = overdueInvoice.invoiceNumber
    const jobTitle = overdueInvoice.jobId?.jobTitle || 'Requirement'
    return {
      isRestricted: true,
      overdueInvoice,
      message: `Payment Overdue: Invoice #${invNum} (₹${overdueInvoice.totalAmount?.toLocaleString('en-IN')}) for "${jobTitle}" is overdue. Please clear your outstanding invoice to continue hiring on Staffivaa.`,
    }
  }

  return { isRestricted: false }
}

/** GET /api/enterprise/security-settings - Fetch dynamic security wallet balance settings & wallet status */
export const getEnterpriseSecuritySettings = asyncHandler(async (req, res) => {
  let settings = await SystemSettings.findOne({ singletonId: 'SYSTEM_SETTINGS' })
  const isEnabled = settings?.isEnterpriseSecurityBalanceEnabled ?? true
  const requiredBalance = settings?.minimumEnterpriseSecurityBalance || 20000
  const dueDays = settings?.enterpriseInvoiceDueDays || 15
  const graceDays = settings?.enterpriseInvoiceGracePeriodDays || 3

  let currentBalance = 0
  if (req.user && req.user.role === USER_ROLES.ENTERPRISE) {
    const wallet = await EnterpriseWallet.findOne({ enterpriseId: req.user._id })
    currentBalance = wallet?.balance || 0
  }

  const difference = Math.max(0, requiredBalance - currentBalance)
  const isSufficient = currentBalance >= requiredBalance

  const restrictionCheck = req.user?.role === USER_ROLES.ENTERPRISE
    ? await checkEnterpriseOverdueRestrictions(req.user._id)
    : { isRestricted: false }

  return sendSuccess(res, {
    data: {
      isEnabled,
      requiredBalance,
      currentBalance,
      difference,
      isSufficient,
      dueDays,
      graceDays,
      isPaymentOverdueRestricted: restrictionCheck.isRestricted,
      overdueMessage: restrictionCheck.message || null,
      overdueInvoice: restrictionCheck.overdueInvoice || null,
      timelineConfig: settings?.timelineConfig || {
        defaultApplicationWindowDays: 10,
        defaultInterviewGapDays: 2,
        defaultJoiningGapDays: 5,
        defaultProjectDurationDays: 90,
        advancePaymentDueBufferHours: 48,
      }
    },
  })
})

/** POST /api/enterprise/jobs - Create a new job requirement */
/** GET /api/enterprise/dashboard-overview - Real-time Database Overview Metrics for Enterprise Panel */
export const getEnterpriseDashboardOverview = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const enterpriseId = req.user._id

  // 1. Enterprise Profile User Info
  const user = await User.findById(enterpriseId).select('fullName email phone enterpriseProfile profileImageUrl')

  // 2. Jobs Statistics
  const totalJobs = await EnterpriseJob.countDocuments({ enterpriseId })
  const activeJobs = await EnterpriseJob.countDocuments({ enterpriseId, isLive: true, status: 'approved' })
  const totalVacanciesResult = await EnterpriseJob.aggregate([
    { $match: { enterpriseId } },
    { $group: { _id: null, totalVacancies: { $sum: '$numberOfWorkers' } } },
  ])
  const totalVacancies = totalVacanciesResult[0]?.totalVacancies || 0

  // 3. Applications & Recruitment Pipeline Statistics
  const totalApplicants = await EnterpriseApplication.countDocuments({ enterpriseId })
  const appliedCount = await EnterpriseApplication.countDocuments({ enterpriseId, status: 'applied' })
  const shortlistedCount = await EnterpriseApplication.countDocuments({ enterpriseId, status: 'shortlisted' })
  const interviewScheduledCount = await EnterpriseApplication.countDocuments({ enterpriseId, status: 'interview_scheduled' })
  const offerSentCount = await EnterpriseApplication.countDocuments({ enterpriseId, status: 'offered' })
  const pendingJoiningPaymentCount = await EnterpriseApplication.countDocuments({ enterpriseId, status: 'waiting_for_joining_payment' })
  const activeWorkforceCount = await EnterpriseApplication.countDocuments({ enterpriseId, status: { $in: ['joining_activated', 'joined'] } })

  // 4. Wallet & Escrow Financial Summary
  let wallet = await EnterpriseWallet.findOne({ enterpriseId })
  if (!wallet) {
    wallet = await EnterpriseWallet.create({ enterpriseId, balance: 0 })
  }

  const pendingInvoices = await EnterpriseJoiningInvoice.find({ enterpriseId, status: 'payment_pending' })
  const pendingInvoicesAmount = pendingInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0)

  // 5. Recent Job Applications (Latest 5)
  const recentApplications = await EnterpriseApplication.find({ enterpriseId })
    .populate('jobId', 'jobTitle salary locationText department')
    .populate('workerId', WORKER_SELECT)
    .sort({ updatedAt: -1 })
    .limit(5)

  // 6. Upcoming Joinings / Pending Invoices (Latest 5)
  const upcomingJoinings = await EnterpriseApplication.find({
    enterpriseId,
    status: { $in: ['waiting_for_joining_payment', 'joining_activated', 'joined'] },
  })
    .populate('jobId', 'jobTitle salary locationText department')
    .populate('workerId', WORKER_SELECT)
    .populate('joiningInvoiceId')
    .sort({ updatedAt: -1 })
    .limit(5)

  // 7. Active Workforce List (Latest 5)
  const activeWorkforceList = await EnterpriseApplication.find({
    enterpriseId,
    status: { $in: ['joining_activated', 'joined'] },
  })
    .populate('jobId', 'jobTitle department locationText')
    .populate('workerId', WORKER_SELECT)
    .sort({ updatedAt: -1 })
    .limit(5)

  return sendSuccess(res, {
    data: {
      profile: {
        fullName: user?.fullName || 'Enterprise Client',
        companyName: user?.enterpriseProfile?.companyName || user?.fullName || 'Enterprise Client',
        companyLogo: user?.profileImageUrl || user?.enterpriseProfile?.companyLogo || null,
        email: user?.email,
      },
      kpis: {
        activeWorkforceCount,
        activeJobsCount: activeJobs,
        totalJobsCount: totalJobs,
        totalVacancies,
        totalApplicantsCount: totalApplicants,
        walletBalance: wallet.balance || 0,
        totalRecharged: wallet.totalRecharged || 0,
        totalSpent: wallet.totalSpent || 0,
        pendingInvoicesCount: pendingInvoices.length,
        pendingInvoicesAmount,
      },
      pipeline: {
        appliedCount,
        shortlistedCount,
        interviewScheduledCount,
        offerSentCount,
        pendingJoiningPaymentCount,
        activeWorkforceCount,
      },
      recentApplications,
      upcomingJoinings,
      activeWorkforceList,
    },
  })
})

export const createEnterpriseJob = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  // ─── 1. Check Overdue Payment Hiring Restrictions ───────────────────────
  const restrictionCheck = await checkEnterpriseOverdueRestrictions(req.user._id)
  if (restrictionCheck.isRestricted) {
    return sendError(res, {
      message: restrictionCheck.message,
      statusCode: HTTP_STATUS.BAD_REQUEST,
      data: {
        isPaymentOverdueRestricted: true,
        overdueInvoice: restrictionCheck.overdueInvoice,
      },
    })
  }

  // Job Creation is FREE — Minimum Wallet Balance Check Removed per Business Rule.


  const {
    jobTitle, department, categoryId, numberOfWorkers, locationText, locationPoint,
    salary, salaryType, experienceRequired, workingHours, shift,
    providesAccommodation, providesFood, providesTransportation, contractDuration,
    jobDescription, timeline
  } = req.body

  const job = await EnterpriseJob.create({
    enterpriseId: req.user._id,
    jobTitle, department, categoryId, numberOfWorkers, locationText, locationPoint,
    salary, salaryType, experienceRequired, workingHours, shift,
    providesAccommodation, providesFood, providesTransportation, contractDuration,
    jobDescription, timeline,
    status: 'approved', // Auto-approved for real-time reflection
    isLive: true,
  })

  // Emit event to all labours so their banner updates in real-time
  emitToRole('labour', 'enterprise_jobs_updated', { type: 'enterprise_job_created', jobId: job._id })

  // ─── Trigger Targeted Real-Time Job Notifications ─────────────────────────
  try {
    const settings = await SystemSettings.findOne({ singletonId: 'SYSTEM_SETTINGS' })
    const notifConfig = settings?.jobNotificationConfig || {}

    if (notifConfig.enableInAppNotifications !== false || notifConfig.enablePushNotifications !== false) {
      const enterpriseUser = await User.findById(req.user._id).select('fullName enterpriseProfile')
      const companyName = enterpriseUser?.enterpriseProfile?.companyName || enterpriseUser?.fullName || 'Enterprise Company'

      const workerQuery = {
        role: USER_ROLES.LABOUR,
        isActive: true,
        accountStatus: 'active',
      }

      if (notifConfig.requireKycApprovedForJobNotifications !== false) {
        workerQuery['labourProfile.kycStatus'] = 'approved'
      }

      workerQuery['labourProfile.availabilityStatus'] = { $ne: 'busy' }

      if (categoryId) {
        workerQuery['$or'] = [
          { 'labourProfile.categoryIds': categoryId },
          { 'labourProfile.skills': { $regex: new RegExp(jobTitle, 'i') } }
        ]
      }

      const eligibleWorkers = await User.find(workerQuery).select('_id fullName')

      const formattedSalary = salary ? `₹${Number(salary).toLocaleString('en-IN')}/${salaryType || 'month'}` : ''
      const locationCity = locationText ? locationText.split(',')[0].trim() : 'your city'

      const notifTitle = `🏢 New Enterprise Job Available`
      const notifBody = `${companyName} has posted a new ${jobTitle} job in ${locationCity}. Salary: ${formattedSalary}. Tap to Apply.`

      // Trigger DB Notification + Socket.IO + Push Notification concurrently
      Promise.allSettled(
        eligibleWorkers.map(worker =>
          triggerNotification({
            userId: worker._id,
            title: notifTitle,
            body: notifBody,
            type: 'ENTERPRISE_JOB_ALERT',
            relatedId: job._id,
            relatedModel: 'EnterpriseJob',
          })
        )
      ).catch(err => console.error('[Enterprise Job Notification Error]:', err.message))
    }
  } catch (err) {
    console.error('[Enterprise Job Notification Trigger Error]:', err)
  }

  await logAudit({
    adminId: req.user._id,
    action: 'Enterprise Job Created',
    module: 'Enterprise Jobs',
    details: { jobId: job._id, title: job.jobTitle },
    req,
  })

  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    data: job,
  })
})

const HIRED_STATUSES = [
  'offer_accepted',
  'waiting_for_joining_payment',
  'joining_pending',
  'joining_activated',
  'joined',
]

/** GET /api/enterprise/jobs - List enterprise jobs for the logged-in company */
export const getEnterpriseJobs = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const jobs = await EnterpriseJob.find({ enterpriseId: req.user._id })
    .populate('categoryId', CATEGORY_SELECT)
    .sort({ createdAt: -1 })

  const now = new Date()

  const jobsWithStats = await Promise.all(
    jobs.map(async (job) => {
      const jobObj = job.toObject()
      const acceptedCount = await EnterpriseApplication.countDocuments({
        jobId: job._id,
        status: { $in: HIRED_STATUSES },
      })
      const joinedCount = await EnterpriseApplication.countDocuments({
        jobId: job._id,
        status: { $in: ['joining_activated', 'joined'] },
      })

      const isFilled = acceptedCount >= (job.numberOfWorkers || 1)
      let isExpired = false
      if (job.timeline?.applicationLastDate) {
        const lastDate = new Date(job.timeline.applicationLastDate)
        lastDate.setHours(23, 59, 59, 999)
        if (now > lastDate) isExpired = true
      }

      jobObj.acceptedCount = acceptedCount
      jobObj.joinedCount = joinedCount
      jobObj.isFilled = isFilled
      jobObj.isExpired = isExpired
      jobObj.displayStatus = isFilled ? 'filled' : isExpired ? 'expired' : job.status
      return jobObj
    })
  )

  return sendSuccess(res, { data: jobsWithStats })
})

/** GET /api/enterprise/public-jobs - Feed for Labour app (list) */
export const getPublicEnterpriseJobs = asyncHandler(async (req, res) => {
  const { category, minSalary, maxSalary, location, search } = req.query

  const query = { isLive: true, status: 'approved' }

  if (category) query.categoryId = category

  if (minSalary || maxSalary) {
    query.salary = {}
    if (minSalary) query.salary.$gte = Number(minSalary)
    if (maxSalary) query.salary.$lte = Number(maxSalary)
  }

  if (location) query.locationText = { $regex: location, $options: 'i' }

  if (search) {
    query.$or = [
      { jobTitle: { $regex: search, $options: 'i' } },
      { department: { $regex: search, $options: 'i' } },
      { skillsRequired: { $regex: search, $options: 'i' } },
    ]
  }

  const jobs = await EnterpriseJob.find(query)
    .populate('enterpriseId', COMPANY_SELECT)
    .populate('categoryId', CATEGORY_SELECT)
    .sort({ createdAt: -1 })
    .limit(100)

  const now = new Date()
  const validJobs = []

  for (const job of jobs) {
    // 1. Check if application deadline has expired
    if (job.timeline?.applicationLastDate) {
      const lastDate = new Date(job.timeline.applicationLastDate)
      lastDate.setHours(23, 59, 59, 999)
      if (now > lastDate) {
        continue // Skip expired jobs
      }
    }

    // 2. Check if all vacancies have been hired/accepted
    const hiredCount = await EnterpriseApplication.countDocuments({
      jobId: job._id,
      status: { $in: HIRED_STATUSES },
    })

    if (hiredCount >= (job.numberOfWorkers || 1)) {
      continue // Skip fully filled jobs
    }

    const jobObj = job.toObject()
    jobObj.remainingVacancies = Math.max(0, (job.numberOfWorkers || 1) - hiredCount)
    jobObj.hiredCount = hiredCount
    validJobs.push(jobObj)
  }

  let myApplicationsMap = {}
  if (req.user?.role === USER_ROLES.LABOUR) {
    const jobIds = validJobs.map(j => j._id)
    const apps = await EnterpriseApplication.find({
      jobId: { $in: jobIds },
      workerId: req.user._id,
    }).select('jobId status createdAt enterpriseNote')

    apps.forEach(app => {
      myApplicationsMap[app.jobId.toString()] = {
        applicationId: app._id,
        status: app.status,
        appliedAt: app.createdAt,
      }
    })
  }

  const jobsWithAppData = validJobs.map(jobObj => {
    const appInfo = myApplicationsMap[jobObj._id.toString()] || null
    return {
      ...jobObj,
      alreadyApplied: Boolean(appInfo),
      userApplication: appInfo,
    }
  })

  return sendSuccess(res, { data: jobsWithAppData })
})

/** GET /api/enterprise/public-jobs/:id - Single job detail */
export const getPublicEnterpriseJobById = asyncHandler(async (req, res) => {
  const job = await EnterpriseJob.findOne({ _id: req.params.id, isLive: true, status: 'approved' })
    .populate('enterpriseId', COMPANY_SELECT)
    .populate('categoryId', CATEGORY_SELECT)

  if (!job) {
    return sendError(res, { message: 'Job not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Check if expired or filled
  const now = new Date()
  if (job.timeline?.applicationLastDate) {
    const lastDate = new Date(job.timeline.applicationLastDate)
    lastDate.setHours(23, 59, 59, 999)
    if (now > lastDate) {
      return sendError(res, { message: 'This job requirement deadline has expired', statusCode: HTTP_STATUS.GONE })
    }
  }

  const hiredCount = await EnterpriseApplication.countDocuments({
    jobId: job._id,
    status: { $in: HIRED_STATUSES },
  })

  const existingApp = req.user?.role === USER_ROLES.LABOUR
    ? await EnterpriseApplication.findOne({ jobId: job._id, workerId: req.user._id })
    : null

  if (hiredCount >= (job.numberOfWorkers || 1) && !existingApp) {
    return sendError(res, { message: 'All vacancies for this job requirement have been filled', statusCode: HTTP_STATUS.GONE })
  }

  const applicantsCount = await EnterpriseApplication.countDocuments({ jobId: job._id })

  let alreadyApplied = false
  let userApplication = null
  if (req.user?.role === USER_ROLES.LABOUR) {
    const existing = await EnterpriseApplication.findOne({ jobId: job._id, workerId: req.user._id })
    alreadyApplied = Boolean(existing)
    if (existing) {
      userApplication = {
        applicationId: existing._id,
        status: existing.status,
        appliedAt: existing.createdAt,
      }
    }
  }

  const similarJobs = await EnterpriseJob.find({
    categoryId: job.categoryId,
    _id: { $ne: job._id },
    isLive: true,
    status: 'approved',
  })
    .populate('enterpriseId', COMPANY_SELECT)
    .populate('categoryId', CATEGORY_SELECT)
    .limit(4)
    .sort({ createdAt: -1 })

  return sendSuccess(res, {
    data: {
      job,
      applicantsCount,
      alreadyApplied,
      userApplication,
      similarJobs,
    },
  })
})

/** POST /api/enterprise/applications - Labour applies to a job */
export const applyToEnterpriseJob = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.LABOUR) {
    return sendError(res, { message: 'Only labour workers can apply', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const { jobId } = req.body

  const job = await EnterpriseJob.findOne({ _id: jobId, isLive: true, status: 'approved' })
  if (!job) {
    return sendError(res, { message: 'Job not found or not accepting applications', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const existing = await EnterpriseApplication.findOne({ jobId, workerId: req.user._id })
  if (existing) {
    return sendError(res, {
      message: 'You have already applied to this job',
      statusCode: HTTP_STATUS.CONFLICT,
    })
  }

  const application = await EnterpriseApplication.create({
    jobId,
    enterpriseId: job.enterpriseId,
    workerId: req.user._id,
    status: 'applied',
  })

  // Emit event to enterprise HR
  emitToRole('enterprise', 'enterprise_application_created', {
    type: 'new_application',
    applicationId: application._id,
    jobId: job._id,
    workerId: req.user._id,
  })

  // Trigger real-time socket + DB + FCM Push Notification to Enterprise HR
  const workerUser = await User.findById(req.user._id).select('fullName phone')
  const workerName = workerUser?.fullName || 'A candidate'
  const jobTitle = job.jobTitle || 'Job Requirement'

  triggerNotification({
    userId: job.enterpriseId,
    title: 'New Job Application Received! 💼',
    body: `${workerName} has applied for "${jobTitle}".`,
    type: 'NEW_JOB_APPLICATION',
    relatedId: application._id,
    relatedModel: 'EnterpriseApplication',
  }).catch((err) => console.error('[Notification Error]:', err.message))

  return sendSuccess(res, {
    message: 'Application submitted successfully!',
    statusCode: HTTP_STATUS.CREATED,
    data: application,
  })
})

/** GET /api/enterprise/my-applications - Labour sees all their applications */
export const getMyApplications = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.LABOUR) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const applications = await EnterpriseApplication.find({ workerId: req.user._id })
    .populate({
      path: 'jobId',
      select: 'jobTitle salary salaryType locationText categoryId enterpriseId department experienceRequired',
      populate: [
        { path: 'categoryId', select: 'name' },
        { path: 'enterpriseId', select: 'fullName profileImageUrl enterpriseProfile' },
      ],
    })
    .sort({ createdAt: -1 })

  return sendSuccess(res, { data: applications })
})

// ─── ENTERPRISE RECRUITMENT WORKFLOW CONTROLLERS ─────────────────────────────

/** GET /api/enterprise/company-applications - Enterprise HR lists candidate applications */
export const getEnterpriseCompanyApplications = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const { status, search, jobId } = req.query
  const query = { enterpriseId: req.user._id }

  if (status && status !== 'all') {
    query.status = status
  }

  if (jobId) {
    query.jobId = jobId
  }

  let applications = await EnterpriseApplication.find(query)
    .populate({
      path: 'workerId',
      select: WORKER_SELECT,
      populate: { path: 'labourProfile.categoryIds', select: 'name' },
    })
    .populate({
      path: 'jobId',
      select: 'jobTitle salary salaryType locationText categoryId department experienceRequired',
      populate: { path: 'categoryId', select: 'name' },
    })
    .sort({ createdAt: -1 })

  // Search by worker name, phone, or job title
  if (search) {
    const q = search.toLowerCase()
    applications = applications.filter((app) => {
      const workerName = app.workerId?.fullName?.toLowerCase() || ''
      const workerPhone = app.workerId?.phone || ''
      const jobTitle = app.jobId?.jobTitle?.toLowerCase() || ''
      return workerName.includes(q) || workerPhone.includes(q) || jobTitle.includes(q)
    })
  }

  // Summary Counts for Dashboard Cards
  const allCompanyApps = await EnterpriseApplication.find({ enterpriseId: req.user._id })
  const stats = {
    total: allCompanyApps.length,
    applied: allCompanyApps.filter((a) => a.status === 'applied').length,
    under_review: allCompanyApps.filter((a) => a.status === 'under_review').length,
    shortlisted: allCompanyApps.filter((a) => a.status === 'shortlisted').length,
    interview_scheduled: allCompanyApps.filter((a) => a.status === 'interview_scheduled').length,
    selected: allCompanyApps.filter((a) => a.status === 'selected').length,
    offered: allCompanyApps.filter((a) => a.status === 'offered').length,
    joining_pending: allCompanyApps.filter((a) => ['offer_accepted', 'joining_pending'].includes(a.status)).length,
    joined: allCompanyApps.filter((a) => a.status === 'joined').length,
    rejected: allCompanyApps.filter((a) => a.status === 'rejected').length,
  }

  return sendSuccess(res, {
    data: {
      applications,
      stats,
    },
  })
})

/** PATCH /api/enterprise/applications/:id/status - HR updates candidate status */
export const updateApplicationStatus = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const { status, enterpriseNote } = req.body
  const application = await EnterpriseApplication.findOne({
    _id: req.params.id,
    enterpriseId: req.user._id,
  })

  if (!application) {
    return sendError(res, { message: 'Application not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (status) application.status = status
  if (enterpriseNote !== undefined) application.enterpriseNote = enterpriseNote

  await application.save()

  // Notify Labour via socket and push notification
  emitToRole('labour', 'enterprise_application_updated', {
    type: 'status_changed',
    applicationId: application._id,
    workerId: application.workerId,
    status: application.status,
  })

  const jobObj = await EnterpriseJob.findById(application.jobId).select('jobTitle')
  const jobTitleStr = jobObj?.jobTitle || 'Job Requirement'

  const enterpriseUser = await User.findById(req.user._id).select('fullName enterpriseProfile')
  const companyName = enterpriseUser?.enterpriseProfile?.companyName || enterpriseUser?.fullName || 'Enterprise Client'

  let notifTitle = `Application Status Updated: ${status.replace('_', ' ').toUpperCase()} 📋`
  let notifBody = `Your application status for "${jobTitleStr}" at ${companyName} has been updated to ${status.replace('_', ' ')}.`

  if (status === 'shortlisted') {
    notifTitle = 'You Are Shortlisted! 🎉'
    notifBody = `Congratulations! Your application for "${jobTitleStr}" at ${companyName} has been shortlisted. Expect an interview invitation soon!`
  } else if (status === 'selected') {
    notifTitle = 'You Are Selected! 🏆'
    notifBody = `Great news! You have been selected for "${jobTitleStr}" at ${companyName}. Check your application for official offer letter details.`
  } else if (status === 'rejected') {
    notifTitle = 'Application Status Update 📌'
    notifBody = `Your application for "${jobTitleStr}" at ${companyName} was not selected. Keep applying for new job opportunities!`
  } else if (status === 'joining_activated' || status === 'joined') {
    notifTitle = 'Deployment Activated! 🏗️'
    notifBody = `Your joining has been confirmed for "${jobTitleStr}" at ${companyName}. You can now start daily site check-ins!`
  }

  triggerNotification({
    userId: application.workerId,
    title: notifTitle,
    body: notifBody,
    type: 'APPLICATION_STATUS_UPDATED',
    relatedId: application._id,
    relatedModel: 'EnterpriseApplication',
  }).catch((err) => console.error('[Notification Error]:', err.message))

  return sendSuccess(res, {
    message: `Candidate status updated to ${status}`,
    data: application,
  })
})

/** POST /api/enterprise/applications/:id/schedule-interview - Schedule or update interview */
export const scheduleInterview = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const {
    round,
    date,
    time,
    duration,
    mode,
    location,
    officeName,
    joinUrl,
    phoneNumber,
    contactPersonName,
    contactPersonMobile,
    contactPersonDesignation,
    contactPersonEmail,
    requiredDocuments,
    candidateInstructions,
    internalNotes,
    notes,
  } = req.body

  const application = await EnterpriseApplication.findOne({
    _id: req.params.id,
    enterpriseId: req.user._id,
  }).populate('jobId', 'jobTitle enterpriseId')

  if (!application) {
    return sendError(res, { message: 'Application not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (mode === 'phone' && phoneNumber) {
    const cleanPhone = String(phoneNumber).replace(/\D/g, '')
    if (cleanPhone.length !== 10) {
      return sendError(res, { message: 'Interview contact phone number must be exactly 10 digits', statusCode: HTTP_STATUS.BAD_REQUEST })
    }
  }

  if (contactPersonMobile) {
    const cleanMobile = String(contactPersonMobile).replace(/\D/g, '')
    if (cleanMobile.length !== 10) {
      return sendError(res, { message: 'HR contact mobile number must be exactly 10 digits', statusCode: HTTP_STATUS.BAD_REQUEST })
    }
  }

  const enterpriseUser = await User.findById(req.user._id)
  const companyName = enterpriseUser?.enterpriseProfile?.companyName || enterpriseUser?.fullName || 'Enterprise Client'

  const formattedDate = date ? new Date(date) : new Date()

  application.interviewDetails = {
    round: round || 'HR Round',
    date: formattedDate,
    time: time || '11:00 AM',
    duration: duration || '30 Minutes',
    mode: mode || 'offline',
    location: location || '',
    officeName: officeName || '',
    joinUrl: joinUrl || '',
    phoneNumber: phoneNumber || contactPersonMobile || '',
    contactPersonName: contactPersonName || '',
    contactPersonMobile: contactPersonMobile || '',
    contactPersonDesignation: contactPersonDesignation || 'Hiring Manager',
    contactPersonEmail: contactPersonEmail || enterpriseUser?.email || '',
    requiredDocuments: Array.isArray(requiredDocuments)
      ? requiredDocuments
      : (typeof requiredDocuments === 'string' ? requiredDocuments.split(',').map((s) => s.trim()).filter(Boolean) : ['Resume', 'Aadhaar Card']),
    candidateInstructions: candidateInstructions || notes || '',
    internalNotes: internalNotes || '',
    status: 'scheduled',
    notes: notes || '',
    scheduledAt: new Date(),
    updatedAt: new Date(),
  }
  application.status = 'interview_scheduled'
  await application.save()

  // Socket notification
  emitToRole('labour', 'enterprise_application_updated', {
    type: 'interview_scheduled',
    applicationId: application._id,
    workerId: application.workerId,
  })

  // Real-time Push Notification
  const jobTitle = application.jobId?.jobTitle || 'Role'
  const dateStr = formattedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  triggerNotification({
    userId: application.workerId,
    title: 'Interview Invitation Received 📅',
    body: `Congratulations! ${companyName} has invited you for an interview for "${jobTitle}" on ${dateStr} at ${time}. Tap to view details.`,
    type: 'INTERVIEW_SCHEDULED',
    relatedId: application._id,
    relatedModel: 'EnterpriseApplication',
  }).catch((err) => console.error('[Notification Error]:', err.message))

  return sendSuccess(res, {
    message: 'Interview invitation sent successfully!',
    data: application,
  })
})

/** PATCH /api/enterprise/applications/:id/cancel-interview - Cancel interview */
export const cancelInterview = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const { cancellationReason } = req.body
  const application = await EnterpriseApplication.findOne({
    _id: req.params.id,
    enterpriseId: req.user._id,
  }).populate('jobId', 'jobTitle')

  if (!application || !application.interviewDetails) {
    return sendError(res, { message: 'Interview details not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  application.interviewDetails.status = 'cancelled'
  if (cancellationReason) application.interviewDetails.cancellationReason = cancellationReason
  application.interviewDetails.updatedAt = new Date()
  await application.save()

  const jobTitle = application.jobId?.jobTitle || 'Role'

  triggerNotification({
    userId: application.workerId,
    title: 'Interview Cancelled ❌',
    body: `Your interview for "${jobTitle}" has been cancelled. ${cancellationReason ? `Reason: ${cancellationReason}` : ''}`,
    type: 'INTERVIEW_CANCELLED',
    relatedId: application._id,
    relatedModel: 'EnterpriseApplication',
  }).catch((err) => console.error('[Notification Error]:', err.message))

  return sendSuccess(res, {
    message: 'Interview cancelled successfully',
    data: application,
  })
})

/** GET /api/enterprise/applications/:id/interview - Fetch interview details (Labour + HR view) */
export const getInterviewDetails = asyncHandler(async (req, res) => {
  const application = await EnterpriseApplication.findById(req.params.id)
    .populate({
      path: 'jobId',
      select: 'jobTitle salary salaryType locationText categoryId department experienceRequired description',
      populate: { path: 'categoryId', select: 'name' },
    })
    .populate({
      path: 'enterpriseId',
      select: 'fullName profileImageUrl enterpriseProfile phone email',
    })
    .populate({
      path: 'workerId',
      select: 'fullName profileImageUrl phone email labourProfile',
    })

  if (!application) {
    return sendError(res, { message: 'Application not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Authorization check: User must be either the worker, enterprise HR, or admin
  const isWorker = String(application.workerId?._id) === String(req.user._id)
  const isEnterprise = String(application.enterpriseId?._id) === String(req.user._id)
  const isAdmin = req.user.role === USER_ROLES.ADMIN

  if (!isWorker && !isEnterprise && !isAdmin) {
    return sendError(res, { message: 'Unauthorized to view these interview details', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  // Security enforcement: NEVER include internalNotes if the requester is Labour
  let applicationData = application.toObject()
  if (req.user.role === USER_ROLES.LABOUR && applicationData.interviewDetails) {
    delete applicationData.interviewDetails.internalNotes
  }

  return sendSuccess(res, { data: applicationData })
})

/** POST /api/enterprise/applications/:id/send-offer - Generate & Send Offer Letter */
export const sendOfferLetter = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  // Restrict sending new offers if Enterprise has overdue invoices
  const restrictionCheck = await checkEnterpriseOverdueRestrictions(req.user._id)
  if (restrictionCheck.isRestricted) {
    return sendError(res, {
      message: restrictionCheck.message,
      statusCode: HTTP_STATUS.BAD_REQUEST,
      data: {
        isPaymentOverdueRestricted: true,
        overdueInvoice: restrictionCheck.overdueInvoice,
      },
    })
  }

  const { salary, salaryType, location, joiningDate, workingHours, benefits, documentsRequired, offerLetterUrl } = req.body

  const application = await EnterpriseApplication.findOne({
    _id: req.params.id,
    enterpriseId: req.user._id,
  }).populate('jobId', 'jobTitle')

  if (!application) {
    return sendError(res, { message: 'Application not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const enterpriseUser = await User.findById(req.user._id)
  const companyName = enterpriseUser?.enterpriseProfile?.companyName || enterpriseUser?.fullName || 'Enterprise Client'

  application.offerDetails = {
    companyName,
    roleTitle: application.jobId?.jobTitle || 'Enterprise Role',
    salary: Number(salary),
    salaryType: salaryType || 'monthly',
    location,
    joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
    workingHours: Number(workingHours) || 8,
    benefits: Array.isArray(benefits) ? benefits : [],
    documentsRequired: Array.isArray(documentsRequired) ? documentsRequired : [],
    offerLetterUrl,
    sentAt: new Date(),
  }
  application.status = 'offered'
  await application.save()

  emitToRole('labour', 'enterprise_application_updated', {
    type: 'offer_sent',
    applicationId: application._id,
    workerId: application.workerId,
  })

  const jobTitleStr3 = application.jobId?.jobTitle || 'Job Requirement'

  triggerNotification({
    userId: application.workerId,
    title: 'Official Job Offer Received! 🎉',
    body: `Congratulations! ${companyName} has issued an official offer letter for "${jobTitleStr3}".`,
    type: 'OFFER_SENT',
    relatedId: application._id,
    relatedModel: 'EnterpriseApplication',
  }).catch((err) => console.error('[Notification Error]:', err.message))

  return sendSuccess(res, {
    message: 'Offer letter sent to candidate successfully!',
    data: application,
  })
})

/** POST /api/enterprise/applications/:id/respond-offer - Labour accepts/rejects offer */
export const respondToOffer = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.LABOUR) {
    return sendError(res, { message: 'Only Labour workers can respond to offers', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const { action, reason } = req.body // action: 'accept' | 'reject'
  const application = await EnterpriseApplication.findOne({
    _id: req.params.id,
    workerId: req.user._id,
  }).populate('jobId', 'jobTitle salary enterpriseId timeline')

  if (!application) {
    return sendError(res, { message: 'Application not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  let invoice = null

  if (action === 'accept') {
    application.workerAcceptedOfferAt = new Date()

    // Fetch Admin System Settings for Dynamic Calculation Engine
    let settings = await SystemSettings.findOne({ singletonId: 'SYSTEM_SETTINGS' })
    const advancePct = Number(settings?.advancePaymentPercentage ?? 0)

    if (advancePct > 0) {
      application.status = 'waiting_for_joining_payment'
      const remainingPct = 100 - advancePct
      const platformFeeType = settings?.platformFeeType || 'percentage'
      const platformFeeValue = settings?.platformFeeValue ?? 10
      const isGstEnabled = settings?.isGstEnabled ?? true
      const gstRate = settings?.gstPercentage ?? 18
      const dueDays = settings?.advanceInvoiceDueDays ?? 7
      const graceDays = settings?.enterpriseInvoiceGracePeriodDays ?? 3

      const totalProjectValue = Number(application.offerDetails?.salary || application.jobId?.salary || 10000)

      // 1. Calculate Platform Fee dynamically (Fixed vs Percentage)
      let platformFee = 0
      if (platformFeeType === 'fixed') {
        platformFee = Number(platformFeeValue)
      } else {
        platformFee = Math.round(totalProjectValue * (platformFeeValue / 100))
      }

      const grossSubtotal = totalProjectValue + platformFee

      // 2. Calculate Advance & Remaining amounts dynamically
      const advanceAmount = Math.round(grossSubtotal * (advancePct / 100))
      const remainingAmount = grossSubtotal - advanceAmount

      // 3. Calculate GST dynamically (Enabled/Disabled & Configured Rate)
      let gstAmount = 0
      if (isGstEnabled) {
        gstAmount = Math.round(advanceAmount * (gstRate / 100))
      }

      const totalAmount = advanceAmount + gstAmount

      const invoiceDate = new Date()
      const dueDaysConfig = dueDays || 7
      const dueDate = new Date(invoiceDate.getTime() + dueDaysConfig * 24 * 60 * 60 * 1000)
      const gracePeriodEndDate = new Date(dueDate.getTime() + graceDays * 24 * 60 * 60 * 1000)
      const invNumber = `INV-ADV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`

      // Generate Dynamic Advance Confirmation Invoice
      invoice = await EnterpriseJoiningInvoice.create({
        invoiceNumber: invNumber,
        invoiceType: 'advance_50',
        enterpriseId: application.enterpriseId,
        jobId: application.jobId._id,
        applicationId: application._id,
        workerId: req.user._id,
        totalProjectValue,
        advancePercentage: advancePct,
        remainingPercentage: remainingPct,
        advanceAmount,
        remainingAmount,
        platformFeeType,
        platformFeeValue,
        platformFee,
        grossSubtotal,
        isGstApplied: isGstEnabled,
        gstRate: isGstEnabled ? gstRate : 0,
        gstAmount,
        totalAmount,
        securityDeposit: advanceAmount,
        invoiceDate,
        configuredDueDays: dueDays,
        configuredGracePeriodDays: graceDays,
        dueDate,
        gracePeriodEndDate,
        status: 'payment_pending',
      })

      application.joiningInvoiceId = invoice._id

      // Financial Audit Log
      await EnterpriseFinancialAuditLog.create({
        enterpriseId: application.enterpriseId,
        action: 'invoice_generated',
        amount: totalAmount,
        performedBy: req.user._id,
        relatedInvoiceId: invoice._id,
        relatedApplicationId: application._id,
        details: {
          invoiceNumber: invNumber,
          workerId: req.user._id,
          dueDate: invoice.dueDate,
        },
      })

      // Real-time Push & System Notifications across Enterprise, Worker & Admin
      const workerUser = await User.findById(req.user._id).select('fullName')
      const workerName = workerUser?.fullName || 'Worker'
      const jobTitle = application.jobId?.jobTitle || 'Role'
      const enterpriseUser = await User.findById(application.enterpriseId).select('fullName enterpriseProfile')
      const companyName = enterpriseUser?.enterpriseProfile?.companyName || enterpriseUser?.fullName || 'Enterprise'

      // 1. Enterprise HR Notification
      triggerNotification({
        userId: application.enterpriseId,
        title: 'Worker Accepted Offer! Joining Invoice Generated 📜',
        body: `Your selected worker ${workerName} has accepted the offer for "${jobTitle}". Please complete the required advance payment (${advancePct}% Advance: Invoice #${invNumber}) before the due date to confirm joining.`,
        type: 'JOINING_INVOICE_GENERATED',
        relatedId: invoice._id,
        relatedModel: 'EnterpriseJoiningInvoice',
      }).catch((err) => console.error('[Notification Error]:', err.message))

      // 2. Worker Notification
      triggerNotification({
        userId: req.user._id,
        title: 'Offer Accepted: Waiting For Employer Confirmation ⏳',
        body: `Your offer for "${jobTitle}" has been accepted. Waiting for the employer to complete the joining payment.`,
        type: 'WAITING_FOR_JOINING_PAYMENT',
        relatedId: application._id,
        relatedModel: 'EnterpriseApplication',
      }).catch((err) => console.error('[Notification Error]:', err.message))

      // 3. Admin System Notification
      triggerNotification({
        userId: null,
        title: 'New Joining Invoice Generated 📄',
        body: `New Joining Invoice #${invNumber} (₹${totalAmount.toLocaleString('en-IN')}) generated for candidate ${workerName} at ${companyName}. Status: Payment Pending.`,
        type: 'ADMIN_INVOICE_GENERATED',
        relatedId: invoice._id,
        relatedModel: 'EnterpriseJoiningInvoice',
      }).catch((err) => console.error('[Notification Error]:', err.message))
    } else {
      // FREE JOINING (advancePaymentPercentage === 0)
      // Directly activate joining so candidate can join without payment upfront
      application.status = 'joining_activated'
      if (!application.joiningDetails) application.joiningDetails = {}
      application.joiningDetails.markedJoinedAt = new Date()

      const workerUser = await User.findById(req.user._id).select('fullName')
      const workerName = workerUser?.fullName || 'Worker'
      const jobTitle = application.jobId?.jobTitle || 'Role'
      const joiningDateStr = application.offerDetails?.joiningDate
        ? new Date(application.offerDetails.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'scheduled date'

      triggerNotification({
        userId: application.enterpriseId,
        title: 'Worker Accepted Offer! Joining Confirmed 🎉',
        body: `${workerName} has accepted the job offer for "${jobTitle}". Candidate joining is confirmed for ${joiningDateStr}.`,
        type: 'ENTERPRISE_JOINING_CONFIRMED',
        relatedId: application._id,
        relatedModel: 'EnterpriseApplication',
      }).catch((err) => console.error('[Notification Error]:', err.message))

      triggerNotification({
        userId: req.user._id,
        title: 'Offer Accepted: Joining Confirmed! 🎉',
        body: `Congratulations! You accepted the offer for "${jobTitle}". Your joining is confirmed for ${joiningDateStr}.`,
        type: 'JOINING_CONFIRMED',
        relatedId: application._id,
        relatedModel: 'EnterpriseApplication',
      }).catch((err) => console.error('[Notification Error]:', err.message))
    }
  } else {
    application.status = 'rejected'
    application.workerRejectedOfferAt = new Date()
    application.rejectionReason = reason || 'Worker declined offer'
  }

  await application.save()

  emitToRole('enterprise', 'enterprise_application_updated', {
    type: action === 'accept' ? (invoice ? 'offer_accepted' : 'joining_confirmed') : 'offer_rejected',
    applicationId: application._id,
    enterpriseId: application.enterpriseId,
    invoiceId: invoice?._id,
  })

  return sendSuccess(res, {
    message: action === 'accept'
      ? (invoice ? 'Offer accepted! Your employer has been issued a Joining Confirmation Invoice.' : 'Offer accepted! Your joining is confirmed.')
      : 'Offer declined.',
    data: { application, invoice },
  })
})

/** GET /api/enterprise/joining-invoices - List joining invoices for Enterprise */
export const getEnterpriseInvoices = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const settings = await SystemSettings.findOne({ singletonId: 'SYSTEM_SETTINGS' })
  const advancePct = Number(settings?.advancePaymentPercentage ?? 0)

  let invoices = await EnterpriseJoiningInvoice.find({ enterpriseId: req.user._id })
    .populate({
      path: 'workerId',
      select: WORKER_SELECT,
    })
    .populate({
      path: 'jobId',
      select: 'jobTitle locationText salary salaryType department',
    })
    .populate({
      path: 'applicationId',
      select: 'status',
    })
    .populate('escrowTransactionId')
    .sort({ createdAt: -1 })

  // Dynamic Rule: If system Advance Payment Percentage is 0%, OR if candidate is already activated/joined/completed,
  // mark advance joining confirmation invoices as cancelled so they do not show up as pending.
  invoices = invoices.map(inv => {
    const invObj = inv.toObject()
    const appStatus = invObj.applicationId?.status
    const isAdvanceInv = invObj.advanceAmount > 0 || invObj.invoiceType === 'advance_50'

    if (invObj.status === 'payment_pending') {
      if (advancePct === 0 && isAdvanceInv) {
        invObj.status = 'cancelled'
      } else if (appStatus && ['joining_activated', 'joined', 'completed', 'rejected', 'cancelled'].includes(appStatus) && isAdvanceInv) {
        invObj.status = 'cancelled'
      }
    }
    return invObj
  })

  return sendSuccess(res, { data: invoices })
})

/** POST /api/enterprise/joining-invoices/:id/pay - Pay joining invoice with automatic wallet preference & hybrid split support */
export const payJoiningInvoice = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const invoice = await EnterpriseJoiningInvoice.findOne({
    _id: req.params.id,
    enterpriseId: req.user._id,
  }).populate('jobId', 'jobTitle')

  if (!invoice) {
    return sendError(res, { message: 'Invoice not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (invoice.status !== 'payment_pending') {
    return sendError(res, { message: `Invoice is already ${invoice.status}`, statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Get or Create Enterprise Wallet
  let wallet = await EnterpriseWallet.findOne({ enterpriseId: req.user._id })
  if (!wallet) {
    wallet = await EnterpriseWallet.create({ enterpriseId: req.user._id, balance: 0 })
  }

  // ALWAYS use Enterprise Wallet balance first! Calculate available wallet funds vs deficit
  const availableBalance = wallet.balance || 0
  const walletAmountUsed = Math.min(availableBalance, invoice.totalAmount)
  const remainingAmount = invoice.totalAmount - walletAmountUsed

  // CASE 1: Wallet balance is greater than or equal to the invoice amount (100% wallet payment)
  if (remainingAmount === 0) {
    const session = await mongoose.startSession()
    session.startTransaction()
    try {
      // Reload under transaction lock to prevent race conditions
      const lockedWallet = await EnterpriseWallet.findOne({ enterpriseId: req.user._id }).session(session)
      if (lockedWallet.balance < invoice.totalAmount) {
        await session.abortTransaction()
        return sendError(res, { message: 'Wallet balance changed concurrently. Insufficient balance.', statusCode: HTTP_STATUS.BAD_REQUEST })
      }

      lockedWallet.balance -= invoice.totalAmount
      await lockedWallet.save({ session })

      const txnId = `TXN_ENT_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`
      const walletTxn = await EnterpriseWalletTransaction.create([{
        transactionId: txnId,
        enterpriseId: req.user._id,
        type: 'debit',
        amount: invoice.totalAmount,
        balanceAfter: lockedWallet.balance,
        description: `Joining Confirmation Payment for Invoice #${invoice.invoiceNumber}`,
        status: 'success',
      }], { session })

      const escrowNumber = `ESC-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`
      const escrowTxn = await EnterpriseEscrowTransaction.create([{
        escrowNumber,
        enterpriseId: req.user._id,
        invoiceId: invoice._id,
        applicationId: invoice.applicationId,
        workerId: invoice.workerId,
        amount: invoice.totalAmount,
        workerSalaryPool: invoice.securityDeposit, // 100% of worker agreed salary, zero platform fee deducted
        platformRevenue: invoice.platformFee,
        gstAmount: invoice.gstAmount,
        status: 'secured',
        securedAt: new Date(),
      }], { session })

      invoice.status = 'paid'
      invoice.paidAt = new Date()
      invoice.paymentMethod = 'enterprise_wallet'
      invoice.walletAmountUsed = invoice.totalAmount
      invoice.onlineAmountUsed = 0
      invoice.remainingAmount = 0
      invoice.walletTransactionId = walletTxn[0]._id
      invoice.escrowTransactionId = escrowTxn[0]._id
      await invoice.save({ session })

      const application = await EnterpriseApplication.findById(invoice.applicationId).session(session)
      if (application) {
        application.status = 'joining_pending'
        application.escrowId = escrowTxn[0]._id
        await application.save({ session })
      }

      await EnterpriseFinancialAuditLog.create([{
        enterpriseId: req.user._id,
        action: 'invoice_paid',
        amount: invoice.totalAmount,
        performedBy: req.user._id,
        relatedInvoiceId: invoice._id,
        relatedApplicationId: invoice.applicationId,
        relatedEscrowId: escrowTxn[0]._id,
        details: {
          invoiceNumber: invoice.invoiceNumber,
          escrowNumber,
          walletAmountUsed: invoice.totalAmount,
          onlineAmountUsed: 0,
          remainingWalletBalance: lockedWallet.balance,
        },
      }], { session })

      await session.commitTransaction()
    } catch (err) {
      await session.abortTransaction()
      throw err
    } finally {
      session.endSession()
    }

    emitToRole('enterprise', 'enterprise_application_updated', {
      type: 'joining_payment_completed',
      applicationId: invoice.applicationId,
      invoiceId: invoice._id,
    })

    // Enterprise Notification (Event 4)
    triggerNotification({
      userId: req.user._id,
      title: 'Advance Payment Received Successfully 💳',
      body: `Your payment of ₹${invoice.totalAmount.toLocaleString('en-IN')} for Invoice #${invoice.invoiceNumber} has been received. Staffivaa Escrow lock activated. Joining confirmation is currently under Admin verification.`,
      type: 'ENTERPRISE_PAYMENT_RECEIVED',
      relatedId: invoice._id,
      relatedModel: 'EnterpriseJoiningInvoice',
    }).catch((err) => console.error('[Notification Error]:', err.message))

    // Admin Notification
    triggerNotification({
      userId: null,
      title: 'Payment Received: Awaiting Admin Verification ⚖️',
      body: `Payment of ₹${invoice.totalAmount.toLocaleString('en-IN')} for Invoice #${invoice.invoiceNumber} has been received from employer. Awaiting Admin verification to confirm candidate joining.`,
      type: 'ADMIN_PAYMENT_AWAITING_VERIFICATION',
      relatedId: invoice._id,
      relatedModel: 'EnterpriseJoiningInvoice',
    }).catch((err) => console.error('[Notification Error]:', err.message))

    return sendSuccess(res, {
      message: 'Invoice paid fully from Enterprise Wallet! Funds are secured in Staffivaa Escrow pending Admin verification.',
      data: {
        invoice,
        paymentStatus: 'paid',
        walletBalance: wallet.balance - invoice.totalAmount,
        walletAmountUsed: invoice.totalAmount,
        onlineAmountUsed: 0,
      },
    })
  }

  // CASE 2 & CASE 3: Wallet balance is less than invoice amount (or ₹0). Generate Razorpay order for remaining deficit!
  const receiptId = `RCPT_INV_${invoice.invoiceNumber}_${Date.now().toString().slice(-4)}`
  const options = {
    amount: Math.round(remainingAmount * 100), // Razorpay amount in paise
    currency: 'INR',
    receipt: receiptId,
    notes: {
      invoiceId: String(invoice._id),
      enterpriseId: String(req.user._id),
      walletAmountUsed: String(walletAmountUsed),
      remainingAmount: String(remainingAmount),
      purpose: 'Joining Confirmation Hybrid Invoice Payment',
    },
  }

  const order = await razorpay.orders.create(options)

  invoice.walletAmountUsed = walletAmountUsed
  invoice.remainingAmount = remainingAmount
  invoice.razorpayOrderId = order.id
  await invoice.save()

  return sendSuccess(res, {
    message: walletAmountUsed > 0 
      ? `Applying ₹${walletAmountUsed.toLocaleString('en-IN')} from Wallet. Please pay remaining ₹${remainingAmount.toLocaleString('en-IN')} via Gateway.`
      : `Wallet balance is ₹0. Please complete full payment of ₹${remainingAmount.toLocaleString('en-IN')} via Gateway.`,
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
      }
    },
  })
})

/** POST /api/enterprise/joining-invoices/:id/verify - Verify Razorpay payment and debit partial wallet atomically */
export const verifyInvoicePayment = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return sendError(res, { message: 'Missing payment verification parameters', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const invoice = await EnterpriseJoiningInvoice.findOne({
    _id: req.params.id,
    enterpriseId: req.user._id,
  }).populate('jobId', 'jobTitle')

  if (!invoice || invoice.razorpayOrderId !== razorpay_order_id) {
    return sendError(res, { message: 'Invoice or payment order mismatch', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (invoice.status !== 'payment_pending') {
    return sendError(res, { message: `Invoice is already ${invoice.status}`, statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Verify HMAC signature
  const generatedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex')

  if (!crypto.timingSafeEqual(Buffer.from(generatedSignature, 'utf8'), Buffer.from(razorpay_signature, 'utf8'))) {
    invoice.status = 'failed'
    invoice.failureReason = 'Invalid Razorpay cryptographic signature'
    await invoice.save()
    return sendError(res, { message: 'Payment verification failed due to signature mismatch', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Execute atomic hybrid settlement in Mongoose Transaction
  const session = await mongoose.startSession()
  session.startTransaction()
  let lockedWallet, escrowTxn, walletTxn
  try {
    lockedWallet = await EnterpriseWallet.findOne({ enterpriseId: req.user._id }).session(session)
    const walletDeduction = invoice.walletAmountUsed || 0

    if (walletDeduction > 0) {
      if ((lockedWallet?.balance || 0) < walletDeduction) {
        await session.abortTransaction()
        return sendError(res, { message: 'Wallet balance became insufficient during online payment checkout.', statusCode: HTTP_STATUS.BAD_REQUEST })
      }
      lockedWallet.balance -= walletDeduction
      await lockedWallet.save({ session })

      const txnId = `TXN_ENT_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`
      walletTxn = await EnterpriseWalletTransaction.create([{
        transactionId: txnId,
        enterpriseId: req.user._id,
        type: 'debit',
        amount: walletDeduction,
        balanceAfter: lockedWallet.balance,
        description: `Partial Wallet Deduction for Joining Invoice #${invoice.invoiceNumber} (Combined with Razorpay # ${razorpay_payment_id})`,
        status: 'success',
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
      }], { session })
    }

    const escrowNumber = `ESC-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`
    escrowTxn = await EnterpriseEscrowTransaction.create([{
      escrowNumber,
      enterpriseId: req.user._id,
      invoiceId: invoice._id,
      applicationId: invoice.applicationId,
      workerId: invoice.workerId,
      amount: invoice.totalAmount,
      workerSalaryPool: invoice.securityDeposit, // 100% of agreed salary
      platformRevenue: invoice.platformFee,
      gstAmount: invoice.gstAmount,
      status: 'secured',
      securedAt: new Date(),
    }], { session })

    invoice.status = 'paid'
    invoice.paidAt = new Date()
    invoice.paymentMethod = walletDeduction > 0 ? 'split_wallet_razorpay' : 'razorpay'
    invoice.onlineAmountUsed = invoice.remainingAmount || (invoice.totalAmount - walletDeduction)
    invoice.razorpayPaymentId = razorpay_payment_id
    invoice.razorpaySignature = razorpay_signature
    if (walletTxn && walletTxn[0]) invoice.walletTransactionId = walletTxn[0]._id
    invoice.escrowTransactionId = escrowTxn[0]._id
    await invoice.save({ session })

    const application = await EnterpriseApplication.findById(invoice.applicationId).session(session)
    if (application) {
      application.status = 'joining_pending'
      application.escrowId = escrowTxn[0]._id
      await application.save({ session })
    }

    await EnterpriseFinancialAuditLog.create([{
      enterpriseId: req.user._id,
      action: 'invoice_paid',
      amount: invoice.totalAmount,
      performedBy: req.user._id,
      relatedInvoiceId: invoice._id,
      relatedApplicationId: invoice.applicationId,
      relatedEscrowId: escrowTxn[0]._id,
      details: {
        invoiceNumber: invoice.invoiceNumber,
        escrowNumber,
        walletAmountUsed: invoice.walletAmountUsed,
        onlineAmountUsed: invoice.onlineAmountUsed,
        razorpayPaymentId: razorpay_payment_id,
        remainingWalletBalance: lockedWallet?.balance || 0,
      },
    }], { session })

    await session.commitTransaction()
  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    session.endSession()
  }

  emitToRole('enterprise', 'enterprise_application_updated', {
    type: 'joining_payment_completed',
    applicationId: invoice.applicationId,
    invoiceId: invoice._id,
  })

  triggerNotification({
    userId: invoice.workerId,
    title: 'Employer Payment Verified & Completed! 💳',
    body: `Your employer has completed the joining payment. Awaiting Admin verification to confirm your joining.`,
    type: 'JOINING_PAYMENT_PAID',
    relatedId: invoice.applicationId,
    relatedModel: 'EnterpriseApplication',
  }).catch((err) => console.error('[Notification Error]:', err.message))

  return sendSuccess(res, {
    message: 'Payment verified successfully! Funds are secured in Staffivaa Escrow pending Admin verification.',
    data: {
      invoice,
      paymentStatus: 'paid',
      walletBalance: lockedWallet?.balance || 0,
      escrowNumber: escrowTxn[0].escrowNumber,
    },
  })
})


/** GET /api/enterprise/upcoming-joinings - List candidates waiting to join */
export const getUpcomingJoinings = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const joinings = await EnterpriseApplication.find({
    enterpriseId: req.user._id,
    status: { $in: ['offer_accepted', 'joining_pending', 'joining_activated'] },
  })
    .populate({
      path: 'workerId',
      select: WORKER_SELECT,
    })
    .populate({
      path: 'jobId',
      select: 'jobTitle locationText salary salaryType department',
    })
    .sort({ 'offerDetails.joiningDate': 1 })

  return sendSuccess(res, { data: joinings })
})

/** POST /api/enterprise/applications/:id/mark-joined - Mark worker as joined */
export const markWorkerJoined = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const { joiningDate, siteLocation, reportingManager, project, department, supervisor } = req.body

  const application = await EnterpriseApplication.findOne({
    _id: req.params.id,
    enterpriseId: req.user._id,
  }).populate('jobId')

  if (!application) {
    return sendError(res, { message: 'Application not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const effectiveJoiningDate = joiningDate
    ? new Date(joiningDate)
    : application.offerDetails?.joiningDate
    ? new Date(application.offerDetails.joiningDate)
    : application.jobId?.timeline?.expectedJoiningDate
    ? new Date(application.jobId.timeline.expectedJoiningDate)
    : application.jobId?.timeline?.projectStartDate
    ? new Date(application.jobId.timeline.projectStartDate)
    : new Date()

  application.joiningDetails = {
    joiningDate: effectiveJoiningDate,
    siteLocation: siteLocation || application.offerDetails?.location || application.jobId?.locationText || 'Main Site',
    reportingManager,
    project: project || application.jobId?.jobTitle || 'Enterprise Project',
    department: department || application.jobId?.department || 'Operations',
    supervisor,
    markedJoinedAt: new Date(),
  }
  application.status = 'joined'
  await application.save()

  emitToRole('labour', 'enterprise_application_updated', {
    type: 'worker_joined',
    applicationId: application._id,
    workerId: application.workerId,
  })

  return sendSuccess(res, {
    message: 'Worker successfully marked as JOINED and added to Active Workforce!',
    data: application,
  })
})

/** GET /api/enterprise/active-workforce - List active joined workers */
export const getActiveWorkforce = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const workforce = await EnterpriseApplication.find({
    enterpriseId: req.user._id,
    status: 'joined',
  })
    .populate({
      path: 'workerId',
      select: WORKER_SELECT,
    })
    .populate({
      path: 'jobId',
      select: 'jobTitle locationText salary salaryType department',
    })
    .sort({ 'joiningDetails.markedJoinedAt': -1 })

  return sendSuccess(res, { data: workforce })
})

/** GET /api/enterprise/my-employment - Active joined employment for Labour Home widget */
export const getLabourCurrentEmployment = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.LABOUR) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  // Find latest joined employment application
  const activeApp = await EnterpriseApplication.findOne({
    workerId: req.user._id,
    status: { $in: ['joining_activated', 'joined', 'waiting_for_joining_payment', 'joining_pending', 'offer_accepted'] },
  })
    .populate({
      path: 'jobId',
      select: 'jobTitle salary salaryType locationText shift workingHours department timeline contractDuration',
    })
    .populate({
      path: 'enterpriseId',
      select: 'fullName profileImageUrl enterpriseProfile phone email',
    })
    .sort({ updatedAt: -1 })

  return sendSuccess(res, { data: activeApp })
})

/** GET /api/enterprise/applications/:id/attendance - Get worker attendance history for Enterprise */
export const getEnterpriseWorkerAttendance = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const application = await EnterpriseApplication.findOne({
    _id: req.params.id,
    enterpriseId: req.user._id,
  }).populate('jobId', 'workingHours jobTitle shift')

  if (!application) {
    return sendError(res, { message: 'Application not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const records = await AttendanceRecord.find({
    workerId: application.workerId,
    $or: [
      { enterpriseApplicationId: application._id },
      { enterpriseJobId: application.jobId?._id || application.jobId },
    ],
  })
    .sort({ shiftDate: -1, createdAt: -1 })
    .lean()

  const standardShiftHours = application.jobId?.workingHours || 8

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
        : Math.max(0, parseFloat((totalH - standardShiftHours).toFixed(2)))
    return {
      ...r,
      totalHours: totalH,
      overtimeHours: otH,
      standardShiftHours,
    }
  })

  return sendSuccess(res, { data: enrichedRecords })
})

/** GET /api/enterprise/jobs/:jobId/workers-attendance - Get all workers & their attendance for a specific enterprise job */
export const getJobWorkersAttendance = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ENTERPRISE) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const jobId = req.params.jobId

  const jobDoc = await EnterpriseJob.findById(jobId).lean()
  const defaultSalary = jobDoc?.salary || 0
  const defaultSalaryType = jobDoc?.salaryType || 'daily'
  const shiftHours = jobDoc?.workingHours || 8

  // Get all active/engaged workers for this job (joined, joining_activated, completed, etc.)
  const joinedApplications = await EnterpriseApplication.find({
    jobId,
    enterpriseId: req.user._id,
    status: { $in: ['joined', 'joining_activated', 'completed', 'waiting_for_joining_payment', 'offer_accepted'] },
  }).populate('workerId', 'fullName phone profileImageUrl')
    .populate('jobId', 'workingHours jobTitle shift salary salaryType')
    .lean()

  const standardShiftHours = shiftHours

  // For each worker, get today's attendance + attendance summary
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const results = await Promise.all(
    joinedApplications.map(async (app) => {
      const worker = app.workerId || {}
      const wIdStr = worker._id ? worker._id.toString() : (app.workerId ? app.workerId.toString() : null)

      // Get attendance records ONLY for this particular job requirement
      const records = await AttendanceRecord.find({
        workerId: wIdStr,
        $or: [
          { enterpriseApplicationId: app._id },
          { enterpriseJobId: jobId },
        ],
      })
        .sort({ shiftDate: -1, checkInAt: -1, createdAt: -1 })
        .lean()

      // Today's record (check shiftDate OR checkInAt)
      const todayRecord = records.find((r) => {
        const d1 = r.shiftDate ? new Date(r.shiftDate) : null
        if (d1) d1.setHours(0, 0, 0, 0)
        const d2 = r.checkInAt ? new Date(r.checkInAt) : null
        if (d2) d2.setHours(0, 0, 0, 0)
        return (d1 && d1.getTime() === todayStart.getTime()) || (d2 && d2.getTime() === todayStart.getTime())
      })

      // Fetch Job salary details for dynamic wage calculation
      const jobSalary = defaultSalary || app.jobId?.salary || app.offerDetails?.salary || 0
      const jobSalaryType = defaultSalaryType || app.jobId?.salaryType || app.offerDetails?.salaryType || 'daily'

      // Summary stats & real dynamic wage calculation
      let presentDays = 0
      let absentDays = 0
      let totalHrs = 0
      let totalOT = 0
      let calculatedWage = 0

      records.forEach((r) => {
        if (r.checkInAt) {
          presentDays++
          const rHrs = r.totalHours || 0
          totalHrs += rHrs
          const rOT = r.overtimeHours != null && r.overtimeHours > 0 ? r.overtimeHours : Math.max(0, rHrs - shiftHours)
          totalOT += rOT

          // Dynamic Hourly Wage Calculation (Actual Hours vs Shift Hours)
          if (r.checkOutAt || rHrs > 0) {
            let hourlyRate = 0
            if (jobSalaryType === 'daily' || jobSalaryType === 'per_day') {
              hourlyRate = jobSalary / shiftHours
            } else if (jobSalaryType === 'hourly' || jobSalaryType === 'per_hour') {
              hourlyRate = jobSalary
            } else {
              // Monthly rate / 26 days
              hourlyRate = (jobSalary / 26) / shiftHours
            }

            const normalHrs = Math.min(rHrs, shiftHours)
            const otHrs = Math.max(0, rHrs - shiftHours)
            const shiftWage = (normalHrs * hourlyRate) + (otHrs * hourlyRate * 1.5)
            calculatedWage += shiftWage
          }
        } else {
          absentDays++
        }
      })

      const completionPercentage = shiftHours > 0 ? Math.min(100, Math.round((totalHrs / shiftHours) * 100)) : 100

      // Today status
      let todayStatus = 'not_checked_in'
      if (todayRecord) {
        if (todayRecord.checkOutAt) todayStatus = 'completed'
        else if (todayRecord.checkInAt) todayStatus = 'working'
      }

      const isPaid = records.length > 0 && records.some((r) => r.paymentStatus === 'paid')

      return {
        applicationId: app._id,
        worker: {
          _id: worker._id,
          fullName: worker.fullName,
          phone: worker.phone,
          profileImageUrl: worker.profileImageUrl,
        },
        todayStatus,
        todayCheckIn: todayRecord?.checkInAt || null,
        todayCheckOut: todayRecord?.checkOutAt || null,
        todayTotalHours: todayRecord?.totalHours || 0,
        todayOvertimeHours: todayRecord?.overtimeHours || 0,
        summary: {
          presentDays,
          absentDays,
          totalHours: parseFloat(totalHrs.toFixed(2)),
          totalOvertime: parseFloat(totalOT.toFixed(2)),
          calculatedWage: Math.round(calculatedWage),
          completionPercentage,
          isPaid,
        },
        records: records.slice(0, 30).map((r) => {
          const tH = r.totalHours || 0
          const oH = r.overtimeHours != null && r.overtimeHours > 0 ? r.overtimeHours : Math.max(0, tH - standardShiftHours)
          return {
            _id: r._id,
            shiftDate: r.shiftDate,
            checkInAt: r.checkInAt,
            checkOutAt: r.checkOutAt,
            totalHours: tH,
            overtimeHours: parseFloat(oH.toFixed(2)),
            attendanceStatus: r.attendanceStatus,
            status: r.status,
          }
        }),
      }
    }),
  )

  return sendSuccess(res, { data: results, standardShiftHours })
})
