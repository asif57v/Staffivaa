import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import { getAdminCommissions, markCommissionPaidOffline, waiveCommission } from '../controllers/commissionController.js'

const router = Router()

// All endpoints restricted to admins
router.use(protect)
router.use(restrictTo(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN))

router.get('/', getAdminCommissions)
router.post('/:id/mark-paid', markCommissionPaidOffline)
router.post('/:id/waive', waiveCommission)

export default router
