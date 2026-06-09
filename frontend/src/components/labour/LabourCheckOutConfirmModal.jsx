import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { LogOut, WifiOff } from 'lucide-react'
import { AppPrimaryButton } from '../app/AppPrimaryButton.jsx'
import { AppSecondaryButton } from '../app/AppSecondaryButton.jsx'

/**
 * Confirms check-out and explains the worker goes offline for new job requests.
 */
export function LabourCheckOutConfirmModal({ open, onClose, onConfirm }) {
  const reduce = useReducedMotion()

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            className="fixed inset-0 z-[115] bg-slate-950/50 backdrop-blur-sm"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            aria-label="Close dialog"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="labour-checkout-title"
            className="fixed inset-x-4 bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] z-[116] mx-auto max-w-lg rounded-[1.5rem] border border-slate-200/90 bg-white p-5 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.35)]"
            initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
              <WifiOff className="h-6 w-6" aria-hidden />
            </span>
            <h2 id="labour-checkout-title" className="mt-3 text-center text-lg font-extrabold text-slate-900">
              You are going offline
            </h2>
            <p className="mt-2 text-center text-sm leading-relaxed text-slate-600">
              After check-out you will be marked <strong className="text-slate-800">offline</strong>. You will not
              receive any new job requests until you check in again from your work area.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <AppSecondaryButton type="button" onClick={onClose} className="py-3 text-sm">
                Stay checked in
              </AppSecondaryButton>
              <AppPrimaryButton
                type="button"
                onClick={onConfirm}
                className="border-rose-200 bg-linear-to-r from-rose-600 to-rose-700 py-3 text-sm shadow-rose-500/20 hover:brightness-110"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Check out
              </AppPrimaryButton>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
