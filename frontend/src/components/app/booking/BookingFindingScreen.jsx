import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Loader2, MapPin, Radio, RotateCcw, SearchX, Sparkles } from 'lucide-react'
import { AppButton } from '../../app-ui/buttons/AppButton.jsx'

const MESSAGES = [
  'Booking received by our team…',
  'Admin will accept your booking soon…',
  'We will notify you as soon as it is accepted…',
]

const ASSIGNING_MESSAGES = [
  'Your booking has been accepted by admin…',
  'Selecting the right worker for your job…',
  'You will be notified as soon as a worker accepts…',
]

function formatDuration(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  if (mins > 0 && secs > 0) return `${mins} min ${secs} sec`
  if (mins > 0) return `${mins} min`
  return `${secs} seconds`
}

// The countdown is driven by the server's searchExpiresAt (admin can change the window or add time).
// `expired` also comes from the server; the local clock only keeps the UI in step between polls.
export function BookingFindingScreen({
  categoryLabel,
  onCancel,
  cancelling = false,
  expired = false,
  // Admin accepted the booking: the 90s accept timer no longer applies, we are just assigning a worker.
  adminAccepted = false,
  // ISO time when the admin-accept window ends (null until the first server response).
  searchExpiresAt = null,
  onRetry,
  retrying = false,
}) {
  const reduce = useReducedMotion()
  const [msgIndex, setMsgIndex] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  // Largest remaining time seen for this window = total length (grows if admin adds time).
  const [peak, setPeak] = useState(0)
  const endMs = searchExpiresAt ? new Date(searchExpiresAt).getTime() : null
  const remaining = endMs && Number.isFinite(endMs) ? Math.max(0, Math.ceil((endMs - now) / 1000)) : null
  if (remaining != null && remaining > peak) setPeak(remaining)
  const timedOut = expired || (!adminAccepted && remaining === 0)
  const messages = adminAccepted ? ASSIGNING_MESSAGES : MESSAGES

  useEffect(() => {
    const msgTimer = window.setInterval(() => {
      setMsgIndex((i) => i + 1)
    }, 2200)
    const tick = window.setInterval(() => setNow(Date.now()), 500)
    return () => {
      window.clearInterval(msgTimer)
      window.clearInterval(tick)
    }
  }, [])

  const retry = async () => {
    if (onRetry && (await onRetry()) === false) return
    setPeak(0)
    setNow(Date.now())
    setMsgIndex(0)
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
          another {peak > 0 ? formatDuration(peak) : 'while'}.
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

  const total = Math.max(peak, 1)
  const progress = remaining == null ? 0 : ((total - remaining) / total) * 100

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

      <h2 className="mt-8 text-xl font-black tracking-tight text-slate-900">
        {adminAccepted ? 'Admin is assigning a worker' : 'Admin will accept your booking soon and assign a worker to you'}
      </h2>
      {categoryLabel ? (
        <p className="mt-1 text-sm font-semibold text-brand">{categoryLabel}</p>
      ) : null}
      <motion.p
        key={msgIndex}
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-3 max-w-xs text-sm font-medium text-slate-600"
      >
        {messages[msgIndex % messages.length]}
      </motion.p>

      {adminAccepted || remaining == null ? null : (
      <motion.div className="mt-6 w-full max-w-xs">
        <motion.div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <motion.div
            className="h-full rounded-full bg-linear-to-r from-brand to-emerald-500"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.2 }}
          />
        </motion.div>
        <p className="mt-2 text-[11px] font-semibold text-slate-500">
          Waiting for admin to accept · {Math.floor(remaining / 60)}:
          {String(remaining % 60).padStart(2, '0')}
        </p>
      </motion.div>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-900 ring-1 ring-emerald-200/80">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Request sent
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-[11px] font-bold text-sky-900 ring-1 ring-sky-200/80">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          {adminAccepted ? 'Admin accepted' : 'Awaiting admin'}
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
