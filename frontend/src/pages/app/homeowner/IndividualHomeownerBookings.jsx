import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, Menu, Plus, Filter, Clock, Search, Activity, CheckCircle2, LayoutGrid } from 'lucide-react'
import { AppButton } from '../../../components/app-ui/buttons/AppButton.jsx'
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
import { useGetMyRequestsQuery } from '../../../store/api/workforceApi.js'
import { buildBookingFlowPath } from '../../../lib/bookingFlowNavigation.js'

function openAppDrawer() {
  window.dispatchEvent(new Event('lc-open-app-drawer'))
}

function BookingsScreenHeader({ title, subtitle, onBack, rightIcon: RightIcon = Menu, onRightClick = openAppDrawer }) {
  return (
    <div
      className="sticky top-0 z-20 -mx-4 bg-white/95 backdrop-blur-md px-4 py-3 border-b border-slate-100/60 flex items-center justify-between shadow-xs"
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-100 bg-white text-slate-800 shadow-xs transition hover:border-slate-200 hover:text-slate-955 active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
      ) : (
        <Link
          to="/app"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-100 bg-white text-slate-800 shadow-xs transition hover:border-slate-200 hover:text-slate-955 active:scale-95"
          aria-label="Back to home"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
      )}
      
      {title ? (
        <div className="min-w-0 flex-1 px-3 text-center">
          <h1 className="truncate text-base font-extrabold tracking-tight text-slate-900">{title}</h1>
          {subtitle ? (
            <p className="truncate text-[10px] font-medium text-slate-500">{subtitle}</p>
          ) : null}
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <button
        type="button"
        onClick={onRightClick}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-100 bg-white text-slate-700 shadow-xs transition hover:border-slate-200 hover:text-slate-955 active:scale-95"
        aria-label="Header action"
      >
        <RightIcon className="h-5 w-5" aria-hidden />
      </button>
    </div>
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
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(true)

  const filteredHistory = useMemo(() => {
    return displayHistory.filter((item) => {
      const status = String(item.status || '').toLowerCase()
      if (selectedFilter === 'all') return true
      if (selectedFilter === 'active') {
        return ['searching', 'pending_review', 'confirmed', 'assigned', 'accepted', 'in_progress', 'on_site'].includes(status)
      }
      if (selectedFilter === 'finding_labour') {
        return status === 'searching' || status === 'pending_review'
      }
      if (selectedFilter === 'in_progress') {
        return status === 'in_progress' || status === 'on_site'
      }
      if (selectedFilter === 'completed') {
        return status === 'completed'
      }
      return true
    })
  }, [displayHistory, selectedFilter])

  const detailBooking = useMemo(
    () => (detailRef ? findBookingByRef(displayHistory, detailRef) : null),
    [detailRef, displayHistory],
  )

  const { data: serverRequestsData } = useGetMyRequestsQuery(undefined)

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
      // defer state update to avoid cascading render warnings
      setTimeout(() => setHistory(newHistory), 0)
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

  const handleViewDetail = useCallback(
    (ref) => {
      const next = new URLSearchParams(searchParams)
      next.set('ref', ref)
      setSearchParams(next)
    },
    [searchParams, setSearchParams]
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
      <div key="detail-view" className="space-y-4">
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
    <div key="list-view" className="space-y-4 pb-4">
      <BookingsScreenHeader
        title="My bookings"
        subtitle="Track requests or book again from home."
        rightIcon={Filter}
        onRightClick={() => setShowFilters(prev => !prev)}
      />

      <div className="pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/app')}
            className="flex items-center justify-center gap-1.5 w-full sm:w-auto rounded-xl bg-gradient-to-r from-brand-bright to-brand hover:opacity-95 active:scale-[0.97] transition-all text-slate-950 font-extrabold px-4 py-2.5 text-xs shadow-xs border-0"
          >
            <Plus className="h-4 w-4" strokeWidth={3.5} />
            <span>New Booking</span>
          </button>
        </div>
      </div>

      {showFilters ? (
        <div className="-mx-4 px-4 overflow-x-auto scrollbar-none flex gap-2 py-1">
          {[
            { id: 'all', label: 'All', icon: LayoutGrid },
            { id: 'active', label: 'Active', icon: Clock },
            { id: 'finding_labour', label: 'Finding Labour', icon: Search },
            { id: 'in_progress', label: 'In Progress', icon: Activity },
            { id: 'completed', label: 'Completed', icon: CheckCircle2 },
          ].map((f) => {
            const isSel = selectedFilter === f.id
            const Icon = f.icon
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedFilter(f.id)}
                className={`flex items-center gap-1.5 shrink-0 rounded-full px-4 py-2 text-xs font-bold transition duration-200 select-none ${
                  isSel
                    ? 'bg-[#FDF9EA] border border-[#F4C542]/70 text-[#8A6D1C] shadow-xs'
                    : 'bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isSel ? 'text-[#F4C542]' : 'text-slate-400'}`} />
                {f.label}
              </button>
            )
          })}
        </div>
      ) : null}

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        {isDemoHistory ? (
          <p className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-center text-[11px] text-slate-600">
            Sample bookings below — your real requests appear after you confirm a booking.
          </p>
        ) : null}

        <IndividualBookingHistoryList
          items={filteredHistory}
          isDemo={isDemoHistory}
          onTrack={handleTrack}
          onRebook={handleRebook}
          onViewDetail={handleViewDetail}
        />
      </motion.div>
    </div>
  )
}
