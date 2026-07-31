import express from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import {
  getEnterpriseCompanies,
  updateEnterpriseCompanyStatus,
  getEnterpriseJobs,
  updateEnterpriseJobStatus,
  getAdminEnterpriseApplications,
} from '../controllers/adminEnterpriseController.js'
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
} from '../controllers/enterprisePayrollController.js'

const router = express.Router()

router.use(protect, restrictTo(USER_ROLES.ADMIN))

// Companies
router.get('/companies', getEnterpriseCompanies)
router.put('/companies/:id/status', updateEnterpriseCompanyStatus)

// Jobs
router.get('/jobs', getEnterpriseJobs)
router.put('/jobs/:id/status', updateEnterpriseJobStatus)

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

// Enterprise Payroll Review & Atomic Salary Release
router.get('/payrolls', getAdminEnterprisePayrolls)
router.patch('/payrolls/:id/review', reviewEnterprisePayroll)
router.post('/payrolls/:id/release', releaseEnterpriseSalary)

export default router
