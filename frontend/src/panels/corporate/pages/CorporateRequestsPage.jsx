import { Link } from 'react-router-dom'
import { ChevronRight, ClipboardList, Plus, MapPin, Calendar, Users, CheckCircle2, UserCircle, Clock, Construction, AlertCircle, XCircle } from 'lucide-react'
import { AppEmptyState } from '../../../components/app/AppEmptyState.jsx'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { useGetMyRequestsQuery } from '../../../store/api/workforceApi.js'
import { useAuth } from '../../../hooks/useAuth.js'
import { useEffect } from 'react'
import { useSocket } from '../../../hooks/useSocket.js'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function CorporateRequestsPage() {
  const { data, isLoading, isError, refetch } = useGetMyRequestsQuery()
  const { user } = useAuth()

  const socket = useSocket()

  useEffect(() => {
    if (socket) {
      const handleUpdate = () => refetch()
      socket.on('vendor_accepted_request', handleUpdate)
      socket.on('vendor_declined_request', handleUpdate)
      socket.on('vendor_accepted_job', handleUpdate)
      socket.on('vendor_assigned_workforce', handleUpdate)
      socket.on('work_progress_update', handleUpdate)
      socket.on('work_completed', handleUpdate)
      socket.on('request_status_update', handleUpdate)
      
      return () => {
        socket.off('vendor_accepted_request', handleUpdate)
        socket.off('vendor_declined_request', handleUpdate)
        socket.off('vendor_accepted_job', handleUpdate)
        socket.off('vendor_assigned_workforce', handleUpdate)
        socket.off('work_progress_update', handleUpdate)
        socket.off('work_completed', handleUpdate)
        socket.off('request_status_update', handleUpdate)
      }
    }
  }, [socket, refetch])

  const requests = data?.requests ?? []

  const companyName = user?.corporateProfile?.companyName || user?.fullName || 'Appzeto'

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
        {requests.map((r, i) => {
          const projectName = r.projectId?.name || 'Maiyur'
          const workersCount = r.lines?.reduce((sum, l) => sum + (l.quantity || 1), 0) || 3
          const tradeName = r.lines?.[0]?.categoryId?.name || 'Mason (Raj Mistri)'
          const shiftStr = (r.shiftStart && r.shiftEnd) ? `${r.shiftStart} - ${r.shiftEnd}` : '08:00 - 18:00'
          const reference = r.reference || 'CR-MQ8OUOON'
          
          let statusLabel = 'Pending'
          let statusTone = 'bg-orange-50 text-orange-700'
          let StatusIcon = AlertCircle
          
          if (r.status === 'accepted' || r.status === 'allocated' || r.status === 'assigned') {
            statusLabel = 'Accepted'
            statusTone = 'bg-emerald-50 text-emerald-700'
            StatusIcon = CheckCircle2
          } else if (r.status === 'completed') {
            statusLabel = 'Completed'
            statusTone = 'bg-emerald-50 text-emerald-700'
            StatusIcon = CheckCircle2
          } else if (r.status === 'cancelled' || r.status === 'rejected') {
            statusLabel = r.status.charAt(0).toUpperCase() + r.status.slice(1)
            statusTone = 'bg-rose-50 text-rose-700'
            StatusIcon = XCircle
          } else if (i % 3 === 1) { // mock variations
             statusLabel = 'In Progress'
             statusTone = 'bg-blue-50 text-blue-700'
             StatusIcon = Construction
          }
          
          // Generate mock thumbnails
          const imgUrls = [
            'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=300&q=80',
            'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=300&q=80',
            'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=300&q=80',
            'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=300&q=80'
          ]
          const imgSrc = imgUrls[i % imgUrls.length]

          return (
            <li key={r._id}>
              <Link to={`/corporate/requests/${r._id}`} className="block transition active:scale-[0.98]">
                <div className="flex flex-row rounded-2xl bg-white p-3 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] border border-slate-100 hover:shadow-lg transition-shadow">
                  {/* Thumbnail */}
                  <div className="relative h-[90px] w-[90px] shrink-0 overflow-hidden rounded-xl bg-slate-200 mr-3 shadow-sm border border-slate-100/50">
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/10 to-transparent z-10" />
                    <img src={imgSrc} alt="Site" className="h-full w-full object-cover" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 truncate pr-2">
                          <h3 className="text-[15px] font-bold text-slate-900 truncate">{projectName}</h3>
                          <span className="text-slate-300 text-sm">|</span>
                          <span className="text-[13px] font-medium text-slate-500 truncate">{companyName}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                      </div>
                      
                      <div className="mt-1 flex items-center gap-2.5 text-slate-500 flex-wrap">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <p className="text-[11px] font-medium truncate max-w-[90px]">{r.locationText || 'Khand'}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 shrink-0" />
                          <p className="text-[11px] font-medium">{formatDate(r.startDate)} <span className="mx-1">•</span> <Users className="inline h-3 w-3 mr-1 mb-[1px]" />{workersCount} Workers</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Badges & ID */}
                    <div className="mt-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone}`}>
                          <StatusIcon className="h-2.5 w-2.5" strokeWidth={3} /> {statusLabel}
                        </span>
                        <span className="flex items-center gap-1 rounded-full bg-transparent px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                          <UserCircle className="h-2.5 w-2.5" strokeWidth={2.5} /> {tradeName}
                        </span>
                        <span className="flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200">
                          <Clock className="h-2.5 w-2.5" /> {shiftStr}
                        </span>
                      </div>
                      <p className="text-[9px] font-bold text-slate-400 mt-2 tracking-wider uppercase text-right w-full">
                        ID: {reference}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
