import express from 'express'
import { getMyRefundRequests, requestRefund } from '../controllers/refundController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

router.use(protect)

router.get('/my', getMyRefundRequests)
router.post('/:bookingId/request', requestRefund)

export default router
