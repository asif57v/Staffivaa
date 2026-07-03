import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { globalSearch } from '../controllers/adminSearchController.js'

const router = Router()

router.use(protect, restrictTo('admin'))

router.get('/', globalSearch)

export default router
