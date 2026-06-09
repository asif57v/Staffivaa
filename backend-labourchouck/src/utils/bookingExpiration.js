import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { Allocation } from '../models/Allocation.js'
import { Assignment } from '../models/Assignment.js'
import { REQUEST_STATUS } from '../constants/workforceConstants.js'
import { getIO } from './socket.js'

export function startBookingExpirationJob() {
  // Check every 1 minute
  setInterval(async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      
      // Find bookings in searching status older than 5 minutes
      const expiredBookings = await WorkforceRequest.find({
        status: REQUEST_STATUS.SEARCHING,
        createdAt: { $lt: fiveMinutesAgo }
      })

      if (expiredBookings.length === 0) return

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
        
        console.log(`Expired and deleted booking: ${booking.reference || booking._id}`)
      }
    } catch (error) {
      console.error('Error in booking expiration job:', error)
    }
  }, 60 * 1000) // 1 minute interval
}
