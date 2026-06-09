import { FileText, CheckCircle } from 'lucide-react'
import { AppEmptyState } from '../../../components/app/AppEmptyState.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { useGetVendorMarketplaceRequestsQuery, useAcceptMarketplaceRequestMutation } from '../../../store/api/workforceApi.js'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function VendorRequestsPage() {
  const { data, isLoading, isError } = useGetVendorMarketplaceRequestsQuery(undefined, {
    pollingInterval: 30000, // Refresh every 30s for real-time feel
  })
  const [acceptRequest, { isLoading: isAccepting }] = useAcceptMarketplaceRequestMutation()
  
  const requests = data?.requests ?? []

  return (
    <div className="space-y-4 pb-10">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Marketplace</p>
        <h2 className="text-lg font-extrabold text-slate-900">Corporate Requests</h2>
        <p className="mt-1 text-xs text-slate-500">Live feed of corporate workforce needs.</p>
      </div>

      {isLoading ? (
        <AppSurface>
          <p className="text-sm text-slate-500">Loading requests…</p>
        </AppSurface>
      ) : null}

      {isError ? (
        <AppSurface className="border-rose-200/90 bg-rose-50/40">
          <p className="text-sm font-semibold text-rose-800">Could not load marketplace requests.</p>
        </AppSurface>
      ) : null}

      {!isLoading && !isError && requests.length === 0 ? (
        <AppEmptyState
          icon={FileText}
          title="No open requests"
          subtitle="Currently there are no open corporate requests."
        />
      ) : null}

      <ul className="space-y-3 mt-4">
        {requests.map((req) => {
          let totalLabour = 0
          req.lines?.forEach(l => totalLabour += (l.quantity || 1))
          
          return (
            <li key={req._id}>
              <AppSurface className="space-y-3 border-brand/20 shadow-sm transition hover:border-brand/40 hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-extrabold text-slate-900">{req.clientId?.corporateProfile?.companyName || req.clientId?.fullName || 'Corporate Client'}</p>
                      <span className="rounded-md bg-brand/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-brand">
                        {req.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-700">
                      {req.locationText || 'Location TBD'}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500 font-semibold capitalize">
                      {req.scheduleType || 'Daily'} Schedule
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Start: {formatDate(req.startDate)} {req.endDate ? ` — End: ${formatDate(req.endDate)}` : ''}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Requirements</p>
                  <div className="space-y-1.5">
                    {req.lines?.map((line, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">
                          {line.categoryId?.name || 'Worker'}
                        </span>
                        <span className="text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded shadow-sm border border-slate-200">
                          x {line.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                  {req.notes && (
                    <p className="mt-3 text-xs italic text-slate-600 border-l-2 border-brand/20 pl-2 bg-white p-2 rounded-lg shadow-sm">"{req.notes}"</p>
                  )}
                </div>

                <div className="pt-2">
                  <AppPrimaryButton
                    className="w-full flex items-center justify-center gap-2"
                    loading={isAccepting}
                    onClick={() => acceptRequest(req._id)}
                  >
                    <CheckCircle className="h-4 w-4" />
                    Accept job
                  </AppPrimaryButton>
                </div>
              </AppSurface>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
