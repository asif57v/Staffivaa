import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { HardHat, RotateCcw, SearchX, Wrench, Zap } from 'lucide-react'
import { AppButton } from '../../app-ui/buttons/AppButton.jsx'
import './bookingStatus3d.css'

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
  // Admin turned the countdown off: no timer is shown and the booking never times out.
  noTimeLimit = false,
  // ISO time the booking was created (shown on the "Booking placed" step).
  placedAt = null,
  // "Back to home": the booking keeps processing in the background.
  onHome,
  onRetry,
  retrying = false,
}) {
  const reduce = useReducedMotion()
  const [now, setNow] = useState(() => Date.now())
  // Largest remaining time seen for this window = total length (grows if admin adds time).
  const [peak, setPeak] = useState(0)
  const endMs = searchExpiresAt && !noTimeLimit ? new Date(searchExpiresAt).getTime() : null
  const remaining = endMs && Number.isFinite(endMs) ? Math.max(0, Math.ceil((endMs - now) / 1000)) : null
  if (remaining != null && remaining > peak) setPeak(remaining)
  const timedOut = expired || (!adminAccepted && remaining === 0)

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(tick)
  }, [])

  const retry = async () => {
    if (onRetry && (await onRetry()) === false) return
    setPeak(0)
    setNow(Date.now())
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

  const status = adminAccepted ? 'accepted' : 'pending'
  const activeIndex = STATUS_INDEX[status]
  const placedTime = formatClock(placedAt)

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bs3d flex flex-col gap-4"
    >
      <WaitingStage accepted={adminAccepted} />

      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-900">
          {adminAccepted ? 'Booking accepted' : 'Your booking is in good hands'}
        </h2>
        <p className="mt-1.5 text-sm leading-5 text-slate-600">
          {adminAccepted
            ? "Our team is matching you with the right professional. We'll notify you the moment someone is assigned, so you don't have to wait here."
            : "Our team is reviewing your request and matching you with a professional. We'll notify you the moment it's confirmed, so you don't have to wait here."}
        </p>
      </div>

      <ol className="bs3d-card" aria-label="Booking progress">
        {STEPS.map((step, i) => {
          const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending'
          return (
            <li
              key={step.key}
              className={`bs3d-step bs3d-step--${state}`}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              {i < STEPS.length - 1 ? <span className="bs3d-line" aria-hidden /> : null}
              <span className={`bs3d-marker bs3d-marker--${state}`} aria-hidden>
                {state === 'done' ? <CheckIcon /> : null}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-bold ${state === 'pending' ? 'text-[#98A2B3]' : 'text-[#101828]'}`}>
                    {step.label}
                  </p>
                  {i === 0 && placedTime ? (
                    <span className="shrink-0 text-xs font-semibold text-[#556072]">{placedTime}</span>
                  ) : null}
                  {state === 'active' && i === 1 && remaining != null ? (
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-[#556072]">
                      {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
                    </span>
                  ) : null}
                </div>
                {state === 'active' ? (
                  <>
                    <p className="mt-0.5 text-xs font-medium text-[#556072]">
                      {i === 1
                        ? noTimeLimit
                          ? "We'll confirm it as soon as we can"
                          : `Usually confirmed within ${peak > 0 ? formatDuration(peak) : 'a few minutes'}`
                        : 'Matching you with the right professional'}
                    </p>
                    <div className="bs3d-indeterminate" role="progressbar" aria-label={step.label} />
                  </>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>

      <div className="sticky bottom-0 z-10 -mx-4 mt-2 flex flex-col gap-1 bg-white/95 px-4 pb-3 pt-3 backdrop-blur-sm">
        {onHome ? (
          <button
            type="button"
            onClick={onHome}
            className="h-13 w-full cursor-pointer rounded-2xl bg-brand text-[15px] font-black text-slate-900 shadow-md shadow-brand/30 transition active:scale-[0.98]"
          >
            Back to home
          </button>
        ) : null}
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={cancelling}
            className="h-11 w-full cursor-pointer rounded-xl text-sm font-semibold text-[#4A5568] transition hover:bg-black/5 disabled:opacity-60"
          >
            {cancelling ? 'Cancelling…' : 'Cancel booking'}
          </button>
        ) : null}
      </div>
    </motion.div>
  )
}

const STEPS = [
  { key: 'placed', label: 'Booking placed' },
  { key: 'review', label: 'Team is reviewing your request' },
  { key: 'assigned', label: 'Professional assigned' },
  { key: 'on_the_way', label: 'Professional on the way' },
]

// Index of the active step for each booking status; every step before it is done.
const STATUS_INDEX = { pending: 1, accepted: 2, assigned: 3, on_the_way: 4 }

function formatClock(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

// Orbiting helpers: white badge with a coloured icon, so they read well on any background.
const BADGES = [
  { angle: 0, Icon: HardHat, color: '#059669' },
  { angle: 120, Icon: Wrench, color: '#E08A00' },
  { angle: 240, Icon: Zap, color: '#2563EB' },
]

// [front/back, sides, top/bottom] shades per cube for simple lighting.
const CUBES = [
  { size: 28, left: '10%', top: '34%', shades: ['#FFD100', '#E0A800', '#FFE766'], cls: '' },
  { size: 20, left: '84%', top: '22%', shades: ['#059669', '#047857', '#34D399'], cls: 'bs3d-cube--slow' },
  { size: 14, left: '80%', top: '74%', shades: ['#0F172A', '#020617', '#334155'], cls: 'bs3d-cube--rev' },
  { size: 12, left: '22%', top: '80%', shades: ['#FFD100', '#E0A800', '#FFE766'], cls: 'bs3d-cube--slow bs3d-cube--rev' },
]

function Cube({ size, left, top, shades, cls }) {
  const h = size / 2
  const [front, side, topShade] = shades
  const faces = [
    [front, `translateZ(${h}px)`],
    [front, `rotateY(180deg) translateZ(${h}px)`],
    [side, `rotateY(90deg) translateZ(${h}px)`],
    [side, `rotateY(-90deg) translateZ(${h}px)`],
    [topShade, `rotateX(90deg) translateZ(${h}px)`],
    [topShade, `rotateX(-90deg) translateZ(${h}px)`],
  ]
  return (
    <div className="bs3d-cube-pos" style={{ left, top, width: size, height: size }}>
      <div className={`bs3d-cube ${cls}`} style={{ width: size, height: size }}>
        {faces.map(([bg, transform], i) => (
          <span key={i} style={{ background: bg, transform, borderRadius: 2 }} />
        ))}
      </div>
    </div>
  )
}

/** Pure CSS 3D scene: spinning house on a rippling floor, orbiting worker badges and tumbling cubes. */
function WaitingStage({ accepted }) {
  return (
    <div className="bs3d-stage" aria-hidden>
      <span className={`bs3d-chip ${accepted ? 'bs3d-chip--accent' : ''}`}>
        <span className="bs3d-chip-dot" />
        {accepted ? 'Accepted' : 'In review'}
      </span>

      <div className="bs3d-floor">
        <span className="bs3d-ripple" />
        <span className="bs3d-ripple" />
        <span className="bs3d-ripple" />
        <span className="bs3d-disc" />
        <div className="bs3d-orbit">
          {BADGES.map(({ angle, Icon, color }) => (
            <div
              key={angle}
              className="bs3d-badge-slot"
              style={{ transform: `rotateZ(${angle}deg) translateX(120px) rotateZ(${-angle}deg)` }}
            >
              <span className="bs3d-badge" style={{ background: "#fff", color }}>
                <Icon size={20} strokeWidth={2.3} aria-hidden />
              </span>
            </div>
          ))}
        </div>
      </div>

      <span className="bs3d-shadow" />
      <div className="bs3d-house-wrap">
        <div className="bs3d-house">
          <div className="bs3d-face bs3d-wall-fb bs3d-front">
            <span className="bs3d-door" />
          </div>
          <div className="bs3d-face bs3d-wall-fb bs3d-back">
            <span className="bs3d-window" />
            <span className="bs3d-window" />
          </div>
          <div className="bs3d-face bs3d-wall-side bs3d-right">
            <span className="bs3d-window" />
          </div>
          <div className="bs3d-face bs3d-wall-side bs3d-left">
            <span className="bs3d-window" />
          </div>
          <span className="bs3d-gable bs3d-gable-front" />
          <span className="bs3d-gable bs3d-gable-back" />
          <span className="bs3d-roof bs3d-roof-r" />
          <span className="bs3d-roof bs3d-roof-l" />
        </div>
      </div>

      {CUBES.map((c) => (
        <Cube key={`${c.left}-${c.top}`} {...c} />
      ))}
    </div>
  )
}
