import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Filter, MapPin, Search, ChevronDown, ChevronRight, UserCircle, Clock, CheckCircle2, AlertCircle, CalendarDays, Building2 } from 'lucide-react'
import { useGetAttendanceMonitorQuery } from '../../../store/api/workforceApi.js'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function AttendanceDashboardView({ basePath = '/vendor' }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [search, setSearch] = useState('')

  const queryParams = useMemo(() => {
    return { date }
  }, [date])

  const { data: monitorData, isLoading } = useGetAttendanceMonitorQuery(queryParams)
  
  const projects = monitorData?.projects ?? []

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header & Date Filter Row */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-[16px] border border-slate-200 bg-white px-10 py-3.5 text-[14px] font-black text-slate-800 shadow-sm outline-none focus:border-brand"
          />
          <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
        </div>
        <button type="button" className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-[16px] border border-slate-200 bg-white shadow-sm transition active:scale-95">
          <Filter className="h-5 w-5 text-slate-600" />
        </button>
      </div>

      {isLoading && <div className="text-center text-sm font-semibold text-slate-500 py-10">Loading attendance data...</div>}
      
      {!isLoading && projects.length === 0 && (
        <div className="rounded-[20px] bg-white p-8 text-center shadow-sm border border-slate-100">
           <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-3" />
           <p className="text-[15px] font-bold text-slate-900">No Projects Found</p>
           <p className="text-[13px] text-slate-500 mt-1">There are no active assignments for this date.</p>
        </div>
      )}

      {/* Render each project */}
      {projects.map((p) => {
         const assignedCount = p.assignedWorkers || 0
         const presentCount = p.present || 0
         const absentCount = p.absent || 0
         const lateCount = p.late || 0
         const weeklyOffCount = p.weeklyOff || 0

         // Filter workers based on search
         let workersList = p.workers || []
         if (search) {
           const query = search.toLowerCase()
           workersList = workersList.filter(w => w.workerName.toLowerCase().includes(query) || w.role.toLowerCase().includes(query))
         }

         return (
           <div key={p.projectId} className="space-y-6">
              {/* Project Card */}
              <div className="overflow-hidden rounded-[20px] bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] border border-slate-100">
                <div className="relative h-32 w-full bg-slate-200 border-b border-slate-100/50">
                  <img src="https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800&q=80" alt="Project Cover" className="h-full w-full object-cover" />
                  <div className="absolute top-3 right-3 rounded-md bg-white/95 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 shadow-sm border border-emerald-100">
                    {p.projectStatus === 'completed' ? 'Completed' : 'Active'}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-[16px] font-extrabold text-slate-900 truncate pr-2">{p.projectName}</h3>
                  <div className="mt-1 flex items-center gap-1.5 text-slate-500">
                     <Building2 className="h-3.5 w-3.5 shrink-0" />
                     <p className="text-[13px] font-bold truncate">{p.corporateName || 'Corporate Client'}</p>
                  </div>
                  
                  <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3">
                     <p className="flex items-center gap-2 text-[12px] font-semibold text-slate-600">
                       <MapPin className="h-3.5 w-3.5 text-slate-400" /> <span className="truncate">{p.projectLocation || 'Location TBD'}</span>
                     </p>
                     <p className="flex items-center gap-2 text-[12px] font-semibold text-slate-600">
                       <CalendarDays className="h-3.5 w-3.5 text-slate-400" /> <span>{formatDate(date)}</span>
                     </p>
                  </div>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col justify-center rounded-[18px] bg-blue-50/70 p-4 border border-blue-100/50">
                   <div className="flex items-center justify-between mb-2">
                     <UserCircle className="h-5 w-5 text-blue-500" strokeWidth={2} />
                     <p className="text-[10px] font-black uppercase tracking-wider text-blue-800">Assigned</p>
                   </div>
                   <p className="text-2xl font-black text-slate-900">{assignedCount}</p>
                   <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Workers</p>
                </div>
                <div className="flex flex-col justify-center rounded-[18px] bg-emerald-50/70 p-4 border border-emerald-100/50">
                   <div className="flex items-center justify-between mb-2">
                     <CheckCircle2 className="h-5 w-5 text-emerald-500" strokeWidth={2} />
                     <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800">Present</p>
                   </div>
                   <p className="text-2xl font-black text-slate-900">{presentCount}</p>
                   <p className="text-[10px] font-semibold text-slate-500 mt-0.5">{assignedCount ? Math.round((presentCount/assignedCount)*100) : 0}%</p>
                </div>
                <div className="flex flex-col justify-center rounded-[18px] bg-rose-50/70 p-4 border border-rose-100/50">
                   <div className="flex items-center justify-between mb-2">
                     <AlertCircle className="h-5 w-5 text-rose-500" strokeWidth={2} />
                     <p className="text-[10px] font-black uppercase tracking-wider text-rose-800">Absent</p>
                   </div>
                   <p className="text-2xl font-black text-slate-900">{absentCount}</p>
                   <p className="text-[10px] font-semibold text-slate-500 mt-0.5">{assignedCount ? Math.round((absentCount/assignedCount)*100) : 0}%</p>
                </div>
                <div className="flex flex-col justify-center rounded-[18px] bg-amber-50/70 p-4 border border-amber-100/50">
                   <div className="flex items-center justify-between mb-2">
                     <Clock className="h-5 w-5 text-amber-500" strokeWidth={2} />
                     <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">Late</p>
                   </div>
                   <p className="text-2xl font-black text-slate-900">{lateCount}</p>
                   <p className="text-[10px] font-semibold text-slate-500 mt-0.5">{assignedCount ? Math.round((lateCount/assignedCount)*100) : 0}%</p>
                </div>
                <div className="col-span-2 flex items-center justify-between rounded-[18px] bg-violet-50/70 p-4 border border-violet-100/50">
                   <div>
                     <p className="text-[10px] font-black uppercase tracking-wider text-violet-800 mb-1 flex items-center gap-1.5"><CalendarDays className="h-3 w-3" /> Weekly Off</p>
                     <p className="text-[11px] font-semibold text-slate-500">Workers off today</p>
                   </div>
                   <p className="text-2xl font-black text-slate-900">{weeklyOffCount}</p>
                </div>
              </div>

              {/* Workers List */}
              <div className="rounded-[20px] bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] border border-slate-100 p-4">
                 <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[13px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      Today's Attendance <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse ml-1" /> <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase tracking-widest border border-emerald-100">Live</span>
                    </h4>
                 </div>

                 {workersList.length > 5 && (
                   <div className="relative mb-5">
                     <input
                       type="text"
                       className="block w-full rounded-[14px] border border-slate-100 bg-slate-50 py-3 pl-10 pr-4 text-[13px] font-medium text-slate-900 outline-none focus:border-brand focus:bg-white transition"
                       placeholder="Search worker..."
                       value={search}
                       onChange={(e) => setSearch(e.target.value)}
                     />
                     <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                   </div>
                 )}

                 <ul className="space-y-3">
                   {workersList.map((w) => {
                      const status = w.status
                      let statusTone = status === 'Present' || status === 'working' || status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                       status === 'Absent' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                       status === 'Late' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                       'bg-violet-50 text-violet-700 border-violet-100'
                      
                      let StatusIcon = status === 'Present' || status === 'working' || status === 'completed' ? CheckCircle2 :
                                       status === 'Absent' ? AlertCircle :
                                       status === 'Late' ? Clock : CalendarDays

                      const r = w.records && w.records[0] ? w.records[0] : null
                      const hasCheckIn = r?.checkInAt != null
                      
                      return (
                        <li key={w.workerId}>
                          <Link to={`${basePath}/attendance/${p.projectId}/worker/${w.workerId}`} className="block transition active:scale-[0.98]">
                            <div className="flex items-center p-2 rounded-[16px] border border-slate-100/50 bg-slate-50/50 hover:bg-slate-50 transition">
                              {/* Avatar */}
                              <div className="relative h-[50px] w-[50px] shrink-0 rounded-[12px] bg-slate-200 shadow-sm overflow-hidden mr-3">
                                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(w.workerName)}&background=random`} alt={w.workerName} className="h-full w-full object-cover" />
                              </div>
                              
                              <div className="flex-1 min-w-0 pr-1 py-0.5">
                                <div className="flex justify-between items-start mb-0.5">
                                  <p className="text-[14px] font-black text-slate-900 truncate pr-2">{w.workerName}</p>
                                  <span className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase border ${statusTone}`}>
                                    <StatusIcon className="h-2.5 w-2.5" strokeWidth={3} /> {status === 'working' || status === 'completed' ? 'Present' : status}
                                  </span>
                                </div>
                                <p className="text-[11px] font-bold text-slate-500 mb-2 truncate">{w.role}</p>
                                
                                <div className="flex items-end justify-between text-[10px] font-semibold text-slate-500">
                                   <div className="space-y-1">
                                     <p className="flex items-center gap-1">
                                       <MapPin className={`h-3 w-3 ${hasCheckIn ? 'text-emerald-500' : 'text-slate-300'}`} />
                                       <span className={hasCheckIn ? "text-emerald-600" : "text-slate-400"}>
                                         {hasCheckIn ? 'GPS Verified' : 'Not Verified'}
                                       </span>
                                     </p>
                                   </div>
                                   
                                   <div className="text-right space-y-1 bg-white px-2 py-1.5 rounded-lg border border-slate-100 shadow-sm">
                                      <p className="flex justify-between gap-3 items-center">
                                        <span className="text-[9px] text-slate-400 font-bold uppercase">In</span>
                                        <span className="font-bold text-slate-800">{r?.checkInAt ? formatTime(r.checkInAt) : '—'}</span>
                                      </p>
                                      <p className="flex justify-between gap-3 items-center">
                                        <span className="text-[9px] text-slate-400 font-bold uppercase">Out</span>
                                        <span className="font-bold text-slate-800">{r?.checkOutAt ? formatTime(r.checkOutAt) : '—'}</span>
                                      </p>
                                   </div>
                                </div>
                              </div>
                              
                              <ChevronRight className="h-4 w-4 text-slate-300 ml-2 shrink-0" />
                            </div>
                          </Link>
                        </li>
                      )
                   })}
                   {workersList.length === 0 && (
                     <div className="py-6 text-center">
                       <UserCircle className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                       <p className="text-[13px] font-bold text-slate-500">No workers found.</p>
                     </div>
                   )}
                 </ul>
              </div>
           </div>
         )
      })}
    </div>
  )
}
