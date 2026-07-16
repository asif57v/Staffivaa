import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, IndianRupee, Users, ChevronRight, FileText, CheckCircle, Menu, MapPin, ChevronDown, Bell, Calendar, Hammer } from 'lucide-react'
import { readAppUserLocation } from '../../../lib/appUserLocationStorage.js'
import { ApprovalGate } from '../../../components/shared/ApprovalGate.jsx'
import { OpsStatCard } from '../../../components/shared/OpsStatCard.jsx'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { useAuth } from '../../../hooks/useAuth.js'
import { 
  useGetVendorDashboardQuery,
  useGetVendorCrewQuery,
  useGetVendorJobsQuery,
  useGetVendorMarketplaceRequestsQuery,
  useAcceptMarketplaceRequestMutation,
  useAcceptVendorJobMutation
} from '../../../store/api/workforceApi.js'
import { getSocket } from '../../../services/socket.js'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function VendorDashboardPage() {
  const { user } = useAuth()
  const [appLocation, setAppLocation] = useState(() => readAppUserLocation())
  const approved = user?.contractorProfile?.verificationStatus === 'approved'
  const { data: dashboardData, isLoading, refetch: refetchDashboard } = useGetVendorDashboardQuery(undefined, { skip: !approved })

  const { data: crewData } = useGetVendorCrewQuery(undefined, { skip: !approved })
  const crew = crewData?.crew ?? []

  const { data: jobsData, refetch: refetchJobs } = useGetVendorJobsQuery(undefined, { skip: !approved })
  const allocations = jobsData?.allocations ?? []
  const [acceptJob, { isLoading: acceptingJob }] = useAcceptVendorJobMutation()

  const { data: requestsData, refetch: refetchRequests } = useGetVendorMarketplaceRequestsQuery(undefined, {
    skip: !approved,
  })
  const requests = requestsData?.requests ?? []
  const [acceptRequest, { isLoading: isAcceptingRequest }] = useAcceptMarketplaceRequestMutation()

  const handleAcceptJob = async (e, id) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await acceptJob(id).unwrap()
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    const onLoc = () => setAppLocation(readAppUserLocation())
    window.addEventListener('lc-app-user-location-changed', onLoc)

    const socket = getSocket()
    if (socket && approved) {
      const handleUpdate = () => {
        refetchDashboard()
        refetchJobs()
        refetchRequests()
      }

      socket.on('corporate_request_created', handleUpdate)
      socket.on('request_status_update', handleUpdate)
      socket.on('payment_status_update', handleUpdate)
      socket.on('work_progress_update', handleUpdate)
      socket.on('work_completed', handleUpdate)

      return () => {
        window.removeEventListener('lc-app-user-location-changed', onLoc)
        socket.off('corporate_request_created', handleUpdate)
        socket.off('request_status_update', handleUpdate)
        socket.off('payment_status_update', handleUpdate)
        socket.off('work_progress_update', handleUpdate)
        socket.off('work_completed', handleUpdate)
      }
    }

    return () => window.removeEventListener('lc-app-user-location-changed', onLoc)
  }, [approved, refetchDashboard, refetchJobs, refetchRequests])

  const locationLabel = appLocation?.address?.trim() || 'Set your location'

  const openDrawer = () => window.dispatchEvent(new CustomEvent('lc-open-app-drawer'))
  const openLocationModal = () => window.dispatchEvent(new CustomEvent('lc-open-location-modal'))

  if (!approved) {
    return (
      <div className="-mx-4 -mt-4">
        <ApprovalGate
          title="Vendor verification required"
          message="Upload business documents on your profile. Operations will verify your account before jobs and crew linking unlock."
          profileTo="/vendor/profile"
        />
      </div>
    )
  }

  const stats = dashboardData?.stats || {}

  return (
    <div className="space-y-6 bg-[#F8F9FA] min-h-screen pb-6 -mx-4 -mt-4">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-[24px] mx-4 bg-slate-900 pb-8 pt-8 text-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] mt-4">
        {/* Background Image with Dark Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-80"
          style={{ backgroundImage: `url('/vendor-hero-bg.png')` }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-slate-950/60" aria-hidden />

        <div className="relative z-10 px-6 flex justify-between items-center">
            <div className="max-w-[65%]">
              <span className="inline-block rounded-full bg-[#3A3F47]/80 backdrop-blur-md px-2.5 py-1 text-[8px] font-black uppercase tracking-widest text-[#FFC107] mb-3 shadow-sm">
                Supply partner
              </span>
              <h2 className="text-[26px] font-extrabold leading-tight text-white tracking-tight drop-shadow-sm">
                {user?.contractorProfile?.businessName || user?.fullName || 'Mayur Corporate'}
              </h2>
              <p className="mt-2 text-[13px] text-white/80 leading-snug font-medium">
                Accept admin allocations and manage your crew.
              </p>
              <Link to="/vendor/jobs" className="mt-5 inline-block">
                <button type="button" className="rounded-full bg-white px-5 py-2.5 text-[13px] font-bold text-slate-900 shadow-sm transition hover:bg-slate-50 active:scale-95 flex items-center gap-1.5">
                  View supply jobs
                  <ChevronRight className="h-4 w-4" />
                </button>
              </Link>
            </div>

            {/* Vendor Avatar */}
            <div className="shrink-0 pl-2">
              <div className="h-20 w-20 rounded-full border-[2px] border-white/80 bg-slate-200 overflow-hidden shadow-lg ring-4 ring-white/10">
                <img src={user?.profileImageUrl || "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=200&q=80"} alt="Vendor" className="h-full w-full object-cover" />
              </div>
            </div>
          </div>
      </section>

      {/* Stats Grid */}
      <div className="relative z-10 mt-6 px-4 grid grid-cols-3 gap-3">
        {[
          { label: 'CREW', value: isLoading ? '—' : stats.crewCount ?? 0, icon: Users, tone: 'text-indigo-500 bg-indigo-50', sub: 'Linked' },
          { label: 'OPEN', value: isLoading ? '—' : stats.openJobs ?? 0, icon: ClipboardList, tone: 'text-orange-500 bg-orange-50', sub: 'Jobs' },
          { label: 'ACTIVE', value: isLoading ? '—' : stats.activeAssignments ?? 0, icon: Hammer, tone: 'text-emerald-500 bg-emerald-50', sub: 'Deployments' },
        ].map((stat, i) => (
          <div key={i} className="flex flex-col items-center justify-center rounded-2xl bg-white px-2 py-4 shadow-[0_2px_12px_rgb(0,0,0,0.03)] border-transparent">
            <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full ${stat.tone}`}>
              <stat.icon className="h-5 w-5" />
            </span>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-900 text-center">{stat.label}</p>
            <p className="mt-1 text-[22px] font-black text-slate-900">{stat.value}</p>
            <p className="mt-1 text-[11px] font-medium text-slate-500 text-center truncate w-full">{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="px-4 space-y-6">
        {/* Current Requests */}
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-[17px] font-extrabold tracking-tight text-slate-900">Current Requests</h3>
            {requests.length > 2 && (
              <Link to="/vendor/requests" className="text-[13px] font-bold text-[#FFC107] hover:underline">
                View all
              </Link>
            )}
          </div>
          {requests.length === 0 ? (
            <div className="flex items-center gap-4 rounded-[20px] bg-white p-4 shadow-[0_2px_12px_rgb(0,0,0,0.03)] border border-slate-100/50">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400 shrink-0">
                <FileText className="h-6 w-6" strokeWidth={1.5} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-slate-900">No open requests</p>
                <p className="text-[13px] text-slate-500">All caught up!</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </div>
          ) : (
            <ul className="space-y-3">
              {requests.slice(0, 2).map((req) => (
                <li key={req._id}>
                  <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-100 transition active:scale-[0.98]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                          <FileText className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="text-sm font-extrabold text-slate-900">{req.clientId?.corporateProfile?.companyName || req.clientId?.fullName || 'Corporate Client'}</p>
                          <p className="text-xs font-medium text-slate-500 mt-0.5">Start: {formatDate(req.startDate)}</p>
                        </div>
                      </div>
                      <span className="rounded-md bg-brand/10 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide text-brand">
                        {req.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <AppPrimaryButton
                        className="w-full py-2.5 text-xs flex-1 rounded-xl"
                        loading={isAcceptingRequest}
                        onClick={() => acceptRequest(req._id)}
                      >
                        Accept
                      </AppPrimaryButton>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Crew Added by Vendor */}
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-[17px] font-extrabold tracking-tight text-slate-900">Crew added by vendor</h3>
            {crew.length > 4 && (
              <Link to="/vendor/crew" className="text-[13px] font-bold text-[#FFC107] hover:underline">
                View all
              </Link>
            )}
          </div>
          {crew.length === 0 ? (
            <div className="flex items-center gap-4 rounded-[20px] bg-white p-4 shadow-[0_2px_12px_rgb(0,0,0,0.03)] border border-slate-100/50">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400 shrink-0">
                <Users className="h-6 w-6" strokeWidth={1.5} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-slate-900">No crew linked yet</p>
                <p className="text-[13px] text-slate-500">Add workers to get started.</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </div>
          ) : (
            <div className="rounded-[20px] bg-white shadow-[0_2px_12px_rgb(0,0,0,0.03)] border border-slate-100/50 overflow-hidden divide-y divide-slate-100/80">
              {crew.slice(0, 4).map((w) => (
                <Link key={w._id} to="/vendor/crew" className="flex items-center gap-4 p-4 transition hover:bg-slate-50 active:bg-slate-100">
                  <div className="h-12 w-12 rounded-full bg-[#FFF8E1] text-[#D4A000] flex items-center justify-center font-bold text-lg shrink-0">
                    {w.fullName?.slice(0, 2).toUpperCase() || 'WO'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[15px] font-bold text-slate-900 truncate">{w.fullName || 'Worker'}</p>
                      <span className="rounded bg-[#E8F5E9] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#2E7D32]">New</span>
                    </div>
                    <p className="text-[13px] text-slate-500 mt-0.5 truncate">{w.phone}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" aria-hidden />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Current Jobs */}
        <section className="pb-10">
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-[17px] font-extrabold tracking-tight text-slate-900">Current Jobs</h3>
            {allocations.length > 0 && (
              <Link to="/vendor/jobs" className="text-[13px] font-bold text-[#FFC107] hover:underline">
                View all
              </Link>
            )}
          </div>
          {allocations.length === 0 ? (
             <div className="flex items-center gap-4 rounded-[20px] bg-white p-4 shadow-[0_2px_12px_rgb(0,0,0,0.03)] border border-slate-100/50">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400 shrink-0">
                <ClipboardList className="h-6 w-6" strokeWidth={1.5} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-slate-900">No active jobs</p>
                <p className="text-[13px] text-slate-500">Wait for new allocations.</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </div>
          ) : (
            <ul className="space-y-3">
              {allocations.slice(0, 4).map((a) => {
                const req = a.requestId
                const projectName = req?.projectId?.name || 'Mayur'
                const companyName = req?.clientId?.corporateProfile?.companyName || req?.clientId?.fullName || 'ABCD'
                const pending = a.status === 'pending'
                const statusLabel = pending ? 'Pending' : 'In Progress'

                return (
                  <li key={a._id}>
                    <Link to={`/vendor/jobs/${a._id}`} className="block transition active:scale-[0.98]">
                      <div className="flex flex-row items-center rounded-[20px] bg-white p-3 shadow-[0_2px_12px_rgb(0,0,0,0.03)] border border-slate-100/50 hover:shadow-md transition-shadow">
                        {/* Thumbnail */}
                        <div className="relative h-16 w-[90px] shrink-0 overflow-hidden rounded-[14px] bg-slate-200 mr-4">
                          <img src="https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=300&q=80" alt="Site" className="h-full w-full object-cover" />
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="flex items-center gap-1.5 truncate pr-2">
                              <h3 className="text-[15px] font-bold text-slate-900 truncate">{projectName}</h3>
                              <span className="text-slate-300 text-sm">|</span>
                              <span className="text-[14px] font-medium text-slate-500 truncate">{companyName}</span>
                            </div>
                          
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <div className={`h-2 w-2 rounded-full ${pending ? 'bg-orange-500' : 'bg-[#FF9800]'}`} />
                            <span className={`text-[12px] font-semibold ${pending ? 'text-orange-700' : 'text-[#1976D2]'}`}>
                              {statusLabel}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300 shrink-0 mr-1" />
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
