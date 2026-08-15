import { Router } from 'express'
import { protect } from '../middleware/auth.js'
import { paymentLimiter, withdrawalLimiter } from '../middleware/rateLimiters.js'
import { 
  createAddMoneyOrder, 
  verifyAddMoneyPayment, 
  getWalletBalance,
  requestWithdrawal
} from '../controllers/walletController.js'

const router = Router()

// All wallet routes require authentication
router.use(protect)

router.get('/', getWalletBalance)
router.post('/razorpay/create-order', paymentLimiter, createAddMoneyOrder)
router.post('/razorpay/verify', paymentLimiter, verifyAddMoneyPayment)
router.post('/withdraw', withdrawalLimiter, requestWithdrawal)

export default router
