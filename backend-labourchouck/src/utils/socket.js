import { Server } from 'socket.io'

let io

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  })

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`)

    // Authenticate and join role-based personal rooms
    socket.on('authenticate', (userData) => {
      if (!userData || !userData._id || !userData.role) return;
      
      const { _id, role } = userData;
      const personalRoom = `${role}_${_id}`;
      const roleRoom = role;

      socket.join(personalRoom);
      socket.join(roleRoom);
      
      console.log(`[Socket.io] Socket ${socket.id} joined rooms: ${personalRoom}, ${roleRoom}`);
    })

    // Client can join a room based on the requestId to receive updates for that specific request
    socket.on('join_request', (requestId) => {
      socket.join(`request_${requestId}`)
      console.log(`[Socket.io] Socket ${socket.id} joined request_${requestId}`)
    })

    socket.on('leave_request', (requestId) => {
      socket.leave(`request_${requestId}`)
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
