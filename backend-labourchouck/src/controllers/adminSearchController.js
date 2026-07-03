import { User } from '../models/User.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { Project } from '../models/Project.js'
import { SupportTicket } from '../models/SupportTicket.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/apiResponse.js'

export const globalSearch = asyncHandler(async (req, res) => {
  const { q } = req.query
  if (!q) {
    return sendSuccess(res, { data: { results: {} } })
  }

  const regex = new RegExp(q, 'i')

  const [users, bookings, projects, tickets, payments] = await Promise.all([
    User.find({
      $or: [
        { fullName: regex },
        { email: regex },
        { phone: regex }
      ]
    }).limit(10).lean(),

    WorkforceRequest.find({
      $or: [
        { reference: regex },
        { locationText: regex },
        { status: regex }
      ]
    }).limit(10).lean(),

    Project.find({ name: regex }).limit(10).lean(),

    SupportTicket.find({
      $or: [
        { ticketId: regex },
        { subject: regex },
        { message: regex }
      ]
    }).limit(10).lean(),

    WalletTransaction.find({
      $or: [
        { transactionId: regex },
        { source: regex },
        { payerName: regex }
      ]
    }).limit(10).lean()
  ])

  return sendSuccess(res, {
    data: {
      results: {
        users: users.map(u => ({ id: u._id, title: u.fullName || 'No Name', subtitle: `${u.role} • ${u.phone || u.email || ''}`, url: `/admin/user/${u._id}` })),
        bookings: bookings.map(b => ({ id: b._id, title: b.reference, subtitle: `Booking • ${b.status} • ${b.locationText || ''}`, url: `/admin/bookings` })),
        projects: projects.map(p => ({ id: p._id, title: p.name, subtitle: `Project`, url: `/admin/allocations` })),
        tickets: tickets.map(t => ({ id: t._id, title: `${t.ticketId}: ${t.subject}`, subtitle: `Support • ${t.status} • ${t.priority}`, url: `/admin/reports` })),
        payments: payments.map(p => ({ id: p._id, title: p.transactionId, subtitle: `Payment • ${p.type} • ₹${p.amount} • ${p.status}`, url: `/admin/wallet` }))
      }
    }
  })
})
