import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { getTickets, createTicket, replyTicket, closeTicket } from '../controllers/adminSupportTicketController.js'

const router = Router()

router.use(protect)

router.post('/', createTicket)
router.post('/:id/reply', replyTicket)

// Admin only operations
router.get('/', restrictTo('admin'), getTickets)
router.patch('/:id/close', restrictTo('admin'), closeTicket)

export default router
