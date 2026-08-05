import express from 'express'
import {
  getWalletSummary,
  getTransactions,
  createWithdrawal,
  getWithdrawals,
  getWithdrawalDetailsById,
  getReports,
  reviewWithdrawal
} from '../controllers/adminWalletController.js'
import { protect, restrictTo } from '../middleware/auth.js'

const router = express.Router()

router.use(protect)
router.use(restrictTo('admin'))

router.get('/summary', getWalletSummary)
router.get('/transactions', getTransactions)
router.post('/withdraw', createWithdrawal)
router.get('/withdrawals', getWithdrawals)
router.get('/withdrawals/:id', getWithdrawalDetailsById)
router.patch('/withdrawals/:id/review', reviewWithdrawal)
router.get('/reports', getReports)

export default router
