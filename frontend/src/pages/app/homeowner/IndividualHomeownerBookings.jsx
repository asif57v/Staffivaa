import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, CalendarClock, Menu, Plus, Sparkles } from 'lucide-react'
import { AppButton } from '../../../components/app-ui/buttons/AppButton.jsx'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { IndividualBookingDetail } from '../../../components/app/booking/IndividualBookingDetail.jsx'
import { IndividualBookingHistoryList } from '../../../components/app/booking/IndividualBookingHistoryList.jsx'
import {
  displayBookingsList,
  findBookingByRef,
  loadIndividualBookings,
  rebookDraftFromRecord,
  saveIndividualBookings,
} from '../../../lib/individualBookings.js'
import { writeBookingDraft } from '../../../lib/individualBookingDraft.js'
import { mapRequestStatusToIndividualBooking } from '../../../lib/workforceLabels.js'
import { useGetMyRequestsQuery } from '../../../store/api/workforceApi.js'
import { buildBookingFlowPath } from '../../../lib/bookingFlowNavigation.js'

function openAppDrawer() {
  window.dispatchEvent(new Event('lc-open-app-drawer'))
}

function BookingsScreenHeader({ title, subtitle, onBack }) {
  return (
    <motion.div layout className="-mx-4 px-4 pb-1">
      <div className="flex items-start gap-2 sm:gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-800 shadow-sm transition hover:border-brand/35 hover:text-brand"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
        ) : (
          <Link
            to="/app"
            className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-800 shadow-sm transition hover:border-brand/35 hover:text-brand"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand">Bookings</p>
          <h1 className="mt-0.5 text-xl font-black tracking-tight text-slate-900">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600 sm:text-sm">{subtitle}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={openAppDrawer}
          className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-700 shadow-sm transition hover:border-brand/35 hover:text-brand"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </motion.div>
  )
}

