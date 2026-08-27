import { Server } from 'socket.io'
import mongoose from 'mongoose'
import { normalizeRole } from './roleUtils.js'
import { verifyAccessToken } from '../services/tokenService.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { Assignment } from '../models/Assignment.js'
import { User } from '../models/User.js'

let io

// In-memory rate limiting map for worker location updates (workerId_bookingId -> lastTimestamp)
const locationUpdateTimestamps = new Map()

// Helper to authenticate a socket or token
const resolveUserFromSocketOrToken = async (socket, token) => {
  const authToken = token || socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '')
  if (!authToken) return null
  try {
    const payload = verifyAccessToken(authToken)
    if (!payload?.sub) return null
    return {
      userId: payload.sub.toString(),
      role: payload.role,
      phone: payload.phone,
    }
  } catch (err) {
    return null
  }
}

export const initSocket = () => {
  io = new Server(5001, {
    cors: {
      origin: function (origin, callback) {
        // Allow dynamic origin resolution to support Vercel preview and production domains
        callback(null, true)
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
    },
  })

  console.log(`[Socket.io] Listening on :5001`)

  io.use(async (socket, next) => {
    // Optional handshake auth
    const user = await resolveUserFromSocketOrToken(socket)
    if (user) {
      socket.data.user = user
    }
    next()
  })

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`)

    // Authenticate and join role-based personal rooms
    socket.on('authenticate', (userData) => {
      if (!userData || !userData._id || !userData.role) return

      const { _id } = userData
      const role = normalizeRole(userData.role)
      const personalRoom = `${role}_${_id}`
      const roleRoom = role

      socket.join(personalRoom)
      socket.join(roleRoom)

      if (role === 'contractor') {
        socket.join(`vendor_${_id}`)
        socket.join(`contractor_${_id}`)
      } else if (role === 'individual') {
        socket.join(`user_${_id}`)
      } else if (role === 'labour') {
        socket.join(`worker_${_id}`)
      } else if (role === 'corporate') {
        socket.join(`corporate_${_id}`)
      } else if (role === 'enterprise') {
        socket.join(`enterprise_${_id}`)
      }

      console.log(`[Socket.io] Socket ${socket.id} joined role-scoped rooms for user ${_id} (${role})`)
    })

    // ==========================================
    // Real-Time Live Location Tracking Handlers
    // ==========================================

    /**
     * worker:joinBooking
     * Worker joins the dedicated tracking room for a booking.
     * Payload: { bookingId, token }
     */
    socket.on('worker:joinBooking', async (payload = {}) => {
      try {
        const { bookingId, token } = payload
        if (!bookingId) return socket.emit('tracking:error', { message: 'bookingId is required' })

        const user = (await resolveUserFromSocketOrToken(socket, token)) || socket.data.user
        if (!user) {
          return socket.emit('tracking:error', { message: 'Authentication required to join tracking' })
        }

        // Validate booking & worker authorization
        if (mongoose.Types.ObjectId.isValid(bookingId)) {
          const request = await WorkforceRequest.findById(bookingId).select('labourId clientId status').lean()
          if (!request) {
            return socket.emit('tracking:error', { message: 'Booking not found' })
          }

          // Check if user is the assigned labour on the request or has an active assignment
          const isDirectLabour = request.labourId && request.labourId.toString() === user.userId
          let hasAssignment = false
          if (!isDirectLabour) {
            const assignment = await Assignment.findOne({
              requestId: bookingId,
              labourId: user.userId,
              status: { $in: ['accepted', 'on_site', 'in_progress'] },
            }).select('_id').lean()
            hasAssignment = !!assignment
          }

          if (!isDirectLabour && !hasAssignment && user.role !== 'admin') {
            console.warn(`[Socket.io Tracking] Unauthorized worker ${user.userId} tried to join booking_${bookingId}`)
            return socket.emit('tracking:error', { message: 'You are not assigned to this booking' })
          }
        }

        const room = `booking_${bookingId}`
        socket.join(room)
        socket.join(`request_${bookingId}`)
        console.log(`[Socket.io Tracking] Worker ${user.userId} joined room ${room}`)
        socket.emit('tracking:joined', { room, role: 'worker', bookingId })
      } catch (err) {
        console.error('[Socket.io worker:joinBooking Error]:', err)
        socket.emit('tracking:error', { message: 'Failed to join tracking room' })
      }
    })

    /**
     * user:joinBooking
     * User (client) joins the dedicated tracking room to receive worker's live location.
     * Payload: { bookingId, token }
     */
    socket.on('user:joinBooking', async (payload = {}) => {
      try {
        const { bookingId, token } = payload
        if (!bookingId) return socket.emit('tracking:error', { message: 'bookingId is required' })

        const user = (await resolveUserFromSocketOrToken(socket, token)) || socket.data.user
        if (!user) {
          return socket.emit('tracking:error', { message: 'Authentication required to track booking' })
        }

        let lastKnownLocation = null
        if (mongoose.Types.ObjectId.isValid(bookingId)) {
          const request = await WorkforceRequest.findById(bookingId).select('clientId labourId currentLocation status').lean()
          if (!request) {
            return socket.emit('tracking:error', { message: 'Booking not found' })
          }

          // Authorization: Only client, assigned labour, or admin can track
          const isClient = request.clientId && request.clientId.toString() === user.userId
          if (!isClient && user.role !== 'admin' && user.role !== 'corporate') {
            console.warn(`[Socket.io Tracking] Unauthorized user ${user.userId} tried to track booking_${bookingId}`)
            return socket.emit('tracking:error', { message: 'You do not have permission to track this booking' })
          }

          lastKnownLocation = request.currentLocation || null
        }

        const room = `booking_${bookingId}`
        socket.join(room)
        socket.join(`request_${bookingId}`)
        console.log(`[Socket.io Tracking] User ${user.userId} joined room ${room}`)
        socket.emit('tracking:joined', { room, role: 'user', bookingId, lastKnownLocation })
      } catch (err) {
        console.error('[Socket.io user:joinBooking Error]:', err)
        socket.emit('tracking:error', { message: 'Failed to join tracking room' })
      }
    })

    /**
     * worker:locationUpdate
     * Worker emits periodic location update { bookingId, lat, lng, heading, speed, timestamp }
     */
    socket.on('worker:locationUpdate', async (payload = {}) => {
      try {
        const { bookingId, lat, lng, heading = 0, speed = 0, timestamp = Date.now(), token } = payload
        if (!bookingId || lat == null || lng == null) return

        const user = (await resolveUserFromSocketOrToken(socket, token)) || socket.data.user
        const workerId = user?.userId || 'unknown'

        // Rate limiting: Reject/skip if less than 2000ms since last update from this worker
        const rateKey = `${workerId}_${bookingId}`
        const lastTime = locationUpdateTimestamps.get(rateKey) || 0
        const now = Date.now()
        if (now - lastTime < 1800) {
          // Skip DB write to avoid overload, but still pass through if necessary
          return
        }
        locationUpdateTimestamps.set(rateKey, now)

        const locationData = {
          bookingId,
          lat: Number(lat),
          lng: Number(lng),
          heading: Number(heading) || 0,
          speed: Number(speed) || 0,
          timestamp: new Date(timestamp).getTime(),
          updatedAt: new Date(timestamp),
        }

        // 1. Relay immediately to the dedicated booking room for instant UI responsiveness
        const room = `booking_${bookingId}`
        io.to(room).emit('user:locationUpdate', locationData)
        // Also emit to request_ room for backward compatibility
        io.to(`request_${bookingId}`).emit('user:locationUpdate', locationData)

        // 2. Persist latest location in MongoDB on WorkforceRequest asynchronously (non-blocking)
        if (mongoose.Types.ObjectId.isValid(bookingId)) {
          WorkforceRequest.findByIdAndUpdate(
            bookingId,
            {
              $set: {
                'currentLocation.lat': locationData.lat,
                'currentLocation.lng': locationData.lng,
                'currentLocation.heading': locationData.heading,
                'currentLocation.speed': locationData.speed,
                'currentLocation.updatedAt': locationData.updatedAt,
              },
            },
            { new: false }
          ).catch((err) => console.error('[DB Location Update Error]:', err.message))

          if (user?.userId && mongoose.Types.ObjectId.isValid(user.userId)) {
            User.findByIdAndUpdate(
              user.userId,
              {
                $set: {
                  'labourProfile.currentLocation': {
                    lat: locationData.lat,
                    lng: locationData.lng,
                    heading: locationData.heading,
                    speed: locationData.speed,
                    updatedAt: locationData.updatedAt,
                  },
                },
              }
            ).catch(() => {})
          }
        }
      } catch (err) {
        console.error('[Socket.io worker:locationUpdate Error]:', err)
      }
    })

    /**
     * tracking:stop
     * Triggered when booking ends (completed, cancelled, or arrived/on_site)
     */
    socket.on('tracking:stop', (payload = {}) => {
      const { bookingId, reason, finalLocation } = payload
      if (!bookingId) return
      io.to(`booking_${bookingId}`).emit('tracking:stop', {
        bookingId,
        reason: reason || 'stopped',
        finalLocation,
      })
    })

    // Legacy and request-level rooms
    socket.on('join_request', (requestId) => {
      socket.join(`request_${requestId}`)
      socket.join(`booking_${requestId}`)
      console.log(`[Socket.io] Socket ${socket.id} joined request_${requestId}`)
    })

    socket.on('leave_request', (requestId) => {
      socket.leave(`request_${requestId}`)
      socket.leave(`booking_${requestId}`)
      console.log(`[Socket.io] Socket ${socket.id} left request_${requestId}`)
    })

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`)
    })
  })

  return io
}

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!')
  }
  return io
}

export const emitRequestStatusUpdate = (requestId, data) => {
  if (io) {
    io.to(`request_${requestId}`).emit('request_status_update', data)
    io.to(`booking_${requestId}`).emit('request_status_update', data)
  }
}

export const emitTrackingStop = (bookingId, reason = 'arrived', finalLocation = null) => {
  if (io) {
    io.to(`booking_${bookingId}`).emit('tracking:stop', {
      bookingId,
      reason,
      finalLocation,
    })
    io.to(`request_${bookingId}`).emit('tracking:stop', {
      bookingId,
      reason,
      finalLocation,
    })
  }
}

export const emitToUser = (role, userId, eventName, payload) => {
  if (io) {
    io.to(`${role}_${userId}`).emit(eventName, payload)
  }
}

export const emitToRole = (role, eventName, payload) => {
  if (io) {
    io.to(role).emit(eventName, payload)
  }
}

export const emitToVendor = (vendorId, eventName, payload) => {
  if (io) {
    io.to(`vendor-${vendorId}`).emit(eventName, payload)
  }
}

export const emitToCorporate = (corporateId, eventName, payload) => {
  if (io) {
    io.to(`corporate-${corporateId}`).emit(eventName, payload)
  }
}
