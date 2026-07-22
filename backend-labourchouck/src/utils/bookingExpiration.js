import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { Allocation } from '../models/Allocation.js'
import { Assignment } from '../models/Assignment.js'
import { User } from '../models/User.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { Wallet } from '../models/Wallet.js'
import { RefundRequest } from '../models/RefundRequest.js'
import { REQUEST_STATUS } from '../constants/workforceConstants.js'
import { getIO } from './socket.js'

export function startBookingExpirationJob() {
  // Check every 1 minute
  setInterval(async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      
      // 1. Find bookings in searching status older than 5 minutes
      const expiredBookings = await WorkforceRequest.find({
        status: REQUEST_STATUS.SEARCHING,
        createdAt: { $lt: fiveMinutesAgo }
      })

      for (const booking of expiredBookings) {
        // Emit socket event before deletion so clients can update UI
        try {
          const io = getIO()
          io.to(`request_${booking._id.toString()}`).emit('bookingExpired', {
            requestId: booking._id,
            status: 'expired',
            message: 'Booking expired due to inactivity'
          })
        } catch (socketErr) {
          console.error('Socket emit error on booking expiration:', socketErr)
        }

        // Delete associated assignments and allocations
        await Assignment.deleteMany({ requestId: booking._id })
        await Allocation.deleteMany({ requestId: booking._id })
        
        // Delete the booking itself
        await WorkforceRequest.findByIdAndDelete(booking._id)
        
        console.log(`Expired and deleted searching booking: ${booking.reference || booking._id}`)
      }

      // 2. Find bookings stuck in platform_fee_pending for > 5 minutes
      const expiredPendingBookings = await WorkforceRequest.find({
        status: REQUEST_STATUS.PLATFORM_FEE_PENDING,
        platformFeePendingAt: { $lt: fiveMinutesAgo }
      })

      for (const booking of expiredPendingBookings) {
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
            payerType: userObj?.role || userRole,
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
            refundedAmount,
            message: 'Booking cancelled due to incomplete platform fee payment'
          }
          io.to(`request_${booking._id.toString()}`).emit('booking_cancelled', payload)
          
          if (booking.labourId) {
            io.to(booking.labourId.toString()).emit('booking_cancelled', payload)
          }
          if (booking.clientId) {
            io.to(booking.clientId.toString()).emit('booking_cancelled', payload)
          }
        } catch (socketErr) {
          console.error('Socket emit error on pending booking cancellation:', socketErr)
        }

        console.log(`Cancelled platform_fee_pending booking: ${booking.reference || booking._id} due to timeout`)
      }

    } catch (error) {
      console.error('Error in booking expiration job:', error)
    }
  }, 60 * 1000) // 1 minute interval
}
