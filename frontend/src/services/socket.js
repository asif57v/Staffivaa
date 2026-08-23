import { io } from 'socket.io-client'
import toast from 'react-hot-toast'
import { store } from '../store/index.js'
import { clearSession } from '../store/slices/authSlice.js'
import { clearPushSyncState } from '../lib/pushSync.js'

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

  socket.on('session:terminated', (data) => {
    console.warn('[Socket.io] Received session:terminated event from server:', data)
    const message = data?.message || 'You have been logged in from another device. Your session has ended.'
    if (typeof window !== 'undefined') {
      clearPushSyncState()
      sessionStorage.setItem('staffivaa_logout_reason', message)
      toast.error(message, {
        id: 'staffivaa-session-terminated-toast',
        duration: 8000,
      })
    }
    store.dispatch(clearSession())
    disconnectSocket()
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

