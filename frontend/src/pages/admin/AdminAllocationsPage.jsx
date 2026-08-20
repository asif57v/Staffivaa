import { useState } from 'react'
import { ClipboardList, CheckCircle2, Clock, UserCheck, Search, ShieldAlert, AlertCircle, XCircle } from 'lucide-react'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { useGetAdminRequestsQuery } from '../../store/api/workforceApi.js'

const STATUS_BADGES = {
  searching: { label: 'Searching Worker', bg: 'bg-amber-50 text-amber-800 border-amber-200', icon: Search },
  allocating: { label: 'Allocating', bg: 'bg-amber-50 text-amber-800 border-amber-200', icon: Clock },
  assigned: { label: 'Worker Assigned', bg: 'bg-blue-50 text-blue-800 border-blue-200', icon: UserCheck },
  confirmed: { label: 'Confirmed', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  platform_fee_pending: { label: 'Fee Pending', bg: 'bg-violet-50 text-violet-800 border-violet-200', icon: Clock },
  in_progress: { label: 'In Progress', bg: 'bg-sky-50 text-sky-800 border-sky-200', icon: Clock },
  completed: { label: 'Completed', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', bg: 'bg-rose-50 text-rose-800 border-rose-200', icon: XCircle },
}

export function AdminAllocationsPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const { data, isLoading, isError, refetch } = useGetAdminRequestsQuery(
    statusFilter ? { status: statusFilter } : undefined
  )
  const requests = data?.requests ?? []

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Booking Status & Allocations</h1>
          <p className="mt-1 text-sm text-slate-500">
            Read-only monitoring of live customer bookings, auto-allocations, and worker statuses.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Refresh Statuses
        </button>
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { value: '', label: 'All Bookings' },
          { value: 'searching', label: 'Searching' },
          { value: 'assigned', label: 'Assigned' },
          { value: 'confirmed', label: 'Confirmed' },
          { value: 'completed', label: 'Completed' },
          { value: 'cancelled', label: 'Cancelled' },
        ].map((f) => (
          <button
            key={f.value || 'all'}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition border ${
              statusFilter === f.value
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <GlassPanel className="p-8 text-center text-sm font-medium text-slate-500">
          Loading booking statuses...
        </GlassPanel>
      ) : null}

      {isError ? (
        <GlassPanel className="border-rose-200 p-6 text-center text-sm font-semibold text-rose-800">
          Failed to load booking statuses.
        </GlassPanel>
      ) : null}

      {!isLoading && !isError && requests.length === 0 ? (
        <GlassPanel className="p-12 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-slate-700">No bookings match the selected status filter.</p>
        </GlassPanel>
      ) : null}

      {!isLoading && !isError && requests.length > 0 ? (
        <div className="grid gap-4">
          {requests.map((r) => {
            const badge = STATUS_BADGES[r.status] || {
              label: r.status || 'Unknown',
              bg: 'bg-slate-100 text-slate-700 border-slate-200',
              icon: Clock,
            }
            const StatusIcon = badge.icon

            return (
              <GlassPanel key={r._id} className="p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-slate-900">{r.reference || r._id}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${badge.bg}`}>
                        <StatusIcon className="h-3 w-3" />
                        {badge.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      Client: <strong className="text-slate-700">{r.clientId?.fullName || r.clientId?.corporateProfile?.companyName || 'N/A'}</strong> ({r.clientId?.phone || 'No phone'})
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-500">Location</span>
                    <p className="text-xs font-semibold text-slate-800 max-w-xs truncate">
                      {r.locationText || 'Location not specified'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned Worker</span>
                    <p className="mt-0.5 font-bold text-slate-800">
                      {r.labourName ? `${r.labourName} (${r.labourPhone || 'No Phone'})` : 'No worker assigned yet'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date & Shift</span>
                    <p className="mt-0.5 font-semibold text-slate-800">
                      {r.startDate ? new Date(r.startDate).toLocaleDateString() : 'N/A'} · {r.shiftStart || 'Full Day'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Payment Status</span>
                    <p className="mt-0.5 font-semibold text-slate-800">
                      User: <span className="capitalize">{r.userPaymentStatus || r.paymentStatus || 'pending'}</span> · Labour Fee: <span className="capitalize">{r.labourPaymentStatus || 'pending'}</span>
                    </p>
                  </div>
                </div>
              </GlassPanel>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
