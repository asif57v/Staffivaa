import { useState } from 'react'
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  UserCheck,
  Search,
  XCircle,
  MapPin,
  Navigation,
  IndianRupee,
  Calendar,
  Layers,
  Phone,
  User,
  Building2,
  CreditCard
} from 'lucide-react'
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

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return 'N/A'
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const renderPaymentStatusBadge = (status) => {
    const isPaid = status === 'paid'
    const isFailed = status === 'failed'
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          isPaid
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : isFailed
            ? 'bg-rose-50 text-rose-700 border-rose-200'
            : 'bg-amber-50 text-amber-700 border-amber-200'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : isFailed ? 'bg-rose-500' : 'bg-amber-500'}`} />
        {isPaid ? 'Paid' : isFailed ? 'Failed' : 'Pending'}
      </span>
    )
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Booking Status & Allocations</h1>
          <p className="mt-1 text-sm text-slate-500">
            Read-only monitoring of live customer bookings, distance (KM), exact timestamps, fee payment breakdown, and site locations.
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
            const isCorporate = r.sourceType === 'corporate'

            return (
              <GlassPanel key={r._id} className="p-5 space-y-4 border border-slate-200/80 shadow-xs">
                {/* Header Row */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-black text-slate-900 tracking-tight">{r.reference || r._id}</span>
                      
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${badge.bg}`}>
                        <StatusIcon className="h-3 w-3" />
                        {badge.label}
                      </span>

                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                        isCorporate ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-sky-50 text-sky-700 border-sky-200'
                      }`}>
                        {isCorporate ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
                        {isCorporate ? 'Corporate' : 'Individual'}
                      </span>

                      {/* Created Date & Time Badge */}
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                        <Clock className="h-3 w-3 text-slate-500" />
                        {formatDateTime(r.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-slate-500 flex items-center gap-2 flex-wrap">
                      <span>Client: <strong className="text-slate-800">{r.clientId?.fullName || r.clientId?.corporateProfile?.companyName || 'N/A'}</strong></span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-slate-400" />{r.clientId?.phone || 'No phone'}</span>
                    </p>
                  </div>

                  {/* Distance KM Pill */}
                  <div className="flex items-center gap-2">
                    <div className="inline-flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1 rounded-xl text-xs font-extrabold shadow-sm">
                      <Navigation className="h-3.5 w-3.5 text-amber-400" />
                      <span>{r.distanceKm != null ? `${Number(r.distanceKm).toFixed(1)} KM` : 'Distance N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Full Location Address (Untruncated) */}
                <div className="flex items-start gap-2 bg-slate-50 border border-slate-200/60 p-3 rounded-xl">
                  <MapPin className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                      Full Site Location Address
                    </span>
                    <p className="text-xs font-semibold text-slate-800 leading-relaxed whitespace-normal break-words">
                      {r.locationText || 'Location not specified'}
                    </p>
                  </div>
                </div>

                {/* Requested Categories (if any) */}
                {r.lines && r.lines.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Layers className="h-3 w-3 text-slate-500" /> Requested Workers:
                    </span>
                    {r.lines.map((line, idx) => (
                      <span key={idx} className="bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded-lg text-xs font-bold border border-slate-200">
                        {line.categoryId?.name || 'Worker'} × {line.quantity}
                      </span>
                    ))}
                  </div>
                )}

                {/* Main Details Grid: Worker, Schedule, Payment & Fee Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Column 1: Assigned Worker */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-1.5 text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Assigned Worker</span>
                    <p className="font-bold text-slate-800">
                      {r.labourName ? `${r.labourName}` : 'No worker assigned yet'}
                    </p>
                    {r.labourPhone && (
                      <p className="text-slate-500 font-medium flex items-center gap-1">
                        <Phone className="h-3 w-3 text-slate-400" /> {r.labourPhone}
                      </p>
                    )}
                    {r.acceptedAt && (
                      <p className="text-[10.5px] text-emerald-700 font-medium flex items-center gap-1 pt-1 border-t border-slate-200/60">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Accepted: {formatDateTime(r.acceptedAt)}
                      </p>
                    )}
                  </div>

                  {/* Column 2: Date & Shift Time */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-1.5 text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Date & Shift Time</span>
                    <p className="font-semibold text-slate-800 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-500" />
                      {r.startDate ? new Date(r.startDate).toLocaleDateString() : 'N/A'}
                    </p>
                    <p className="text-slate-600 font-medium flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-amber-500" />
                      Shift: <strong className="text-slate-800">{r.shiftStart || 'Full Day'}</strong>
                    </p>
                    <p className="text-[10.5px] text-slate-500 font-medium pt-1 border-t border-slate-200/60">
                      Booked On: <strong className="text-slate-700">{formatDateTime(r.createdAt)}</strong>
                    </p>
                  </div>

                  {/* Column 3: Platform Fee & Payment Breakdown */}
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-indigo-100/80 pb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1">
                        <IndianRupee className="h-3 w-3 text-indigo-600" /> Fee & Payment Details
                      </span>
                      {r.razorpayPaymentId && (
                        <span className="text-[9px] font-mono text-indigo-700 bg-white px-1.5 py-0.5 rounded border border-indigo-200">
                          {r.razorpayPaymentId}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 text-[11px]">User Fee (₹{r.userPlatformFee ?? 49}):</span>
                        {renderPaymentStatusBadge(r.userPaymentStatus || r.paymentStatus)}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 text-[11px]">Labour Fee (₹{r.labourPlatformFee ?? r.vendorPlatformFeeAmount ?? 49}):</span>
                        {renderPaymentStatusBadge(r.labourPaymentStatus || r.vendorPlatformFeeStatus)}
                      </div>

                      {r.labourCharge != null && (
                        <div className="flex items-center justify-between pt-1 border-t border-indigo-100">
                          <span className="text-slate-700 font-bold text-[11px]">Labour Charge:</span>
                          <span className="font-extrabold text-emerald-700">₹{r.labourCharge}</span>
                        </div>
                      )}
                    </div>
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
