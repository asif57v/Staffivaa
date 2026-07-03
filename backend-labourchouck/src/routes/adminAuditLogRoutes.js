import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { getAuditLogs } from '../controllers/adminAuditLogController.js'

const router = Router()

router.use(protect, restrictTo('admin'))

router.get('/', getAuditLogs)

export default router
