import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin, Clock, Users, CheckCircle2, XCircle, AlertTriangle,
  Search, Filter, RefreshCw, Loader2, Eye, Calendar, Building2,
  User, ArrowUpRight, Timer, Activity, ChevronDown, ChevronUp, X
} from 'lucide-react'
import {
  useGetAdminEnterpriseAttendanceQuery,
  useGetAdminWorkerAttendanceDetailQuery,
} from '../../store/api/adminEnterpriseApi.js'
import toast from 'react-hot-toast'

const STATUS_COLORS = {
  present: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  absent: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  late: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  'half-day': 'bg-orange-50 text-orange-700 ring-orange-600/20',
  leave: 'bg-blue-50 text-blue-700 ring-blue-600/20',
}

export function AdminEnterpriseAttendancePage() {
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedWorker, setSelectedWorker] = useState(null)
  const [page, setPage] = useState(1)

  const { data: attendanceData, isLoading, refetch } = useGetAdminEnterpriseAttendanceQuery({
    date: dateFilter || undefined,
    status: statusFilter || undefined,
    page,
    limit: 50,
  })

  const { data: workerDetail } = useGetAdminWorkerAttendanceDetailQuery(
    { workerId: selectedWorker?._id || selectedWorker },
    { skip: !selectedWorker }
  )

  const records = attendanceData?.data?.records || (Array.isArray(attendanceData?.data) ? attendanceData.data : [])
  const summary = attendanceData?.data?.summary || attendanceData?.summary || {}
  const pagination = attendanceData?.data?.pagination || attendanceData?.pagination || {}

  const filteredRecords = records.filter((r) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      r.workerId?.fullName?.toLowerCase().includes(q) ||
      r.workerId?.phone?.includes(q) ||
      r.enterpriseId?.fullName?.toLowerCase().includes(q) ||
      r.enterpriseId?.enterpriseProfile?.companyName?.toLowerCase().includes(q) ||
      r.enterpriseJobId?.jobTitle?.toLowerCase().includes(q)
    )
  })

  const formatTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <Activity className="h-7 w-7 text-cyan-400" /> Live Enterprise Attendance
            </h1>
            <p className="text-slate-400 text-sm mt-1">Monitor real-time worker attendance across all enterprise clients</p>
          </div>
          <button onClick={refetch} className="flex items-center gap-2 px-4 py-2 bg-cyan-600/20 text-cyan-400 rounded-xl font-bold text-sm border border-cyan-500/30 hover:bg-cyan-600/30 transition-all">
            <RefreshCw className="h-4 w-4" /> Refresh Live Data
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          {[
            { label: 'Total Records', value: summary.totalRecords || 0, icon: Users, color: 'from-slate-600 to-slate-700' },
            { label: 'Today Total', value: summary.todayTotal || 0, icon: Calendar, color: 'from-indigo-600 to-indigo-700' },
            { label: 'Present', value: summary.todayPresent || 0, icon: CheckCircle2, color: 'from-emerald-600 to-emerald-700' },
            { label: 'Absent', value: summary.todayAbsent || 0, icon: XCircle, color: 'from-rose-600 to-rose-700' },
            { label: 'Late', value: summary.todayLate || 0, icon: AlertTriangle, color: 'from-amber-600 to-amber-700' },
            { label: 'Currently Working', value: summary.todayCheckedIn || 0, icon: Activity, color: 'from-cyan-600 to-cyan-700' },
            { label: 'Avg Hours', value: `${summary.avgHoursToday || 0}h`, icon: Timer, color: 'from-purple-600 to-purple-700' },
          ].map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`bg-gradient-to-br ${card.color} rounded-2xl p-3 border border-white/10`}
            >
              <card.icon className="h-4 w-4 text-white/60 mb-1" />
              <p className="text-xl font-black text-white">{card.value}</p>
              <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider">{card.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search worker, company, job..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setPage(1) }}
              className="px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-cyan-500/50 outline-none"
            />
            {dateFilter ? (
              <button
                type="button"
                onClick={() => { setDateFilter(''); setPage(1) }}
                className="px-3 py-2 bg-slate-700/80 hover:bg-slate-600 text-slate-300 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer"
              >
                Show All Dates
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setDateFilter(new Date().toISOString().split('T')[0]); setPage(1) }}
                className="px-3 py-2 bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer"
              >
                Today Only
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-cyan-500/50 outline-none"
          >
            <option value="">All Status</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="late">Late</option>
          </select>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            <span className="ml-3 text-slate-400 font-medium">Loading attendance data...</span>
          </div>
        )}

        {/* Attendance Table */}
        {!isLoading && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-900/60 text-slate-400 text-[11px] uppercase tracking-wider">
                    <th className="px-4 py-3 text-left font-bold">Worker</th>
                    <th className="px-4 py-3 text-left font-bold">Enterprise</th>
                    <th className="px-4 py-3 text-left font-bold">Job</th>
                    <th className="px-4 py-3 text-left font-bold">Date</th>
                    <th className="px-4 py-3 text-center font-bold">Check In</th>
                    <th className="px-4 py-3 text-center font-bold">Check Out</th>
                    <th className="px-4 py-3 text-center font-bold">Hours</th>
                    <th className="px-4 py-3 text-center font-bold">OT</th>
                    <th className="px-4 py-3 text-center font-bold">Status</th>
                    <th className="px-4 py-3 text-center font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="px-6 py-12 text-center text-slate-500">
                        <Users className="h-10 w-10 mx-auto mb-2 text-slate-600" />
                        <p className="font-bold">No attendance records found</p>
                        <p className="text-xs text-slate-600 mt-1">Try changing the date or filters</p>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r, idx) => {
                      const isLive = r.checkInAt && !r.checkOutAt
                      return (
                        <motion.tr
                          key={r._id || idx}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.02 }}
                          className={`hover:bg-slate-700/30 transition-colors ${isLive ? 'bg-cyan-900/10' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {r.workerId?.profileImageUrl ? (
                                <img src={r.workerId.profileImageUrl} className="h-8 w-8 rounded-full object-cover ring-2 ring-slate-600" alt="" />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center">
                                  <User className="h-4 w-4 text-slate-400" />
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-white text-xs">{r.workerId?.fullName || '—'}</p>
                                <p className="text-[10px] text-slate-500">{r.workerId?.phone || ''}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 text-slate-500" />
                              <span className="text-xs text-slate-300 font-medium">{r.enterpriseId?.enterpriseProfile?.companyName || r.enterpriseId?.fullName || '—'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-slate-300">{r.enterpriseJobId?.jobTitle || '—'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-slate-400">{r.shiftDate ? new Date(r.shiftDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs text-emerald-400 font-mono font-bold">{formatTime(r.checkInAt)}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isLive ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full ring-1 ring-cyan-500/30">
                                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" /> LIVE
                              </span>
                            ) : (
                              <span className="text-xs text-rose-400 font-mono font-bold">{formatTime(r.checkOutAt)}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs font-bold text-white">{r.totalHours ? `${Number(r.totalHours).toFixed(1)}h` : '—'}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs font-bold text-amber-400">{r.overtimeHours ? `${Number(r.overtimeHours).toFixed(1)}h` : '—'}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ring-1 ${STATUS_COLORS[r.attendanceStatus] || 'bg-slate-100 text-slate-700 ring-slate-600/20'}`}>
                              {r.attendanceStatus || 'unknown'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => setSelectedWorker(r.workerId)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                            >
                              <Eye className="h-3.5 w-3.5" /> Details
                            </button>
                          </td>
                        </motion.tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/40">
                <p className="text-xs text-slate-500">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} records)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 text-xs bg-slate-700 text-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-600 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                    disabled={page >= pagination.totalPages}
                    className="px-3 py-1.5 text-xs bg-slate-700 text-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-600 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Worker Detail Modal */}
        <AnimatePresence>
          {selectedWorker && workerDetail && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setSelectedWorker(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
              >
                {(() => {
                  const mData = workerDetail?.data || workerDetail || {}
                  const mWorker = mData.worker || workerDetail?.worker || {}
                  const mSummary = mData.summary || workerDetail?.summary || {}
                  const mRecords = mData.records || (Array.isArray(mData) ? mData : (Array.isArray(workerDetail?.data) ? workerDetail.data : []))

                  return (
                    <>
                      <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between z-10">
                        <div>
                          <h3 className="text-lg font-black text-white flex items-center gap-2">
                            <User className="h-5 w-5 text-cyan-400" />
                            {mWorker.fullName || 'Worker'} — Attendance Detail
                          </h3>
                          <p className="text-xs text-slate-400 mt-0.5">{mWorker.phone || ''}</p>
                        </div>
                        <button onClick={() => setSelectedWorker(null)} className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer">
                          <X className="h-5 w-5 text-slate-400" />
                        </button>
                      </div>

                      {/* Summary */}
                      <div className="px-6 py-4 grid grid-cols-3 sm:grid-cols-6 gap-3">
                        {[
                          { label: 'Total', value: mSummary.totalRecords || mRecords.length || 0 },
                          { label: 'Present', value: mSummary.presentDays || mRecords.filter(r => r.attendanceStatus === 'present' || r.checkInAt).length || 0 },
                          { label: 'Absent', value: mSummary.absentDays || 0 },
                          { label: 'Total Hrs', value: `${mSummary.totalHours || mRecords.reduce((s, r) => s + (r.totalHours || 0), 0).toFixed(1)}h` },
                          { label: 'OT Hrs', value: `${mSummary.totalOvertimeHours || 0}h` },
                          { label: 'Avg/Day', value: `${mSummary.avgHoursPerDay || (mRecords.length > 0 ? (mRecords.reduce((s, r) => s + (r.totalHours || 0), 0) / mRecords.length).toFixed(1) : 0)}h` },
                        ].map((s, i) => (
                          <div key={i} className="bg-slate-700/50 rounded-xl p-2.5 text-center">
                            <p className="text-lg font-black text-white">{s.value}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase">{s.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Daily Logs */}
                      <div className="px-6 pb-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Daily Attendance Logs</h4>
                        <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                          {mRecords.map((r, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-700/30 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400 font-mono w-16">
                            {r.shiftDate ? new Date(r.shiftDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase ring-1 ${STATUS_COLORS[r.attendanceStatus] || 'bg-slate-100 text-slate-700'}`}>
                            {r.attendanceStatus || '—'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-emerald-400 font-mono">{formatTime(r.checkInAt)}</span>
                          <span className="text-slate-600">→</span>
                          <span className="text-rose-400 font-mono">{formatTime(r.checkOutAt)}</span>
                          <span className="text-white font-bold w-10 text-right">{r.totalHours ? `${Number(r.totalHours).toFixed(1)}h` : '—'}</span>
                        </div>
                      </div>
                    ))}
                    {(!mRecords || mRecords.length === 0) && (
                      <p className="text-center text-slate-500 text-sm py-4">No attendance records found</p>
                    )}
                  </div>
                </div>
              </>
            )
          })()}
        </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}
