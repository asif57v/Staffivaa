import { io } from 'socket.io-client'

let socket = null

export const connectSocket = (user, token) => {
  if (socket) return socket

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
  
  // Enforce socket on port 5001
  const socketUrl = import.meta.env.VITE_SOCKET_URL || API_URL.replace('/api/v1', '').replace(':5000', ':5001').replace(':50011', ':5001')
  
  socket = io(socketUrl, {
    auth: { token },
    withCredentials: true,
    transports: ['websocket', 'polling'], // Force WebSocket transport if polling fails
  })

  socket.on('connect', () => {
    console.log('[Socket.io] Connected to server:', socket.id)
    if (user && user._id && user.role) {
      socket.emit('authenticate', {
        _id: user._id,
        role: user.role
      })
    }
  })

  socket.on('disconnect', (reason) => {
    console.log('[Socket.io] Disconnected from server:', reason)
  })

  socket.on('connect_error', (err) => {
    console.error('[Socket.io] Connection Error:', err.message)
  })

  socket.on('reconnect', (attempt) => {
    console.log('[Socket.io] Reconnected on attempt:', attempt)
  })

  return socket
}

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export const getSocket = () => {
  return socket
}

