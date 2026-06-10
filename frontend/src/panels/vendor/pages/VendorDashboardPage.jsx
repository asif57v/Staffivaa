import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, IndianRupee, Users, ChevronRight, FileText, CheckCircle, Menu, MapPin, ChevronDown, Bell, Calendar } from 'lucide-react'
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

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function VendorDashboardPage() {
  const { user } = useAuth()
  const [appLocation, setAppLocation] = useState(() => readAppUserLocation())
  const approved = user?.contractorProfile?.verificationStatus === 'approved'
  const { data, isLoading } = useGetVendorDashboardQuery(undefined, { skip: !approved })

  const { data: crewData } = useGetVendorCrewQuery(undefined, { skip: !approved })
  const crew = crewData?.crew ?? []

  const { data: jobsData } = useGetVendorJobsQuery(undefined, { skip: !approved })
  const allocations = jobsData?.allocations ?? []
  const [acceptJob, { isLoading: acceptingJob }] = useAcceptVendorJobMutation()

  const { data: requestsData } = useGetVendorMarketplaceRequestsQuery(undefined, {
    skip: !approved,
    pollingInterval: 30000,
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
    return () => window.removeEventListener('lc-app-user-location-changed', onLoc)
  }, [])

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

  const stats = data?.stats || {}

  return (
    <div className="space-y-6 bg-[#F5F6F8] min-h-screen pb-6 -mx-4 -mt-4">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-b-[2rem] bg-slate-900 pb-10 pt-[max(1.25rem,env(safe-area-inset-top,1rem))] text-white shadow-lg">
        {/* Background Image with Dark Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('/vendor-hero-bg.png')` }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-900/80 to-slate-900/60" aria-hidden />

        {/* Custom Header in Hero */}
        <div className="relative z-10 px-5">
          <div className="flex items-start justify-between gap-3 mb-6">
            {/* Location Dropdown */}
            <button
              type="button"
              onClick={openLocationModal}
              className="flex min-w-0 flex-1 flex-col items-start text-left outline-none transition active:opacity-70"
            >
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/70 mb-0.5">Location</span>
              <div className="flex w-full items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0 text-white" fill="currentColor" />
                <span className="truncate text-sm font-extrabold tracking-tight text-white">
                  {locationLabel}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-white/80" />
              </div>
            </button>

            {/* Menu & Bell */}
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={openDrawer}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm text-white shadow-sm transition hover:bg-white/20 active:scale-95"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm text-white shadow-sm transition hover:bg-white/20 active:scale-95"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-slate-800">
                  3
                </span>
              </button>
            </div>
          </div>

          {/* Hero Content */}
          <div className="mt-8 flex justify-between items-end relative">
            <div className="max-w-[70%]">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/70">Supply partner</p>
              <h2 className="mt-1 text-2xl font-extrabold leading-tight text-white drop-shadow-sm">
                {user?.contractorProfile?.businessName || user?.fullName}
              </h2>
              <p className="mt-2 text-sm text-white/80 leading-snug font-medium">
                Accept admin allocations and manage your crew.
              </p>
              <Link to="/vendor/jobs" className="mt-5 inline-block">
                <button type="button" className="rounded-xl bg-white px-5 py-2.5 text-xs font-extrabold text-slate-900 shadow-sm transition hover:bg-slate-50 active:scale-95 flex items-center gap-1.5">
                  View supply jobs
                  <ChevronRight className="h-4 w-4" />
                </button>
              </Link>
            </div>

            {/* Vendor Avatar overlapping */}
            <div className="absolute right-2 bottom-0 translate-y-3">
              <div className="h-16 w-16 rounded-full border-[3px] border-white bg-slate-200 overflow-hidden shadow-md">
                <img src={user?.profileImageUrl || "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=200&q=80"} alt="Vendor" className="h-full w-full object-cover" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <div className="relative z-10 mt-4 px-4 grid grid-cols-3 gap-2">
        {[
          { label: 'Crew', value: isLoading ? '—' : stats.crewCount ?? 0, icon: Users, tone: 'text-indigo-600 bg-indigo-50', sub: 'Linked' },
          { label: 'Open', value: isLoading ? '—' : stats.openJobs ?? 0, icon: ClipboardList, tone: 'text-amber-600 bg-amber-50', sub: 'Jobs' },
          { label: 'Active', value: isLoading ? '—' : stats.activeAssignments ?? 0, icon: IndianRupee, tone: 'text-emerald-600 bg-emerald-50', sub: 'Deployments' },
        ].map((stat, i) => (
          <div key={i} className="flex flex-col items-center justify-center rounded-xl bg-white px-1.5 py-3 shadow-sm border border-slate-100">
            <span className={`mb-1.5 flex h-7 w-7 items-center justify-center rounded-full ${stat.tone}`}>
              <stat.icon className="h-3.5 w-3.5" />
            </span>
            <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-500 text-center">{stat.label}</p>
            <p className="mt-0.5 text-lg font-black text-slate-900">{stat.value}</p>
            <p className="mt-0.5 text-[8px] font-semibold text-slate-400 text-center truncate w-full">{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="px-4 space-y-6">
        {/* Current Requests */}
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-base font-extrabold text-slate-900">Current Requests</h3>
            {requests.length > 4 && (
              <Link to="/vendor/requests" className="text-xs font-bold text-brand hover:underline">
                View all
              </Link>
            )}
          </div>
          {requests.length === 0 ? (
            <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                <FileText className="h-6 w-6" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-extrabold text-slate-900">No open requests</p>
                <p className="text-xs font-medium text-slate-500">All caught up!</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </div>
          ) : (
            <ul className="space-y-3">
              {requests.slice(0, 4).map((req) => (
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
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-base font-extrabold text-slate-900">Crew added by vendor</h3>
            {crew.length > 4 && (
              <Link to="/vendor/crew" className="text-xs font-bold text-brand hover:underline">
                View all
              </Link>
            )}
          </div>
          {crew.length === 0 ? (
            <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                <Users className="h-6 w-6" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-extrabold text-slate-900">No crew linked yet</p>
                <p className="text-xs font-medium text-slate-500">Add workers to get started.</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </div>
          ) : (
            <div className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-100">
              {crew.slice(0, 4).map((w) => (
                <Link key={w._id} to="/vendor/crew" className="flex items-center gap-3 p-4 transition hover:bg-slate-50 active:bg-slate-100">
                  <div className="h-10 w-10 rounded-full bg-slate-200 overflow-hidden border border-slate-200 shrink-0">
                    <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(w.fullName || 'Worker')}&background=random`} alt="Avatar" className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-extrabold text-slate-900 truncate">{w.fullName || 'Worker'}</p>
                      <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-700">New</span>
                    </div>
                    <p className="text-xs font-medium text-slate-500 mt-0.5 truncate">{w.phone}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" aria-hidden />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Current Jobs */}
        <section className="pb-10">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-base font-extrabold text-slate-900">Current Jobs</h3>
            {allocations.length > 4 && (
              <Link to="/vendor/jobs" className="text-xs font-bold text-brand hover:underline">
                View all
              </Link>
            )}
          </div>
          {allocations.length === 0 ? (
             <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                <ClipboardList className="h-6 w-6" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-extrabold text-slate-900">No active jobs</p>
                <p className="text-xs font-medium text-slate-500">Wait for new allocations.</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </div>
          ) : (
            <ul className="space-y-3">
              {allocations.slice(0, 4).map((a) => {
                const req = a.requestId
                const projectName = req?.projectId?.name || 'Maiyur'
                const companyName = req?.clientId?.corporateProfile?.companyName || req?.clientId?.fullName || 'Appzeto'
                const pending = a.status === 'pending'
                const statusLabel = pending ? 'Pending' : 'Accepted'
                const statusTone = pending ? 'bg-orange-50 text-orange-700' : 'bg-emerald-50 text-emerald-700'

                return (
                  <li key={a._id}>
                    <Link to={`/vendor/jobs/${a._id}`} className="block transition active:scale-[0.98]">
                      <div className="flex flex-row rounded-[20px] bg-white p-3 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                        {/* Thumbnail */}
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[14px] bg-slate-200 mr-3 shadow-sm border border-slate-100/50">
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/10 to-transparent z-10" />
                          <img src="https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=300&q=80" alt="Site" className="h-full w-full object-cover" />
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 truncate pr-2">
                              <h3 className="text-[14px] font-bold text-slate-900 truncate">{projectName}</h3>
                              <span className="text-slate-300 text-sm">|</span>
                              <span className="text-[12px] font-medium text-slate-500 truncate">{companyName}</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                          </div>
                          
                          <div className="mt-1 flex items-center gap-2.5 text-slate-500 flex-wrap">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <p className="text-[11px] font-medium truncate max-w-[90px]">{req?.locationText || 'Location TBD'}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 shrink-0" />
                              <p className="text-[11px] font-medium">{formatDate(req?.startDate)}</p>
                            </div>
                          </div>
                          
                          <div className="mt-2.5 flex items-center gap-2">
                            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone}`}>
                              {pending ? <CheckCircle className="h-2.5 w-2.5" /> : <CheckCircle className="h-2.5 w-2.5" strokeWidth={3} />} {statusLabel}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-auto">
                              ID: {req?.reference || 'CR-MQ7'}
                            </span>
                          </div>
                        </div>
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
