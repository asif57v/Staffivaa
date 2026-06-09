import { useCallback, useEffect, useState } from 'react'

import { patchCurrentUser } from '../api/userProfileApi.js'

const PRESENCE_KEY = 'lc-labour-presence'
const EVENT = 'lc-labour-presence'

export function readLabourPresenceOnline() {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(PRESENCE_KEY) !== 'offline'
}

export function writeLabourPresenceOnline(online) {
  if (typeof window === 'undefined') return
  localStorage.setItem(PRESENCE_KEY, online ? 'online' : 'offline')
  window.dispatchEvent(new CustomEvent(EVENT))
  
  // Sync with backend
  patchCurrentUser({
    labourProfile: {
      availabilityStatus: online ? 'available' : 'offline'
    }
  }).catch(err => {
    console.error('Failed to update presence on backend:', err)
  })
}

/** Online / offline for worker availability. */
export function useLabourPresence() {
  const [online, setOnlineState] = useState(readLabourPresenceOnline)

  useEffect(() => {
    const sync = () => setOnlineState(readLabourPresenceOnline())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const setOnline = useCallback((next) => {
    writeLabourPresenceOnline(next)
    setOnlineState(next)
  }, [])

  const toggle = useCallback(() => {
    const next = !readLabourPresenceOnline()
    setOnline(next)
  }, [setOnline])

  return { online, setOnline, toggle }
}
