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
  
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const [selectedDay, setSelectedDay] = useState(now.getDate())

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
    return (
      <div style={{ minHeight: '100vh', background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, border: '3px solid #F1F5F9', borderTopColor: '#F59E0B',
            borderRadius: '50%', margin: '0 auto 16px',
            animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: '#64748B', margin: 0 }}>Loading worker details...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  if (!worker || !project) {
    return (
      <div style={{ minHeight: '100vh', background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: '#FEF2F2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px'
          }}>
            <AlertCircle style={{ width: 24, height: 24, color: '#EF4444' }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 4px' }}>Worker details not found</p>
          <p style={{ fontSize: 12, fontWeight: 500, color: '#94A3B8', margin: '0 0 16px' }}>This worker may not be assigned to this project.</p>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: '#F59E0B', color: '#FFFFFF', border: 'none', borderRadius: 12,
              padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer'
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const latestRecord = worker.records?.[0]
  let status = latestRecord?.attendanceStatus || worker.status
  if (status === 'working' || status === 'completed') status = 'Present'
  if (!status) status = 'Absent'

  const isPresent = status === 'Present' || status === 'Half Day'
  const isAbsent = status === 'Absent'
  const isLate = status === 'Late'
  const stColor = isPresent ? '#10B981' : isAbsent ? '#EF4444' : isLate ? '#F59E0B' : '#8B5CF6'
  const stBg = isPresent ? '#ECFDF5' : isAbsent ? '#FEF2F2' : isLate ? '#FFFBEB' : '#F5F3FF'

  // Real Monthly Calendar data calculation
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  
  // Create a map of dates to records for easy lookup
  const recordMap = {}
  
  if (worker.records) {
    worker.records.forEach(r => {
      const d = new Date(r.shiftDate)
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        recordMap[d.getDate()] = r
      }
    })
  }

  // Determine Assignment Date
  const assignedDate = worker.assignedAt ? new Date(worker.assignedAt) : project.startDate ? new Date(project.startDate) : new Date(currentYear, currentMonth, 1)
  assignedDate.setHours(0, 0, 0, 0)
  
  let totalPresent = 0
  let totalAbsent = 0
  let totalLate = 0
  let totalWeeklyOff = 0
  let totalHoursSum = 0
  let daysWithHours = 0
  let assignedWorkingDays = 0

  // Calculate stats based purely on assignment date and backend records
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  
  const getDayStatus = (d) => {
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
      return { type: 'Present', color: '#10B981' } // Fallback if check in exists but no explicit status
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
  
  // Selected Day specific data
  const selectedRecord = recordMap[selectedDay]
  const selectedStatusObj = getDayStatus(selectedDay)
  const isSelectedToday = selectedDay === now.getDate()
  const selectedDateStr = new Date(currentYear, currentMonth, selectedDay).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()

  let selStatusText = selectedStatusObj?.type || 'No Data'
  if (isSelectedToday && selectedRecord?.checkInAt && !selectedRecord?.checkOutAt) {
    selStatusText = 'Working'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', paddingBottom: 90 }}>

      {/* ──── Sticky Header ──── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid #F1F1F1',
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10
      }}>
        <button
          onClick={() => navigate(`${basePath}/attendance/${projectId}`)}
          style={{
            width: 38, height: 38, borderRadius: 12, border: '1.5px solid #E2E8F0',
            background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0
          }}
        >
          <ChevronLeft style={{ width: 18, height: 18, color: '#475569' }} />
        </button>
        <h1 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 }}>Worker Details</h1>
      </header>

      <div style={{ padding: '16px', maxWidth: 480, margin: '0 auto' }}>

        {/* ──── Worker Profile Card ──── */}
        <div style={{
          background: '#FFFFFF', borderRadius: 20, padding: '20px',
          border: '1px solid #F1F5F9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          marginBottom: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 18,
                background: `linear-gradient(135deg, ${stColor}20, ${stColor}08)`,
                padding: 3, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(worker.workerName)}&background=random&size=58`}
                  alt={worker.workerName}
                  style={{ width: 58, height: 58, borderRadius: 15, objectFit: 'cover' }}
                />
              </div>
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 16, height: 16, borderRadius: '50%',
                background: stColor, border: '2.5px solid #FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {isPresent && <CheckCircle2 style={{ width: 8, height: 8, color: '#FFF' }} strokeWidth={3} />}
                {isAbsent && <AlertCircle style={{ width: 8, height: 8, color: '#FFF' }} strokeWidth={3} />}
                {isLate && <Clock style={{ width: 8, height: 8, color: '#FFF' }} strokeWidth={3} />}
                {!isPresent && !isAbsent && !isLate && <CalendarDays style={{ width: 8, height: 8, color: '#FFF' }} strokeWidth={3} />}
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {worker.workerName}
                </h2>
                <span style={{
                  background: stBg, color: stColor,
                  padding: '3px 10px', borderRadius: 8,
                  fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
                  border: `1px solid ${stColor}25`, flexShrink: 0,
                  display: 'flex', alignItems: 'center', gap: 4
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: stColor, animation: 'pulse 2s ease-in-out infinite' }} />
                  {status}
                </span>
              </div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#64748B', margin: '3px 0 0' }}>{worker.role}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Phone style={{ width: 11, height: 11 }} />
                {worker.phone || 'Phone not available'}
              </p>
            </div>
          </div>
        </div>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>

        {/* ──── Project Info Card ──── */}
        <div style={{
          background: '#FFFFFF', borderRadius: 16, padding: '12px',
          border: '1px solid #F1F5F9', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <div style={{ width: 56, height: 56, flexShrink: 0, borderRadius: 12, overflow: 'hidden', background: '#E2E8F0' }}>
            <img
              src="https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=200&q=80"
              alt="Project"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {project.projectName}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, color: '#64748B' }}>
              <Building2 style={{ width: 10, height: 10, flexShrink: 0 }} />
              <p style={{ fontSize: 10, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {project.corporateName || 'Corporate Client'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, color: '#94A3B8' }}>
              <MapPin style={{ width: 10, height: 10, flexShrink: 0 }} />
              <p style={{ fontSize: 10, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {project.projectLocation || 'Location TBD'}
              </p>
            </div>
          </div>
        </div>

        {/* ──── Monthly Summary Stats ──── */}
        <div style={{ marginBottom: 16 }}>
          <h4 style={{
            fontSize: 10, fontWeight: 800, color: '#64748B', margin: '0 0 10px 2px',
            textTransform: 'uppercase', letterSpacing: '0.8px',
            display: 'flex', alignItems: 'center', gap: 6
          }}>
            <CalendarDays style={{ width: 13, height: 13 }} />
            Monthly Summary
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 8 }}>
            {[
              { label: 'Present', value: totalPresent, color: '#10B981', bg: '#ECFDF5', border: '#D1FAE5' },
              { label: 'Absent', value: totalAbsent, color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
              { label: 'Late', value: totalLate, color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
              { label: 'Off', value: totalWeeklyOff, color: '#8B5CF6', bg: '#F5F3FF', border: '#E9D5FF' },
            ].map(s => (
              <div key={s.label} style={{
                background: s.bg, borderRadius: 14, padding: '10px 4px',
                border: `1px solid ${s.border}`, textAlign: 'center'
              }}>
                <p style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0, lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: 8, fontWeight: 700, color: s.color, margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</p>
              </div>
            ))}
          </div>
          
          <div style={{
             background: '#FFFFFF', borderRadius: 14, padding: '12px 16px',
             border: `1px solid #F1F5F9`, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
             <p style={{ fontSize: 10, fontWeight: 700, color: '#64748B', margin: 0, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
               <Clock style={{ width: 12, height: 12 }} />
               Avg Working Hours
             </p>
             <p style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: 0 }}>
               {avgHours}h <span style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8' }}>/ day</span>
             </p>
          </div>
        </div>

        {/* ──── Monthly Calendar ──── */}
        <div style={{
          background: '#FFFFFF', borderRadius: 20, padding: '16px',
          border: '1px solid #F1F5F9', boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          marginBottom: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, padding: '0 4px' }}>
            <button style={{
              width: 30, height: 30, borderRadius: 10, border: '1px solid #E2E8F0',
              background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer'
            }}>
              <ChevronLeft style={{ width: 14, height: 14, color: '#94A3B8' }} />
            </button>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: 0 }}>
              {now.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h3>
            <button style={{
              width: 30, height: 30, borderRadius: 10, border: '1px solid #E2E8F0',
              background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer'
            }}>
              <ChevronRight style={{ width: 14, height: 14, color: '#94A3B8' }} />
            </button>
          </div>

          {/* Calendar Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center', marginBottom: 12 }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', paddingBottom: 6, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{d}</div>
            ))}

            {/* Blank spaces for the first day of month */}
            {Array.from({ length: (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7 }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}

            {calendarDays.map((d) => {
              const sObj = getDayStatus(d)
              const dotColor = sObj?.color || 'transparent'
              const isSelected = selectedDay === d
              
              let txtColor = '#334155'
              if (sObj?.type === 'Not Assigned') txtColor = '#CBD5E1'
              else if (d > now.getDate()) txtColor = '#CBD5E1'
              if (isSelected) txtColor = '#FFFFFF'

              return (
                <div 
                  key={d} 
                  onClick={() => d <= now.getDate() && setSelectedDay(d)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2px 0', gap: 3, cursor: d <= now.getDate() ? 'pointer' : 'default' }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: isSelected ? 800 : 600,
                    background: isSelected ? '#0F172A' : (d <= now.getDate() && sObj?.type !== 'Not Assigned') ? '#F8FAFC' : 'transparent',
                    color: txtColor,
                    border: isSelected ? 'none' : (d <= now.getDate() && sObj?.type !== 'Not Assigned') ? '1px solid #F1F5F9' : '1px solid transparent',
                    transition: 'all 0.2s'
                  }}>
                    {d}
                  </div>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor }} />
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10,
            borderTop: '1px solid #F1F5F9', paddingTop: 10
          }}>
            {[
              { label: 'Present', color: '#10B981' },
              { label: 'Absent', color: '#EF4444' },
              { label: 'Late', color: '#F59E0B' },
              { label: 'Off', color: '#8B5CF6' },
            ].map(l => (
              <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        </div>

        {/* ──── Selected Date Timeline ──── */}
        <div style={{ marginBottom: 16 }}>
          <h4 style={{
            fontSize: 10, fontWeight: 800, color: '#64748B', margin: '0 0 10px 2px',
            textTransform: 'uppercase', letterSpacing: '0.8px'
          }}>
            {isSelectedToday ? "Today's Timeline" : "Timeline"} ({selectedDateStr})
          </h4>
          <div style={{
            background: '#FFFFFF', borderRadius: 18, padding: '16px',
            border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            {selectedStatusObj?.type === 'Not Assigned' ? (
              <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 13, fontWeight: 600, color: '#94A3B8' }}>
                Worker was not assigned on this date.
              </div>
            ) : selectedRecord ? (
              <div style={{ position: 'relative', paddingLeft: 24 }}>
                {/* Timeline Line */}
                <div style={{ position: 'absolute', top: 12, bottom: 12, left: 7, width: 2, background: '#E2E8F0', borderRadius: 2 }} />
                
                {/* Check In Event */}
                <div style={{ position: 'relative', marginBottom: 24 }}>
                   <div style={{
                     position: 'absolute', left: -24, top: 2,
                     width: 16, height: 16, borderRadius: '50%', background: '#ECFDF5',
                     border: '2px solid #10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1
                   }}>
                     <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
                   </div>
                   <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                     <div style={{ flexShrink: 0, minWidth: 50 }}>
                       <p style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                         {selectedRecord.checkInAt ? formatTime(selectedRecord.checkInAt).split(' ')[0] : '—'}
                       </p>
                       <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', margin: 0 }}>
                         {selectedRecord.checkInAt ? formatTime(selectedRecord.checkInAt).split(' ')[1] : ''}
                       </p>
                     </div>
                     <div>
                       <p style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: '0 0 4px' }}>Checked In</p>
                       <span style={{
                         display: 'inline-flex', alignItems: 'center', gap: 4,
                         fontSize: 9, fontWeight: 700, color: '#10B981',
                         border: '1px solid #A7F3D0', borderRadius: 4, padding: '2px 6px',
                         background: '#ECFDF5'
                       }}>
                         <MapPin style={{ width: 9, height: 9 }} />
                         GPS Verified
                       </span>
                     </div>
                   </div>
                </div>

                {/* Check Out Event */}
                <div style={{ position: 'relative' }}>
                   <div style={{
                     position: 'absolute', left: -24, top: 2,
                     width: 16, height: 16, borderRadius: '50%', background: selectedRecord.checkOutAt ? '#EFF6FF' : '#F1F5F9',
                     border: `2px solid ${selectedRecord.checkOutAt ? '#3B82F6' : '#CBD5E1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1
                   }}>
                     <span style={{ width: 6, height: 6, borderRadius: '50%', background: selectedRecord.checkOutAt ? '#3B82F6' : '#CBD5E1' }} />
                   </div>
                   <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                     <div style={{ flexShrink: 0, minWidth: 50 }}>
                       <p style={{ fontSize: 13, fontWeight: 800, color: selectedRecord.checkOutAt ? '#0F172A' : '#94A3B8', margin: 0 }}>
                         {selectedRecord.checkOutAt ? formatTime(selectedRecord.checkOutAt).split(' ')[0] : '—'}
                       </p>
                       <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', margin: 0 }}>
                         {selectedRecord.checkOutAt ? formatTime(selectedRecord.checkOutAt).split(' ')[1] : ''}
                       </p>
                     </div>
                     <div>
                       <p style={{ fontSize: 13, fontWeight: 800, color: selectedRecord.checkOutAt ? '#0F172A' : '#94A3B8', margin: '0 0 4px' }}>
                         {selectedRecord.checkOutAt ? 'Checked Out' : 'Not Checked Out'}
                       </p>
                       {selectedRecord.totalHours && (
                         <span style={{
                           display: 'inline-flex', alignItems: 'center', gap: 4,
                           fontSize: 9, fontWeight: 600, color: '#64748B'
                         }}>
                           <Clock style={{ width: 10, height: 10 }} />
                           Total: <span style={{ fontWeight: 800 }}>{selectedRecord.totalHours} hrs</span>
                         </span>
                       )}
                     </div>
                   </div>
                </div>
              </div>
            ) : (
               <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 13, fontWeight: 600, color: '#94A3B8' }}>
                 No records found for {selectedDateStr}. <br/>Status: {selStatusText}
               </div>
            )}
          </div>
        </div>

        {/* ──── Attendance Records List ──── */}
        <div style={{ marginBottom: 16 }}>
          <h4 style={{
            fontSize: 10, fontWeight: 800, color: '#64748B', margin: '0 0 10px 2px',
            textTransform: 'uppercase', letterSpacing: '0.8px'
          }}>
            Attendance Records
          </h4>
          <div style={{
            background: '#FFFFFF', borderRadius: 14, padding: '12px',
            border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            overflowX: 'auto'
          }}>
            {worker.records && worker.records.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 400 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', borderBottom: '1px solid #F1F5F9' }}>Date</th>
                    <th style={{ padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', borderBottom: '1px solid #F1F5F9' }}>Check In</th>
                    <th style={{ padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', borderBottom: '1px solid #F1F5F9' }}>Check Out</th>
                    <th style={{ padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', borderBottom: '1px solid #F1F5F9' }}>Hours</th>
                    <th style={{ padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', borderBottom: '1px solid #F1F5F9', textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {worker.records.map((r, i) => {
                    const d = new Date(r.shiftDate)
                    const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })

                    let st = r.attendanceStatus || (r.projectStatus === 'completed' || r.projectStatus === 'working' ? 'Present' : 'Absent')
                    if (st === 'working') st = 'Working'

                    const rColor = st === 'Present' || st === 'Working' ? '#10B981' : '#EF4444'
                    const rBg = st === 'Present' || st === 'Working' ? '#ECFDF5' : '#FEF2F2'

                    return (
                      <tr key={r._id || i} style={{ borderBottom: '1px solid #F8FAFC' }}>
                        <td style={{ padding: '10px', fontSize: 12, fontWeight: 800, color: '#0F172A' }}>{dateStr}</td>
                        <td style={{ padding: '10px', fontSize: 11, fontWeight: 600, color: '#475569' }}>{r.checkInAt ? formatTime(r.checkInAt) : '—'}</td>
                        <td style={{ padding: '10px', fontSize: 11, fontWeight: 600, color: '#475569' }}>{r.checkOutAt ? formatTime(r.checkOutAt) : '—'}</td>
                        <td style={{ padding: '10px', fontSize: 11, fontWeight: 700, color: '#0F172A' }}>{r.totalHours ? `${r.totalHours}h` : '0h'}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>
                          <span style={{
                            background: rBg, color: rColor, padding: '3px 8px',
                            borderRadius: 6, fontSize: 9, fontWeight: 800,
                            textTransform: 'uppercase', letterSpacing: '0.4px'
                          }}>
                            {st}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <CalendarDays style={{ width: 24, height: 24, color: '#CBD5E1', margin: '0 auto 8px' }} />
                <p style={{ fontSize: 12, fontWeight: 700, color: '#64748B', margin: 0 }}>No attendance records found for this month.</p>
              </div>
            )}
          </div>
        </div>

        {/* ──── Download Button ──── */}
        {worker.records && worker.records.length > 0 && (
          <button style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 20px', borderRadius: 16,
            background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
            border: '1.5px solid #FCD34D',
            fontSize: 13, fontWeight: 700, color: '#92400E',
            cursor: 'pointer', transition: 'all 0.2s',
            marginBottom: 16
          }}>
            <Download style={{ width: 16, height: 16 }} strokeWidth={2.5} />
            Download Full History
          </button>
        )}
      </div>
    </div>
  )
}
