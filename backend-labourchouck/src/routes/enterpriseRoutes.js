import express from 'express'
import { protect, optionalAuth } from '../middleware/auth.js'
import {
  createEnterpriseJob,
  getEnterpriseJobs,
  getPublicEnterpriseJobs,
  getPublicEnterpriseJobById,
  applyToEnterpriseJob,
  getMyApplications,
  getEnterpriseCompanyApplications,
  updateApplicationStatus,
  scheduleInterview,
  cancelInterview,
  getInterviewDetails,
  sendOfferLetter,
  respondToOffer,
  getEnterpriseInvoices,
  payJoiningInvoice,
  verifyInvoicePayment,
  getEnterpriseSecuritySettings,
  getEnterpriseDashboardOverview,
  getUpcomingJoinings,
  markWorkerJoined,
  getActiveWorkforce,
  getLabourCurrentEmployment,
  getEnterpriseWorkerAttendance,
  getJobWorkersAttendance,
} from '../controllers/enterpriseController.js'
import {
  calculateEnterpriseMonthlyPayroll,
  getEnterprisePayrolls,
  submitPayrollForReview,
  getMyEnterprisePayrolls,
} from '../controllers/enterprisePayrollController.js'

const router = express.Router()

// ── Labour Feed ──────────────────────────────────────────────────────────────
router.get('/public-jobs', optionalAuth, getPublicEnterpriseJobs)
router.get('/public-jobs/:id', optionalAuth, getPublicEnterpriseJobById)

// ── Labour Applications & Employment ─────────────────────────────────────────
router.post('/applications', protect, applyToEnterpriseJob)
router.get('/my-applications', protect, getMyApplications)
router.get('/applications/:id/interview', protect, getInterviewDetails)
router.post('/applications/:id/respond-offer', protect, respondToOffer)
router.get('/my-employment', protect, getLabourCurrentEmployment)
router.get('/my-payrolls', protect, getMyEnterprisePayrolls)

// ── Enterprise HR Panel ──────────────────────────────────────────────────────
router.get('/dashboard-overview', protect, getEnterpriseDashboardOverview)
router.get('/security-settings', protect, getEnterpriseSecuritySettings)
router.get('/jobs', protect, getEnterpriseJobs)
router.post('/jobs', protect, createEnterpriseJob)

router.get('/company-applications', protect, getEnterpriseCompanyApplications)
router.patch('/applications/:id/status', protect, updateApplicationStatus)
router.post('/applications/:id/schedule-interview', protect, scheduleInterview)
router.patch('/applications/:id/cancel-interview', protect, cancelInterview)
router.post('/applications/:id/send-offer', protect, sendOfferLetter)
router.post('/applications/:id/mark-joined', protect, markWorkerJoined)
router.get('/applications/:id/attendance', protect, getEnterpriseWorkerAttendance)
router.get('/jobs/:jobId/workers-attendance', protect, getJobWorkersAttendance)

// ── Enterprise Financial Invoices & Joining Confirmation Payments ─────────────
router.get('/joining-invoices', protect, getEnterpriseInvoices)
router.post('/joining-invoices/:id/pay', protect, payJoiningInvoice)
router.post('/joining-invoices/:id/verify', protect, verifyInvoicePayment)

// ── Enterprise Workforce Management ──────────────────────────────────────────
router.get('/upcoming-joinings', protect, getUpcomingJoinings)
router.get('/active-workforce', protect, getActiveWorkforce)

// ── Enterprise Payroll & Attendance Calculations ─────────────────────────────
router.post('/payroll/calculate', protect, calculateEnterpriseMonthlyPayroll)
router.get('/payroll', protect, getEnterprisePayrolls)
router.post('/payroll/:id/submit', protect, submitPayrollForReview)

export default router
