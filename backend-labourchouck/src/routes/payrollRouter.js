import express from 'express'
import {
  setDailyWageRate,
  getLabourProjectEarnings,
  getVendorPayoutBatches,
  approvePayoutBatch,
} from '../controllers/payroll.controller.js'
import { protect, restrictTo } from '../middleware/auth.js'

const router = express.Router()

// All payroll routes require authentication
router.use(protect)

// Vendor routes
router.post('/rate', restrictTo('contractor'), setDailyWageRate)
router.get('/batches', restrictTo('contractor'), getVendorPayoutBatches)
router.post('/batches/:batchId/approve', restrictTo('contractor'), approvePayoutBatch)

// Labour routes
router.get('/earnings/:projectId', restrictTo('labour'), getLabourProjectEarnings)

export default router
