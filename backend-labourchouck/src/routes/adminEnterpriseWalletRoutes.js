import express from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import {
  getAdminEnterpriseWallets,
  toggleWalletFreezeStatus,
  adjustEnterpriseWalletBalance,
  getAdminEnterpriseWalletTransactions,
} from '../controllers/adminEnterpriseWalletController.js'

const router = express.Router()

router.use(protect, restrictTo(USER_ROLES.ADMIN))

router.get('/', getAdminEnterpriseWallets)
router.patch('/:enterpriseId/status', toggleWalletFreezeStatus)
router.post('/:enterpriseId/adjust', adjustEnterpriseWalletBalance)
router.get('/transactions', getAdminEnterpriseWalletTransactions)

export default router
