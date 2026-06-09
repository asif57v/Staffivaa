import { Link } from 'react-router-dom'
import { ChevronRight, ClipboardList, Plus } from 'lucide-react'
import { AppEmptyState } from '../../../components/app/AppEmptyState.jsx'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { PipelineTimeline } from '../../../components/shared/PipelineTimeline.jsx'
import { useGetMyRequestsQuery } from '../../../store/api/workforceApi.js'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function CorporateRequestsPage() {
  const { data, isLoading, isError } = useGetMyRequestsQuery()
  const requests = data?.requests ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Workforce</p>
          <h2 className="text-lg font-extrabold text-slate-900">Requests</h2>
        </div>
        <Link to="/corporate/requests/new">
          <AppPrimaryButton type="button">
            <Plus className="mr-1.5 h-4 w-4" />
            New
          </AppPrimaryButton>
        </Link>
      </div>

      {isLoading ? (
        <AppSurface>
          <p className="text-sm text-slate-500">Loading requests…</p>
        </AppSurface>
      ) : null}

      {isError ? (
        <AppSurface className="border-rose-200/90 bg-rose-50/40">
          <p className="text-sm font-semibold text-rose-800">Could not load requests.</p>
        </AppSurface>
      ) : null}

      {!isLoading && !isError && requests.length === 0 ? (
        <AppEmptyState
          icon={ClipboardList}
          title="No workforce requests"
          subtitle="Submit a bulk request with skill lines, schedule, and dates."
        />
      ) : null}

      <ul className="space-y-3">
        {requests.map((r) => (
          <li key={r._id}>
            <Link to={`/corporate/requests/${r._id}`}>
              <AppSurface className="space-y-3 transition hover:border-brand/30">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{r.reference || 'Request'}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(r.startDate)}
                      {r.endDate ? ` – ${formatDate(r.endDate)}` : ''} · {(r.lines?.length ?? 0)} skill line(s)
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                </div>
                <PipelineTimeline status={r.status} title="Pipeline" />
              </AppSurface>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
