import { FileText, CheckCircle, XCircle } from 'lucide-react'
import { AppEmptyState } from '../../../components/app/AppEmptyState.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { useGetVendorMarketplaceRequestsQuery, useAcceptMarketplaceRequestMutation, useDeclineMarketplaceRequestMutation } from '../../../store/api/workforceApi.js'
import { markVendorRequestsViewed } from '../../../hooks/useVendorNotificationCount.js'
import { useEffect } from 'react'
import { useSocket } from '../../../hooks/useSocket.js'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function VendorRequestsPage() {
  useEffect(() => {
    markVendorRequestsViewed()
  }, [])
  const { data: marketplaceData, isLoading: loadingMarketplace, refetch } = useGetVendorMarketplaceRequestsQuery(undefined)
  const [acceptRequest, { isLoading: isAccepting }] = useAcceptMarketplaceRequestMutation()
  const [declineRequest, { isLoading: isDeclining }] = useDeclineMarketplaceRequestMutation()

  const socket = useSocket()

  useEffect(() => {
    if (socket) {
      const handleUpdate = () => refetch()
      socket.on('corporate_request_created', handleUpdate)
      socket.on('vendor_accepted_request_global', handleUpdate)
      socket.on('request_status_update', handleUpdate)
      
      return () => {
        socket.off('corporate_request_created', handleUpdate)
        socket.off('vendor_accepted_request_global', handleUpdate)
        socket.off('request_status_update', handleUpdate)
      }
    }
  }, [socket, refetch])
  
  const requests = marketplaceData?.requests ?? []

  return (
    <div className="space-y-4 pb-10">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Marketplace</p>
        <h2 className="text-lg font-extrabold text-slate-900">Corporate Requests</h2>
        <p className="mt-1 text-xs text-slate-500">Live feed of corporate workforce needs.</p>
      </div>

      {loadingMarketplace ? (
        <AppSurface>
          <p className="text-sm text-slate-500">Loading requests…</p>
        </AppSurface>
      ) : null}

      {!loadingMarketplace && requests.length === 0 ? (
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

                <div className="pt-2 flex gap-2">
                  <button
                    disabled={isDeclining || isAccepting}
                    onClick={() => declineRequest(req._id)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Decline
                  </button>
                  <AppPrimaryButton
                    className="flex-1 flex items-center justify-center gap-2"
                    loading={isAccepting}
                    disabled={isDeclining}
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
