import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { Allocation } from '../models/Allocation.js'
import { SystemPricing } from '../models/SystemPricing.js'
import { Quotation } from '../models/Quotation.js'
import { sendNotificationToUser } from '../services/notificationService.js'
import { getIO, emitToUser } from './socket.js'

export function startCorporatePaymentCheckJob() {
  // Check every 1 minute
  setInterval(async () => {
    try {
      const pricing = await SystemPricing.findOne().lean()
      const paymentHours = pricing?.corporate?.paymentDueBeforeStartHours || 48
      const advancePercent = pricing?.corporate?.advancePercentage || 30
      const autoReminder = pricing?.corporate?.autoReminder !== false

      const now = new Date()

      // 1. assigned -> payment_pending (Advance payment trigger)
      const assignedRequests = await WorkforceRequest.find({
        sourceType: 'corporate',
        status: 'assigned'
      })

      for (const req of assignedRequests) {
        // Ensure quotation exists and is approved before advancing to payment_pending
        const approvedQuote = await Quotation.findOne({ requestId: req._id, status: 'approved' })
        if (!approvedQuote) {
          continue
        }

        // Calculate hours remaining until project start date
        const startDate = new Date(req.startDate)
        const diffMs = startDate.getTime() - now.getTime()
        const hoursUntilStart = diffMs / (1000 * 60 * 60)


        // Check if payment deadline has been manually extended by Admin
        let isExtended = false
        if (req.paymentDeadlineExtendedAt) {
          const extendedTime = new Date(req.paymentDeadlineExtendedAt)
          if (extendedTime > now) {
            isExtended = true
          }
        }

        if (hoursUntilStart <= paymentHours && !isExtended) {
          // Change status to payment_pending
          req.status = 'payment_pending'
          await req.save()

          console.log(`[Scheduler] Transformed corporate request ${req.reference} to payment_pending`)

          // Emit socket events
          try {
            const io = getIO()
            io.to(`request_${req._id.toString()}`).emit('request_status_update', {
              requestId: req._id,
              status: 'payment_pending'
            })
            emitToUser('corporate', req.clientId.toString(), 'request_status_update', {
              requestId: req._id.toString(),
              status: 'payment_pending'
            })

            const allocation = await Allocation.findOne({ requestId: req._id }).lean()
            if (allocation && allocation.vendorId) {
              emitToUser('contractor', allocation.vendorId.toString(), 'request_status_update', {
                requestId: req._id.toString(),
                status: 'payment_pending'
              })
            }
          } catch (err) {
            console.error('[Scheduler] Socket emit error:', err.message)
          }

          // Send notifications
          await sendNotificationToUser(
            req.clientId.toString(),
            'Advance Payment Request',
            `Your project starts on ${startDate.toLocaleDateString()}. Please complete the ${advancePercent}% advance payment of your booking to start.`,
            { url: `/corporate/requests/${req._id}` }
          )

          const allocation = await Allocation.findOne({ requestId: req._id })
          if (allocation && allocation.vendorId) {
            await sendNotificationToUser(
              allocation.vendorId.toString(),
              'Project Payment Pending',
              `Corporate advance payment is pending for project ${req.reference || req._id}. Check-in is locked until payment is made.`,
              { url: `/vendor/jobs` }
            )
          }
        }
      }

      // 2. advance_paid -> project_active (Activation trigger)
      const advancePaidRequests = await WorkforceRequest.find({
        sourceType: 'corporate',
        status: 'advance_paid'
      })

      for (const req of advancePaidRequests) {
        const startDate = new Date(req.startDate)
        // Reset hours to start of day or compare exactly
        if (now >= startDate) {
          req.status = 'project_active'
          await req.save()

          console.log(`[Scheduler] Transformed corporate request ${req.reference} to project_active`)

          // Emit socket and send notifications
          try {
            const io = getIO()
            io.to(`request_${req._id.toString()}`).emit('request_status_update', {
              requestId: req._id,
              status: 'project_active'
            })
            emitToUser('corporate', req.clientId.toString(), 'request_status_update', {
              requestId: req._id.toString(),
              status: 'project_active'
            })
          } catch (err) {
            console.error('[Scheduler] Socket emit error:', err.message)
          }

          await sendNotificationToUser(
            req.clientId.toString(),
            'Project Active',
            `Your project ${req.reference} is now Active! Workers are allowed to check-in.`,
            { url: `/corporate/requests/${req._id}` }
          )
        }
      }

      // 3. project_active -> settlement_pending (Settlement trigger)
      const activeRequests = await WorkforceRequest.find({
        sourceType: 'corporate',
        status: 'project_active'
      })

      for (const req of activeRequests) {
        if (req.endDate) {
          const endDate = new Date(req.endDate)
          // Set end date to end of day to allow all day shifts
          endDate.setHours(23, 59, 59, 999)
          if (now > endDate) {
            req.status = 'settlement_pending'
            await req.save()

            console.log(`[Scheduler] Transformed corporate request ${req.reference} to settlement_pending`)

            try {
              const io = getIO()
              io.to(`request_${req._id.toString()}`).emit('request_status_update', {
                requestId: req._id,
                status: 'settlement_pending'
              })
              emitToUser('corporate', req.clientId.toString(), 'request_status_update', {
                requestId: req._id.toString(),
                status: 'settlement_pending'
              })
            } catch (err) {
              console.error('[Scheduler] Socket emit error:', err.message)
            }

            await sendNotificationToUser(
              req.clientId.toString(),
              'Final Settlement Payment Request',
              `Your project has ended. Please complete the remaining payment for project ${req.reference || req._id} to settle the invoice.`,
              { url: `/corporate/requests/${req._id}` }
            )
          }
        }
      }

      // 4. Send daily reminder for payment_pending if autoReminder is true
      if (autoReminder) {
        // Send auto reminder notification for payment_pending
        const pendingPaymentRequests = await WorkforceRequest.find({
          sourceType: 'corporate',
          status: 'payment_pending'
        })
        for (const req of pendingPaymentRequests) {
          // Simple throttling: e.g., send every 24 hours (or we can just send alert if user hasn't paid)
          // For safety, we can log or check if a reminder was recently sent, or just send a push notification.
          // Since we want auto reminders, let's trigger it.
          await sendNotificationToUser(
            req.clientId.toString(),
            'Reminder: Payment Due',
            `Please pay the advance payment for booking ${req.reference} to avoid check-in lock.`,
            { url: `/corporate/requests/${req._id}` }
          )
        }
      }

    } catch (error) {
      console.error('Error in corporate payment scheduler job:', error)
    }
  }, 60 * 1000) // 1 minute interval
}
