import { useState, useMemo } from 'react'
import { Clock, Users, CheckCircle, AlertCircle, Percent, Building2, Calendar } from 'lucide-react'
import { AppEmptyState } from '../../../components/app/AppEmptyState.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { useGetAttendanceMonitorQuery } from '../../../store/api/workforceApi.js'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getDateRange(preset) {
  const end = new Date()
  let start = new Date()
  if (preset === 'today') {
    // Both today
  } else if (preset === 'yesterday') {
    start.setDate(start.getDate() - 1)
    end.setDate(end.getDate() - 1)
  } else if (preset === 'last7') {
    start.setDate(start.getDate() - 6)
  } else if (preset === 'month') {
    start.setDate(1)
  }
  return { 
    startDate: start.toISOString().split('T')[0], 
    endDate: end.toISOString().split('T')[0] 
  }
}

export function CorporateAttendancePage() {
  const [datePreset, setDatePreset] = useState('today')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const queryParams = useMemo(() => {
    if (datePreset === 'custom') {
      return { startDate: customStart || undefined, endDate: customEnd || undefined }
    }
    return getDateRange(datePreset)
  }, [datePreset, customStart, customEnd])

  const { data: monitorData, isLoading, isError } = useGetAttendanceMonitorQuery(queryParams)
  
  const projects = monitorData?.projects ?? []

  // Top level aggregates
  let requiredCount = 0
  let assignedCount = 0
  let presentCount = 0
  let absentCount = 0

  projects.forEach(p => {
    requiredCount += p.requiredWorkers || 0
    assignedCount += p.assignedWorkers || 0
    presentCount += p.present || 0
    absentCount += p.absent || 0
  })

  const attendancePercentage = assignedCount > 0 ? Math.round((presentCount / assignedCount) * 100) : 0

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Operations</p>
          <h2 className="text-2xl font-extrabold text-slate-900">Attendance Monitoring</h2>
          <p className="mt-1 text-sm text-slate-600">Site-wise real-time logs for billing and tracking.</p>
        </div>
      </div>

      {/* Filters Bar */}
      <AppSurface className="p-4 flex flex-wrap items-end gap-4 border-slate-200">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" /> Date Range
          </label>
          <select
            value={datePreset}
            onChange={e => setDatePreset(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-brand"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7">Last 7 Days</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
        
        {datePreset === 'custom' && (
          <>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Start Date</label>
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-brand"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">End Date</label>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-brand"
              />
            </div>
          </>
        )}
      </AppSurface>

      {isLoading ? (
        <AppSurface>
          <p className="text-sm text-slate-500 p-4">Loading dashboard…</p>
        </AppSurface>
      ) : null}

      {isError ? (
        <AppSurface className="border-rose-200/90 bg-rose-50/40 p-4">
          <p className="text-sm font-semibold text-rose-800">Could not load attendance data.</p>
        </AppSurface>
      ) : null}

      {!isLoading && !isError && (
        <>
          {/* Dashboard Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <AppSurface className="p-4 flex flex-col justify-center items-center text-center border-b-4 border-b-slate-400">
              <Users className="h-6 w-6 text-slate-400 mb-2" />
              <p className="text-2xl font-black text-slate-900">{assignedCount} <span className="text-sm font-semibold text-slate-500">/ {requiredCount}</span></p>
              <p className="text-[10px] font-bold uppercase text-slate-500 mt-1">Assigned / Required</p>
            </AppSurface>
            <AppSurface className="p-4 flex flex-col justify-center items-center text-center border-b-4 border-b-brand">
              <CheckCircle className="h-6 w-6 text-brand mb-2" />
              <p className="text-2xl font-black text-slate-900">{presentCount}</p>
              <p className="text-[10px] font-bold uppercase text-slate-500 mt-1">Present Workers</p>
            </AppSurface>
            <AppSurface className="p-4 flex flex-col justify-center items-center text-center border-b-4 border-b-rose-500">
              <AlertCircle className="h-6 w-6 text-rose-500 mb-2" />
              <p className="text-2xl font-black text-slate-900">{absentCount}</p>
              <p className="text-[10px] font-bold uppercase text-slate-500 mt-1">Absent Workers</p>
            </AppSurface>
            <AppSurface className="p-4 flex flex-col justify-center items-center text-center border-b-4 border-b-indigo-500">
              <Percent className="h-6 w-6 text-indigo-500 mb-2" />
              <p className="text-2xl font-black text-slate-900">{attendancePercentage}%</p>
              <p className="text-[10px] font-bold uppercase text-slate-500 mt-1">Attendance Rate</p>
            </AppSurface>
          </div>

          <h3 className="text-lg font-bold text-slate-900 mt-8 mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-slate-400" />
            Project Attendance Logs
          </h3>
          
          {projects.length === 0 ? (
            <AppEmptyState icon={Clock} title="No active projects" subtitle="There are no active workforce assignments to display." />
          ) : (
            <div className="space-y-6">
              {projects.map(project => {
                const projectAttPercentage = project.assignedWorkers > 0 
                  ? Math.round((project.present / project.assignedWorkers) * 100) 
                  : 0

                return (
                  <AppSurface key={project.projectId} className="overflow-hidden border border-slate-200">
                    {/* Project Header */}
                    <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h4 className="text-lg font-black text-slate-900">{project.projectName}</h4>
                        <div className="flex flex-wrap gap-4 mt-2">
                          <p className="text-xs font-semibold text-slate-600">Required: <span className="text-slate-900">{project.requiredWorkers}</span></p>
                          <p className="text-xs font-semibold text-slate-600">Assigned: <span className="text-slate-900">{project.assignedWorkers}</span></p>
                          <p className="text-xs font-semibold text-emerald-600">Present (in range): <span className="text-emerald-700">{project.present}</span></p>
                          <p className="text-xs font-semibold text-rose-600">Absent (in range): <span className="text-rose-700">{project.absent}</span></p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-slate-900">{projectAttPercentage}%</p>
                        <p className="text-[10px] font-bold uppercase text-slate-500">Attendance</p>
                      </div>
                    </div>

                    {/* Attendance List */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 bg-white">
                            <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">Worker</th>
                            <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">Role</th>
                            <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 min-w-[250px]">Attendance History (Range)</th>
                            <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">Current Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 bg-white">
                          {project.workers.map(w => {
                            const hasRecords = w.records && w.records.length > 0
                            
                            const isWorking = w.status === 'working'
                            const isCompleted = w.status === 'completed'
                            const isAbsent = w.status === 'Absent'

                            return (
                              <tr key={w.assignmentId} className="hover:bg-slate-50 transition-colors align-top">
                                <td className="py-4 px-4 text-sm font-bold text-slate-900 whitespace-nowrap">{w.workerName}</td>
                                <td className="py-4 px-4 text-xs font-medium text-slate-600 whitespace-nowrap">{w.role}</td>
                                <td className="py-4 px-4">
                                  {!hasRecords ? (
                                    <p className="text-xs font-bold text-rose-500">No check-ins (Absent)</p>
                                  ) : (
                                    <ul className="space-y-2">
                                      {w.records.map(r => (
                                        <li key={r._id} className="bg-slate-50 border border-slate-100 rounded-lg p-2 flex items-center justify-between max-w-sm">
                                          <div>
                                            <p className="text-xs font-bold text-slate-800">{formatDate(r.shiftDate)}</p>
                                            <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                                              {r.checkInAt ? formatTime(r.checkInAt) : '—'} - {r.checkOutAt ? formatTime(r.checkOutAt) : '—'} 
                                              {r.totalHours != null && <span className="font-bold text-slate-700 ml-2">({r.totalHours}h)</span>}
                                            </p>
                                          </div>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </td>
                                <td className="py-4 px-4 whitespace-nowrap">
                                  <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                    isWorking ? 'bg-sky-100 text-sky-700' :
                                    isCompleted ? 'bg-emerald-100 text-emerald-700' :
                                    isAbsent ? 'bg-rose-100 text-rose-700' :
                                    'bg-slate-100 text-slate-600'
                                  }`}>
                                    {w.status}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                          {project.workers.length === 0 && (
                            <tr>
                              <td colSpan={4} className="py-4 text-center text-sm text-slate-500">No workers assigned</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </AppSurface>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
