import { io } from 'socket.io-client'

let socket = null
let activeUser = null

export const connectSocket = (user, token) => {
  if (user && user._id && user.role) {
    activeUser = user;
  }

  if (socket) {
    if (socket.connected && activeUser && activeUser._id && activeUser.role) {
      socket.emit('authenticate', {
        _id: activeUser._id,
        role: activeUser.role
      })
    }
    return socket
  }

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
  
  // Enforce socket on port 5001
  const socketUrl = import.meta.env.VITE_SOCKET_URL || API_URL.replace('/api/v1', '').replace(':5000', ':5001').replace(':50011', ':5001')
  
  socket = io(socketUrl, {
    auth: { token },
    withCredentials: true,
    transports: ['websocket', 'polling'], // Force WebSocket transport if polling fails
  })

  const doAuth = () => {
    if (activeUser && activeUser._id && activeUser.role) {
      console.log('[Socket.io] Authenticating active user rooms:', activeUser._id, activeUser.role);
      socket.emit('authenticate', {
        _id: activeUser._id,
        role: activeUser.role
      })
    }
  }

  socket.on('connect', () => {
    console.log('[Socket.io] Connected to server:', socket.id)
    doAuth()
  })

  socket.on('disconnect', (reason) => {
    console.log('[Socket.io] Disconnected from server:', reason)
  })

  socket.on('connect_error', (err) => {
    console.error('[Socket.io] Connection Error:', err.message)
  })

  socket.on('reconnect', (attempt) => {
    console.log('[Socket.io] Reconnected on attempt:', attempt)
    doAuth()
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

