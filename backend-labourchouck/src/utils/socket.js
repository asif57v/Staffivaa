import { Server } from 'socket.io'

let io

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*', // In production, restrict this
      methods: ['GET', 'POST'],
      credentials: true,
    },
  })

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`)

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
