import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import {
  getVendorMe,
  patchVendorMe,
  addVendorDocument,
  submitVendorVerification,
  removeVendorDocument,
  listVendorCrew,
  linkVendorCrew,
  getVendorDashboard,
  listVendorJobs,
  acceptVendorJob,
  listVendorSettlements,
  listVendorMarketplaceRequests,
  acceptVendorMarketplaceRequest,
  declineVendorMarketplaceRequest,
  assignWorkforce,
} from '../controllers/vendorController.js'
import {
  getWalletSummary,
  getSettlements,
  getWalletActivity,
  getSettlementDetails,
  requestWithdrawal,
  getWithdrawals,
  remindAdminForSettlement,
} from '../controllers/vendorWalletController.js'
import {
  submitQuotationVendor,
  getQuotationForRequest,
} from '../controllers/quotationController.js'
import { getVendorCommissions, createRazorpayOrder, verifyRazorpayPayment } from '../controllers/commissionController.js'
import { withdrawalLimiter } from '../middleware/rateLimiters.js'

const router = Router()

router.use(protect, restrictTo(USER_ROLES.CONTRACTOR))

router.get('/me', getVendorMe)
router.patch('/me', patchVendorMe)
router.post('/documents', addVendorDocument)
router.delete('/documents/:docId', removeVendorDocument)
router.post('/verification/submit', submitVendorVerification)
router.get('/dashboard', getVendorDashboard)
router.get('/crew', listVendorCrew)
router.post('/crew/link', linkVendorCrew)
router.get('/jobs', listVendorJobs)
router.post('/jobs/:id/accept', acceptVendorJob)
router.post('/jobs/:id/assign', assignWorkforce)
router.get('/settlements', listVendorSettlements)
router.get('/requests', listVendorMarketplaceRequests)
router.post('/requests/:id/accept', acceptVendorMarketplaceRequest)
router.post('/requests/:id/decline', declineVendorMarketplaceRequest)

// Wallet Endpoints
router.get('/wallet/summary', getWalletSummary)
router.get('/wallet/settlements', getSettlements)
router.get('/wallet/activity', getWalletActivity)
router.get('/wallet/withdrawals', getWithdrawals)
router.post('/wallet/withdraw', withdrawalLimiter, requestWithdrawal)
router.get('/wallet/:settlementId', getSettlementDetails)
router.post('/wallet/:settlementId/remind', remindAdminForSettlement)

// Quotation endpoints
router.post('/jobs/:id/quotation', submitQuotationVendor)
router.get('/jobs/:id/quotation', getQuotationForRequest)

// Commission endpoints
router.get('/commission', getVendorCommissions)
router.post('/commission/:id/pay/order', createRazorpayOrder)
router.post('/commission/:id/pay/verify', verifyRazorpayPayment)

export default router

