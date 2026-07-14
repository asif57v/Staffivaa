import { Router } from 'express'
import * as adminMarketingController from '../controllers/adminMarketingController.js'
import { protect, restrictTo } from '../middleware/auth.js'

const router = Router()

// Protect all routes - restrict to admin only
router.use(protect, restrictTo('admin'))

// Offers
router.get('/offers', adminMarketingController.getOffers)
router.post('/offers', adminMarketingController.createOffer)
router.patch('/offers/:id', adminMarketingController.updateOffer)
router.delete('/offers/:id', adminMarketingController.deleteOffer)

// Ads
router.get('/ads', adminMarketingController.getAds)
router.post('/ads', adminMarketingController.createAd)
router.patch('/ads/:id', adminMarketingController.updateAd)
router.delete('/ads/:id', adminMarketingController.deleteAd)

// Banners
router.get('/banners', adminMarketingController.getBanners)
router.post('/banners', adminMarketingController.createBanner)
router.patch('/banners/:id', adminMarketingController.updateBanner)
router.delete('/banners/:id', adminMarketingController.deleteBanner)

// Analytics
router.get('/analytics', adminMarketingController.getCampaignAnalytics)

export default router
