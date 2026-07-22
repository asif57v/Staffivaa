import express from 'express'
import { listRefundRequests, approveRefundRequest, rejectRefundRequest } from '../controllers/adminRefundController.js'
import { protect, restrictTo } from '../middleware/auth.js'

const router = express.Router()

router.use(protect, restrictTo('admin'))

router.get('/', listRefundRequests)
router.post('/:id/approve', approveRefundRequest)
router.post('/:id/reject', rejectRefundRequest)

export default router
