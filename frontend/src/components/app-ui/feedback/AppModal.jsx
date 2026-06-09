import { motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { appSpring } from '../../app/appMotion.js'

export function AppModal({ open, title, description, children, onClose, footer }) {
  const reduce = useReducedMotion()
  if (!open) return null

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'app-modal-title' : undefined}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xl"
        initial={reduce ? false : { scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={reduce ? undefined : { scale: 0.96, opacity: 0 }}
        transition={reduce ? { duration: 0.2 } : appSpring}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            {title ? (
              <h2 id="app-modal-title" className="text-base font-extrabold text-slate-900">
                {title}
              </h2>
            ) : null}
            {description ? <p className="mt-1 text-xs font-medium text-slate-500">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-600 shadow-sm transition hover:border-brand/25 hover:text-slate-900"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[min(70vh,32rem)] overflow-y-auto px-4 py-4">{children}</div>
        {footer ? <div className="border-t border-slate-100 px-4 py-3">{footer}</div> : null}
      </motion.div>
    </motion.div>
  )
}
