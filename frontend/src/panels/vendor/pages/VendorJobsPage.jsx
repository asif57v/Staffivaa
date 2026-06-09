import { Link } from 'react-router-dom'
import { ChevronRight, ClipboardList } from 'lucide-react'
import { AppEmptyState } from '../../../components/app/AppEmptyState.jsx'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { useAcceptVendorJobMutation, useGetVendorJobsQuery } from '../../../store/api/workforceApi.js'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function VendorJobsPage() {
  const { data, isLoading, isError } = useGetVendorJobsQuery()
  const [acceptJob, { isLoading: accepting }] = useAcceptVendorJobMutation()
  const allocations = data?.allocations ?? []

  const handleAccept = async (e, id) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await acceptJob(id).unwrap()
    } catch {
      /* toast later */
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Supply</p>
        <h2 className="text-lg font-extrabold text-slate-900">Jobs</h2>
      </div>

      {isLoading ? (
        <AppSurface>
          <p className="text-sm text-slate-500">Loading jobs…</p>
        </AppSurface>
      ) : null}

      {isError ? (
        <AppSurface className="border-rose-200/90 bg-rose-50/40">
          <p className="text-sm font-semibold text-rose-800">Could not load jobs.</p>
        </AppSurface>
      ) : null}

      {!isLoading && !isError && allocations.length === 0 ? (
        <AppEmptyState
          icon={ClipboardList}
          title="No supply jobs"
          subtitle="Admin allocations assigned to you will appear here."
        />
      ) : null}

      <ul className="space-y-2">
        {allocations.map((a) => {
          const req = a.requestId
          const pending = !a.vendorAcceptedAt
          return (
            <li key={a._id}>
              <Link to={`/vendor/jobs/${a._id}`}>
                <AppSurface className="space-y-3 transition hover:border-brand/30">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{req?.reference || 'Allocation'}</p>
                      <p className="text-xs text-slate-500">
                        {req?.locationText || 'Site TBD'} · {formatDate(req?.startDate)}
                      </p>
                      <p className="mt-1 text-[10px] font-bold uppercase text-slate-400">{req?.status}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                  </div>
                  {pending ? (
                    <AppPrimaryButton
                      type="button"
                      className="w-full"
                      loading={accepting}
                      onClick={(e) => handleAccept(e, a._id)}
                    >
                      Accept job
                    </AppPrimaryButton>
                  ) : (
                    <p className="text-xs font-bold text-emerald-700">Accepted</p>
                  )}
                </AppSurface>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
