import { Router } from 'express'
import * as marketingController from '../controllers/marketingController.js'

const router = Router()

router.get('/offers', marketingController.getActiveOffers)
router.get('/ads', marketingController.getActiveAds)
router.get('/banners', marketingController.getActiveBanners)

export default router
