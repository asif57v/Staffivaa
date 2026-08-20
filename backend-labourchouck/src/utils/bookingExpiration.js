import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { Allocation } from '../models/Allocation.js'
import { Assignment } from '../models/Assignment.js'
import { User } from '../models/User.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { Wallet } from '../models/Wallet.js'
import { RefundRequest } from '../models/RefundRequest.js'
import { REQUEST_STATUS } from '../constants/workforceConstants.js'
import { getIO, emitToUser } from './socket.js'
import { triggerNotification } from './notificationTrigger.js'
import {
  searchExpiredUserNotif,
  searchExpiredLabourNotif,
  feeTimeoutUserNotif,
  feeTimeoutLabourNotif,
} from './bookingNotificationCopy.js'

export function startBookingExpirationJob() {
  // Check every 1 minute
  setInterval(async () => {
    try {
      const timeoutThreshold = new Date(Date.now() - 2.5 * 60 * 1000)
      
      // 1. Find bookings in searching status older than 2.5 minutes
      const expiredBookings = await WorkforceRequest.find({
        status: REQUEST_STATUS.SEARCHING,
        createdAt: { $lt: timeoutThreshold }
      })

      for (const booking of expiredBookings) {
        const payload = {
          requestId: booking._id.toString(),
          reference: booking.reference || null,
          status: 'expired',
          fullCancel: true,
          reason: 'search_expired',
          message: 'Booking expired due to inactivity',
        }

        // Capture offered labour IDs before deleting assignments (for expiry push)
        const openAssignments = await Assignment.find({
          requestId: booking._id,
          status: { $in: ['offered', 'assigned'] },
        }).select('labourId').lean()
        const labourIds = [
          ...new Set(
            openAssignments
              .map((a) => a.labourId?.toString())
              .filter(Boolean),
          ),
        ]

        // Emit socket event before deletion so clients can update UI
        try {
          const io = getIO()
          io.to(`request_${booking._id.toString()}`).emit('bookingExpired', payload)
          io.to(`request_${booking._id.toString()}`).emit('booking_cancelled', payload)
          const clientId = booking.clientId?.toString()
          if (clientId) {
            emitToUser('individual', clientId, 'bookingExpired', payload)
            emitToUser('individual', clientId, 'booking_cancelled', payload)
          }
        } catch (socketErr) {
          console.error('Socket emit error on booking expiration:', socketErr)
        }

        // Dedicated mobile push for customer
        if (booking.clientId) {
          const copy = searchExpiredUserNotif(booking.reference)
          triggerNotification({
            userId: booking.clientId,
            title: copy.title,
            body: copy.body,
            type: copy.type,
            relatedId: booking._id,
            relatedModel: 'WorkforceRequest',
            url: '/app/bookings',
          }).catch(() => {})
        }

        // Soft expiry notice to workers who still had an open offer
        for (const labourId of labourIds) {
          const copy = searchExpiredLabourNotif()
          triggerNotification({
            userId: labourId,
            title: copy.title,
            body: copy.body,
            type: copy.type,
            relatedId: booking._id,
            relatedModel: 'WorkforceRequest',
            url: '/app/jobs',
          }).catch(() => {})
        }

        // Delete associated assignments and allocations
        await Assignment.deleteMany({ requestId: booking._id })
        await Allocation.deleteMany({ requestId: booking._id })
        
        // Delete the booking itself
        await WorkforceRequest.findByIdAndDelete(booking._id)
        
        console.log(`Expired and deleted searching booking: ${booking.reference || booking._id}`)
      }

      // 2. Find bookings stuck in platform_fee_pending for > 15 minutes (give users time for UPI app switch)
      const pendingPaymentTimeoutThreshold = new Date(Date.now() - 15 * 60 * 1000)
      const expiredPendingBookings = await WorkforceRequest.find({
        status: { 
          $in: [
            REQUEST_STATUS.PLATFORM_FEE_PENDING,
            REQUEST_STATUS.VENDOR_PLATFORM_FEE_PENDING,
            REQUEST_STATUS.CORPORATE_PLATFORM_FEE_PENDING
          ]
        },
        $or: [
          { platformFeePendingAt: { $lt: pendingPaymentTimeoutThreshold } },
          { platformFeePendingAt: { $exists: false }, createdAt: { $lt: pendingPaymentTimeoutThreshold } }
        ]
      })

      for (const booking of expiredPendingBookings) {
        try {
          // Helper function for processing refund eligibility
          const processRefundEligibility = async (userId, userRole, amount) => {
            if (!amount || amount <= 0) return 'none'

          // 1. Create Refund Request (ELIGIBLE)
          const refundReq = await RefundRequest.create({
            bookingId: booking._id,
            userId: userId,
            userRole: userRole,
            amount: amount,
            paymentTransactionId: 'timeout-refund', // Can be enhanced to find actual tx id
            status: 'ELIGIBLE',
            cancellationReason: 'Booking cancelled because the opposite party did not complete the platform fee payment within 5 minutes.'
          })

          // 2. Create WalletTransaction (Pending)
          const userObj = await User.findById(userId).select('fullName role')
          await WalletTransaction.create({
            transactionId: `RFND-REQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            payerId: userId,
            payerName: userObj?.fullName || userRole,
            payerType: (userObj?.role === 'individual' ? 'user' : userObj?.role) || userRole,
            amount: amount,
            type: 'Refund',
            source: 'Refund Eligible - Pending Request',
            status: 'Pending',
            bookingId: booking._id,
            referenceModel: 'RefundRequest',
            referenceId: refundReq._id
          })

          // 3. Update Admin Wallet (Shift from Revenue to Liability)
          let adminWallet = await Wallet.findOne({ singletonId: 'ADMIN_WALLET' })
          if (adminWallet) {
            adminWallet.totalRevenue = Math.max(0, adminWallet.totalRevenue - amount)
            adminWallet.pendingRefundLiability += amount
            await adminWallet.save()
          }

          return `${userRole}_refund_eligible`
        }

        let refundStatus = 'none'

        if (booking.labourPaymentStatus === 'paid' && booking.labourId) {
          refundStatus = await processRefundEligibility(booking.labourId, 'labour', booking.labourPlatformFee)
        }

        if (booking.userPaymentStatus === 'paid' && booking.clientId) {
          const s = await processRefundEligibility(booking.clientId, 'user', booking.userPlatformFee)
          refundStatus = refundStatus !== 'none' ? 'both_refund_eligible' : s
        }

        // --- Corporate and Vendor Flow Refunds ---
        if (booking.vendorPlatformFeeStatus === 'paid' && booking.acceptedBy) {
          const s = await processRefundEligibility(booking.acceptedBy, 'vendor', booking.vendorPlatformFeeAmount)
          refundStatus = refundStatus !== 'none' ? 'multiple_refund_eligible' : s
        }

        if (booking.corporatePlatformFeeStatus === 'paid' && booking.clientId) {
          const s = await processRefundEligibility(booking.clientId, 'corporate', booking.corporatePlatformFeeAmount)
          refundStatus = refundStatus !== 'none' ? 'multiple_refund_eligible' : s
        }

        // Cancel the booking and update lifecycle
        booking.status = 'cancelled'
        booking.cancelReason = 'platform_fee_timeout'
        booking.platformFeePaymentLifecycle = 'expired'
        await booking.save()

        // Clean up assignment to avoid hanging active jobs
        await Assignment.updateMany({ requestId: booking._id }, { status: 'cancelled' })

        // Emit socket event
        try {
          const io = getIO()
          const payload = {
            bookingId: booking._id,
            cancelReason: booking.cancelReason,
            refundStatus,
            message: 'Booking cancelled due to incomplete platform fee payment'
          }
          io.to(`request_${booking._id.toString()}`).emit('booking_cancelled', payload)
          
          if (booking.labourId) {
            emitToUser('labour', booking.labourId.toString(), 'booking_cancelled', payload)
          }
          if (booking.clientId) {
            emitToUser('individual', booking.clientId.toString(), 'booking_cancelled', payload)
          }
        } catch (socketErr) {
          console.error('Socket emit error on pending booking cancellation:', socketErr)
        }

        // Dedicated fee-timeout push for customer + worker
        if (booking.clientId) {
          const copy = feeTimeoutUserNotif()
          triggerNotification({
            userId: booking.clientId,
            title: copy.title,
            body: copy.body,
            type: copy.type,
            relatedId: booking._id,
            relatedModel: 'WorkforceRequest',
            url: '/app/bookings',
          }).catch(() => {})
        }
        if (booking.labourId) {
          const copy = feeTimeoutLabourNotif()
          triggerNotification({
            userId: booking.labourId,
            title: copy.title,
            body: copy.body,
            type: copy.type,
            relatedId: booking._id,
            relatedModel: 'WorkforceRequest',
            url: '/app/jobs',
          }).catch(() => {})
        }

        console.log(`Cancelled platform_fee_pending booking: ${booking.reference || booking._id} due to timeout`)
        } catch (innerErr) {
          console.error(`Failed to cancel booking ${booking._id}:`, innerErr)
        }
      }

    } catch (error) {
      console.error('Error in booking expiration job:', error)
    }
  }, 60 * 1000) // 1 minute interval
}
