import { useState, useMemo, useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import {
  useGetLabourAssignmentsQuery,
  useCheckInMutation,
  useCheckOutMutation,
  useGetAttendanceQuery,
} from '../../store/api/workforceApi.js'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { LogIn, LogOut, MapPin, Clock, Building2, Briefcase, UserCircle, CalendarDays, History } from 'lucide-react'

// Helper to format date
const formatDate = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Helper to get YYYY-MM-DD in local time
const getLocalDateStr = (d) => {
  if (!d) return ''
  const date = new Date(d)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Component to handle live duration ticking
function LiveDuration({ checkInAt }) {
  const [elapsedStr, setElapsedStr] = useState('')

  useEffect(() => {
    if (!checkInAt) return
    const update = () => {
      const diffMs = new Date() - new Date(checkInAt)
      if (diffMs < 0) return setElapsedStr('00h 00m')
      const totalMins = Math.floor(diffMs / 60000)
      const h = Math.floor(totalMins / 60)
      const m = totalMins % 60
      setElapsedStr(`${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`)
    }
    update()
    const intv = setInterval(update, 60000) // Update every minute
    return () => clearInterval(intv)
  }, [checkInAt])

  return <span className="font-bold text-slate-900">{elapsedStr}</span>
}

export function AppAttendancePage() {
  const reduce = useReducedMotion()
  const [toast, setToast] = useState('')
  const { data: assignmentsData, isLoading: loadingAssignments } = useGetLabourAssignmentsQuery()
  
  // Fetch ALL historical attendance records for this worker, without date filtering
  const { data: attendanceData, isLoading: loadingAttendance } = useGetAttendanceQuery()
  
  const [checkIn, { isLoading: isCheckingIn }] = useCheckInMutation()
  const [checkOut, { isLoading: isCheckingOut }] = useCheckOutMutation()

  const assignments = assignmentsData?.assignments ?? []
  const records = attendanceData?.records ?? []

  const showToast = (msg) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2400)
  }

  const handleCheckIn = async (assignmentId) => {
    try {
      await checkIn({ assignmentId, lat: 28.5355, lng: 77.3910 }).unwrap()
      showToast('Checked in successfully.')
    } catch (err) {
      showToast(err?.data?.message || 'Failed to check in.')
    }
  }

  const handleCheckOut = async (assignmentId) => {
    try {
      await checkOut({ assignmentId }).unwrap()
      showToast('Checked out successfully.')
    } catch (err) {
      showToast(err?.data?.message || 'Failed to check out.')
    }
  }

  if (loadingAssignments || loadingAttendance) {
    return <div className="p-4 text-center text-slate-500">Loading attendance...</div>
  }

  const todayStr = getLocalDateStr(new Date())

  // Visibility Rule: Show if accepted/on_site AND current date is not past project end date.
  const activeAssignments = assignments.filter((a) => {
    if (a.status !== 'accepted' && a.status !== 'on_site') return false
    
    // If there is an end date, hide it if today is past the end date
    if (a.requestId?.endDate) {
      const endStr = getLocalDateStr(a.requestId.endDate)
      if (todayStr > endStr) return false
    }
    return true
  })

  return (
    <div className="space-y-4 pb-8">
      <AnimatePresence>
        {toast ? (
          <motion.p
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0 }}
            className="fixed left-4 right-4 top-[max(4.5rem,env(safe-area-inset-top))] z-[120] mx-auto max-w-md rounded-2xl border border-sky-300/40 bg-sky-900/95 px-4 py-3 text-center text-sm font-semibold text-white shadow-xl"
            role="status"
          >
            {toast}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Attendance</h1>
        <p className="mt-2 text-sm text-slate-600">Your assigned active projects.</p>
      </div>

      {activeAssignments.length === 0 ? (
        <GlassPanel className="p-6 text-center">
          <p className="text-sm text-slate-500">You don't have any active assignments to check in to.</p>
        </GlassPanel>
      ) : (
        <div className="space-y-6">
          {activeAssignments.map((assignment) => {
            const req = assignment.requestId || {}
            const corporateName = req.clientId?.corporateProfile?.companyName || req.clientId?.fullName || 'Corporate Client'
            const vendorName = assignment.vendorId?.contractorProfile?.businessName || assignment.vendorId?.fullName || 'Vendor'
            const roleName = assignment.categoryId?.name || req.lines?.[0]?.categoryId?.name || 'Worker'
            const locationStr = req.locationText || req.siteId?.address || 'Location not specified'
            const shiftStr = (req.shiftStart && req.shiftEnd) ? `${req.shiftStart} - ${req.shiftEnd}` : 'Not specified'
            
            // All records for this assignment
            const assignmentRecords = records.filter(r => r.assignmentId === assignment._id)
            
            // Identify today's record
            const todayRecord = assignmentRecords.find(r => getLocalDateStr(r.shiftDate) === todayStr)
            
            // Identify history records (sorted descending, omitting today)
            const historyRecords = assignmentRecords
              .filter(r => getLocalDateStr(r.shiftDate) < todayStr)
              .sort((a, b) => new Date(b.shiftDate) - new Date(a.shiftDate))
            
            // Today's Status
            const isCheckedIn = todayRecord && todayRecord.projectStatus === 'working'
            const isCompleted = todayRecord && todayRecord.projectStatus === 'completed'
            const isNotCheckedIn = !isCheckedIn && !isCompleted

            return (
              <GlassPanel key={assignment._id} className={`overflow-hidden border-2 shadow-sm ${isCheckedIn ? 'border-brand/50' : isCompleted ? 'border-emerald-300' : 'border-slate-200'}`}>
                {/* Header: Company Name */}
                <div className={`px-4 py-3 border-b border-slate-100 flex items-center gap-3 ${isCheckedIn ? 'bg-brand/5' : isCompleted ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                  <div className={`p-2 rounded-lg ${isCheckedIn ? 'bg-brand/10 text-brand' : isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-600'}`}>
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">{corporateName}</h3>
                  </div>
                </div>

                {/* Details Section */}
                <div className="p-4 space-y-4">
                  
                  {/* Role & Vendor */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1">
                        <Briefcase className="h-3 w-3" /> Role / Skill
                      </p>
                      <p className="text-sm font-bold text-slate-800">{roleName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1">
                        <UserCircle className="h-3 w-3" /> Assigned By
                      </p>
                      <p className="text-sm font-bold text-slate-800">{vendorName}</p>
                    </div>
                  </div>

                  {/* Location */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1">
                      <MapPin className="h-3 w-3" /> Location
                    </p>
                    <p className="text-sm font-medium text-slate-700">{locationStr}</p>
                  </div>

                  {/* Timing & Duration */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1">
                        <Clock className="h-3 w-3" /> Shift Timing
                      </p>
                      <p className="text-sm font-medium text-slate-700">{shiftStr}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1">
                        <CalendarDays className="h-3 w-3" /> Duration
                      </p>
                      <p className="text-sm font-medium text-slate-700">
                        {formatDate(req.startDate)} - {req.endDate ? formatDate(req.endDate) : 'Ongoing'}
                      </p>
                    </div>
                  </div>

                  <hr className="border-slate-100 my-4" />

                  {/* Today's Attendance Block */}
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-800 mb-3">Today's Attendance</p>
                    
                    {/* Checked In Info */}
                    {(isCheckedIn || isCompleted) && (
                      <div className="bg-slate-50 p-3 rounded-xl grid grid-cols-3 gap-3 mb-4 border border-slate-100">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Check In</p>
                          <p className="text-sm font-bold text-slate-900">
                            {todayRecord.checkInAt ? new Date(todayRecord.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Check Out</p>
                          <p className="text-sm font-bold text-slate-900">
                            {todayRecord.checkOutAt ? new Date(todayRecord.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            {isCompleted ? 'Hours Worked' : 'Working Time'}
                          </p>
                          {isCompleted && todayRecord.totalHours != null ? (
                            <p className="text-sm font-bold text-slate-900">{todayRecord.totalHours}h</p>
                          ) : isCheckedIn && todayRecord.checkInAt ? (
                            <p className="text-sm"><LiveDuration checkInAt={todayRecord.checkInAt} /></p>
                          ) : (
                            <p className="text-sm font-bold text-slate-900">—</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Status & Actions */}
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Today's Status</p>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${
                          isCompleted ? 'bg-emerald-100 text-emerald-700' :
                          isCheckedIn ? 'bg-brand/15 text-brand animate-pulse' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {isCompleted ? 'Completed' : isCheckedIn ? 'Working' : 'Not Checked In'}
                        </span>
                      </div>

                      <div className="flex-1 flex justify-end">
                        {!isCompleted && (
                          !isCheckedIn ? (
                            <AppPrimaryButton
                              type="button"
                              className="w-full sm:w-auto px-6 py-2.5"
                              loading={isCheckingIn}
                              onClick={() => handleCheckIn(assignment._id)}
                            >
                              <LogIn className="h-4 w-4 mr-2" />
                              Check In
                            </AppPrimaryButton>
                          ) : (
                            <button
                              type="button"
                              disabled={isCheckingOut}
                              onClick={() => handleCheckOut(assignment._id)}
                              className="w-full sm:w-auto px-6 py-2.5 flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                            >
                              <LogOut className="h-4 w-4 text-slate-600" />
                              Check Out
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Attendance History Section */}
                  {historyRecords.length > 0 && (
                    <div className="pt-4 mt-4 border-t border-slate-100">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 mb-3">
                        <History className="h-3.5 w-3.5 text-slate-400" /> Attendance History
                      </p>
                      <ul className="space-y-2">
                        {historyRecords.map(r => (
                          <li key={r._id} className="bg-slate-50/80 border border-slate-100 rounded-lg p-3 flex justify-between items-center">
                            <div>
                              <p className="text-xs font-bold text-slate-900">{formatDate(r.shiftDate)}</p>
                              <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                                {r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'} 
                                {' - '}
                                {r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                r.attendanceStatus === 'present' ? 'bg-emerald-100 text-emerald-700' :
                                r.attendanceStatus === 'absent' ? 'bg-rose-100 text-rose-700' :
                                'bg-slate-200 text-slate-700'
                              }`}>
                                {r.attendanceStatus}
                              </span>
                              {r.totalHours != null && (
                                <p className="text-[10px] font-bold text-slate-800 mt-1">{r.totalHours}h</p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                </div>
              </GlassPanel>
            )
          })}
        </div>
      )}
    </div>
  )
}
