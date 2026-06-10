import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, ClipboardList, Search, Filter, MapPin, Calendar, Users, CheckCircle2, UserCircle, Clock, Construction, AlertCircle, XCircle, Building2 } from 'lucide-react'
import { AppEmptyState } from '../../../components/app/AppEmptyState.jsx'
import { useAcceptVendorJobMutation, useGetVendorJobsQuery } from '../../../store/api/workforceApi.js'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const TABS = ['All', 'Accepted', 'Assigned', 'Completed', 'Cancelled']

export function VendorJobsPage() {
  const { data, isLoading, isError } = useGetVendorJobsQuery()
  const [acceptJob] = useAcceptVendorJobMutation()
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
      // assigned / in progress mock logic based on actual data if available

      if (activeTab === 'Accepted' && status !== 'accepted') return false
      if (activeTab === 'Completed' && status !== 'completed') return false
      if (activeTab === 'Cancelled' && status !== 'cancelled') return false
      // If we don't have accurate 'Assigned' state, we just show accepted jobs for now
      if (activeTab === 'Assigned' && status !== 'accepted') return false 

      if (search) {
        const req = a.requestId || {}
        const query = search.toLowerCase()
        const ref = req.reference?.toLowerCase() || ''
        const comp = req.clientId?.corporateProfile?.companyName?.toLowerCase() || ''
        const loc = req.locationText?.toLowerCase() || ''
        if (!ref.includes(query) && !comp.includes(query) && !loc.includes(query)) return false
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

      {/* Search and Filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
            <Search className="h-4 w-4 text-slate-400" aria-hidden />
          </div>
          <input
            type="text"
            className="block w-full rounded-2xl border-0 py-3.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand bg-white"
            placeholder="Search by Project ID, Company, or Location"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-100 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 active:scale-95"
        >
          <Filter className="h-5 w-5" />
        </button>
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

          // Generate mock thumbnails
          const imgUrls = [
            'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=300&q=80',
            'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=300&q=80',
            'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=300&q=80',
            'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=300&q=80'
          ]
          const imgSrc = imgUrls[i % imgUrls.length]

          return (
            <li key={a._id}>
              <Link to={`/vendor/jobs/${a._id}`} className="block transition active:scale-[0.98]">
                <div className="flex flex-row rounded-[20px] bg-white p-4 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] border border-slate-100 hover:shadow-lg transition-shadow">
                  {/* Thumbnail */}
                  <div className="relative h-32 w-28 shrink-0 overflow-hidden rounded-[14px] bg-slate-200 mr-4 shadow-sm border border-slate-100/50">
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 to-transparent z-10" />
                    <img src={imgSrc} alt="Site" className="h-full w-full object-cover" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className="text-[18px] font-bold text-slate-900 leading-tight truncate pr-2 tracking-tight">
                          {projectName}
                        </h3>
                        <ChevronRight className="h-5 w-5 text-slate-300 shrink-0 mt-0.5" />
                      </div>
                      
                      <div className="flex items-center gap-1.5 mt-1 text-slate-500">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        <p className="text-[15px] font-medium truncate">{company}</p>
                      </div>
                      
                      <div className="mt-2.5 flex items-center gap-1.5 text-slate-500">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <p className="text-[13px] font-medium truncate">{req.locationText || 'Khand, Indore'}</p>
                      </div>
                      
                      <div className="mt-1 flex items-center gap-4 text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          <p className="text-[13px] font-medium">{formatDate(req.startDate)}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 shrink-0" />
                          <p className="text-[13px] font-medium">{workersCount} Workers</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Badges & ID */}
                    <div className="mt-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone}`}>
                          <StatusIcon className="h-3 w-3" strokeWidth={3} /> {statusLabel}
                        </span>
                        <span className="flex items-center gap-1 rounded-full bg-transparent px-2.5 py-1 text-[11px] font-bold text-blue-700 border border-blue-200">
                          <UserCircle className="h-3 w-3" strokeWidth={2.5} /> {tradeName}
                        </span>
                        <span className="flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 border border-slate-200">
                          <Clock className="h-3 w-3" /> {shiftStr}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-400 mt-3 tracking-wide uppercase">
                        Project ID: {reference}
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
