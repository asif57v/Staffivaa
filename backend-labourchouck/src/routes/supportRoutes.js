import express from 'express'
import { protect } from '../middleware/auth.js'
import { createSupportTicket, getMySupportTickets } from '../controllers/supportController.js'

const router = express.Router()

router.use(protect)

router.post('/', createSupportTicket)
router.get('/', getMySupportTickets)

export default router
