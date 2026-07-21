import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { Allocation } from '../models/Allocation.js'
import { Assignment } from '../models/Assignment.js'
import { User } from '../models/User.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
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
        // Process Refunds
        let refundedAmount = 0
        let refundStatus = 'none'

        if (booking.labourPaymentStatus === 'paid' && booking.labourId) {
          const amount = booking.labourPlatformFee || 0
          if (amount > 0) {
            await User.findByIdAndUpdate(booking.labourId, { $inc: { walletBalance: amount } })
            await WalletTransaction.create({
              userId: booking.labourId,
              amount: amount,
              type: 'refund',
              status: 'completed',
              reference: booking._id.toString(),
              description: 'Booking cancelled due to incomplete platform fee payment',
              category: 'platform_fee'
            })
            refundedAmount += amount
            refundStatus = 'labour_refunded'
          }
        }

        if (booking.userPaymentStatus === 'paid' && booking.clientId) {
          const amount = booking.userPlatformFee || 0
          if (amount > 0) {
            await User.findByIdAndUpdate(booking.clientId, { $inc: { walletBalance: amount } })
            await WalletTransaction.create({
              userId: booking.clientId,
              amount: amount,
              type: 'refund',
              status: 'completed',
              reference: booking._id.toString(),
              description: 'Booking cancelled due to incomplete platform fee payment',
              category: 'platform_fee'
            })
            refundedAmount += amount
            refundStatus = refundStatus === 'labour_refunded' ? 'both_refunded' : 'user_refunded'
          }
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
