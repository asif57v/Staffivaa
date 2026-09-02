import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { getLenisInstance } from '../../lib/lenisController.js'

/**
 * Global Scroll Manager for Workforce OS / Staffivaa
 *
 * Rules:
 * 1. PUSH / REPLACE Navigation (Tab Click, Link Click, Sidebar / Menu Click):
 *    - Automatically resets scroll to top (0,0) instantly.
 * 2. POP Navigation (Back / Forward Button):
 *    - Restores the saved scroll position for that specific route history entry.
 * 3. Active Tab Re-Tap:
 *    - Smoothly scrolls back to top.
 * 4. Dual Target:
 *    - Resets / restores both `window` and any scrollable container (`main`, `.overflow-y-auto`, `[data-scroll-container]`).
 */

// In-memory map to store scroll positions keyed by location.key or pathname
const scrollPositions = new Map()

const getValidScrollContainers = () => {
  return Array.from(document.querySelectorAll('main, [data-scroll-container], .main-content-scroll')).filter(
    (c) => !c.closest('aside') && !c.closest('.sidebar-scroll') && !c.classList.contains('no-auto-scroll')
  )
}

export function scrollToTop(smooth = true) {
  const lenis = getLenisInstance()
  if (lenis) {
    lenis.scrollTo(0, { immediate: !smooth })
  } else {
    const behavior = smooth ? 'smooth' : 'instant'
    window.scrollTo({ top: 0, left: 0, behavior })
  }

  getValidScrollContainers().forEach((c) => {
    c.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'instant' })
  })
}

export function GlobalScrollManager() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const currentKeyRef = useRef(location.key || location.pathname)

  // 1. Record scroll position continuously before route changes
  useEffect(() => {
    const key = location.key || location.pathname
    currentKeyRef.current = key

    const recordScroll = () => {
      const windowY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0
      const windowX = window.scrollX || window.pageXOffset || document.documentElement.scrollLeft || 0

      const container = getValidScrollContainers()[0] || document.querySelector('main')
      const containerY = container ? container.scrollTop : 0
      const containerX = container ? container.scrollLeft : 0

      scrollPositions.set(key, { windowX, windowY, containerX, containerY })
    }

    let ticking = false
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          recordScroll()
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    const containers = getValidScrollContainers()
    containers.forEach((c) => c.addEventListener('scroll', handleScroll, { passive: true }))

    return () => {
      recordScroll()
      window.removeEventListener('scroll', handleScroll)
      containers.forEach((c) => c.removeEventListener('scroll', handleScroll))
    }
  }, [location.key, location.pathname])

  // 2. Reset or Restore scroll position on location change
  useEffect(() => {
    const key = location.key || location.pathname

    if (navigationType === 'POP') {
      // POP Navigation (Back / Forward Button) -> Restore exact previous position!
      const saved = scrollPositions.get(key)
      const targetY = saved ? saved.windowY : 0
      const targetContainerY = saved ? saved.containerY : 0

      const restore = () => {
        const lenis = getLenisInstance()
        if (lenis) {
          lenis.scrollTo(targetY, { immediate: true })
        } else {
          window.scrollTo({ top: targetY, left: 0, behavior: 'instant' })
        }
        getValidScrollContainers().forEach((c) => {
          c.scrollTop = targetContainerY
        })
      }

      restore()
      requestAnimationFrame(restore)
      const t = setTimeout(restore, 60)
      return () => clearTimeout(t)
    } else {
      // PUSH or REPLACE Navigation (New Page / Tab Click) -> Always start from TOP!
      const resetToTop = () => {
        const lenis = getLenisInstance()
        if (lenis) {
          lenis.scrollTo(0, { immediate: true })
        } else {
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
        }
        getValidScrollContainers().forEach((c) => {
          c.scrollTop = 0
        })
      }

      resetToTop()
      requestAnimationFrame(resetToTop)
    }
  }, [location.key, location.pathname, navigationType])

  return null
}
