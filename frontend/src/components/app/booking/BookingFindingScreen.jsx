import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Loader2, MapPin, Radio, RotateCcw, SearchX, Sparkles } from 'lucide-react'
import { AppButton } from '../../app-ui/buttons/AppButton.jsx'

const MESSAGES = [
  'Booking received by our team…',
  'Selecting the right worker for your job…',
  'Checking worker availability in your area…',
  'You will be notified as soon as a worker accepts…',
]

const SEARCH_SECONDS = 90

// Matches the server's INDIVIDUAL_SEARCH_SECONDS: after this the booking expires for the admin too.
// `expired` comes from the server (it is the source of truth); the local timer just keeps the UI in step.
export function BookingFindingScreen({
  categoryLabel,
  onCancel,
  cancelling = false,
  expired = false,
  onRetry,
  retrying = false,
}) {
  const reduce = useReducedMotion()
  const [msgIndex, setMsgIndex] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const timedOut = expired || elapsed >= SEARCH_SECONDS

  useEffect(() => {
    const startedAt = Date.now()
    const msgTimer = window.setInterval(() => {
      setMsgIndex((i) => (i + 1) % MESSAGES.length)
    }, 2200)
    const tick = window.setInterval(() => {
      const secs = Math.min(SEARCH_SECONDS, Math.floor((Date.now() - startedAt) / 1000))
      setElapsed(secs)
      if (secs >= SEARCH_SECONDS) {
        window.clearInterval(tick)
        window.clearInterval(msgTimer)
      }
    }, 500)

    return () => {
      window.clearInterval(msgTimer)
      window.clearInterval(tick)
    }
  }, [attempt])

  const retry = async () => {
    if (onRetry && (await onRetry()) === false) return
    setElapsed(0)
    setMsgIndex(0)
    setAttempt((a) => a + 1)
  }

  if (timedOut) {
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-10 text-center"
      >
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 text-amber-500 ring-8 ring-amber-50/60">
          <SearchX className="h-9 w-9" aria-hidden />
        </span>
        <h2 className="mt-6 text-xl font-black tracking-tight text-slate-900">No worker found</h2>
        {categoryLabel ? <p className="mt-1 text-sm font-semibold text-brand">{categoryLabel}</p> : null}
        <p className="mt-3 max-w-xs text-sm font-medium text-slate-600">
          Nearby workers seem busy right now, so this search has expired. Tap “Try again” and our team will search for
          another {SEARCH_SECONDS} seconds.
        </p>

        <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
          <AppButton type="button" className="w-full" onClick={retry} disabled={retrying} loading={retrying}>
            {retrying ? null : <RotateCcw className="mr-2 h-4 w-4" aria-hidden />}
            {retrying ? 'Searching…' : 'Try again'}
          </AppButton>
          {onCancel ? (
            <AppButton
              type="button"
              variant="danger"
              className="w-full"
              disabled={cancelling}
              loading={cancelling}
              onClick={onCancel}
            >
              {cancelling ? 'Cancelling…' : 'Cancel booking'}
            </AppButton>
          ) : null}
        </div>
      </motion.div>
    )
  }

  const progress = (elapsed / SEARCH_SECONDS) * 100
  const remaining = SEARCH_SECONDS - elapsed

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-10 text-center"
    >
      <motion.div
        className="relative flex h-44 w-44 items-center justify-center"
        animate={reduce ? undefined : { scale: [1, 1.04, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-brand/30"
          animate={reduce ? undefined : { scale: [0.6, 1.35], opacity: [0.55, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
        />
        <motion.span
          className="absolute inset-4 rounded-full border-2 border-brand/45"
          animate={reduce ? undefined : { scale: [0.7, 1.2], opacity: [0.5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.35 }}
        />
        <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-brand to-emerald-600 text-white shadow-xl shadow-brand/30">
          <Radio className="h-9 w-9" aria-hidden />
        </span>
        <motion.span
          className="absolute -bottom-1 flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-brand shadow-md ring-1 ring-brand/20"
          animate={reduce ? undefined : { opacity: [1, 0.7, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        >
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Live
        </motion.span>
      </motion.div>

      <h2 className="mt-8 text-xl font-black tracking-tight text-slate-900">Assigning a worker for you</h2>
      {categoryLabel ? (
        <p className="mt-1 text-sm font-semibold text-brand">{categoryLabel}</p>
      ) : null}
      <motion.p
        key={msgIndex}
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-3 max-w-xs text-sm font-medium text-slate-600"
      >
        {MESSAGES[msgIndex]}
      </motion.p>

      <motion.div className="mt-6 w-full max-w-xs">
        <motion.div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <motion.div
            className="h-full rounded-full bg-linear-to-r from-brand to-emerald-500"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.2 }}
          />
        </motion.div>
        <p className="mt-2 text-[11px] font-semibold text-slate-500">
          Our team is assigning the best worker nearby · {Math.floor(remaining / 60)}:
          {String(remaining % 60).padStart(2, '0')}
        </p>
      </motion.div>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-900 ring-1 ring-emerald-200/80">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Request sent
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-[11px] font-bold text-sky-900 ring-1 ring-sky-200/80">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          Searching nearby
        </span>
      </div>

      {onCancel ? (
        <div className="mt-10 w-full max-w-xs">
          <AppButton
            type="button"
            variant="danger"
            className="w-full"
            disabled={cancelling}
            loading={cancelling}
            onClick={onCancel}
          >
            {cancelling ? 'Cancelling…' : 'Cancel booking'}
          </AppButton>
          <p className="mt-2 text-[11px] font-medium text-slate-500">
            This stops the search and cancels the booking for everyone.
          </p>
        </div>
      ) : null}
    </motion.div>
  )
}
