import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { getDashboardStats, getDashboardAnalytics } from '../controllers/adminDashboardController.js'

const router = Router()

router.use(protect, restrictTo('admin'))

router.get('/stats', getDashboardStats)
router.get('/analytics', getDashboardAnalytics)

export default router
