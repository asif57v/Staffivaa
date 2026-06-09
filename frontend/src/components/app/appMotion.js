/** Shared motion presets — pair with `useReducedMotion()` from framer-motion */

export const appSpring = { type: 'spring', stiffness: 380, damping: 32 }

export const appPage = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
}

export const appStaggerParent = {
  animate: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
}

export const appStaggerItem = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
}
