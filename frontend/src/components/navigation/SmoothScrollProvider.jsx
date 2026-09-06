import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { ReactLenis, useLenis } from 'lenis/react'
import {
  clearLenisInstance,
  setLenisInstance,
} from '../../lib/lenisController.js'

const LENIS_DISABLED_ROUTE_RE =
  /^\/(admin|enterprise|corporate|vendor)(\/|$)|\/app\/(navigation|booking\/flow)/

const lenisOptions = {
  lerp: 0.1,
  duration: 1.15,
  smoothWheel: true,
  syncTouch: true,
  touchMultiplier: 1.1,
  wheelMultiplier: 1,
}

function LenisBridge() {
  const lenis = useLenis()

  useEffect(() => {
    if (!lenis) return undefined
    setLenisInstance(lenis)
    return () => clearLenisInstance()
  }, [lenis])

  return null
}

export function SmoothScrollProvider({ children }) {
  const { pathname } = useLocation()
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const disableLenis = LENIS_DISABLED_ROUTE_RE.test(pathname)

  useEffect(() => {
    if (disableLenis) {
      clearLenisInstance()
      document.documentElement.classList.remove('lenis', 'lenis-smooth', 'lenis-stopped', 'lenis-maps-safe')
      document.body.classList.remove('lenis', 'lenis-smooth', 'lenis-stopped')
    }
  }, [disableLenis])

  if (prefersReducedMotion || disableLenis) {
    return children
  }

  return (
    <ReactLenis root options={lenisOptions}>
      <LenisBridge />
      {children}
    </ReactLenis>
  )
}
