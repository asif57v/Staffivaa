import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { scrollToTop } from '../../navigation/GlobalScrollManager.jsx'

/**
 * Presentational bottom tab bar for `AppShell`.
 * Hides automatically when the mobile soft keyboard is open so it doesn't
 * float above the keyboard. Works on both Android and iOS.
 */
export function AppBottomNav({ items }) {
  const reduce = useReducedMotion()
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  useEffect(() => {
    // ── Strategy 1: visualViewport resize (Android Chrome) ──────────────────
    const vv = window.visualViewport
    const initialHeight = vv?.height ?? window.innerHeight

    const onVVResize = () => {
      if (!vv) return
      // Keyboard is open when viewport height drops by >150px
      setKeyboardOpen(initialHeight - vv.height > 150)
    }

    if (vv) vv.addEventListener('resize', onVVResize)

    // ── Strategy 2: focusin/focusout on inputs (iOS Safari) ─────────────────
    // iOS doesn't shrink visualViewport reliably, but we can track
    // whether a text input has focus
    const INPUT_SELECTOR = 'input, textarea, select, [contenteditable]'

    const onFocusIn = (e) => {
      if (e.target.matches(INPUT_SELECTOR)) {
        setKeyboardOpen(true)
      }
    }
    const onFocusOut = (e) => {
      if (e.target.matches(INPUT_SELECTOR)) {
        // Small delay so nav doesn't flicker during focus transfers between inputs
        setTimeout(() => {
          if (!document.activeElement?.matches(INPUT_SELECTOR)) {
            setKeyboardOpen(false)
          }
        }, 100)
      }
    }

    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)

    return () => {
      if (vv) vv.removeEventListener('resize', onVVResize)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  // Hide completely when keyboard is open — no floating bar above keyboard
  if (keyboardOpen) return null


  return (
    <nav
      className="pointer-events-auto fixed bottom-0 left-1/2 z-30 flex w-full max-w-[430px] -translate-x-1/2 justify-center bg-white border-t border-[#ECECEC] rounded-t-[20px] shadow-[0_-4px_24px_rgba(0,0,0,0.04)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Bottom navigation"
    >
      <div className="flex h-[60px] w-full max-w-[430px] items-center justify-around px-4 overflow-visible">
        {items.map(({ id, to, end, label, icon: Icon, premium, badge }) => (
          <NavLink
            key={`${id}-${to}`}
            to={to}
            end={Boolean(end)}
            onClick={(e) => {
              const currentPath = window.location.pathname
              if (currentPath === to || (to !== '/app' && currentPath.startsWith(to))) {
                scrollToTop(true)
              }
            }}
            className={`flex min-w-0 flex-col items-center justify-center outline-none transition-all ${
              premium ? 'relative -mt-2.5 flex-[1.15]' : 'flex-1 h-full'
            }`}
          >
            {({ isActive }) =>
              premium ? (
                <>
                  <motion.span
                    className="relative flex items-center justify-center"
                    animate={
                      reduce
                        ? undefined
                        : isActive
                          ? { scale: [1, 1.06, 1], y: [0, -2, 0] }
                          : { scale: 1, y: 0 }
                    }
                    transition={
                      isActive
                        ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
                        : { type: 'spring', stiffness: 400, damping: 28 }
                    }
                  >
                    {isActive && !reduce ? (
                      <motion.span
                        layoutId="app-tab-premium-highlight"
                        className="absolute -inset-1 rounded-2xl buildmart-gradient buildmart-glow ring-2 ring-orange-300/40"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    ) : null}
                    {isActive && reduce ? (
                      <span className="absolute -inset-1 rounded-2xl buildmart-gradient ring-2 ring-orange-300/40" />
                    ) : null}
                    {!isActive ? (
                      <span className="absolute -inset-0.5 rounded-2xl bg-white ring-1 ring-orange-200/80 shadow-md" />
                    ) : null}
                    <span
                      className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-xl ${
                        isActive ? 'text-white' : 'text-bm-terracotta'
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px]" aria-hidden />
                    </span>
                  </motion.span>
                  <span
                    className={`mt-0.5 truncate px-0.5 text-[9px] font-black tracking-wide ${
                      isActive ? 'text-bm-terracotta' : 'text-[#98A2B3]'
                    }`}
                  >
                    {label}
                  </span>
                </>
              ) : (
                <div className="relative flex flex-col items-center justify-center w-full h-full text-center z-10 group pt-1">
                  <div className="relative flex items-center justify-center h-[32px] w-[32px]">
                    <div
                      className={`absolute inset-0 rounded-full bg-[#FFC107] shadow-[0_2px_8px_rgba(255,193,7,0.25)] transition-all duration-[250ms] ease-in-out origin-center ${
                        isActive ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
                      }`}
                    />

                    <div
                      className={`relative z-10 flex items-center justify-center transition-transform duration-[250ms] ease-in-out ${
                        isActive ? 'scale-[1.08]' : 'scale-100'
                      }`}
                    >
                      <Icon
                        size={20}
                        color={isActive ? '#000000' : '#98A2B3'}
                        strokeWidth={1.5}
                        className="transition-colors duration-[250ms] ease-in-out"
                        aria-hidden
                      />
                    </div>

                    {badge ? (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white ring-2 ring-white z-20 shadow-sm">
                        {badge}
                      </span>
                    ) : null}
                  </div>

                  <span
                    className={`mt-1 truncate px-0.5 text-[10px] transition-colors duration-[250ms] ease-in-out ${
                      isActive ? 'font-bold text-[#000000]' : 'font-medium text-[#98A2B3]'
                    }`}
                  >
                    {label}
                  </span>
                </div>
              )
            }
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
