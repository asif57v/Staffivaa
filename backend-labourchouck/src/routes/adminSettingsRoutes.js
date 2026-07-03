import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { getSettings, updateSettings } from '../controllers/adminSettingsController.js'

const router = Router()

router.use(protect, restrictTo('admin'))

router.get('/', getSettings)
router.post('/', updateSettings)

export default router
