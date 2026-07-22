import { Router } from 'express'
import { protect } from '../middleware/auth.js'
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
router.post('/razorpay/create-order', createAddMoneyOrder)
router.post('/razorpay/verify', verifyAddMoneyPayment)
router.post('/withdraw', requestWithdrawal)

export default router
