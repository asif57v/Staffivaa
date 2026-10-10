import { Router } from 'express'
import * as ctrl from '../controllers/adminPushController.js'
import { protect, restrictTo } from '../middleware/auth.js'

const router = Router()
router.use(protect, restrictTo('admin'))

router.get('/', ctrl.getCampaigns)
router.get('/recipients/search', ctrl.searchRecipients)
router.post('/recipients/count', ctrl.getRecipientsCount)
router.post('/send', ctrl.sendCampaign)
router.delete('/:id', ctrl.cancelScheduledCampaign)

export default router
