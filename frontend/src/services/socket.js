import { io } from 'socket.io-client'

let socket = null

export const connectSocket = (user, token) => {
  if (socket) return socket

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
  
  socket = io(API_URL, {
    auth: { token },
    withCredentials: true,
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

  socket.on('disconnect', () => {
    console.log('[Socket.io] Disconnected from server')
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
