import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Building2, ClipboardList, Clock, FileText, Plus, ShieldCheck, Users, Settings, ArrowRight, ChevronRight, UserPlus, CalendarCheck } from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth.js'
import { CORPORATE_STATUS } from '../../../constants/userRoles.js'
import { ApprovalGate } from '../../../components/shared/ApprovalGate.jsx'
import { useGetCorporateDashboardQuery, useGetMyRequestsQuery } from '../../../store/api/workforceApi.js'
import { useEffect } from 'react'
import { getSocket } from '../../../services/socket.js'

function timeAgo(date) {
  if (!date) return '—'
  const seconds = Math.floor((new Date() - date) / 1000)
  
  let interval = Math.floor(seconds / 31536000)
  if (interval >= 1) return `${interval}y ago`
  interval = Math.floor(seconds / 2592000)
  if (interval >= 1) return `${interval}mo ago`
  interval = Math.floor(seconds / 86400)
  if (interval >= 1) return `${interval}d ago`
  interval = Math.floor(seconds / 3600)
  if (interval >= 1) return `${interval}h ago`
  interval = Math.floor(seconds / 60)
  if (interval >= 1) return `${interval}m ago`
  return 'Just now'
}

export function CorporateDashboardPage() {
  const { user } = useAuth()
  const approved = user?.corporateProfile?.status === CORPORATE_STATUS.APPROVED
  
  const { data, isLoading, refetch: refetchDashboard } = useGetCorporateDashboardQuery(undefined, { skip: !approved })
  const { data: requestsData, refetch: refetchRequests } = useGetMyRequestsQuery(undefined, { skip: !approved })

  useEffect(() => {
    const socket = getSocket()
    if (socket && approved) {
      const handleUpdate = () => {
        refetchDashboard()
        refetchRequests()
      }
      
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
  }, [approved, refetchDashboard, refetchRequests])

  const activities = useMemo(() => {
    const list = []
    const reqs = requestsData?.requests || []
    
    reqs.forEach((r) => {
      const projectName = r.projectId?.name || 'Bulk Workforce'
      const tradeName = r.lines?.[0]?.categoryId?.name || 'Mason'
      const workersCount = r.lines?.reduce((sum, l) => sum + (l.quantity || 1), 0) || 1
      
      // Request Created
      if (r.createdAt) {
        list.push({
          id: `created-${r._id}`,
          title: 'New request created',
          description: `Need ${workersCount} ${tradeName} for ${projectName}`,
          timestamp: new Date(r.createdAt),
          icon: Plus,
          iconBg: 'bg-[#FFFBEB] text-[#F4C542]',
        })
      }
      
      // Workers Assigned
      if (r.status === 'assigned' || r.status === 'allocated' || r.status === 'accepted') {
        list.push({
          id: `assigned-${r._id}`,
          title: 'Workers assigned',
          description: `${workersCount} ${tradeName} assigned to ${projectName}`,
          timestamp: new Date(r.updatedAt || r.createdAt),
          icon: Users,
          iconBg: 'bg-[#ECFDF5] text-[#059669]',
        })
      }

      // Request Completed
      if (r.status === 'completed') {
        list.push({
          id: `completed-${r._id}`,
          title: 'Request completed',
          description: `Work completed for ${projectName}`,
          timestamp: new Date(r.updatedAt || r.createdAt),
          icon: CalendarCheck,
          iconBg: 'bg-[#EFF6FF] text-[#2563EB]',
        })
      }
    })
    
    return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, 4)
  }, [requestsData])

  if (!approved) {
    return (
      <div className="space-y-4">
        <ApprovalGate
          title="Corporate approval required"
          message="Upload company documents on your profile. Operations will verify your account before projects and bulk requests unlock."
          profileTo="/corporate/profile"
        />
      </div>
    )
  }

  const stats = data?.stats || {}

  return (
    <div className="space-y-5 pb-6">
      
      {/* Hero Banner */}
      <div 
        className="relative overflow-hidden rounded-3xl border border-slate-100 p-5 md:p-6 text-white shadow-sm"
        style={{
          backgroundImage: 'url(/corporate_bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-slate-950/75" />
        <div className="relative z-10 flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-white/12 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-yellow-350">
                Enterprise
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-brand-bright">
                <Building2 className="h-4.5 w-4.5" />
              </span>
            </div>
            <h2 className="mt-2.5 text-base sm:text-lg font-bold tracking-tight">
              Welcome back, <span className="text-yellow-350 font-extrabold">{user?.corporateProfile?.companyName || user?.fullName || 'Company'}</span>
            </h2>
            <p className="mt-1 text-xs font-semibold text-white/80">
              Manage workforce, projects, attendance and billing from one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 py-0.5 border-t border-b border-white/10 my-1">
            {[
              { text: 'Verified Workforce', icon: ShieldCheck },
              { text: 'GST Ready', icon: FileText },
              { text: 'Bulk Operations', icon: Users },
            ].map((chip, index) => {
              const ChipIcon = chip.icon
              return (
                <div key={index} className="flex items-center gap-1 text-[9px] font-bold text-white/70 bg-white/5 rounded-md px-2 py-1 border border-white/5 shrink-0">
                  <ChipIcon className="h-3 w-3 text-yellow-350" />
                  <span>{chip.text}</span>
                </div>
              )
            })}
          </div>

          <Link to="/corporate/requests/new" className="w-full">
            <button 
              type="button" 
              className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-gradient-to-r from-brand-bright to-brand hover:opacity-95 active:scale-[0.98] transition-all text-slate-950 font-extrabold px-4 py-3 text-xs shadow-md border-0"
            >
              <Plus className="h-4 w-4" strokeWidth={3.5} />
              <span>New Workforce Request</span>
            </button>
          </Link>
        </div>
      </div>

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Active Projects', value: isLoading ? '—' : stats.activeProjects ?? 0, icon: Building2, to: '/corporate/projects', bg: 'bg-indigo-50 text-indigo-600' },
          { label: 'Open Requests', value: isLoading ? '—' : stats.openRequests ?? 0, icon: ClipboardList, to: '/corporate/requests', bg: 'bg-amber-50 text-amber-600' },
          { label: 'Workers Deployed', value: isLoading ? '—' : stats.activeWorkers ?? 0, icon: Users, to: '/corporate/attendance', bg: 'bg-emerald-50 text-emerald-600' },
          { label: 'Invoices Due', value: isLoading ? '—' : stats.invoicesDue ?? 0, icon: FileText, to: '/corporate/billing', bg: 'bg-rose-50 text-rose-600' },
        ].map((item, index) => {
          const Icon = item.icon
          return (
            <Link key={index} to={item.to} className="block transition active:scale-[0.98]">
              <div className="bg-white p-4 rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between h-[120px] relative">
                <div className="flex items-start justify-between w-full">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.bg}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                </div>
                <div className="mt-2">
                  <p className="text-[24px] font-black text-slate-900 leading-none">{item.value}</p>
                  <p className="text-[11px] font-bold text-slate-400 mt-1">{item.label}</p>
                </div>
                <div className="absolute bottom-3 right-3 flex items-center gap-1 text-[9px] font-bold text-slate-400">
                  <span>View all</span>
                  <ChevronRight className="h-3 w-3" />
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-extrabold text-slate-900">Quick Actions</h3>
          <button type="button" className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
            <span>Customize</span>
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="-mx-4 px-4 overflow-x-auto scrollbar-none flex gap-3 pb-1">
          {[
            { label: 'Request Workforce', icon: UserPlus, to: '/corporate/requests/new', bg: 'bg-[#FFFDF0] text-[#F4C542] border border-[#FDF2C2]' },
            { label: 'Manage Projects', icon: Building2, to: '/corporate/projects', bg: 'bg-[#F9F5FF] text-[#7C3AED] border border-[#E9D5FF]' },
            { label: 'Attendance Sheets', icon: CalendarCheck, to: '/corporate/attendance', bg: 'bg-[#F4FDF7] text-[#059669] border border-[#C6F3D7]' },
            { label: 'Invoices & Billing', icon: FileText, to: '/corporate/billing', bg: 'bg-[#FFF7ED] text-[#EA580C] border border-[#FFEDD5]' },
            { label: 'Workforce Directory', icon: Users, to: '/corporate/profile', bg: 'bg-[#F4F9FD] text-[#2563EB] border border-[#C6E1F7]' },
          ].map((act, index) => {
            const Icon = act.icon
            return (
              <Link key={index} to={act.to} className="flex flex-col items-center shrink-0 w-20 text-center transition active:scale-[0.96]">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-2xs ${act.bg}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="mt-1.5 text-[10px] font-black text-slate-600 leading-tight block w-full truncate-2-lines h-7">
                  {act.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-[20px] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
        <div className="flex items-center justify-between mb-3 border-b border-slate-50 pb-2">
          <h3 className="text-sm font-extrabold text-slate-900">Recent Activity</h3>
          <Link to="/corporate/requests" className="text-[11px] font-bold text-brand-bright hover:underline">
            View all
          </Link>
        </div>
        {activities.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">No recent activities found.</p>
        ) : (
          <div className="space-y-4 relative pl-3 before:absolute before:left-6 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-50">
            {activities.map((act) => {
              const ActIcon = act.icon
              return (
                <div key={act.id} className="flex items-start gap-3 relative">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl z-10 shadow-3xs ${act.iconBg}`}>
                    <ActIcon className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xs font-black text-slate-900 leading-none">{act.title}</p>
                      <span className="text-[9px] font-bold text-slate-400 shrink-0">{timeAgo(act.timestamp)}</span>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-500 mt-1 leading-snug">
                      {act.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bulk Promotional Banner */}
      <div className="relative overflow-hidden rounded-[20px] bg-gradient-to-r from-amber-50/90 to-orange-50/70 p-5 border border-amber-100 flex items-center justify-between shadow-2xs">
        <div className="flex-1 pr-4 z-10">
          <h4 className="text-sm font-black text-slate-900">Need bulk workforce for large projects?</h4>
          <p className="text-[11px] font-semibold text-slate-500 mt-1 leading-relaxed">
            We've got you covered with verified professionals across all categories.
          </p>
          <Link to="/corporate/requests/new" className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-bright to-brand hover:opacity-95 text-slate-950 font-extrabold text-[10px] px-4 py-2 shadow-xs transition active:scale-95 border-0">
            <span>Request Bulk Workforce</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="shrink-0 z-0 opacity-40 sm:opacity-100 max-w-[100px] -mr-2">
          <img src="/hardhat_3d.png" alt="Bulk workforce" className="w-18 h-18 object-contain" />
        </div>
      </div>

    </div>
  )
}
