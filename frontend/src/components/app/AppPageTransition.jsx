import { motion, useReducedMotion } from 'framer-motion'
import { useLocation, useOutlet } from 'react-router-dom'

export function AppPageTransition() {
  const location = useLocation()
  const outlet = useOutlet()
  const reduce = useReducedMotion()

  return (
    <motion.div
      key={location.pathname}
      className="min-h-0"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      {outlet}
    </motion.div>
  )
}

