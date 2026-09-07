import { motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { appSpring } from '../../app/appMotion.js'

/**
 * Bottom sheet shell — parent controls open state and AnimatePresence if needed.
 */
export function AppBottomSheetBackdrop({ onClose }) {
  return (
    <button
      type="button"
      className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm cursor-pointer touch-none"
      aria-label="Close"
      onClick={onClose}
      onTouchMove={(e) => {
        if (e.cancelable) e.preventDefault()
      }}
    />
  )
}

export function AppBottomSheetPanel({ children, titleId, className = '' }) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={`relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xl ${className}`}
      initial={reduce ? false : { y: 28, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={reduce ? undefined : { y: 20, opacity: 0 }}
      transition={reduce ? { duration: 0.2 } : appSpring}
    >
      {children}
    </motion.div>
  )
}

export function AppBottomSheetChrome({ onClose, title, subtitle }) {
  return (
    <div className="border-b border-slate-100 px-4 pb-3 pt-2 shrink-0">
      <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-200" aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {title}
          {subtitle}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClose?.(e)
            }}
            className="shrink-0 flex items-center justify-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition active:scale-95 cursor-pointer touch-manipulation"
            aria-label="Close"
          >
            Close
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  )
}
