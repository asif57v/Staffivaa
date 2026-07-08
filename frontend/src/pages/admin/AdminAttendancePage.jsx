import { useState, useMemo } from 'react'
import { Clock, Building2, Calendar, Filter, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { useGetAttendanceMonitorQuery, useVerifyAttendanceMutation } from '../../store/api/workforceApi.js'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'

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

export function AdminAttendancePage() {
  const [datePreset, setDatePreset] = useState('today')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [expandedProjectIds, setExpandedProjectIds] = useState(new Set())

  const queryParams = useMemo(() => {
    if (datePreset === 'custom') {
      return { startDate: customStart || undefined, endDate: customEnd || undefined }
    }
    return getDateRange(datePreset)
  }, [datePreset, customStart, customEnd])

  const { data: monitorData, isLoading, isError } = useGetAttendanceMonitorQuery(queryParams)
  const [verify, { isLoading: verifying }] = useVerifyAttendanceMutation()
  
  const projects = monitorData?.projects ?? []

  const handleVerify = async (id) => {
    try {
      await verify({ id, status: 'present' }).unwrap()
    } catch {
      // Ignore
    }
  }

  const toggleProject = (projectId) => {
    setExpandedProjectIds(prev => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  return (
    <div className="w-full space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Platform Attendance Monitoring</h1>
        <p className="mt-2 text-sm text-slate-600">Complete workforce visibility across all corporate clients and vendors.</p>
      </div>

      {/* Filters Bar */}
      <GlassPanel className="p-4 flex flex-wrap items-end gap-4 border-slate-200">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" /> Date Range
          </label>
          <select
            value={datePreset}
            onChange={e => setDatePreset(e.target.value)}
            className="w-full rounded-xl border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none ring-brand/50 focus:border-brand focus:ring-2"
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
                className="w-full rounded-xl border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none ring-brand/50 focus:border-brand focus:ring-2"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">End Date</label>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="w-full rounded-xl border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none ring-brand/50 focus:border-brand focus:ring-2"
              />
            </div>
          </>
        )}
      </GlassPanel>

      {isLoading ? (
        <GlassPanel className="p-6">
          <p className="text-sm text-slate-500">Loading platform attendance data…</p>
        </GlassPanel>
      ) : null}

      {isError ? (
        <GlassPanel className="p-6 text-rose-800">Could not load attendance data.</GlassPanel>
      ) : null}

      {!isLoading && !isError && projects.length === 0 && (
        <GlassPanel className="p-10 text-center">
          <Clock className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900">No Attendance Records</h3>
          <p className="text-sm text-slate-500 mt-1">No workforce assignments or attendance found for the selected date range.</p>
        </GlassPanel>
      )}

      {!isLoading && !isError && projects.length > 0 && (
        <div className="space-y-4">
          {projects.map(project => {
            const isExpanded = expandedProjectIds.has(project.projectId)

            return (
              <GlassPanel key={project.projectId} className="overflow-hidden border border-slate-200 p-0 transition-all">
                <div 
                  className="bg-white p-5 cursor-pointer hover:bg-slate-50 transition flex flex-col md:flex-row md:items-center justify-between gap-4 select-none"
                  onClick={() => toggleProject(project.projectId)}
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600 ring-1 ring-indigo-100">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-extrabold text-slate-900">{project.projectName}</h4>
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{formatDate(queryParams.startDate)} — {formatDate(queryParams.endDate)}</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-600">
                          Assigned: <span className="text-slate-900">{project.assignedWorkers}</span>
                        </p>
                        <div className="h-1 w-1 rounded-full bg-slate-300" />
                        <p className="text-xs font-semibold text-slate-600">
                          Present: <span className="text-emerald-600">{project.present}</span>
                        </p>
                        <div className="h-1 w-1 rounded-full bg-slate-300" />
                        <p className="text-xs font-semibold text-slate-600">
                          Absent: <span className="text-rose-600">{project.absent}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-slate-50 text-slate-400 group-hover:bg-slate-100 transition">
                    {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="overflow-x-auto border-t border-slate-100 bg-slate-50/50">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-white">
                      <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Worker</th>
                      <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Role</th>
                      <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Attendance History (Range)</th>
                      <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 bg-white">
                    {project.workers.map(w => {
                      const hasRecords = w.records && w.records.length > 0

                      return (
                        <tr key={w.assignmentId} className="hover:bg-slate-50/50 transition-colors align-top">
                          <td className="py-4 px-4 text-sm font-bold text-slate-900">{w.workerName}</td>
                          <td className="py-4 px-4 text-xs font-medium text-slate-600">{w.role}</td>
                          <td className="py-4 px-4">
                            {!hasRecords ? (
                              <p className="text-xs font-bold text-rose-500">No check-ins (Absent)</p>
                            ) : (
                              <ul className="space-y-2">
                                {w.records.map(r => (
                                  <li key={r._id} className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 flex items-center justify-between max-w-sm">
                                    <div>
                                      <p className="text-xs font-bold text-slate-800">{formatDate(r.shiftDate)}</p>
                                      <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                                        {r.checkInAt ? formatTime(r.checkInAt) : '—'} - {r.checkOutAt ? formatTime(r.checkOutAt) : '—'} 
                                        {r.totalHours != null && <span className="font-bold text-slate-700 ml-2">({r.totalHours}h)</span>}
                                      </p>
                                    </div>
                                    <div>
                                      {!r.verifiedAt ? (
                                        <button 
                                          type="button" 
                                          onClick={() => handleVerify(r._id)}
                                          disabled={verifying}
                                          className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-800"
                                        >
                                          Verify
                                        </button>
                                      ) : (
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                                          <CheckCircle className="h-3 w-3" /> Verified
                                        </span>
                                      )}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              w.status === 'working' ? 'bg-sky-100 text-sky-700' :
                              w.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              'bg-rose-100 text-rose-700'
                            }`}>
                              {w.status}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                    {project.workers.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-sm text-slate-500">No assigned workers</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
                )}
              </GlassPanel>
            )
          })}
        </div>
      )}
    </div>
  )
}
