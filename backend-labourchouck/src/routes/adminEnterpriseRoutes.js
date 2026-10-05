import express from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import {
  getEnterpriseCompanies,
  updateEnterpriseCompanyStatus,
  getEnterpriseJobs,
  updateEnterpriseJobStatus,
  getAdminEnterpriseApplications,
  getEnterpriseDirectRequests,
  respondEnterpriseDirectRequest,
  getDirectRequestMatchingWorkers,
  assignDirectRequestWorkers,
  removeDirectRequestWorker,
  updateDirectRequestWorkerPay,
} from '../controllers/adminEnterpriseController.js'
import {
  sendJobEndReminder,
  payoutAssignedWorker,
  getAdminDirectPayments,
} from '../controllers/enterpriseDirectPaymentController.js'
import {
  getAdminJoiningPayments,
  verifyApproveJoining,
  refundJoiningPayment,
  sendPaymentReminder,
  extendInvoiceDueDate,
  markInvoicePaidOffline,
  cancelInvoice,
} from '../controllers/adminEnterprisePaymentController.js'
import {
  getAdminEnterprisePayrolls,
  reviewEnterprisePayroll,
  releaseEnterpriseSalary,
  sendPayrollPaymentRequest,
  getAdminEnterpriseAttendance,
  getAdminWorkerAttendanceDetail,
} from '../controllers/enterprisePayrollController.js'

const router = express.Router()

router.use(protect, restrictTo(USER_ROLES.ADMIN))

// Companies
router.get('/companies', getEnterpriseCompanies)
router.put('/companies/:id/status', updateEnterpriseCompanyStatus)

// Jobs
router.get('/jobs', getEnterpriseJobs)
router.put('/jobs/:id/status', updateEnterpriseJobStatus)

// Daily/Hourly Requests (routed to Admin instead of the labour feed)
router.get('/direct-requests', getEnterpriseDirectRequests)
router.patch('/direct-requests/:id/respond', respondEnterpriseDirectRequest)
router.get('/direct-requests/:id/matching-workers', getDirectRequestMatchingWorkers)
router.post('/direct-requests/:id/assign-workers', assignDirectRequestWorkers)
router.delete('/direct-requests/:id/assigned-workers/:entryId', removeDirectRequestWorker)
router.patch('/direct-requests/:id/assigned-workers/:entryId', updateDirectRequestWorkerPay)
router.post('/direct-requests/:id/send-reminder', sendJobEndReminder)
router.post('/direct-requests/:id/assigned-workers/:entryId/payout', payoutAssignedWorker)
router.get('/direct-payments', getAdminDirectPayments)

// Applications & Placement Activity
router.get('/applications', getAdminEnterpriseApplications)

// Joining Payments & Escrow Management
router.get('/joining-payments', getAdminJoiningPayments)
router.post('/joining-payments/:id/verify-approve', verifyApproveJoining)
router.post('/joining-payments/:id/refund', refundJoiningPayment)
router.post('/joining-payments/:id/remind', sendPaymentReminder)
router.post('/joining-payments/:id/extend-due-date', extendInvoiceDueDate)
router.post('/joining-payments/:id/mark-paid-offline', markInvoicePaidOffline)
router.post('/joining-payments/:id/cancel-invoice', cancelInvoice)

// Live Enterprise Attendance Monitoring
router.get('/attendance', getAdminEnterpriseAttendance)
router.get('/attendance/:workerId', getAdminWorkerAttendanceDetail)

// Enterprise Payroll Review & Atomic Salary Release
router.get('/payrolls', getAdminEnterprisePayrolls)
router.patch('/payrolls/:id/review', reviewEnterprisePayroll)
router.post('/payrolls/:id/send-payment-request', sendPayrollPaymentRequest)
router.post('/payrolls/:id/release', releaseEnterpriseSalary)

export default router

