import { useEffect, useMemo, useState } from 'react'
import {
  BellRing,
  Calendar,
  CheckCircle2,
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
} from 'lucide-react'
import toast from 'react-hot-toast'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { useSocket } from '../../hooks/useSocket.js'
import {
  useGetAdminIndividualBookingsQuery,
  useGetIndividualBookingWorkersQuery,
  useAssignIndividualBookingWorkersMutation,
  useWithdrawIndividualBookingOfferMutation,
} from '../../store/api/workforceApi.js'

const TABS = [
  { value: 'awaiting', label: 'Awaiting Assignment' },
  { value: 'active', label: 'Worker Assigned' },
  { value: 'completed', label: 'Completed' },
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
  searching: 'Awaiting worker',
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

function categoryNames(lines) {
  if (!Array.isArray(lines)) return '—'
  return lines.map((l) => `${l.categoryId?.name || 'Worker'}${l.quantity > 1 ? ` ×${l.quantity}` : ''}`).join(', ') || '—'
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
    socket.on('individual_booking_pending', onPending)
    socket.on('individual_booking_updated', onUpdate)
    socket.on('request_cancelled', onUpdate)
    return () => {
      socket.off('individual_booking_pending', onPending)
      socket.off('individual_booking_updated', onUpdate)
      socket.off('request_cancelled', onUpdate)
    }
  }, [socket, refetch])

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
            Customer bookings wait here until you assign a worker. The worker gets the normal job ring and accepts as usual
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
            {tab === 'awaiting' ? 'No bookings waiting for assignment.' : 'No bookings here.'}
          </p>
        </GlassPanel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {requests.map((r) => (
            <BookingCard
              key={r._id}
              request={r}
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

function BookingCard({ request, onAssign, onWithdraw }) {
  const client = request.clientId || {}
  const assignments = request.assignments || []
  const canAssign = request.status === 'searching' && !request.labourId
  const ringing = assignments.filter((a) => a.status === 'offered')

  return (
    <GlassPanel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-black text-slate-500">{request.reference}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ring-1 ${
                request.status === 'searching'
                  ? 'bg-rose-50 text-rose-700 ring-rose-200'
                  : request.status === 'cancelled'
                    ? 'bg-slate-100 text-slate-500 ring-slate-200'
                    : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
              }`}
            >
              {STATUS_LABEL[request.status] || request.status}
            </span>
          </div>
          <p className="mt-1.5 text-base font-black text-slate-900">{categoryNames(request.lines)}</p>
        </div>
        <span className="shrink-0 text-[11px] font-semibold text-slate-400">{timeAgo(request.createdAt)}</span>
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
        <p className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          Start {formatDateTime(request.startDate)}
          {request.shiftStart ? ` · ${request.shiftStart}${request.shiftEnd ? `–${request.shiftEnd}` : ''}` : ''}
        </p>
        {request.notes ? <p className="rounded-lg bg-slate-50 p-2 text-[11px] italic text-slate-500">“{request.notes}”</p> : null}
      </div>

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

function AssignWorkerModal({ request, onClose }) {
  const [showAll, setShowAll] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selected, setSelected] = useState([])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading, isFetching } = useGetIndividualBookingWorkersQuery({
    id: request._id,
    ...(showAll ? { all: 'true' } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  })
  const [assign, { isLoading: assigning }] = useAssignIndividualBookingWorkersMutation()

  const workers = data?.workers ?? []
  const minWallet = data?.minimumWalletBalance ?? 0
  const selectedSet = useMemo(() => new Set(selected), [selected])

  const toggle = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
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

        <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search worker name or phone"
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-600">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            Show all workers (any skill)
          </label>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : workers.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No workers found. Try “Show all workers”.</p>
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
