import { Router } from 'express'
import { optionalAuth } from '../middleware/auth.js'
import * as marketingController from '../controllers/marketingController.js'

const router = Router()

router.get('/popular-services', marketingController.getActivePopularServices)
router.get('/offers', marketingController.getActiveOffers)
router.get('/ads', marketingController.getActiveAds)
router.get('/banners', optionalAuth,marketingController.getActiveBanners)
router.post('/track', marketingController.trackCampaign)

export default router
