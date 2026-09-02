import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { MapPin, User, Clock, IndianRupee, Briefcase, X, CheckCircle2 } from 'lucide-react'
import './IncomingJobPopup.css'

const CIRCLE_RADIUS = 54
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS

export function IncomingJobPopup({
  job,
  onAccept,
  onDecline,
  onTimeout,
  isAccepting,
  walletPolicy,
}) {
  const navigate = useNavigate()
  const totalSeconds = job?.timeoutSeconds || 90
  const [timeLeft, setTimeLeft] = useState(totalSeconds)
  const [exiting, setExiting] = useState(false)
  const audioRef = useRef(null)
  const timerRef = useRef(null)
  const jobIdRef = useRef(job?.assignmentId)

  // Reset timer + animation whenever a new job offer arrives
  useEffect(() => {
    const nextId = job?.assignmentId
    if (!nextId) return
    if (jobIdRef.current !== nextId) {
      jobIdRef.current = nextId
      setExiting(false)
    }
    setTimeLeft(job?.timeoutSeconds || 90)
  }, [job?.assignmentId, job?.timeoutSeconds])

  // Audio playback removed as requested
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.pause()
          audioRef.current.currentTime = 0
        } catch (e) {}
        audioRef.current = null
      }
    }
  }, [])

  // Countdown timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [job?.assignmentId, totalSeconds])

  // Auto-dismiss on timeout
  useEffect(() => {
    if (timeLeft === 0) {
      handleDismiss('timeout')
    }
  }, [timeLeft])

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }, [])

  const needsRecharge = Boolean(walletPolicy?.isLowBalance)

  const handleDismiss = useCallback((reason) => {
    stopAudio()
    setExiting(true)
    setTimeout(() => {
      if (reason === 'timeout') {
        onTimeout?.()
      }
    }, 300)
  }, [stopAudio, onTimeout])

  const handleAccept = useCallback(() => {
    stopAudio()
    if (timerRef.current) clearInterval(timerRef.current)
    if (needsRecharge) {
      navigate('/app/wallet', { replace: true })
      return
    }
    onAccept?.()
  }, [stopAudio, onAccept, needsRecharge, navigate])

  const handleDecline = useCallback(() => {
    stopAudio()
    if (timerRef.current) clearInterval(timerRef.current)
    setExiting(true)
    setTimeout(() => {
      onDecline?.()
    }, 300)
  }, [stopAudio, onDecline])

  if (!job) return null

  const progress = timeLeft / totalSeconds
  const strokeDashoffset = CIRCLE_CIRCUMFERENCE * (1 - progress)
  const isUrgent = timeLeft <= 15
  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const minimumRequired = Number(walletPolicy?.minimumRequired || 0)
  const walletBalance = Number(walletPolicy?.balance || 0)

  // Format shift display
  let shiftDisplay = ''
  if (job.shiftStart && job.shiftEnd) {
    shiftDisplay = `${job.shiftStart} - ${job.shiftEnd}`
  } else if (job.shiftStart) {
    shiftDisplay = job.shiftStart
  }

  // Format date display
  let dateDisplay = ''
  if (job.startDate) {
    try {
      dateDisplay = new Date(job.startDate).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    } catch (e) {
      dateDisplay = ''
    }
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] flex min-h-[100dvh] items-center justify-center p-4 ${exiting ? '' : 'ijp-backdrop'}`}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className={`w-full max-w-md ${exiting ? 'ijp-card-exit' : 'ijp-card'}`}
      >
        {/* Main Card */}
        <div className="rounded-[1.75rem] bg-white overflow-hidden shadow-[0_20px_60px_-12px_rgba(0,0,0,0.45)]">
          
          {/* Header with Timer */}
          <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-5 pt-5 pb-4">
            {/* Animated gradient accent */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />
            
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
                    <Briefcase className="h-3 w-3" />
                    New Job Request
                  </span>
                </div>
                <h3 className="text-[17px] font-extrabold text-white leading-tight truncate">
                  {job.categoryName || 'Worker'} Needed
                </h3>
                {dateDisplay && (
                  <p className="mt-1 text-xs font-medium text-slate-400">
                    {dateDisplay}
                  </p>
                )}
              </div>

              {/* Circular Countdown Timer */}
              <div className={`relative flex-shrink-0 ${isUrgent ? 'ijp-timer-urgent' : ''}`}>
                <svg width="72" height="72" viewBox="0 0 120 120">
                  {/* Background circle */}
                  <circle
                    cx="60"
                    cy="60"
                    r={CIRCLE_RADIUS}
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="6"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="60"
                    cy="60"
                    r={CIRCLE_RADIUS}
                    fill="none"
                    stroke={isUrgent ? '#ef4444' : '#22c55e'}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={CIRCLE_CIRCUMFERENCE}
                    strokeDashoffset={strokeDashoffset}
                    className="ijp-timer-circle"
                    style={{
                      transform: 'rotate(-90deg)',
                      transformOrigin: '50% 50%',
                    }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-[15px] font-black tabular-nums ${isUrgent ? 'text-red-400' : 'text-white'}`}>
                    {minutes}:{String(seconds).padStart(2, '0')}
                  </span>
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                    left
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Info Section */}
          <div className="px-5 py-4 space-y-3">
            {/* Customer Name */}
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5 ring-1 ring-slate-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Customer</p>
                <p className="text-sm font-bold text-slate-800 truncate">{job.clientName || 'Customer'}</p>
              </div>
            </div>

            {/* Location (Full multiline address) */}
            {job.locationText && (
              <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5 ring-1 ring-slate-100">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mt-0.5">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Location</p>
                  <p className="text-xs font-semibold text-slate-700 leading-relaxed break-words">{job.locationText}</p>
                </div>
              </div>
            )}

            {/* Shift Timing (if available) */}
            {shiftDisplay && (
              <div className="flex items-center gap-3 rounded-xl bg-purple-50 px-3.5 py-2.5 ring-1 ring-purple-100">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-200 text-purple-700">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-purple-600/70">Shift Timing</p>
                  <p className="text-xs font-bold text-purple-700">{shiftDisplay}</p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="px-5 pb-5 pt-1">
            {needsRecharge ? (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-900">
                Wallet balance ₹{walletBalance.toLocaleString('en-IN')}
                {minimumRequired > 0
                  ? ` — minimum ₹${minimumRequired.toLocaleString('en-IN')} required to accept jobs.`
                  : ' — recharge to receive this job.'}
              </div>
            ) : null}
            <div className="grid grid-cols-5 gap-3">
              {/* Decline Button (smaller) */}
              <button
                type="button"
                onClick={handleDecline}
                disabled={isAccepting}
                className="col-span-2 flex items-center justify-center gap-1.5 rounded-2xl border-2 border-slate-200 bg-white py-3.5 text-sm font-extrabold text-slate-600 transition-all active:scale-95 hover:bg-slate-100 hover:border-slate-300 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Decline
              </button>

              {/* Accept Button (larger, glowing) */}
              <button
                type="button"
                onClick={handleAccept}
                disabled={isAccepting}
                className={`ijp-accept-btn col-span-3 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-extrabold text-white shadow-lg transition-all active:scale-95 disabled:opacity-60 ${
                  needsRecharge
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
                    : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                }`}
              >
                {isAccepting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <CheckCircle2 className="h-4.5 w-4.5" />
                )}
                {isAccepting
                  ? 'Accepting...'
                  : needsRecharge
                    ? 'Recharge to Accept'
                    : 'Accept Job'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
