import { SupportTicket } from '../models/SupportTicket.js'

export async function createSupportTicket(req, res) {
  try {
    const { subject, message, priority, category } = req.body
    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'Subject and message are required' })
    }

    const ticketId = `TKT-${Date.now()}-${Math.floor(Math.random() * 1000)}`

    const ticket = await SupportTicket.create({
      ticketId,
      userId: req.user._id,
      subject,
      message,
      priority: priority || 'medium',
      category: category || 'general',
      status: 'open',
    })

    res.status(201).json({ success: true, ticket })
  } catch (error) {
    console.error('Error creating support ticket:', error)
    res.status(500).json({ success: false, message: 'Failed to create support ticket' })
  }
}

export async function getMySupportTickets(req, res) {
  try {
    const tickets = await SupportTicket.find({ userId: req.user._id }).sort({ createdAt: -1 })
    res.status(200).json({ success: true, tickets })
  } catch (error) {
    console.error('Error fetching support tickets:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch support tickets' })
  }
}
