import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { MapPin, Building2, Clock, Briefcase, X, CheckCircle2, Calendar, Users } from 'lucide-react'
import { readAppUserLocation } from '../../lib/appUserLocationStorage.js'
import '../labour/jobs/IncomingJobPopup.css'

const CIRCLE_RADIUS = 54
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null
  const numLat1 = Number(lat1)
  const numLon1 = Number(lon1)
  const numLat2 = Number(lat2)
  const numLon2 = Number(lon2)
  if (!Number.isFinite(numLat1) || !Number.isFinite(numLon1) || !Number.isFinite(numLat2) || !Number.isFinite(numLon2)) {
    return null
  }

  const R = 6371e3
  const phi1 = (numLat1 * Math.PI) / 180
  const phi2 = (numLat2 * Math.PI) / 180
  const deltaPhi = ((numLat2 - numLat1) * Math.PI) / 180
  const deltaLambda = ((numLon2 - numLon1) * Math.PI) / 180

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

function formatDistance(meters) {
  if (meters == null || isNaN(meters)) return ''
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  }
  const km = meters / 1000
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`
}

function formatDate(d) {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

export function IncomingVendorRequestPopup({
  request,
  onAccept,
  onDecline,
  onTimeout,
  isAccepting = false,
}) {
  const totalSeconds = Math.min(60, Number(request?.timeoutSeconds) || 60)
  const [timeLeft, setTimeLeft] = useState(totalSeconds)
  const [exiting, setExiting] = useState(false)
  const timerRef = useRef(null)
  const soundIntervalRef = useRef(null)

  const [distanceMeters, setDistanceMeters] = useState(() => {
    if (request?.distanceKm != null && Number.isFinite(Number(request.distanceKm))) {
      return Number(request.distanceKm) * 1000
    }
    const savedLoc = readAppUserLocation()
    if (savedLoc?.lat != null && savedLoc?.lng != null && request?.locationLat != null && request?.locationLng != null) {
      return calculateDistanceMeters(savedLoc.lat, savedLoc.lng, request.locationLat, request.locationLng)
    }
    return null
  })

  // Watch GPS location for real-time distance
  useEffect(() => {
    if (request?.distanceKm != null && Number.isFinite(Number(request.distanceKm))) {
      setDistanceMeters(Number(request.distanceKm) * 1000)
    } else {
      const savedLoc = readAppUserLocation()
      if (savedLoc?.lat != null && savedLoc?.lng != null && request?.locationLat != null && request?.locationLng != null) {
        setDistanceMeters(calculateDistanceMeters(savedLoc.lat, savedLoc.lng, request.locationLat, request.locationLng))
      }
    }

    if (!navigator?.geolocation || request?.locationLat == null || request?.locationLng == null) return

    let isMounted = true
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!isMounted) return
        const d = calculateDistanceMeters(
          pos.coords.latitude,
          pos.coords.longitude,
          request.locationLat,
          request.locationLng
        )
        if (d != null) setDistanceMeters(d)
      },
      () => { },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    )

    return () => {
      isMounted = false
    }
  }, [request?.locationLat, request?.locationLng, request?.distanceKm])

  const distanceDisplay = formatDistance(distanceMeters)

  // Play audio chime loop every 3.5s while popup is active
  const playChime = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        if (AudioCtx) {
          const ctx = new AudioCtx()
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12) // A5
          gain.gain.setValueAtTime(0.25, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start()
          osc.stop(ctx.currentTime + 0.5)
        }
      }
    } catch { }
  }, [])

  useEffect(() => {
    playChime()
    soundIntervalRef.current = setInterval(playChime, 3500)
    return () => {
      if (soundIntervalRef.current) clearInterval(soundIntervalRef.current)
    }
  }, [playChime])

  const stopSound = useCallback(() => {
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current)
      soundIntervalRef.current = null
    }
  }, [])

  // Countdown timer
  useEffect(() => {
    setTimeLeft(totalSeconds)
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
  }, [request?.requestId, totalSeconds])

  const handleDismiss = useCallback((reason) => {
    stopSound()
    setExiting(true)
    setTimeout(() => {
      if (reason === 'timeout') {
        onTimeout?.()
      } else if (reason === 'decline') {
        onDecline?.()
      }
    }, 300)
  }, [stopSound, onTimeout, onDecline])

  // Auto-dismiss on timer zero
  useEffect(() => {
    if (timeLeft === 0) {
      handleDismiss('timeout')
    }
  }, [timeLeft, handleDismiss])

  const handleAccept = useCallback(() => {
    stopSound()
    if (timerRef.current) clearInterval(timerRef.current)
    onAccept?.()
  }, [stopSound, onAccept])

  if (!request) return null

  const progress = timeLeft / totalSeconds
  const strokeDashoffset = CIRCLE_CIRCUMFERENCE * (1 - progress)
  const isUrgent = timeLeft <= 15
  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60

  const lines = Array.isArray(request.lines) ? request.lines : []
  let totalWorkers = 0
  lines.forEach((l) => {
    totalWorkers += Number(l.quantity) || 1
  })

  const clientName = request.companyName || request.clientName || 'Corporate Client'
  const siteOrProject = request.siteName || request.projectName

  const durationStr = request.startDate
    ? `${formatDate(request.startDate)}${request.endDate ? ` — ${formatDate(request.endDate)}` : ''}`
    : ''

  const shiftStr = (request.shiftStart && request.shiftEnd)
    ? `${request.shiftStart} - ${request.shiftEnd}`
    : ''

  return createPortal(
    <div
      className={`fixed inset-0 z-[99999] flex items-center justify-center p-4 ${exiting ? '' : 'ijp-backdrop'}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 99999,
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        className={`w-full max-w-[420px] ${exiting ? 'ijp-card-exit' : 'ijp-card'}`}
        style={{
          margin: 'auto',
          maxWidth: '420px',
          width: '100%',
        }}
      >
        {/* Main Floating Card */}
        <div className="rounded-3xl bg-white overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] border border-slate-100">

          {/* Header with Circular Timer */}
          <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-5 pt-5 pb-4">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500" />

            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-300 ring-1 ring-amber-400/40">
                    <Briefcase className="h-3 w-3" />
                    New Corporate Request
                  </span>
                  {request.reference && (
                    <span className="rounded-full bg-slate-700/80 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                      {request.reference}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-black text-white leading-tight truncate">
                  {lines.length > 0 ? (lines[0].categoryName || lines[0].categoryId?.name || 'Workforce') : 'Corporate Request'}
                  {lines.length > 1 ? ` +${lines.length - 1} more` : ''} Needed
                </h3>
                <p className="mt-1 text-xs font-semibold text-amber-300/90 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {totalWorkers || 1} Total Workers Required
                </p>
              </div>

              {/* Circular Countdown Timer */}
              <div className={`relative flex-shrink-0 ${isUrgent ? 'ijp-timer-urgent' : ''}`}>
                <svg width="68" height="68" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r={CIRCLE_RADIUS}
                    fill="none"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="6"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r={CIRCLE_RADIUS}
                    fill="none"
                    stroke={isUrgent ? '#ef4444' : '#f59e0b'}
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
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                    left
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className="px-5 py-4 space-y-2.5 max-h-[52vh] overflow-y-auto">
            {/* Client & Site */}
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3.5 py-2.5 ring-1 ring-slate-100">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                <Building2 className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Corporate Client</p>
                <p className="text-xs font-bold text-slate-900 truncate">{clientName}</p>
                {siteOrProject && (
                  <p className="text-[11px] font-medium text-slate-500 truncate">{siteOrProject}</p>
                )}
              </div>
            </div>

            {/* Location */}
            {request.locationText && (
              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-3.5 py-2.5 ring-1 ring-slate-100">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 mt-0.5">
                  <MapPin className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Location</p>
                    {distanceDisplay && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100/90 px-2 py-0.5 text-[10px] font-black text-emerald-800 ring-1 ring-emerald-600/20">
                        {distanceDisplay} away
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-slate-700 leading-relaxed break-words mt-0.5">
                    {request.locationText}
                  </p>
                </div>
              </div>
            )}

            {/* Duration & Shift */}
            {(durationStr || shiftStr) && (
              <div className="grid grid-cols-2 gap-2">
                {durationStr && (
                  <div className="rounded-xl bg-blue-50/80 p-2.5 ring-1 ring-blue-100/80">
                    <div className="flex items-center gap-1.5 text-blue-700 mb-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">Duration</span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-800 line-clamp-1">{durationStr}</p>
                  </div>
                )}
                {shiftStr && (
                  <div className="rounded-xl bg-purple-50/80 p-2.5 ring-1 ring-purple-100/80">
                    <div className="flex items-center gap-1.5 text-purple-700 mb-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">Shift</span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-800 line-clamp-1">{shiftStr}</p>
                  </div>
                )}
              </div>
            )}

            {/* Workforce Requirements Breakdown */}
            <div className="rounded-2xl bg-amber-50/60 p-3 ring-1 ring-amber-200/60">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900/80 mb-2">Requirements</p>
              <div className="space-y-1.5">
                {lines.map((line, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs font-bold text-slate-800 bg-white/90 px-3 py-1.5 rounded-xl border border-amber-100 shadow-2xs">
                    <span>{line.categoryName || line.categoryId?.name || 'Worker'}</span>
                    <span className="rounded-md bg-amber-500 px-2 py-0.5 text-[11px] font-black text-white">
                      x {line.quantity || 1}
                    </span>
                  </div>
                ))}
              </div>
              {request.notes && (
                <p className="mt-2 text-xs italic text-slate-600 bg-white/80 p-2 rounded-lg border border-amber-100">
                  "{request.notes}"
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-4 pt-2 bg-white border-t border-slate-100">
            <div className="grid grid-cols-5 gap-3">
              {/* Decline Button */}
              <button
                type="button"
                onClick={() => handleDismiss('decline')}
                disabled={isAccepting}
                className="col-span-2 flex items-center justify-center gap-1.5 rounded-2xl border-2 border-slate-200 bg-white py-3.5 text-sm font-extrabold text-slate-700 transition hover:bg-slate-100 hover:border-slate-300 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <X className="h-4 w-4" />
                Decline
              </button>

              {/* Accept Button */}
              <button
                type="button"
                onClick={handleAccept}
                disabled={isAccepting}
                className="ijp-accept-btn col-span-3 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 py-3.5 text-sm font-black text-slate-900 shadow-lg shadow-amber-500/25 transition hover:brightness-105 active:scale-95 disabled:opacity-60 cursor-pointer"
              >
                {isAccepting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
                ) : (
                  <CheckCircle2 className="h-4.5 w-4.5" />
                )}
                {isAccepting ? 'Accepting...' : 'Accept Job'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
