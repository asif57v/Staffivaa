import { useEffect, useState } from 'react'

/**
 * Custom hook to detect when soft keyboard is open on mobile devices (Android / iOS / WebViews).
 * Returns `true` when an input field is focused or when visualViewport height shrinks.
 */
export function useKeyboardOpen() {
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const INPUT_SELECTOR =
      'input:not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]):not([type="file"]), textarea, select, [contenteditable="true"]'

    const checkState = () => {
      const active = document.activeElement
      const isInputFocused = Boolean(active && active.matches && active.matches(INPUT_SELECTOR))

      const vv = window.visualViewport
      let isViewportShrunk = false
      if (vv) {
        isViewportShrunk = (window.innerHeight - vv.height > 120) || (window.screen.height - vv.height > 150)
      }

      setKeyboardOpen(isInputFocused || (isViewportShrunk && isInputFocused))
    }

    const onFocusIn = (e) => {
      if (e.target && e.target.matches && e.target.matches(INPUT_SELECTOR)) {
        setKeyboardOpen(true)
      }
    }

    const onFocusOut = (e) => {
      if (e.target && e.target.matches && e.target.matches(INPUT_SELECTOR)) {
        setTimeout(() => {
          const currentActive = document.activeElement
          if (!currentActive || !currentActive.matches || !currentActive.matches(INPUT_SELECTOR)) {
            setKeyboardOpen(false)
          }
        }, 120)
      }
    }

    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', checkState)
      vv.addEventListener('scroll', checkState)
    }

    window.addEventListener('resize', checkState)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)

    return () => {
      if (vv) {
        vv.removeEventListener('resize', checkState)
        vv.removeEventListener('scroll', checkState)
      }
      window.removeEventListener('resize', checkState)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  return keyboardOpen
}
