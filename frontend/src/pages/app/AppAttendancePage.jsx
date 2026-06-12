import { useState, useMemo, useEffect, useCallback } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import {
  useGetLabourAssignmentsQuery,
  useCheckInMutation,
  useCheckOutMutation,
  useGetAttendanceQuery,
} from '../../store/api/workforceApi.js'
import {
  loadJobDemoState,
  subscribeJobDemo,
  saveJobDemoState,
  nowIso,
} from '../../lib/labourJobDemoStorage.js'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { LogIn, LogOut, MapPin, Clock, Building2, Briefcase, UserCircle, CalendarDays, History } from 'lucide-react'

function isApiAssignment(job) {
  return Boolean(job?.requestId) && /^[a-f0-9]{24}$/i.test(String(job.id))
}

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
  const [selectedDay, setSelectedDay] = useState(new Date().getDate())
  
  const { data: assignmentsData, isLoading: loadingAssignments, refetch } = useGetLabourAssignmentsQuery()
  
  // Fetch ALL historical attendance records for this worker, without date filtering
  const { data: attendanceData, isLoading: loadingAttendance } = useGetAttendanceQuery()
  
  const [localDemo, setLocalDemo] = useState(() => loadJobDemoState())
  useEffect(() => subscribeJobDemo(setLocalDemo), [])
  
  const [checkIn, { isLoading: isCheckingIn }] = useCheckInMutation()
  const [checkOut, { isLoading: isCheckingOut }] = useCheckOutMutation()

  const assignments = assignmentsData?.assignments ?? []
  const records = attendanceData?.records ?? []

  const showToast = useCallback((msg) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2400)
  }, [])

  const persistDemo = useCallback((next) => {
    saveJobDemoState(next)
    setLocalDemo(next)
  }, [])

  const handleCheckIn = async (assignmentId, isDemo) => {
    if (isDemo) {
      persistDemo({
        ...localDemo,
        active: localDemo.active.map((a) => (a.id === assignmentId ? { ...a, status: 'on_site', onSiteAt: nowIso() } : a)),
      })
      showToast('Checked in successfully.')
      return
    }
    try {
      await checkIn({ assignmentId, lat: 28.5355, lng: 77.3910 }).unwrap()
      refetch()
      showToast('Checked in successfully.')
    } catch (err) {
      showToast(err?.data?.message || 'Failed to check in.')
    }
  }

  const handleCheckOut = async (assignmentId, isDemo) => {
    if (isDemo) {
      const job = localDemo.active.find((a) => a.id === assignmentId)
      if (job) {
        const { acceptedAt, ...rest } = job
        persistDemo({
          ...localDemo,
          active: localDemo.active.filter((a) => a.id !== assignmentId),
          history: [{ ...rest, acceptedAt, completedAt: nowIso() }, ...localDemo.history],
        })
      }
      showToast('Checked out successfully.')
      return
    }
    try {
      await checkOut({ assignmentId }).unwrap()
      refetch()
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
  const apiActiveAssignments = assignments.filter((a) => {
    if (a.status !== 'accepted' && a.status !== 'on_site') return false
    
    // If there is an end date, hide it if today is past the end date
    if (a.requestId?.endDate) {
      const endStr = getLocalDateStr(a.requestId.endDate)
      if (todayStr > endStr) return false
    }
    return true
  }).map(a => ({ ...a, isDemo: false }))

  const demoActiveAssignments = localDemo.active.filter(a => !isApiAssignment(a)).map(a => ({ ...a, isDemo: true, _id: a.id }))

  const activeAssignments = [...demoActiveAssignments, ...apiActiveAssignments]

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()

  // Primary Assignment Data
  const primaryAssignment = activeAssignments[0]
  const isDemo = primaryAssignment?.isDemo
  const req = primaryAssignment?.requestId || {}

  let corporateName, vendorName, roleName, locationStr, shiftStr
  if (primaryAssignment) {
    if (isDemo) {
      corporateName = primaryAssignment.contractor || 'Corporate Client'
      vendorName = primaryAssignment.vendorName || 'Vendor'
      roleName = primaryAssignment.trade || 'Worker'
      locationStr = primaryAssignment.location || primaryAssignment.site || 'Location not specified'
      shiftStr = primaryAssignment.shiftWindow || '08:00 AM - 06:00 PM'
    } else {
      corporateName = req.clientId?.corporateProfile?.companyName || req.clientId?.fullName || 'Corporate Client'
      vendorName = primaryAssignment.vendorId?.contractorProfile?.businessName || primaryAssignment.vendorId?.fullName || 'Vendor'
      roleName = primaryAssignment.categoryId?.name || req.lines?.[0]?.categoryId?.name || 'Worker'
      locationStr = req.locationText || req.siteId?.address || 'Location not specified'
      shiftStr = (req.shiftStart && req.shiftEnd) ? `${req.shiftStart} - ${req.shiftEnd}` : '08:00 AM - 06:00 PM'
    }
  }

  // Determine Assignment Date
  const assignedDate = primaryAssignment?.createdAt ? new Date(primaryAssignment.createdAt) : req.startDate ? new Date(req.startDate) : new Date(currentYear, currentMonth, 1)
  assignedDate.setHours(0, 0, 0, 0)

  // Map records for the current month
  const recordMap = {}
  if (records) {
    records.forEach(r => {
      const d = new Date(r.shiftDate)
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        recordMap[d.getDate()] = r
      }
    })
  }

  let totalPresent = 0
  let totalAbsent = 0
  let totalLate = 0
  let totalWeeklyOff = 0
  let totalHoursSum = 0
  let daysWithHours = 0
  let assignedWorkingDays = 0

  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const getDayStatus = (d) => {
    if (!primaryAssignment) return { type: 'Not Assigned', color: '#CBD5E1' }
    const iterDate = new Date(currentYear, currentMonth, d)
    if (iterDate < assignedDate) return { type: 'Not Assigned', color: '#CBD5E1' }
    if (iterDate > now) return null // future
    
    const r = recordMap[d]
    if (r) {
      let st = r.attendanceStatus || (r.projectStatus === 'completed' || r.projectStatus === 'working' ? 'Present' : 'Absent')
      if (st === 'working') st = 'Present'
      
      if (st === 'Present' || st === 'Half Day') return { type: 'Present', color: '#10B981' }
      if (st === 'Absent') return { type: 'Absent', color: '#EF4444' }
      if (st === 'Late') return { type: 'Late', color: '#F59E0B' }
      if (st === 'Weekly Off') return { type: 'Off', color: '#8B5CF6' }
      return { type: 'Present', color: '#10B981' }
    }
    
    // Past day, >= assignedDate, no record -> Absent
    return { type: 'Absent', color: '#EF4444' }
  }

  calendarDays.forEach(d => {
    const s = getDayStatus(d)
    if (s && s.type !== 'Not Assigned') {
      assignedWorkingDays++
      if (s.type === 'Present') totalPresent++
      else if (s.type === 'Absent') totalAbsent++
      else if (s.type === 'Late') totalLate++
      else if (s.type === 'Off') {
        totalWeeklyOff++
        assignedWorkingDays-- // Exclude off days from assigned working days
      }
    }
    
    const r = recordMap[d]
    if (r && r.totalHours) {
      totalHoursSum += r.totalHours
      daysWithHours++
    }
  })

  const avgHours = daysWithHours > 0 ? (totalHoursSum / daysWithHours).toFixed(1) : 0

  // Today's Check In Status
  const todayRecord = recordMap[now.getDate()] || (isDemo && primaryAssignment?.status === 'on_site' ? { checkInAt: primaryAssignment.onSiteAt || nowIso(), projectStatus: 'working' } : null)
  const isCheckedIn = todayRecord && (todayRecord.projectStatus === 'working' || (todayRecord.checkInAt && !todayRecord.checkOutAt))
  const isCompleted = todayRecord && (todayRecord.projectStatus === 'completed' || (todayRecord.checkInAt && todayRecord.checkOutAt))
  
  // Selected Day specific data
  const selectedRecord = recordMap[selectedDay]
  const selectedStatusObj = getDayStatus(selectedDay)
  const isSelectedToday = selectedDay === now.getDate()
  const selectedDateStr = new Date(currentYear, currentMonth, selectedDay).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()

  let selStatusText = selectedStatusObj?.type || 'No Data'
  if (isSelectedToday && isCheckedIn && !isCompleted) {
    selStatusText = 'Working'
  }

  // History Records
  const historyRecords = records
    .filter(r => getLocalDateStr(r.shiftDate) < todayStr)
    .sort((a, b) => new Date(b.shiftDate) - new Date(a.shiftDate))

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
        <p className="mt-2 text-sm text-slate-600">Your personal attendance dashboard.</p>
      </div>

      {!primaryAssignment ? (
        <div style={{
          background: '#FFFFFF', borderRadius: 20, padding: '24px',
          border: '1px solid #F1F5F9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          textAlign: 'center'
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: '#F8FAFC',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <Building2 style={{ width: 24, height: 24, color: '#94A3B8' }} />
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: '0 0 8px' }}>📭 No Active Assignment</h2>
          <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 16px', lineHeight: 1.5 }}>
            You are currently not assigned to any Corporate project.
          </p>
          <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '16px', textAlign: 'left' }}>
            <p style={{ fontSize: 12, color: '#475569', margin: '0 0 8px', fontWeight: 600 }}>Once a Vendor or Corporate assigns you to a project, this page will automatically display:</p>
            <ul style={{ fontSize: 12, color: '#64748B', margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
              <li>Assigned Project</li>
              <li>Attendance Calendar</li>
              <li>Check-In / Check-Out</li>
              <li>Working Hours</li>
              <li>Attendance History</li>
              <li>Monthly Summary</li>
            </ul>
          </div>
        </div>
      ) : (
        <>
          {/* 1️⃣ Active Project Card */}
          <div style={{
            background: '#FFFFFF', borderRadius: 20, overflow: 'hidden',
            border: '1px solid #F1F5F9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}>
            <div style={{ background: '#0F172A', padding: '16px', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 style={{ width: 20, height: 20, color: '#38BDF8' }} />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{corporateName}</h2>
                <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>{project.projectName || 'Corporate Project'}</p>
              </div>
            </div>
            <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><Briefcase style={{ width: 12, height: 12 }} /> Role</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: 0 }}>{roleName}</p>
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><MapPin style={{ width: 12, height: 12 }} /> Location</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{locationStr}</p>
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><CalendarDays style={{ width: 12, height: 12 }} /> Assigned</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: 0 }}>{formatDate(assignedDate)}</p>
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><Clock style={{ width: 12, height: 12 }} /> Shift</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: 0 }}>{shiftStr}</p>
              </div>
            </div>
            <div style={{ padding: '12px 16px', background: '#F8FAFC', borderTop: '1px solid #F1F5F9' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: '#10B981', background: '#ECFDF5', padding: '4px 10px', borderRadius: 12, border: '1px solid #A7F3D0' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} /> Active Assignment
              </span>
            </div>
          </div>

          {/* 3️⃣ Today's Attendance Block */}
          <div style={{
            background: '#FFFFFF', borderRadius: 20, padding: '16px',
            border: '1px solid #F1F5F9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}>
            <h3 style={{ fontSize: 11, fontWeight: 800, color: '#64748B', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Today's Attendance</h3>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Status</p>
                <span style={{
                  display: 'inline-block', padding: '4px 12px', borderRadius: 8, fontSize: 13, fontWeight: 800,
                  background: isCompleted ? '#ECFDF5' : isCheckedIn ? '#EFF6FF' : '#F1F5F9',
                  color: isCompleted ? '#10B981' : isCheckedIn ? '#3B82F6' : '#64748B',
                }}>
                  {isCompleted ? '🟢 Present' : isCheckedIn ? '🔵 Working' : '⚪ Not Checked In'}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>{isCompleted ? 'Total Hours' : isCheckedIn ? 'Live Time' : ''}</p>
                {isCompleted && todayRecord?.totalHours != null ? (
                  <p style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0 }}>{todayRecord.totalHours}h</p>
                ) : isCheckedIn && todayRecord?.checkInAt ? (
                  <p style={{ fontSize: 18, fontWeight: 800, color: '#3B82F6', margin: 0 }}><LiveDuration checkInAt={todayRecord.checkInAt} /></p>
                ) : null}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: 12, border: '1px solid #F1F5F9' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 2 }}>Check In</p>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  {todayRecord?.checkInAt ? new Date(todayRecord.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                </p>
              </div>
              <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: 12, border: '1px solid #F1F5F9' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 2 }}>Check Out</p>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  {todayRecord?.checkOutAt ? new Date(todayRecord.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                </p>
              </div>
            </div>

            {!isCompleted && (
              !isCheckedIn ? (
                <AppPrimaryButton
                  type="button"
                  className="w-full py-3.5 rounded-xl shadow-lg shadow-sky-500/20 text-base"
                  loading={isCheckingIn}
                  onClick={() => handleCheckIn(primaryAssignment._id, isDemo)}
                >
                  <LogIn className="h-5 w-5 mr-2" />
                  Check In Now
                </AppPrimaryButton>
              ) : (
                <button
                  type="button"
                  disabled={isCheckingOut}
                  onClick={() => handleCheckOut(primaryAssignment._id, isDemo)}
                  className="w-full py-3.5 flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white text-base font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <LogOut className="h-5 w-5 text-slate-600" />
                  Check Out
                </button>
              )
            )}
          </div>

          {/* 4️⃣ Monthly Summary Cards */}
          <div>
            <h4 style={{ fontSize: 11, fontWeight: 800, color: '#64748B', margin: '0 0 10px 2px', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CalendarDays style={{ width: 14, height: 14 }} /> Monthly Summary
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 8 }}>
              {[
                { label: 'Present', value: totalPresent, color: '#10B981', bg: '#ECFDF5', border: '#D1FAE5' },
                { label: 'Absent', value: totalAbsent, color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
                { label: 'Late', value: totalLate, color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
                { label: 'Off', value: totalWeeklyOff, color: '#8B5CF6', bg: '#F5F3FF', border: '#E9D5FF' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: '12px 4px', border: `1px solid ${s.border}`, textAlign: 'center' }}>
                  <p style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0, lineHeight: 1 }}>{s.value}</p>
                  <p style={{ fontSize: 9, fontWeight: 700, color: s.color, margin: '6px 0 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
               <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '12px 16px', border: `1px solid #F1F5F9`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                 <p style={{ fontSize: 10, fontWeight: 700, color: '#64748B', margin: 0, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}><Clock style={{ width: 12, height: 12 }} /> Total Hrs</p>
                 <p style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: 0 }}>{totalHoursSum.toFixed(1)}h</p>
               </div>
               <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '12px 16px', border: `1px solid #F1F5F9`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                 <p style={{ fontSize: 10, fontWeight: 700, color: '#64748B', margin: 0, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}><Clock style={{ width: 12, height: 12 }} /> Avg / Day</p>
                 <p style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: 0 }}>{avgHours}h</p>
               </div>
            </div>
          </div>

          {/* 5️⃣ Monthly Calendar */}
          <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '16px', border: '1px solid #F1F5F9', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '0 4px' }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: 0 }}>{now.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center', marginBottom: 12 }}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <div key={d} style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', paddingBottom: 6, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{d}</div>
              ))}

              {Array.from({ length: (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7 }).map((_, i) => <div key={`blank-${i}`} />)}

              {calendarDays.map((d) => {
                const sObj = getDayStatus(d)
                const dotColor = sObj?.color || 'transparent'
                const isSelected = selectedDay === d
                
                let txtColor = '#334155'
                if (sObj?.type === 'Not Assigned') txtColor = '#CBD5E1'
                else if (d > now.getDate()) txtColor = '#CBD5E1'
                if (isSelected) txtColor = '#FFFFFF'

                return (
                  <div key={d} onClick={() => d <= now.getDate() && setSelectedDay(d)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2px 0', gap: 3, cursor: d <= now.getDate() ? 'pointer' : 'default' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: isSelected ? 800 : 600, background: isSelected ? '#0F172A' : (d <= now.getDate() && sObj?.type !== 'Not Assigned') ? '#F8FAFC' : 'transparent', color: txtColor, border: isSelected ? 'none' : (d <= now.getDate() && sObj?.type !== 'Not Assigned') ? '1px solid #F1F5F9' : '1px solid transparent', transition: 'all 0.2s' }}>
                      {d}
                    </div>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor }} />
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, borderTop: '1px solid #F1F5F9', paddingTop: 12 }}>
              {[
                { label: 'Present', color: '#10B981' },
                { label: 'Absent', color: '#EF4444' },
                { label: 'Late', color: '#F59E0B' },
                { label: 'Off', color: '#8B5CF6' },
                { label: 'Not Assigned', color: '#CBD5E1' }
              ].map(l => (
                <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: l.color }} /> {l.label}
                </span>
              ))}
            </div>
          </div>

          {/* 7️⃣ Selected Date Timeline */}
          <div>
            <h4 style={{ fontSize: 11, fontWeight: 800, color: '#64748B', margin: '0 0 10px 2px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              {isSelectedToday ? "Today's Timeline" : "Timeline"} ({selectedDateStr})
            </h4>
            <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '20px', border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              {selectedStatusObj?.type === 'Not Assigned' ? (
                <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 14, fontWeight: 600, color: '#94A3B8' }}>Worker was not assigned on this date.</div>
              ) : selectedRecord || (isSelectedToday && isCheckedIn) ? (
                <div style={{ position: 'relative', paddingLeft: 24 }}>
                  <div style={{ position: 'absolute', top: 12, bottom: 12, left: 7, width: 2, background: '#E2E8F0', borderRadius: 2 }} />
                  
                  {/* Check In Event */}
                  <div style={{ position: 'relative', marginBottom: 24 }}>
                     <div style={{ position: 'absolute', left: -24, top: 2, width: 16, height: 16, borderRadius: '50%', background: '#ECFDF5', border: '2px solid #10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                       <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
                     </div>
                     <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                       <div style={{ flexShrink: 0, minWidth: 60 }}>
                         <p style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                           {todayRecord?.checkInAt ? new Date(todayRecord.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).split(' ')[0] : selectedRecord?.checkInAt ? new Date(selectedRecord.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).split(' ')[0] : '—'}
                         </p>
                         <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', margin: 0 }}>
                           {todayRecord?.checkInAt ? new Date(todayRecord.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).split(' ')[1] : selectedRecord?.checkInAt ? new Date(selectedRecord.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).split(' ')[1] : ''}
                         </p>
                       </div>
                       <div>
                         <p style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: '0 0 6px' }}>Checked In</p>
                         <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#10B981', border: '1px solid #A7F3D0', borderRadius: 6, padding: '3px 8px', background: '#ECFDF5' }}>
                           <MapPin style={{ width: 10, height: 10 }} /> GPS Verified
                         </span>
                       </div>
                     </div>
                  </div>

                  {/* Check Out Event */}
                  <div style={{ position: 'relative' }}>
                     <div style={{ position: 'absolute', left: -24, top: 2, width: 16, height: 16, borderRadius: '50%', background: (isSelectedToday ? isCompleted : selectedRecord?.checkOutAt) ? '#EFF6FF' : '#F1F5F9', border: `2px solid ${(isSelectedToday ? isCompleted : selectedRecord?.checkOutAt) ? '#3B82F6' : '#CBD5E1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                       <span style={{ width: 6, height: 6, borderRadius: '50%', background: (isSelectedToday ? isCompleted : selectedRecord?.checkOutAt) ? '#3B82F6' : '#CBD5E1' }} />
                     </div>
                     <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                       <div style={{ flexShrink: 0, minWidth: 60 }}>
                         <p style={{ fontSize: 14, fontWeight: 800, color: (isSelectedToday ? isCompleted : selectedRecord?.checkOutAt) ? '#0F172A' : '#94A3B8', margin: 0 }}>
                           {todayRecord?.checkOutAt ? new Date(todayRecord.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).split(' ')[0] : selectedRecord?.checkOutAt ? new Date(selectedRecord.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).split(' ')[0] : '—'}
                         </p>
                         <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', margin: 0 }}>
                           {todayRecord?.checkOutAt ? new Date(todayRecord.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).split(' ')[1] : selectedRecord?.checkOutAt ? new Date(selectedRecord.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).split(' ')[1] : ''}
                         </p>
                       </div>
                       <div>
                         <p style={{ fontSize: 14, fontWeight: 800, color: (isSelectedToday ? isCompleted : selectedRecord?.checkOutAt) ? '#0F172A' : '#94A3B8', margin: '0 0 6px' }}>
                           {(isSelectedToday ? isCompleted : selectedRecord?.checkOutAt) ? 'Checked Out' : 'Not Checked Out'}
                         </p>
                         {(isSelectedToday ? todayRecord?.totalHours : selectedRecord?.totalHours) != null && (
                           <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: '#64748B' }}>
                             <Clock style={{ width: 12, height: 12 }} /> Total: <span style={{ fontWeight: 800 }}>{(isSelectedToday ? todayRecord?.totalHours : selectedRecord?.totalHours)} hrs</span>
                           </span>
                         )}
                       </div>
                     </div>
                  </div>
                </div>
              ) : (
                 <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 14, fontWeight: 600, color: '#94A3B8' }}>
                   No records found for {selectedDateStr}. <br/>Status: {selStatusText}
                 </div>
              )}
            </div>
          </div>

          {/* 8️⃣ Attendance History */}
          {historyRecords.length > 0 && (
            <div>
              <h4 style={{ fontSize: 11, fontWeight: 800, color: '#64748B', margin: '0 0 10px 2px', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <History style={{ width: 14, height: 14 }} /> Attendance History
              </h4>
              <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '12px', border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 400 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 12px', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', borderBottom: '1px solid #F1F5F9' }}>Date</th>
                      <th style={{ padding: '10px 12px', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', borderBottom: '1px solid #F1F5F9' }}>Status</th>
                      <th style={{ padding: '10px 12px', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', borderBottom: '1px solid #F1F5F9' }}>Check In</th>
                      <th style={{ padding: '10px 12px', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', borderBottom: '1px solid #F1F5F9' }}>Check Out</th>
                      <th style={{ padding: '10px 12px', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', borderBottom: '1px solid #F1F5F9', textAlign: 'right' }}>Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRecords.map((r, i) => {
                      const d = new Date(r.shiftDate)
                      const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                      let st = r.attendanceStatus || (r.projectStatus === 'completed' || r.projectStatus === 'working' ? 'Present' : 'Absent')
                      if (st === 'working') st = 'Working'

                      const rColor = st === 'Present' || st === 'Working' ? '#10B981' : st === 'Late' ? '#F59E0B' : '#EF4444'
                      const rBg = st === 'Present' || st === 'Working' ? '#ECFDF5' : st === 'Late' ? '#FFFBEB' : '#FEF2F2'

                      return (
                        <tr key={r._id || i} style={{ borderBottom: '1px solid #F8FAFC' }}>
                          <td style={{ padding: '12px', fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{dateStr}</td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ background: rBg, color: rColor, padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                              {st}
                            </span>
                          </td>
                          <td style={{ padding: '12px', fontSize: 12, fontWeight: 600, color: '#475569' }}>{r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                          <td style={{ padding: '12px', fontSize: 12, fontWeight: 600, color: '#475569' }}>{r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                          <td style={{ padding: '12px', fontSize: 13, fontWeight: 800, color: '#0F172A', textAlign: 'right' }}>{r.totalHours ? `${r.totalHours}h` : '0h'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
