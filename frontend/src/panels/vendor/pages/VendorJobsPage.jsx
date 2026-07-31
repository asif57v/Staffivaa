import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, ClipboardList, Search, Filter, MapPin, Calendar, Users, CheckCircle2, UserCircle, Clock, Construction, AlertCircle, XCircle, Building2 } from 'lucide-react'
import { AppEmptyState } from '../../../components/app/AppEmptyState.jsx'
import { useAcceptVendorJobMutation, useGetVendorJobsQuery } from '../../../store/api/workforceApi.js'
import { markVendorJobsViewed } from '../../../hooks/useVendorNotificationCount.js'
import { getSocket } from '../../../services/socket.js'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const TABS = ['All', 'Accepted', 'Assigned', 'Completed', 'Cancelled']

export function VendorJobsPage() {
  useEffect(() => {
    markVendorJobsViewed()
  }, [])
  const { data, isLoading, isError, refetch } = useGetVendorJobsQuery()
  const [acceptJob] = useAcceptVendorJobMutation()

  useEffect(() => {
    const socket = getSocket()
    if (socket) {
      const handleUpdate = () => refetch()
      socket.on('request_status_update', handleUpdate)
      socket.on('payment_status_update', handleUpdate)
      socket.on('work_progress_update', handleUpdate)
      socket.on('work_completed', handleUpdate)
      
      return () => {
        socket.off('request_status_update', handleUpdate)
        socket.off('payment_status_update', handleUpdate)
        socket.off('work_progress_update', handleUpdate)
        socket.off('work_completed', handleUpdate)
      }
    }
  }, [refetch])
  const allocations = data?.allocations ?? []

  const [activeTab, setActiveTab] = useState('All')
  const [search, setSearch] = useState('')

  const handleAccept = async (e, id) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await acceptJob(id).unwrap()
    } catch {
      // ignore
    }
  }

  const filteredAllocations = useMemo(() => {
    return allocations.filter(a => {
      const pending = !a.vendorAcceptedAt
      let status = 'pending'
      if (!pending) status = 'accepted'
      if (a.status === 'completed') status = 'completed'
      if (a.status === 'cancelled') status = 'cancelled'

      if (activeTab === 'Accepted' && status !== 'accepted') return false
      if (activeTab === 'Completed' && status !== 'completed') return false
      if (activeTab === 'Cancelled' && status !== 'cancelled') return false
      if (activeTab === 'Assigned' && status !== 'accepted') return false 

      if (search.trim()) {
        const req = a.requestId || {}
        const query = search.toLowerCase().trim()
        
        const reference = (req.reference || 'CR-MQ8OUOON').toLowerCase()
        const company = (req.clientId?.corporateProfile?.companyName || req.clientId?.fullName || 'Urban Company').toLowerCase()
        const loc = (req.locationText || 'Khand, Indore').toLowerCase()
        const project = (req.projectId?.name || req.projectName || 'Appzeto Tower Construction').toLowerCase()

        if (!reference.includes(query) && !company.includes(query) && !loc.includes(query) && !project.includes(query)) {
          return false
        }
      }
      return true
    })
  }, [allocations, activeTab, search])

  return (
    <div className="space-y-5">
      {/* Header text */}
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Supply</p>
        <h2 className="text-2xl font-black text-slate-900 mt-0.5">Jobs</h2>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
            <Search className="h-4 w-4 text-slate-400" aria-hidden />
          </div>
          <input
            type="text"
            className="block w-full rounded-2xl border-0 py-3.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand bg-white"
            placeholder="Search by company name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="-mx-4 overflow-x-auto pb-1 scrollbar-hide">
        <div className="flex gap-2 px-4 w-max">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-5 py-2.5 text-xs font-extrabold shadow-sm transition active:scale-95 border ${
                activeTab === tab
                  ? 'bg-white text-brand border-brand/30'
                  : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500 text-center py-4">Loading jobs…</p>
        </div>
      ) : null}

      {isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <p className="text-sm font-semibold text-rose-800 text-center">Could not load jobs.</p>
        </div>
      ) : null}

      {!isLoading && !isError && filteredAllocations.length === 0 ? (
        <div className="pt-4">
          <AppEmptyState
            icon={ClipboardList}
            title="No jobs found"
            subtitle="Try adjusting your filters or search query."
          />
        </div>
      ) : null}

      {/* Job List */}
      <ul className="space-y-3">
        {filteredAllocations.map((a, i) => {
          const req = a.requestId || {}
          const pending = !a.vendorAcceptedAt
          const company = req.clientId?.corporateProfile?.companyName || req.clientId?.fullName || 'Urban Company'
          const projectName = req.projectId?.name || req.projectName || 'Appzeto Tower Construction'
          const reference = req.reference || 'CR-MQ8OUOON'
          
          const workersCount = req.lines?.reduce((sum, l) => sum + (l.quantity || 1), 0) || 3
          const tradeName = req.lines?.[0]?.categoryId?.name || 'Mason (Raj Mistri)'
          const shiftStr = (req.shiftStart && req.shiftEnd) ? `${req.shiftStart} - ${req.shiftEnd}` : '08:00 AM - 06:00 PM'
          
          let statusLabel = pending ? 'Pending' : 'Accepted'
          let statusTone = pending ? 'bg-orange-50 text-orange-700' : 'bg-emerald-50 text-emerald-700'
          let StatusIcon = pending ? AlertCircle : CheckCircle2
          
          if (a.status === 'completed') {
            statusLabel = 'Completed'
            statusTone = 'bg-emerald-50 text-emerald-700'
            StatusIcon = CheckCircle2
          } else if (a.status === 'cancelled') {
            statusLabel = 'Cancelled'
            statusTone = 'bg-rose-50 text-rose-700'
            StatusIcon = XCircle
          } else if (!pending && i % 3 === 1) { // mock variations
             statusLabel = 'In Progress'
             statusTone = 'bg-blue-50 text-blue-700'
             StatusIcon = Construction
          } else if (!pending && i % 3 === 2) {
             statusLabel = 'Rejected'
             statusTone = 'bg-rose-50 text-rose-700'
             StatusIcon = XCircle
          }

          return (
            <li key={a._id}>
              <Link to={`/vendor/jobs/${a._id}`} className="block transition active:scale-[0.98]">
                <div className="rounded-xl sm:rounded-[24px] bg-white p-2.5 sm:p-5 shadow-[0_2px_14px_-4px_rgba(0,0,0,0.08)] border border-slate-100/90 hover:shadow-lg transition-shadow">
                  {/* Header Row: Title & Status */}
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3.5">
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-snug tracking-tight">
                        {projectName}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-slate-600 font-semibold text-sm">
                        <Building2 className="h-4 w-4 shrink-0 text-brand" />
                        <span className="leading-normal">{company}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-xs ${statusTone}`}>
                        <StatusIcon className="h-3.5 w-3.5" strokeWidth={2.5} /> {statusLabel}
                      </span>
                      <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
                    </div>
                  </div>

                  {/* Complete Location Address Row */}
                  <div className="mt-3.5 flex items-start gap-2.5 rounded-xl bg-slate-50/80 p-3.5 border border-slate-100 text-slate-700">
                    <MapPin className="h-4 w-4 shrink-0 text-brand mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Location</p>
                      <p className="text-sm font-bold text-slate-800 leading-relaxed">
                        {req.locationText || 'Khand, Indore'}
                      </p>
                    </div>
                  </div>

                  {/* Schedule & Workers Info Row */}
                  <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                    <div className="flex items-center gap-2.5 rounded-xl bg-slate-50/60 p-3 border border-slate-100/80">
                      <Calendar className="h-4 w-4 shrink-0 text-slate-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start Date</p>
                        <p className="text-xs sm:text-sm font-bold text-slate-800 leading-snug break-words">{formatDate(req.startDate)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 rounded-xl bg-slate-50/60 p-3 border border-slate-100/80">
                      <Users className="h-4 w-4 shrink-0 text-slate-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Workforce</p>
                        <p className="text-xs sm:text-sm font-bold text-slate-800 leading-snug">{workersCount} Workers Required</p>
                      </div>
                    </div>
                  </div>

                  {/* Badges & Project ID Footer */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-100/80">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-200/60">
                        <UserCircle className="h-3.5 w-3.5" strokeWidth={2.5} /> {tradeName}
                      </span>
                      <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 border border-slate-200/60">
                        <Clock className="h-3.5 w-3.5" /> {shiftStr}
                      </span>
                    </div>
                    <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
                      ID: {reference}
                    </span>
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
