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
  getVendorWallet,
  requestVendorWithdrawal,
} from '../controllers/vendorController.js'
import {
  submitQuotationVendor,
  getQuotationForRequest,
} from '../controllers/quotationController.js'

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
router.get('/wallet', getVendorWallet)
router.post('/wallet/withdraw', requestVendorWithdrawal)

// Quotation endpoints
router.post('/jobs/:id/quotation', submitQuotationVendor)
router.get('/jobs/:id/quotation', getQuotationForRequest)

export default router

