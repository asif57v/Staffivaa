import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Phone, CalendarDays, MapPin, Clock, Download, CheckCircle2, AlertCircle, Play, Building2, UserCircle } from 'lucide-react'
import { useGetAttendanceMonitorQuery } from '../../../store/api/workforceApi.js'

function formatDateLong(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function WorkerAttendanceHistoryView({ basePath = '/vendor' }) {
  const { projectId, workerId } = useParams()
  const navigate = useNavigate()
  
  // We can fetch a broad range to get the monthly calendar data
  const queryParams = useMemo(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(1) // beginning of month
    return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0], projectId }
  }, [projectId])

  const { data: monitorData, isLoading } = useGetAttendanceMonitorQuery(queryParams)
  const projects = monitorData?.projects ?? []
  
  const project = projects.find(p => p.projectId === projectId)
  const worker = project?.workers?.find(w => String(w.workerId) === String(workerId))
  
  // Get today's record specifically
  const todayStr = new Date().toLocaleDateString()
  const todayRecord = worker?.records?.find(r => new Date(r.shiftDate).toLocaleDateString() === todayStr)

  if (isLoading) {
    return <div className="p-8 text-center text-[13px] font-bold text-slate-500">Loading worker details...</div>
  }

  if (!worker || !project) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-bold mb-4">Worker details not found.</p>
        <button onClick={() => navigate(-1)} className="text-brand font-bold underline">Go back</button>
      </div>
    )
  }

  const latestRecord = worker.records?.[0]
  let status = latestRecord?.attendanceStatus || worker.status
  if (status === 'working' || status === 'completed') status = 'Present'
  if (!status) status = 'Absent'

  let statusTone = status === 'Present' || status === 'Half Day' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                   status === 'Absent' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                   status === 'Late' ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                   'bg-violet-50 text-violet-700 border-violet-100'
                   
  let StatusIcon = status === 'Present' || status === 'Half Day' ? CheckCircle2 :
                   status === 'Absent' ? AlertCircle :
                   status === 'Late' ? Clock : CalendarDays

  // Real Monthly Calendar data calculation
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  
  // Create a map of dates to records for easy lookup
  const recordMap = {}
  let totalPresent = 0
  let totalAbsent = 0
  let totalLate = 0
  let totalWeeklyOff = 0
  let totalHoursSum = 0
  let daysWithHours = 0

  if (worker.records) {
    worker.records.forEach(r => {
       const dateKey = new Date(r.shiftDate).getDate()
       recordMap[dateKey] = r

       const st = r.attendanceStatus || (r.projectStatus === 'completed' || r.projectStatus === 'working' ? 'Present' : 'Absent')
       if (st === 'Present' || st === 'Half Day') totalPresent++
       else if (st === 'Absent') totalAbsent++
       else if (st === 'Late') totalLate++
       else if (st === 'Weekly Off') totalWeeklyOff++

       if (r.totalHours) {
         totalHoursSum += r.totalHours
         daysWithHours++
       }
    })
  }

  // Generate calendar days
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const avgHours = daysWithHours > 0 ? (totalHoursSum / daysWithHours).toFixed(1) : 0

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Header */}
      <header className="bg-white px-4 py-4 sticky top-0 z-30 shadow-sm border-b border-slate-100 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-slate-100 transition hover:bg-slate-50 active:scale-95">
          <ChevronLeft className="h-5 w-5 text-slate-600" />
        </button>
        <h1 className="text-[16px] font-extrabold text-slate-900">Worker Attendance Details</h1>
      </header>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        {/* Worker Info Card */}
        <div className="rounded-[20px] bg-white p-4 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] border border-slate-100 flex items-center gap-4">
          <div className="relative h-16 w-16 shrink-0 rounded-[14px] bg-slate-200 shadow-sm overflow-hidden border border-slate-100">
            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(worker.workerName)}&background=random`} alt={worker.workerName} className="h-full w-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start mb-0.5">
              <h2 className="text-[16px] font-black text-slate-900 truncate pr-2">{worker.workerName}</h2>
              <span className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${statusTone}`}>
                <div className={`h-1.5 w-1.5 rounded-full ${status === 'Present' || status === 'Half Day' ? 'bg-emerald-500' : 'bg-current'}`} /> Active
              </span>
            </div>
            <p className="text-[12px] font-bold text-slate-500 mb-1.5 truncate">{worker.role}</p>
            <p className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
              <Phone className="h-3 w-3 text-slate-400" /> {worker.phone || 'Phone not available'}
            </p>
          </div>
        </div>

        {/* Project Card */}
        <div className="rounded-[20px] bg-white p-4 shadow-sm border border-slate-100 flex items-center gap-3">
          <div className="h-16 w-20 shrink-0 rounded-[14px] bg-slate-200 overflow-hidden border border-slate-100">
            <img src="https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=200&q=80" alt="Project Cover" className="h-full w-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-black text-slate-900 truncate mb-1">{project.projectName}</p>
            <div className="flex items-center gap-1 text-slate-500 mb-1">
              <Building2 className="h-3 w-3 shrink-0" />
              <p className="text-[11px] font-bold truncate">{project.corporateName || 'Corporate Client'}</p>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <MapPin className="h-3 w-3 shrink-0" />
              <p className="text-[10px] font-bold truncate">{project.projectLocation || 'Location TBD'}</p>
            </div>
          </div>
        </div>

        {/* Monthly Summary Statistics */}
        <div>
          <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-3 ml-1 flex items-center gap-1.5">
             <CalendarDays className="h-3.5 w-3.5" /> Monthly Summary
          </h4>
          <div className="grid grid-cols-4 gap-2">
             <div className="rounded-[16px] bg-emerald-50/70 border border-emerald-100 p-3 text-center">
               <p className="text-xl font-black text-slate-900">{totalPresent}</p>
               <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-wide">Present</p>
             </div>
             <div className="rounded-[16px] bg-rose-50/70 border border-rose-100 p-3 text-center">
               <p className="text-xl font-black text-slate-900">{totalAbsent}</p>
               <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-wide">Absent</p>
             </div>
             <div className="rounded-[16px] bg-amber-50/70 border border-amber-100 p-3 text-center">
               <p className="text-xl font-black text-slate-900">{totalLate}</p>
               <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-wide">Late</p>
             </div>
             <div className="rounded-[16px] bg-violet-50/70 border border-violet-100 p-3 text-center">
               <p className="text-xl font-black text-slate-900">{totalWeeklyOff}</p>
               <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-wide">Off</p>
             </div>
             
             {/* Average hours full width */}
             <div className="col-span-4 flex items-center justify-between rounded-[16px] bg-white border border-slate-100 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span className="text-[12px] font-bold uppercase tracking-wider">Average Working Hours</span>
                </div>
                <span className="text-[16px] font-black text-slate-900">{avgHours}h / day</span>
             </div>
          </div>
        </div>

        {/* Monthly Calendar */}
        <div className="rounded-[20px] bg-white p-4 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] border border-slate-100">
          <div className="flex items-center justify-between mb-4 px-2">
            <button className="p-1.5 hover:bg-slate-50 rounded-[10px] border border-slate-100 transition active:scale-95">
              <ChevronLeft className="h-4 w-4 text-slate-400" />
            </button>
            <h3 className="text-[14px] font-black text-slate-900">{now.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
            <button className="p-1.5 hover:bg-slate-50 rounded-[10px] border border-slate-100 transition active:scale-95">
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          </div>
          
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1.5 text-center mb-4">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="text-[10px] font-black uppercase tracking-wider text-slate-400 pb-2">{d}</div>
            ))}
            
            {/* Blank spaces for the first day of month (simple approximation) */}
            {Array.from({ length: (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7 }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            
            {calendarDays.map((d) => {
              const r = recordMap[d]
              const st = r?.attendanceStatus || (r?.projectStatus === 'completed' || r?.projectStatus === 'working' ? 'Present' : null)
              
              const isToday = d === now.getDate()
              
              let dotColor = 'bg-transparent'
              if (st === 'Present' || st === 'Half Day') dotColor = 'bg-emerald-500'
              else if (st === 'Absent') dotColor = 'bg-rose-500'
              else if (st === 'Late') dotColor = 'bg-amber-500'
              else if (st === 'Weekly Off') dotColor = 'bg-violet-500'

              return (
                <div key={d} className="flex flex-col items-center justify-center py-1 gap-1">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-[10px] text-[12px] font-bold transition-all ${isToday ? 'bg-slate-900 text-white shadow-md' : 'text-slate-700 bg-slate-50/50 border border-slate-100/50'}`}>
                    {d}
                  </div>
                  <div className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                </div>
              )
            })}
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-3 text-[9px] font-black text-slate-500 border-t border-slate-100 pt-3 uppercase tracking-wider">
            <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-emerald-500" /> Present</span>
            <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-rose-500" /> Absent</span>
            <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-amber-500" /> Late</span>
            <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-violet-500" /> Off</span>
          </div>
        </div>

        {/* Daily Summary (Today or Selected) */}
        {todayRecord && (
          <div>
            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-3 ml-1">Today's Timeline ({formatDateLong(todayRecord.shiftDate)})</h4>
            <div className="rounded-[20px] bg-white p-5 shadow-sm border border-slate-100">
              <div className="relative pl-6 space-y-6">
                <div className="absolute left-[11px] top-2 bottom-2 w-px bg-slate-100" />
                
                {todayRecord.checkInAt && (
                  <div className="relative">
                    <div className="absolute -left-[30px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 border-[3px] border-white shadow-sm z-10">
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    </div>
                    <div className="flex gap-3">
                      <p className="text-[12px] font-black text-slate-700 w-16 pt-0.5">{formatTime(todayRecord.checkInAt)}</p>
                      <div>
                        <p className="text-[13px] font-black text-slate-900 mb-1">Checked In</p>
                        <p className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                          <MapPin className="h-3 w-3 text-emerald-500" /> <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-100">GPS Verified</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {todayRecord.checkOutAt && (
                  <div className="relative">
                    <div className="absolute -left-[30px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 border-[3px] border-white shadow-sm z-10">
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    </div>
                    <div className="flex gap-3">
                      <p className="text-[12px] font-black text-slate-700 w-16 pt-0.5">{formatTime(todayRecord.checkOutAt)}</p>
                      <div>
                        <p className="text-[13px] font-black text-slate-900 mb-1">Checked Out</p>
                        <p className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                           <Clock className="h-3 w-3 text-slate-400" /> Total: <span className="text-slate-700">{todayRecord.totalHours} hrs</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {!todayRecord.checkInAt && !todayRecord.checkOutAt && (
                   <div className="text-center text-[12px] font-bold text-slate-500 py-2">
                     No timeline events recorded today.
                   </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* All Attendance Records List */}
        <div>
          <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-800 mb-3 mt-4 ml-1">Attendance Records</h4>
          <div className="space-y-3">
            {worker.records && worker.records.length > 0 ? worker.records.map((r, i) => {
              const d = new Date(r.shiftDate)
              const dayStr = d.toLocaleDateString('en-GB', { weekday: 'short' })
              const dateStr = formatDateLong(d)
              
              const st = r.attendanceStatus || (r.projectStatus === 'completed' || r.projectStatus === 'working' ? 'Present' : 'Absent')
              const tone = st === 'Present' || st === 'Half Day' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                           st === 'Weekly Off' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 
                           st === 'Late' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 
                           'bg-rose-50 text-rose-600 border border-rose-100'
                           
              const Icon = st === 'Weekly Off' ? CalendarDays : 
                           st === 'Late' ? Clock : 
                           st === 'Absent' ? AlertCircle : CheckCircle2
                           
              const timeStr = r.checkInAt && r.checkOutAt ? `${formatTime(r.checkInAt)} - ${formatTime(r.checkOutAt)}` :
                              r.checkInAt ? `${formatTime(r.checkInAt)} - Present` : '—'

              return (
                <div key={r._id || i} className="flex items-center justify-between rounded-[16px] bg-white p-4 shadow-sm border border-slate-100 transition active:scale-[0.99]">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-[13px] font-black text-slate-900">{dateStr}</p>
                      <p className="text-[10px] font-bold text-slate-400">{dayStr}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-[9px] font-black uppercase ${tone}`}>
                        <Icon className="h-2.5 w-2.5" /> {st}
                      </span>
                      <p className="text-[10px] font-bold text-slate-500">{timeStr}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {r.totalHours && <p className="text-[12px] font-black text-slate-800 bg-slate-50 px-2 py-1 rounded border border-slate-100">{r.totalHours}h</p>}
                  </div>
                </div>
              )
            }) : (
              <div className="rounded-[16px] bg-white p-6 text-center border border-slate-100 shadow-sm">
                <CalendarDays className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                <p className="text-[12px] font-bold text-slate-500">No attendance records found for this month.</p>
              </div>
            )}
          </div>
        </div>

        {/* Download Button */}
        {worker.records && worker.records.length > 0 && (
          <button 
            className="w-full mt-6 mb-4 flex items-center justify-center gap-2 rounded-[16px] bg-amber-50 py-4 text-[13px] font-black text-amber-700 border border-amber-100 transition hover:bg-amber-100 active:scale-95"
          >
            <Download className="h-4 w-4" strokeWidth={3} /> Download Full History
          </button>
        )}

      </div>
    </div>
  )
}
