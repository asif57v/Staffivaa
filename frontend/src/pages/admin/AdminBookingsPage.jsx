import { useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { PipelineTimeline } from '../../components/shared/PipelineTimeline.jsx'
import {
  useGetAdminRequestsQuery,
  usePatchRequestStatusMutation,
} from '../../store/api/workforceApi.js'

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending_review', label: 'Pending review' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'allocating', label: 'Allocating' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const QUICK_ACTIONS = [
  { status: 'confirmed', label: 'Confirm' },
  { status: 'allocating', label: 'Allocate' },
  { status: 'cancelled', label: 'Cancel' },
]

export function AdminBookingsPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const { data, isLoading, isError } = useGetAdminRequestsQuery(
    statusFilter ? { status: statusFilter } : undefined,
  )
  const [patchStatus, { isLoading: patching }] = usePatchRequestStatusMutation()
  const requests = data?.requests ?? []

  const handleStatus = async (id, status) => {
    try {
      await patchStatus({ id, status }).unwrap()
    } catch {
      /* handle later */
    }
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Bookings & requests</h1>
        <p className="mt-2 text-sm text-slate-600">
          Individual and corporate workforce requests — FCFS queue with manual review.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value || 'all'}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition ${
              statusFilter === f.value
                ? 'bg-brand text-white ring-brand'
                : 'bg-white text-slate-600 ring-slate-200 hover:ring-brand/30'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <GlassPanel className="p-6">
          <p className="text-sm text-slate-500">Loading requests…</p>
        </GlassPanel>
      ) : null}

      {isError ? (
        <GlassPanel className="border-rose-200 p-6">
          <p className="text-sm font-semibold text-rose-800">Failed to load requests.</p>
        </GlassPanel>
      ) : null}

      {!isLoading && !isError && requests.length === 0 ? (
        <GlassPanel className="p-8 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-slate-700">No requests in this filter.</p>
        </GlassPanel>
      ) : null}

      <ul className="space-y-4">
        {requests.map((r) => (
          <li key={r._id}>
            <GlassPanel className="space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">{r.reference}</p>
                  <p className="text-xs text-slate-500">
                    {r.sourceType} ·{' '}
                    {r.clientId?.corporateProfile?.companyName || r.clientId?.fullName || 'Client'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {r.locationText || 'No location'} · {(r.lines?.length ?? 0)} line(s)
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_ACTIONS.map((a) => (
                    <button
                      key={a.status}
                      type="button"
                      disabled={patching || r.status === a.status}
                      onClick={() => handleStatus(r._id, a.status)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:border-brand/30 disabled:opacity-50"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
              <PipelineTimeline status={r.status} title="Request pipeline" />
              {r.status === 'payment_pending' && (
                <div className="mt-3 p-3 bg-amber-50/50 rounded-xl border border-amber-200/60 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-amber-800">⚠️ Advance Payment Pending</p>
                    <p className="text-[10px] text-amber-600 font-bold">Extend deadline to allow workers to check in temporarily.</p>
                  </div>
                  <div className="flex gap-1.5">
                    {[24, 48, 72].map((hours) => (
                      <button
                        key={hours}
                        type="button"
                        onClick={async () => {
                          const newDeadline = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
                          try {
                            await patchStatus({
                              id: r._id,
                              status: 'assigned',
                              paymentDeadlineExtendedAt: newDeadline
                            }).unwrap()
                          } catch (err) {
                            alert('Failed to extend deadline')
                          }
                        }}
                        className="bg-white hover:bg-amber-100 border border-amber-200 text-amber-800 text-[10px] font-bold px-2 py-1 rounded-lg transition"
                      >
                        +{hours}h
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </GlassPanel>
          </li>
        ))}
      </ul>
    </div>
  )
}
