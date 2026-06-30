import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import {
  reviewCorporateAdmin,
  reviewContractorAdmin,
} from '../controllers/corporateController.js'
import {
  listCorporateVerificationsAdmin,
  listVendorVerificationsAdmin,
  getBusinessVerificationAdmin,
} from '../controllers/businessVerificationController.js'
import {
  listAdminRequests,
  patchRequestStatusAdmin,
  sendPaymentReminderAdmin,
  recordOfflinePaymentAdmin,
  releaseVendorSettlementAdmin,
} from '../controllers/requestController.js'
import {
  createAllocationAdmin,
  replaceAssignmentAdmin,
} from '../controllers/allocationController.js'
import { verifyAttendanceAdmin } from '../controllers/attendanceController.js'
import {
  listPricingRatesAdmin,
  upsertPricingRateAdmin,
  generateInvoiceAdmin,
  patchInvoiceStatusAdmin,
} from '../controllers/billingController.js'
import {
  getSystemPricing,
  updateSystemPricing,
  getSettlementRules,
  updateSettlementRules,
  getPricingHistory
} from '../controllers/systemPricingController.js'
import {
  createQuotation,
  getQuotations,
  approveQuotation,
  rejectQuotation
} from '../controllers/quotationController.js'

const router = Router()

router.use(protect, restrictTo(USER_ROLES.ADMIN))

router.get('/corporates', listCorporateVerificationsAdmin)
router.get('/corporates/:id', getBusinessVerificationAdmin)
router.patch('/corporates/:id/review', reviewCorporateAdmin)
router.get('/vendors', listVendorVerificationsAdmin)
router.get('/vendors/:id', getBusinessVerificationAdmin)
router.patch('/vendors/:id/review', reviewContractorAdmin)

router.get('/requests', listAdminRequests)
router.patch('/requests/:id/status', patchRequestStatusAdmin)
router.post('/requests/:id/reminder', sendPaymentReminderAdmin)
router.post('/requests/:id/record-payment', recordOfflinePaymentAdmin)
router.post('/requests/:id/release-settlement', releaseVendorSettlementAdmin)

router.post('/allocations', createAllocationAdmin)
router.post('/assignments/:id/replace', replaceAssignmentAdmin)

router.patch('/attendance/:id/verify', verifyAttendanceAdmin)

router.get('/pricing', listPricingRatesAdmin)
router.post('/pricing', upsertPricingRateAdmin)
router.get('/system-pricing', getSystemPricing)
router.post('/system-pricing', updateSystemPricing)
router.get('/settlement-rules', getSettlementRules)
router.post('/settlement-rules', updateSettlementRules)
router.get('/pricing-history', getPricingHistory)
router.post('/quotations', createQuotation)
router.get('/quotations', getQuotations)
router.patch('/quotations/:id/approve', approveQuotation)
router.patch('/quotations/:id/reject', rejectQuotation)
router.post('/invoices/generate', generateInvoiceAdmin)
router.patch('/invoices/:id', patchInvoiceStatusAdmin)

export default router

