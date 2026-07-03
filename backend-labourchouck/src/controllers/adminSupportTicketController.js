import { SupportTicket } from '../models/SupportTicket.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess, sendError, HTTP_STATUS } from '../utils/apiResponse.js'

export const getTickets = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, priority, category, search } = req.query
  const query = {}

  if (status) query.status = status
  if (priority) query.priority = priority
  if (category) query.category = category

  if (search) {
    query.$or = [
      { ticketId: { $regex: search, $options: 'i' } },
      { subject: { $regex: search, $options: 'i' } },
      { message: { $regex: search, $options: 'i' } },
    ]
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const tickets = await SupportTicket.find(query)
    .populate('userId', 'fullName role email phone')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean()

  const total = await SupportTicket.countDocuments(query)

  return sendSuccess(res, {
    data: {
      tickets,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    },
  })
})

export const createTicket = asyncHandler(async (req, res) => {
  const { subject, message, priority = 'medium', category = 'general' } = req.body
  
  if (!subject || !message) {
    return sendError(res, { message: 'Subject and message are required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const ticketId = `TKT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`

  const ticket = await SupportTicket.create({
    ticketId,
    userId: req.user._id,
    subject,
    message,
    priority,
    category,
    status: 'open',
  })

  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    data: { ticket },
  })
})

export const replyTicket = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { message } = req.body

  if (!message) {
    return sendError(res, { message: 'Message is required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const ticket = await SupportTicket.findById(id)
  if (!ticket) {
    return sendError(res, { message: 'Ticket not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  ticket.replies.push({
    senderId: req.user._id,
    senderRole: req.user.role,
    message: message.trim(),
  })

  // Auto reopen or keep open on admin/user reply
  if (req.user.role === 'admin') {
    ticket.status = 'resolved' // Mark as resolved when admin replies
  } else {
    ticket.status = 'open'
  }

  await ticket.save()

  return sendSuccess(res, {
    data: { ticket },
  })
})

export const closeTicket = asyncHandler(async (req, res) => {
  const { id } = req.params
  
  const ticket = await SupportTicket.findById(id)
  if (!ticket) {
    return sendError(res, { message: 'Ticket not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  ticket.status = 'closed'
  await ticket.save()

  return sendSuccess(res, {
    data: { ticket },
  })
})
