import { useEffect, useMemo, useState } from 'react'
import {
  BellRing,
  Calendar,
  CheckCircle2,
  CircleCheck,
  Clock,
  Home,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  UserPlus,
  Users,
  Wallet,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { useSocket } from '../../hooks/useSocket.js'
import {
  useGetAdminIndividualBookingsQuery,
  useGetIndividualBookingWorkersQuery,
  useAcceptIndividualBookingMutation,
  useExtendIndividualBookingMutation,
  useGetSettingsQuery,
  useUpdateSettingsMutation,
  useAssignIndividualBookingWorkersMutation,
  useWithdrawIndividualBookingOfferMutation,
} from '../../store/api/workforceApi.js'

const TABS = [
  { value: 'awaiting', label: 'Awaiting Assignment' },
  { value: 'active', label: 'Worker Assigned' },
  { value: 'completed', label: 'Completed' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
]

const OFFER_BADGE = {
  offered: { label: 'Ringing', className: 'bg-amber-50 text-amber-800 ring-amber-200' },
  accepted: { label: 'Accepted', className: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  on_site: { label: 'On site', className: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  in_progress: { label: 'In progress', className: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  completed: { label: 'Completed', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
  declined: { label: 'Declined / missed', className: 'bg-rose-50 text-rose-700 ring-rose-200' },
  cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
  replaced: { label: 'Replaced', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
}

const STATUS_LABEL = {
  searching: 'New request',
  admin_accepted: 'Accepted — assign worker',
  accepted: 'Accepted',
  confirmed: 'Confirmed',
  platform_fee_pending: 'Fee pending',
  on_site: 'On site',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
}

function formatDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function timeAgo(d) {
  if (!d) return ''
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  return `${Math.floor(hrs / 24)} d ago`
}

// startDate/endDate are stored as date-only values (UTC midnight), so format them in UTC to avoid
// showing a fake "05:30 am" time or the wrong day.
function formatDateOnly(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

const DURATION_LABEL = { few_hours: 'Few hours', full_day: 'Full day', multi_day: 'Multi day' }

function durationText(request) {
  let days = 1
  if (request.startDate && request.endDate) {
    days = Math.round((new Date(request.endDate) - new Date(request.startDate)) / 86400000) + 1
  }
  if (days > 1) return `${days} days (till ${formatDateOnly(request.endDate)})`
  return DURATION_LABEL[request.durationKind] || null
}

function isSearchExpired(request) {
  return request.status === 'cancelled' && request.cancelReason === 'search_expired'
}

/** Seconds left in the customer's search window (null when the booking has no window). */
function useSearchSecondsLeft(searchExpiresAt, active) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active || !searchExpiresAt) return undefined
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active, searchExpiresAt])
  if (!active || !searchExpiresAt) return null
  return Math.max(0, Math.ceil((new Date(searchExpiresAt).getTime() - now) / 1000))
}

function workerCount(lines) {
  if (!Array.isArray(lines)) return 1
  return lines.reduce((sum, l) => sum + (Number(l.quantity) || 1), 0) || 1
}

function categoryNames(lines) {
  if (!Array.isArray(lines)) return '—'
  return lines.map((l) => `${l.categoryId?.name || 'Worker'}${l.quantity > 1 ? ` ×${l.quantity}` : ''}`).join(', ') || '—'
}

/** Admin sets how long a new booking waits for accept (the countdown customers see). */
function AcceptTimeSetting() {
  const { data } = useGetSettingsQuery()
  const [updateSettings, { isLoading: saving }] = useUpdateSettingsMutation()
  const saved = data?.settings?.individualAcceptWindowSeconds ?? 90
  const [mins, setMins] = useState(null)
  const [secs, setSecs] = useState(null)
  const curMins = mins ?? Math.floor(saved / 60)
  const curSecs = secs ?? saved % 60
  const total = (Number(curMins) || 0) * 60 + (Number(curSecs) || 0)
  const valid = total >= 30 && total <= 1800
  const dirty = total !== saved

  const handleSave = async () => {
    if (!valid) return
    try {
      await updateSettings({ individualAcceptWindowSeconds: total }).unwrap()
      toast.success('Accept time updated — applies to new bookings')
      setMins(null)
      setSecs(null)
    } catch (err) {
      toast.error(err?.data?.message || 'Could not update accept time')
    }
  }

  return (
    <GlassPanel className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="flex items-center gap-2 text-sm font-black text-slate-900">
          <Clock className="h-4 w-4 text-brand" /> Booking accept time
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          How long a new booking waits for you to accept. Customers see this countdown (30 sec – 30 min).
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min="0"
          max="30"
          value={curMins}
          onChange={(e) => setMins(e.target.value)}
          className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-bold outline-none focus:border-slate-400"
        />
        <span className="text-xs font-semibold text-slate-500">min</span>
        <input
          type="number"
          min="0"
          max="59"
          value={curSecs}
          onChange={(e) => setSecs(e.target.value)}
          className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-bold outline-none focus:border-slate-400"
        />
        <span className="text-xs font-semibold text-slate-500">sec</span>
        <button
          type="button"
          disabled={!dirty || !valid || saving}
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save
        </button>
        {!valid ? <span className="text-[11px] font-bold text-rose-600">Min 30 sec, max 30 min</span> : null}
      </div>
    </GlassPanel>
  )
}

export function AdminIndividualBookingsPage() {
  const [tab, setTab] = useState('awaiting')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [assignTarget, setAssignTarget] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading, isFetching, isError, refetch } = useGetAdminIndividualBookingsQuery(
    { tab, ...(debouncedSearch ? { search: debouncedSearch } : {}) },
    { pollingInterval: 30000 },
  )
  const [withdrawOffer] = useWithdrawIndividualBookingOfferMutation()
  const [acceptBooking] = useAcceptIndividualBookingMutation()
  const [acceptingId, setAcceptingId] = useState(null)
  const [extendIndividualBooking] = useExtendIndividualBookingMutation()
  const [extendingId, setExtendingId] = useState(null)

  const requests = data?.requests ?? []
  const counts = data?.counts ?? {}

  const socket = useSocket()
  useEffect(() => {
    if (!socket) return
    const onPending = (payload) => {
      refetch()
      toast(
        payload?.reason === 'worker_cancelled'
          ? `Worker cancelled ${payload?.reference || 'a booking'} — please re-assign`
          : `New booking ${payload?.reference || ''} from ${payload?.clientName || 'customer'}`,
        { icon: '🛠️', id: `ib-${payload?.requestId}` },
      )
    }
    const onUpdate = () => refetch()
    const onBookingUpdated = (payload) => {
      refetch()
      if (payload?.reason === 'search_expired') {
        toast('A booking expired — no worker was assigned in time', { icon: '⌛', id: `ib-exp-${payload?.requestId}` })
      }
    }
    socket.on('individual_booking_pending', onPending)
    socket.on('individual_booking_updated', onBookingUpdated)
    socket.on('request_cancelled', onUpdate)
    return () => {
      socket.off('individual_booking_pending', onPending)
      socket.off('individual_booking_updated', onBookingUpdated)
      socket.off('request_cancelled', onUpdate)
    }
  }, [socket, refetch])

  const handleAccept = async (id) => {
    if (acceptingId) return
    setAcceptingId(id)
    try {
      const res = await acceptBooking(id).unwrap()
      toast.success(res?.message || 'Booking accepted')
    } catch (err) {
      toast.error(err?.data?.message || 'Could not accept booking')
      refetch()
    } finally {
      setAcceptingId(null)
    }
  }

  const handleExtend = async (id, seconds) => {
    if (extendingId) return
    setExtendingId(id)
    try {
      await extendIndividualBooking({ id, seconds }).unwrap()
      toast.success('Time added — customer countdown updated')
    } catch (err) {
      toast.error(err?.data?.message || 'Could not add time')
      refetch()
    } finally {
      setExtendingId(null)
    }
  }

  const handleWithdraw = async (assignmentId) => {
    try {
      await withdrawOffer(assignmentId).unwrap()
      toast.success('Offer withdrawn')
    } catch (err) {
      toast.error(err?.data?.message || 'Could not withdraw offer')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black text-slate-900">
            <Home className="h-5 w-5 text-brand" /> Individual Bookings
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Customer bookings wait here until you accept them, then assign a worker. The worker gets the normal job ring and accepts as usual
            (wallet balance is checked on accept).
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <AcceptTimeSetting />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const count = counts[t.value]
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
                  tab === t.value ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {t.label}
                {count ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      t.value === 'awaiting' ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ref, customer, phone, area…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : isError ? (
        <GlassPanel className="p-8 text-center text-sm text-rose-600">Failed to load bookings.</GlassPanel>
      ) : requests.length === 0 ? (
        <GlassPanel className="p-10 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
          <p className="mt-3 text-sm font-bold text-slate-700">
            {tab === 'awaiting' ? 'No bookings waiting for you.' : 'No bookings here.'}
          </p>
        </GlassPanel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {requests.map((r) => (
            <BookingCard
              key={r._id}
              request={r}
              searchWindowSeconds={data?.searchWindowSeconds ?? 90}
              onAccept={() => handleAccept(r._id)}
              accepting={acceptingId === r._id}
              onExtend={(seconds) => handleExtend(r._id, seconds)}
              extending={extendingId === r._id}
              onAssign={() => setAssignTarget(r)}
              onWithdraw={handleWithdraw}
            />
          ))}
        </div>
      )}

      {assignTarget ? <AssignWorkerModal request={assignTarget} onClose={() => setAssignTarget(null)} /> : null}
    </div>
  )
}

function BookingCard({ request, onAccept, accepting, onExtend, extending, onAssign, onWithdraw, searchWindowSeconds = 90 }) {
  const client = request.clientId || {}
  const assignments = request.assignments || []
  // New request: only "Accept booking". Worker assignment unlocks once admin accepted (enforced on the server too).
  const canAccept = request.status === 'searching' && !request.labourId
  const canAssign = request.status === 'admin_accepted' && !request.labourId
  const ringing = assignments.filter((a) => a.status === 'offered')
  const isInstant = request.bookingType !== 'scheduled'
  const workers = workerCount(request.lines)
  const expired = isSearchExpired(request)
  // Older bookings have no searchExpiresAt; their window started at creation (same rule as the server).
  const searchEndsAt =
    request.searchExpiresAt ||
    (request.createdAt ? new Date(new Date(request.createdAt).getTime() + searchWindowSeconds * 1000).toISOString() : null)
  const secondsLeft = useSearchSecondsLeft(searchEndsAt, canAccept)
  const [customMinutes, setCustomMinutes] = useState('')

  return (
    <GlassPanel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-black text-slate-500">{request.reference}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ring-1 ${
                expired
                  ? 'bg-amber-50 text-amber-700 ring-amber-200'
                  : request.status === 'searching'
                    ? 'bg-rose-50 text-rose-700 ring-rose-200'
                    : request.status === 'admin_accepted'
                      ? 'bg-indigo-50 text-indigo-700 ring-indigo-200'
                      : request.status === 'cancelled'
                      ? 'bg-slate-100 text-slate-500 ring-slate-200'
                      : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
              }`}
            >
              {expired ? 'Expired — no worker' : STATUS_LABEL[request.status] || request.status}
            </span>
            {secondsLeft != null ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ${
                  secondsLeft <= 30 ? 'bg-rose-600 text-white ring-rose-600' : 'bg-amber-50 text-amber-800 ring-amber-200'
                }`}
              >
                <Clock className="h-3 w-3" />
                {secondsLeft > 0
                  ? `Expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
                  : 'Expiring…'}
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 text-base font-black text-slate-900">{categoryNames(request.lines)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-bold text-slate-600">Booked {formatDateTime(request.createdAt)}</p>
          <p className="text-[10px] font-semibold text-slate-400">{timeAgo(request.createdAt)}</p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-slate-600">
        <p className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="font-bold text-slate-800">{client.fullName || 'Customer'}</span>
          {client.phone ? (
            <a href={`tel:${client.phone}`} className="inline-flex items-center gap-1 text-brand hover:underline">
              <Phone className="h-3 w-3" /> {client.phone}
            </a>
          ) : null}
        </p>
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="line-clamp-2">{request.locationText || 'Location not provided'}</span>
        </p>
        <p className="flex flex-wrap items-center gap-2">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          {isInstant ? (
            <>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase text-amber-700 ring-1 ring-amber-200">
                <Zap className="h-3 w-3" /> Instant
              </span>
              <span className="font-semibold text-slate-800">ASAP — {formatDateOnly(request.startDate)}</span>
            </>
          ) : (
            <>
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-black uppercase text-sky-700 ring-1 ring-sky-200">
                Scheduled
              </span>
              <span className="font-semibold text-slate-800">{formatDateOnly(request.startDate)}</span>
              {request.shiftStart ? (
                <span className="text-slate-600">
                  · {request.shiftStart}
                  {request.shiftEnd ? ` – ${request.shiftEnd}` : ''}
                </span>
              ) : (
                <span className="text-slate-400">· time slot not given</span>
              )}
            </>
          )}
        </p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            {durationText(request) || 'Duration not given'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            {workers} worker{workers > 1 ? 's' : ''}
          </span>
          {request.labourCharge ? (
            <span className="inline-flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              Est. labour ₹{Number(request.labourCharge).toLocaleString('en-IN')}
            </span>
          ) : null}
        </p>
        {request.notes ? <p className="rounded-lg bg-slate-50 p-2 text-[11px] italic text-slate-500">“{request.notes}”</p> : null}
      </div>

      {expired ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900 ring-1 ring-amber-200">
          <XCircle className="h-4 w-4 shrink-0" />
          <span>
            <span className="font-bold">Booking expired</span> — no worker was assigned within the search window
            {request.searchExpiredAt ? ` (expired ${formatDateTime(request.searchExpiredAt)})` : ''}. It reopens here if
            the customer taps “Try again”.
          </span>
        </div>
      ) : null}

      {request.labourId ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-2.5 text-xs text-emerald-900 ring-1 ring-emerald-200">
          <CheckCircle2 className="h-4 w-4" />
          <span className="font-bold">{request.labourName || 'Worker'}</span>
          {request.labourPhone ? <span className="text-emerald-700">· {request.labourPhone}</span> : null}
          <span className="ml-auto text-[10px] text-emerald-700">accepted {formatDateTime(request.acceptedAt)}</span>
        </div>
      ) : null}

      {assignments.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Offers sent</p>
          <ul className="space-y-1.5">
            {assignments.map((a) => {
              const badge = OFFER_BADGE[a.status] || { label: a.status, className: 'bg-slate-100 text-slate-600 ring-slate-200' }
              return (
                <li key={a._id} className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-800">{a.labourId?.fullName || 'Worker'}</span>
                  <span className="text-slate-400">{a.labourId?.phone}</span>
                  <span className="text-[10px] text-slate-400">· sent {formatDateTime(a.offeredAt || a.createdAt)}</span>
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${badge.className}`}>
                    {badge.label}
                  </span>
                  {a.status === 'offered' && canAssign ? (
                    <button
                      type="button"
                      onClick={() => onWithdraw(a._id)}
                      title="Withdraw offer"
                      className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {canAccept ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-50 p-2 text-[11px] font-bold text-slate-600">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> Add time:
          </span>
          {[60, 120, 300].map((s) => (
            <button
              key={s}
              type="button"
              disabled={extending}
              onClick={() => onExtend(s)}
              className="rounded-lg bg-white px-2 py-1 ring-1 ring-slate-200 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              +{s / 60} min
            </button>
          ))}
          <input
            type="number"
            min="1"
            max="30"
            value={customMinutes}
            onChange={(e) => setCustomMinutes(e.target.value)}
            placeholder="min"
            className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] outline-none focus:border-slate-400"
          />
          <button
            type="button"
            disabled={extending || !(Number(customMinutes) > 0)}
            onClick={() => {
              onExtend(Math.round(Number(customMinutes) * 60))
              setCustomMinutes('')
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2 py-1 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {extending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Add
          </button>
        </div>
      ) : null}

      {canAccept ? (
        <button
          type="button"
          onClick={onAccept}
          disabled={accepting}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleCheck className="h-4 w-4" />}
          {accepting ? 'Accepting…' : 'Accept booking'}
        </button>
      ) : null}

      {canAssign ? (
        <button
          type="button"
          onClick={onAssign}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-black text-white hover:bg-slate-800"
        >
          <UserPlus className="h-4 w-4" />
          {ringing.length ? 'Assign another worker' : assignments.length ? 'Re-assign worker' : 'Assign worker'}
        </button>
      ) : null}
    </GlassPanel>
  )
}

const RADIUS_OPTIONS = [2, 5, 10, 15, 25, 50]

function isEligibleForBulk(w) {
  return !w.hasActiveJob && ['verified', 'approved'].includes(w.kycStatus)
}

function AssignWorkerModal({ request, onClose }) {
  const bookingCategoryId = request.lines?.[0]?.categoryId?._id ?? request.lines?.[0]?.categoryId ?? ''
  const [categoryFilter, setCategoryFilter] = useState(bookingCategoryId ? String(bookingCategoryId) : 'all')
  const [radiusKm, setRadiusKm] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selected, setSelected] = useState([])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading, isFetching } = useGetIndividualBookingWorkersQuery({
    id: request._id,
    categoryId: categoryFilter || 'all',
    ...(radiusKm ? { radiusKm } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  })
  const [assign, { isLoading: assigning }] = useAssignIndividualBookingWorkersMutation()

  const workers = useMemo(() => data?.workers ?? [], [data])
  const categories = data?.categories ?? []
  const minWallet = data?.minimumWalletBalance ?? 0
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const bulkIds = useMemo(() => workers.filter(isEligibleForBulk).map((w) => String(w._id)), [workers])
  const allBulkSelected = bulkIds.length > 0 && bulkIds.every((id) => selectedSet.has(id))

  const toggle = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleSelectAll = () => {
    if (allBulkSelected) {
      const bulkSet = new Set(bulkIds)
      setSelected((prev) => prev.filter((id) => !bulkSet.has(id)))
    } else {
      setSelected((prev) => [...new Set([...prev, ...bulkIds])])
    }
  }

  const handleAssign = async () => {
    if (!selected.length) return
    try {
      const res = await assign({ id: request._id, labourIds: selected }).unwrap()
      toast.success(res?.message || 'Job offer sent')
      onClose()
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to assign worker')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <h2 className="text-lg font-black text-slate-900">Assign worker</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {request.reference} · {categoryNames(request.lines)} · {request.locationText || 'No location'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-2 border-b border-slate-100 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search worker name or phone"
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-500">
              Skill
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-slate-400"
              >
                <option value="all">All skills</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                    {String(c._id) === String(bookingCategoryId) ? ' (booking skill)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-500">
              Distance from booking
              <select
                value={radiusKm}
                onChange={(e) => setRadiusKm(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-slate-400"
              >
                <option value="">Any distance</option>
                {RADIUS_OPTIONS.map((km) => (
                  <option key={km} value={km}>
                    Within {km} km
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500">
              {workers.length} worker{workers.length === 1 ? '' : 's'} found · {bulkIds.length} ready (KYC verified, not busy)
            </span>
            <button
              type="button"
              disabled={!bulkIds.length}
              onClick={toggleSelectAll}
              className="rounded-lg px-2.5 py-1 text-xs font-black text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {allBulkSelected ? 'Clear selection' : `Select all ready (${bulkIds.length})`}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : workers.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No workers found. Try “All skills” or a bigger distance.</p>
          ) : (
            <ul className={`space-y-2 ${isFetching ? 'opacity-60' : ''}`}>
              {workers.map((w) => {
                const id = String(w._id)
                const isSelected = selectedSet.has(id)
                const kycOk = ['verified', 'approved'].includes(w.kycStatus)
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => toggle(id)}
                      className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left ring-1 transition ${
                        isSelected ? 'bg-slate-900/5 ring-slate-900' : 'ring-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input type="checkbox" readOnly checked={isSelected} className="mt-1" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{w.fullName || 'Worker'}</span>
                          <span className="text-xs text-slate-400">{w.phone}</span>
                          {w.skillMatch ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                              Skill match
                            </span>
                          ) : null}
                          {w.offerStatus === 'offered' ? (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200">
                              Ringing — select to ring again
                            </span>
                          ) : w.offerStatus === 'declined' ? (
                            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-rose-200">
                              Declined earlier
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {w.distanceKm != null ? `${w.distanceKm} km` : 'distance n/a'}
                            {w.withinRadius === false ? <span className="text-amber-600">(outside {w.workRadius} km radius)</span> : null}
                          </span>
                          <span className={`inline-flex items-center gap-1 ${w.walletOk ? '' : 'text-rose-600'}`}>
                            <Wallet className="h-3 w-3" />₹{Number(w.walletBalance || 0).toLocaleString('en-IN')}
                            {w.isWalletFrozen ? ' (frozen)' : !w.walletOk ? ` (min ₹${minWallet})` : ''}
                          </span>
                          <span className={`inline-flex items-center gap-1 ${kycOk ? '' : 'text-rose-600'}`}>
                            <ShieldAlert className="h-3 w-3" /> KYC {w.kycStatus}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {w.availabilityStatus}
                          </span>
                          {w.hasActiveJob ? <span className="font-bold text-rose-600">Busy on another job</span> : null}
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-slate-500">
            Selected workers get the job ring. The first one to accept (with enough wallet balance) gets the job.
          </p>
          <button
            type="button"
            disabled={!selected.length || assigning}
            onClick={handleAssign}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
            Send ring{selected.length ? ` (${selected.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
