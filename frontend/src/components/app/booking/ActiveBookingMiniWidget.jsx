import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronRight, Loader2, MapPin, Radio, UserRound } from 'lucide-react'
import { useKeyboardOpen } from '../../../hooks/useKeyboardOpen.js'
import { buildBookingFlowPath } from '../../../lib/bookingFlowNavigation.js'
import { patchBookingDraft, readBookingDraft } from '../../../lib/individualBookingDraft.js'
import {
  cancelActiveLiveBookings,
  getActiveLiveBooking,
  INDIVIDUAL_BOOKINGS_UPDATED_EVENT,
  liveBookingWidgetCopy,
  loadIndividualBookings,
  markLocalBookingCancelled,
  notifyWorkerCancelledBooking,
  resolveLiveBookingFlowStep,
  saveIndividualBookings,
  WORKER_CANCELLED_BOOKING_EVENT,
} from '../../../lib/individualBookings.js'
import { store } from '../../../store/index.js'

/** Searching chip should not linger forever if server already expired the request. */
const SEARCHING_MAX_AGE_MS = 3 * 60 * 1000

/**
 * Swiggy-style floating live-job chip — sits above bottom nav while a search
 * or active booking is in progress. Tap reopens the correct flow step.
 */
export function ActiveBookingMiniWidget() {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const keyboardOpen = useKeyboardOpen()
  const [booking, setBooking] = useState(() => getActiveLiveBooking())
  const handledCancelRef = useRef('')

  const refresh = useCallback(() => {
    setBooking(getActiveLiveBooking())
  }, [])

  const clearChip = useCallback((reason = 'cancelled', { notifyWorker = false, message } = {}) => {
    const live = getActiveLiveBooking()
    const key = String(live?.requestId || live?.ref || booking?.requestId || booking?.ref || 'live')
    if (handledCancelRef.current === key) {
      setBooking(null)
      return
    }
    handledCancelRef.current = key
    markLocalBookingCancelled({
      requestId: live?.requestId || booking?.requestId,
      ref: live?.ref || booking?.ref,
      reason,
    })
    if (!getActiveLiveBooking()) {
      /* already cleared */
    } else {
      cancelActiveLiveBookings(reason)
    }
    if (notifyWorker) {
      notifyWorkerCancelledBooking({
        message: message || 'Worker cancelled the booking.',
        requestId: live?.requestId || booking?.requestId,
        ref: live?.ref || booking?.ref,
      })
    }
    setBooking(null)
  }, [booking])

  useEffect(() => {
    refresh()
    const onUpdated = () => refresh()
    const onFocus = () => refresh()
    const onWorkerCancelled = () => {
      setBooking(null)
      refresh()
    }
    window.addEventListener(INDIVIDUAL_BOOKINGS_UPDATED_EVENT, onUpdated)
    window.addEventListener(WORKER_CANCELLED_BOOKING_EVENT, onWorkerCancelled)
    window.addEventListener('storage', onUpdated)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener(INDIVIDUAL_BOOKINGS_UPDATED_EVENT, onUpdated)
      window.removeEventListener(WORKER_CANCELLED_BOOKING_EVENT, onWorkerCancelled)
      window.removeEventListener('storage', onUpdated)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [refresh])

  // Drop stale "Finding labour" chips after search window ends
  useEffect(() => {
    if (!booking) return undefined
    const status = String(booking.status || '').toLowerCase()
    if (status !== 'searching') return undefined

    const createdAt = booking.createdAt ? new Date(booking.createdAt).getTime() : 0
    if (!createdAt) return undefined

    const age = Date.now() - createdAt
    if (age >= SEARCHING_MAX_AGE_MS) {
      clearChip('search_expired', { notifyWorker: false })
      return undefined
    }

    const remaining = SEARCHING_MAX_AGE_MS - age
    const timer = window.setTimeout(() => {
      clearChip('search_expired', { notifyWorker: false })
    }, remaining)
    return () => window.clearTimeout(timer)
  }, [booking, clearChip])

  // Poll live bookings so home stays in sync when labour cancels / accepts
  useEffect(() => {
    const status = String(booking?.status || '').toLowerCase()
    if (!booking) return undefined
    if (!['searching', 'accepted', 'assigned', 'in_progress', 'on_site'].includes(status)) return undefined

    const requestId = booking.requestId
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'
    let cancelled = false
    let stopPolling = false
    let intervalId = null

    const stop = () => {
      stopPolling = true
      if (intervalId != null) {
        window.clearInterval(intervalId)
        intervalId = null
      }
    }

    const markAccepted = (workerInfo) => {
      if (cancelled || stopPolling || !booking) return
      const worker = workerInfo
        ? {
            id: workerInfo._id || workerInfo.id,
            displayName: workerInfo.fullName || workerInfo.displayName || workerInfo.name || 'Verified Worker',
            photoUrl: workerInfo.profileImageUrl || workerInfo.photoUrl || null,
            phone: workerInfo.phone || null,
          }
        : booking.assignedWorker || null

      const updated = {
        ...booking,
        status: 'accepted',
        assignedWorker: worker,
        jobTimelineStep: 'accepted',
        etaMinutes: booking.etaMinutes ?? 22,
      }
      const stored = loadIndividualBookings().map((b) =>
        b.id === updated.id || b.ref === updated.ref ? updated : b,
      )
      saveIndividualBookings(stored)
      setBooking(updated)
    }

    const poll = async () => {
      if (cancelled || stopPolling) return
      try {
        const token = store.getState().auth.token
        if (!token) return

        // No server id — cannot verify; drop searching chip if stale
        if (!requestId) {
          if (status === 'searching') {
            stop()
            clearChip('search_expired', { notifyWorker: false })
          }
          return
        }

        const res = await fetch(`${baseUrl}/workforce/requests/${requestId}`, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
        })
        if (!res.ok) {
          if (res.status === 404 || res.status === 410) {
            stop()
            clearChip('cancelled', {
              notifyWorker: status !== 'searching',
              message: 'Worker cancelled the booking.',
            })
          }
          return
        }
        const json = await res.json()
        const { request, assignments } = json?.data || json || {}
        const reqStatus = String(request?.status || '').toLowerCase()

        if (['cancelled', 'timed_out', 'expired', 'failed', 'completed'].includes(reqStatus)) {
          stop()
          if (reqStatus === 'completed') {
            const stored = loadIndividualBookings().map((b) =>
              b.id === booking.id || b.ref === booking.ref ? { ...b, status: 'completed' } : b,
            )
            saveIndividualBookings(stored)
            setBooking(null)
            return
          }
          const workerCancel = request?.cancelReason === 'labour_cancelled_unpaid'
          clearChip(request?.cancelReason || 'cancelled', {
            notifyWorker: workerCancel,
            message: workerCancel ? 'Worker cancelled the booking.' : 'This booking has been cancelled.',
          })
          return
        }

        if (status === 'searching') {
          const accepted = assignments?.find((a) =>
            ['accepted', 'on_site', 'in_progress', 'completed'].includes(a.status),
          )
          if (accepted) {
            if (accepted.status === 'completed') {
              stop()
              const stored = loadIndividualBookings().map((b) =>
                b.id === booking.id || b.ref === booking.ref ? { ...b, status: 'completed' } : b,
              )
              saveIndividualBookings(stored)
              setBooking(null)
              return
            }
            markAccepted(accepted.labourId || accepted)
          }
          return
        }

        const active = assignments?.find((a) =>
          ['accepted', 'on_site', 'in_progress', 'completed'].includes(a.status),
        )
        if (active?.status === 'completed') {
          stop()
          const stored = loadIndividualBookings().map((b) =>
            b.id === booking.id || b.ref === booking.ref ? { ...b, status: 'completed' } : b,
          )
          saveIndividualBookings(stored)
          setBooking(null)
          return
        }
        if (!active && reqStatus === 'searching') {
          // Paid re-search — keep chip but switch to finding state
          const updated = {
            ...booking,
            status: 'searching',
            assignedWorker: null,
            jobTimelineStep: 'sent',
          }
          const stored = loadIndividualBookings().map((b) =>
            b.id === updated.id || b.ref === updated.ref ? updated : b,
          )
          saveIndividualBookings(stored)
          setBooking(null)
          return
        }
      } catch {
        /* ignore transient poll errors */
      }
    }

    poll()
    intervalId = window.setInterval(poll, 3000)
    return () => {
      cancelled = true
      stop()
    }
  }, [booking, clearChip])

  const handleOpen = useCallback(() => {
    if (!booking?.ref) return
    const step = resolveLiveBookingFlowStep(booking)
    if (!step) return

    const categoryId = booking.lines?.[0]?.categoryId || ''
    const groupId = booking.lines?.[0]?.groupId || ''
    const categoryName = booking.lines?.[0]?.categoryName || ''
    const prev = readBookingDraft() || {}
    patchBookingDraft({
      ...prev,
      lastRef: booking.ref,
      categoryId: categoryId || prev.categoryId || '',
      groupId: groupId || prev.groupId || '',
      categoryName: categoryName || prev.categoryName || '',
      groupName: booking.lines?.[0]?.groupName || prev.groupName || '',
    })

    navigate(
      buildBookingFlowPath(step, {
        ref: booking.ref,
        categoryId: categoryId || undefined,
        groupId: groupId || undefined,
      }),
    )
  }, [booking, navigate])

  if (keyboardOpen || !booking) return null

  const copy = liveBookingWidgetCopy(booking)
  const isSearching = copy.tone === 'searching'
  const Icon = isSearching ? Radio : copy.tone === 'accepted' ? UserRound : MapPin

  return (
    <div
      className="pointer-events-none fixed bottom-[calc(76px+env(safe-area-inset-bottom,0px))] left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 px-3"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence>
        <motion.button
          key={booking.ref || booking.id}
          type="button"
          onClick={handleOpen}
          initial={reduce ? false : { opacity: 0, y: 16, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? undefined : { opacity: 0, y: 12, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
          className="pointer-events-auto flex max-w-[min(100%,280px)] items-center gap-2.5 rounded-2xl border border-slate-200/90 bg-white/95 p-2.5 pr-3 text-left shadow-[0_10px_32px_-8px_rgba(15,23,42,0.28)] ring-1 ring-black/5 backdrop-blur-md transition active:scale-[0.98]"
          aria-label={`${copy.title}. ${copy.subtitle}. Tap to open.`}
        >
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
            {!reduce && isSearching ? (
              <motion.span
                className="absolute inset-0 rounded-full border-2 border-brand/35"
                animate={{ scale: [0.75, 1.25], opacity: [0.55, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
              />
            ) : null}
            <span
              className={`relative flex h-10 w-10 items-center justify-center rounded-full text-white shadow-md ${
                isSearching
                  ? 'bg-linear-to-br from-brand to-emerald-600 shadow-brand/25'
                  : 'bg-linear-to-br from-emerald-500 to-emerald-700 shadow-emerald-600/25'
              }`}
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden />
            </span>
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-black tracking-tight text-slate-900">{copy.title}</span>
              {copy.live ? (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-brand/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-brand">
                  {isSearching ? <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden /> : null}
                  Live
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-500">{copy.subtitle}</span>
          </span>

          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        </motion.button>
      </AnimatePresence>
    </div>
  )
}
