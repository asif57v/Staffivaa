import express from 'express'
import { protect } from '../middleware/auth.js'
import { paymentLimiter } from '../middleware/rateLimiters.js'
import {
  getEnterpriseWalletSummary,
  createRechargeOrder,
  verifyRechargePayment,
  getEnterpriseWalletTransactions,
  getTransactionDetails,
  downloadWalletStatement,
} from '../controllers/enterpriseWalletController.js'

const router = express.Router()

router.use(protect)

router.get('/summary', getEnterpriseWalletSummary)
router.post('/recharge/init', paymentLimiter, createRechargeOrder)
router.post('/recharge/verify', paymentLimiter, verifyRechargePayment)
router.get('/transactions', getEnterpriseWalletTransactions)
router.get('/transactions/:id', getTransactionDetails)
router.get('/statement', downloadWalletStatement)

export default router
