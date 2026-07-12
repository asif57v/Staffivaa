import { useState, useEffect } from 'react'
import { getSocket } from '../services/socket.js'

export function useSocket() {
  const [socket, setSocket] = useState(getSocket())

  useEffect(() => {
    if (socket) return

    // If socket is null (because a parent hasn't initialized it yet),
    // we poll briefly until it becomes available.
    const interval = setInterval(() => {
      const s = getSocket()
      if (s) {
        setSocket(s)
        clearInterval(interval)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [socket])

  return socket
}