/** History + track detail — new bookings start from Home search or category tiles. */
export function IndividualHomeownerBookings() {
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [history, setHistory] = useState(() => loadIndividualBookings())

  const detailRef = searchParams.get('ref')?.trim() || ''
  const displayHistory = useMemo(() => displayBookingsList(history), [history])
  const isDemoHistory = history.length === 0
  const detailBooking = useMemo(
    () => (detailRef ? findBookingByRef(displayHistory, detailRef) : null),
    [detailRef, displayHistory],
  )

  const { data: serverRequestsData } = useGetMyRequestsQuery(undefined, { pollingInterval: 5000 })

  useEffect(() => {
    if (!serverRequestsData?.requests) return
    let updated = false
    const newHistory = history.map(b => {
      if (!b.requestId) return b
      const serverReq = serverRequestsData.requests.find(r => r._id === b.requestId)
      if (!serverReq) return b

      let newStatus = b.status
      if (serverReq.status) {
        if (serverReq.status === 'pending') newStatus = 'searching'
        else newStatus = serverReq.status
      }

      if (newStatus !== b.status) {
        updated = true
        return { ...b, status: newStatus }
      }
      return b
    })

    if (updated) {
      saveIndividualBookings(newHistory)
      setHistory(newHistory)
    }
  }, [serverRequestsData, history])

  useEffect(() => {
    const rebook = searchParams.get('rebookFrom')?.trim()
    if (!rebook) return
    const found = findBookingByRef(displayHistory, rebook)
    if (found) {
      const legacy = rebookDraftFromRecord(found)
      const line = found.lines?.[0]
      const categoryId = line?.categoryId || ''
      const groupId = line?.groupId || ''
      writeBookingDraft({
        entryPoint: 'category',
        bookingType: legacy.bookingType || 'instant',
        serviceDate: legacy.serviceDate,
        durationDays: legacy.durationDays,
        durationKind: found.durationKind || 'few_hours',
        address: legacy.address,
        lat: legacy.lat,
        lng: legacy.lng,
        notes: legacy.notes,
        groupId,
        categoryId,
        groupName: line?.groupName || '',
        categoryName: line?.categoryName || '',
        matchMode: found.matchMode || 'smart',
        selectedWorkers: found.selectedWorkers || [],
        paymentTiming: 'after_work',
      })
      navigate(buildBookingFlowPath('type', { categoryId, groupId }), { replace: true })
      return
    }
    const next = new URLSearchParams(searchParams)
    next.delete('rebookFrom')
    setSearchParams(next, { replace: true })
  }, [searchParams, displayHistory, navigate, setSearchParams])

  useEffect(() => {
    const type = searchParams.get('type')
    if (type !== 'instant' && type !== 'scheduled') return
    writeBookingDraft({ bookingType: type, entryPoint: 'search', matchMode: 'smart' })
    navigate(buildBookingFlowPath('type'), { replace: true })
  }, [searchParams, navigate])

  const clearDetailRef = useCallback(() => {
    const next = new URLSearchParams(searchParams)
    next.delete('ref')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const handleTrack = useCallback(
    (ref) => {
      const booking = findBookingByRef(displayHistory, ref)
      if (booking) {
        if (booking.status === 'searching' || booking.status === 'assigned') {
          navigate(buildBookingFlowPath('searching', { ref }))
          return
        }
        if (booking.status === 'accepted' || booking.status === 'in_progress' || booking.status === 'on_site') {
          navigate(buildBookingFlowPath('active', { ref }))
          return
        }
      }
      const next = new URLSearchParams(searchParams)
      next.set('ref', ref)
      setSearchParams(next)
    },
    [displayHistory, navigate, searchParams, setSearchParams],
  )

  const handleRebook = useCallback(
    (booking) => {
      const legacy = rebookDraftFromRecord(booking)
      const line = booking.lines?.[0]
      const categoryId = line?.categoryId || ''
      const groupId = line?.groupId || ''
      writeBookingDraft({
        entryPoint: 'category',
        bookingType: legacy.bookingType || 'instant',
        serviceDate: legacy.serviceDate,
        durationDays: legacy.durationDays,
        durationKind: booking.durationKind || 'few_hours',
        address: legacy.address,
        lat: legacy.lat,
        lng: legacy.lng,
        notes: legacy.notes,
        groupId,
        categoryId,
        groupName: line?.groupName || '',
        categoryName: line?.categoryName || '',
        matchMode: 'smart',
        selectedWorkers: [],
      })
      navigate(buildBookingFlowPath('type', { categoryId, groupId }))
    },
    [navigate],
  )

  const handleAdvancePipeline = useCallback((booking) => {
    const order = ['pending', 'finding', 'assigned', 'in_progress', 'completed']
    const idx = order.indexOf(booking.status)
    const newStatus = order[Math.min(idx + 1, order.length - 1)] || 'pending'
    const stored = loadIndividualBookings()
    const updated = stored.map((b) => (b.id === booking.id ? { ...b, status: newStatus } : b))
    saveIndividualBookings(updated)
    setHistory(updated)
  }, [])

  if (detailRef) {
    return (
      <div className="space-y-4">
        <BookingsScreenHeader
          title="Track booking"
          subtitle={detailBooking?.ref ? `Ref ${detailBooking.ref}` : 'Booking details'}
          onBack={clearDetailRef}
        />
        {!detailBooking ? (
          <AppSurface className="border-slate-200/90">
            <p className="text-sm font-semibold text-slate-800">Booking not found</p>
            <AppButton type="button" variant="primary" className="mt-4" onClick={clearDetailRef}>
              Back to history
            </AppButton>
          </AppSurface>
        ) : (
          <IndividualBookingDetail
            booking={detailBooking}
            onBack={clearDetailRef}
            onRebook={handleRebook}
            onAdvancePipeline={handleAdvancePipeline}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-4">
      <BookingsScreenHeader
        title="My bookings"
        subtitle="Track requests or book again from home."
      />

      <AppSurface className="border-brand/20 bg-linear-to-br from-brand/8 via-white to-emerald-50/40">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-md">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <motion.div layout className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-slate-900">Book labour</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Search a skill on home, pick workers, then confirm — instant or scheduled.
            </p>
            <AppPrimaryButton
              type="button"
              className="mt-3 w-full py-3 text-sm sm:w-auto"
              onClick={() => navigate('/app')}
            >
              <Plus className="h-4 w-4" aria-hidden />
              New booking
              <ArrowRight className="h-4 w-4" aria-hidden />
            </AppPrimaryButton>
          </motion.div>
        </div>
      </AppSurface>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        <div className="flex items-center gap-2 px-0.5">
          <CalendarClock className="h-4 w-4 text-slate-400" aria-hidden />
          <h2 className="text-sm font-extrabold text-slate-900">History</h2>
        </div>

        {isDemoHistory ? (
          <p className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-center text-[11px] text-slate-600">
            Sample bookings below — your real requests appear after you confirm a booking.
          </p>
        ) : null}

        <IndividualBookingHistoryList
          items={displayHistory}
          isDemo={isDemoHistory}
          onTrack={handleTrack}
          onRebook={handleRebook}
        />
      </motion.div>
    </div>
  )
}
