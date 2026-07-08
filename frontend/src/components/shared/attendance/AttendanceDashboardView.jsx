import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar, Filter, MapPin, Search, ChevronRight, UserCircle,
  Clock, CheckCircle2, AlertCircle, CalendarDays, Building2,
  Users, TrendingUp, ChevronDown
} from 'lucide-react'
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

  // Filter projects by search
  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects
    const q = search.toLowerCase()
    return projects.filter(p =>
      p.projectName?.toLowerCase().includes(q) ||
      p.corporateName?.toLowerCase().includes(q) ||
      p.projectLocation?.toLowerCase().includes(q)
    )
  }, [projects, search])

  // Aggregate stats across all projects
  const totals = useMemo(() => {
    let assigned = 0, present = 0, absent = 0, working = 0, checkedOut = 0;
    let totalMins = 0;
    let checkedOutCountForAvg = 0;

    projects.forEach(p => {
      const workers = p.workers || []
      assigned += p.assignedWorkers || workers.length || 0
      
      let p_present = 0, p_working = 0, p_checkedOut = 0, p_absent = 0;
      workers.forEach(w => {
        const r = w.records && w.records[0] ? w.records[0] : null;
        if (r && r.checkInAt) {
          p_present++;
          if (r.checkOutAt) {
            p_checkedOut++;
            if (r.totalHours) {
              totalMins += parseFloat(r.totalHours) * 60;
              checkedOutCountForAvg++;
            } else {
              const ms = new Date(r.checkOutAt) - new Date(r.checkInAt);
              totalMins += ms / 60000;
              checkedOutCountForAvg++;
            }
          } else {
            p_working++;
          }
        } else {
          p_absent++;
        }
      });
      
      present += p_present || p.present || 0;
      working += p_working;
      checkedOut += p_checkedOut;
      absent += p_absent || p.absent || 0;
    })
    
    const avgHours = checkedOutCountForAvg > 0 ? (totalMins / 60 / checkedOutCountForAvg).toFixed(1) : 0;
    return { assigned, present, absent, working, checkedOut, avgHours }
  }, [projects])

  const attendancePct = totals.assigned > 0 ? Math.round((totals.present / totals.assigned) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', paddingBottom: 90 }}>

      {/* ──── Sticky Header ──── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid #F1F1F1',
        padding: '14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.3px' }}>Attendance</h1>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', margin: 0, marginTop: 2 }}>
            {projects.length} Project{projects.length !== 1 ? 's' : ''} • {formatDate(date)}
          </p>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 14,
              padding: '10px 36px 10px 36px', fontSize: 13, fontWeight: 700,
              color: '#334155', outline: 'none', width: 170, cursor: 'pointer'
            }}
          />
          <Calendar style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#94A3B8' }} />
        </div>
      </header>

      <div style={{ padding: '16px 6px 0' }}>

        {/* ──── Aggregated Stats Banner ──── */}
        {!isLoading && projects.length > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 16
          }}>
            {[
              { label: 'Assigned', value: totals.assigned, color: '#3B82F6', bg: '#EFF6FF', icon: Users },
              { label: 'Present', value: totals.present, color: '#10B981', bg: '#ECFDF5', icon: CheckCircle2 },
              { label: 'Absent', value: totals.absent, color: '#EF4444', bg: '#FEF2F2', icon: AlertCircle },
              { label: 'Working', value: totals.working, color: '#F59E0B', bg: '#FFFBEB', icon: Clock },
              { label: 'Checked Out', value: totals.checkedOut, color: '#8B5CF6', bg: '#F5F3FF', icon: CheckCircle2 },
              { label: 'Avg Hrs', value: `${totals.avgHours}h`, color: '#06B6D4', bg: '#ECFEFF', icon: CalendarDays },
            ].map((s) => (
              <div key={s.label} style={{
                background: '#FFFFFF', borderRadius: 10, padding: '8px 4px',
                border: '1px solid #F1F5F9', textAlign: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6, background: s.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 4px'
                }}>
                  <s.icon style={{ width: 12, height: 12, color: s.color }} strokeWidth={2} />
                </div>
                <p style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: 0, lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: 8, fontWeight: 700, color: '#94A3B8', margin: 0, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ──── Attendance Rate Bar ──── */}
        {!isLoading && projects.length > 0 && (
          <div style={{
            background: '#FFFFFF', borderRadius: 16, padding: '12px 8px',
            border: '1px solid #F1F5F9', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 12
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <TrendingUp style={{ width: 12, height: 12, display: 'inline', marginRight: 4, verticalAlign: '-2px' }} />
                  Attendance Rate
                </p>
                <p style={{ fontSize: 16, fontWeight: 800, color: attendancePct >= 75 ? '#10B981' : attendancePct >= 50 ? '#F59E0B' : '#EF4444', margin: 0 }}>
                  {attendancePct}%
                </p>
              </div>
              <div style={{ width: '100%', height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${attendancePct}%`, height: '100%', borderRadius: 3,
                  background: attendancePct >= 75 ? 'linear-gradient(90deg, #10B981, #34D399)' :
                             attendancePct >= 50 ? 'linear-gradient(90deg, #F59E0B, #FBBF24)' :
                             'linear-gradient(90deg, #EF4444, #F87171)',
                  transition: 'width 0.6s ease'
                }} />
              </div>
            </div>
          </div>
        )}

        {/* ──── Search Bar ──── */}
        {projects.length > 1 && (
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '12px 16px 12px 42px',
                background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: 14,
                fontSize: 13, fontWeight: 600, color: '#0F172A', outline: 'none',
                boxSizing: 'border-box', transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#F59E0B'}
              onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
            />
            <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#94A3B8' }} />
          </div>
        )}

        {/* ──── Loading State ──── */}
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{
              width: 40, height: 40, border: '3px solid #F1F5F9', borderTopColor: '#F59E0B',
              borderRadius: '50%', margin: '0 auto 16px',
              animation: 'spin 0.8s linear infinite'
            }} />
            <p style={{ fontSize: 14, fontWeight: 700, color: '#64748B', margin: 0 }}>Loading attendance data...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {/* ──── Empty State ──── */}
        {!isLoading && projects.length === 0 && (
          <div style={{
            background: '#FFFFFF', borderRadius: 20, padding: '48px 24px',
            textAlign: 'center', border: '1px solid #F1F5F9',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: '#FEF3C7',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <CalendarDays style={{ width: 28, height: 28, color: '#F59E0B' }} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 }}>No Projects Found</p>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#94A3B8', margin: '8px 0 0' }}>
              There are no active assignments for this date. Try selecting a different date.
            </p>
          </div>
        )}

        {/* ──── Project Cards ──── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredProjects.map((p) => {
            const workers = p.workers || []
            
            let assignedCount = p.assignedWorkers || workers.length || 0
            let presentCount = 0, workingCount = 0, checkedOutCount = 0, absentCount = 0;
            
            workers.forEach(w => {
              const r = w.records && w.records[0] ? w.records[0] : null;
              if (r && r.checkInAt) {
                presentCount++;
                if (r.checkOutAt) checkedOutCount++;
                else workingCount++;
              } else {
                absentCount++;
              }
            })
            
            if (workers.length === 0) {
              presentCount = p.present || 0;
              absentCount = p.absent || 0;
            }

            const pct = assignedCount > 0 ? Math.round((presentCount / assignedCount) * 100) : 0

            return (
              <div key={p.projectId} style={{
                background: '#FFFFFF', borderRadius: 20, overflow: 'hidden',
                border: '1px solid #F1F5F9',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.02)'
              }}>
                {/* Project Banner */}
                <div style={{ position: 'relative', height: 120, background: '#E2E8F0' }}>
                  <img
                    src="https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800&q=80"
                    alt="Project"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(180deg, rgba(15,23,42,0.1) 0%, rgba(15,23,42,0.65) 100%)'
                  }} />
                  {/* Status Badge */}
                  <div style={{
                    position: 'absolute', top: 10, right: 10,
                    background: p.projectStatus === 'completed' ? 'rgba(16,185,129,0.9)' : 'rgba(255,255,255,0.95)',
                    color: p.projectStatus === 'completed' ? '#FFFFFF' : '#10B981',
                    padding: '4px 10px', borderRadius: 8,
                    fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px',
                    backdropFilter: 'blur(8px)'
                  }}>
                    {p.projectStatus === 'completed' ? 'Completed' : '● Active'}
                  </div>
                  {/* Project Name Overlay */}
                  <div style={{ position: 'absolute', bottom: 12, left: 14, right: 14 }}>
                    <h3 style={{
                      fontSize: 17, fontWeight: 800, color: '#FFFFFF', margin: 0,
                      textShadow: '0 1px 3px rgba(0,0,0,0.3)', lineHeight: 1.2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>{p.projectName}</h3>
                  </div>
                </div>

                {/* Project Info */}
                <div style={{ padding: '10px 8px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                    <p style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#64748B', margin: 0 }}>
                      <Building2 style={{ width: 13, height: 13, color: '#94A3B8' }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{p.corporateName || 'Corporate Client'}</span>
                    </p>
                    <p style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#64748B', margin: 0 }}>
                      <MapPin style={{ width: 13, height: 13, color: '#94A3B8' }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{p.projectLocation || 'Location TBD'}</span>
                    </p>
                  </div>

                  {/* Attendance Stats Chips */}
                  <div style={{
                    display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10,
                    padding: '10px 0', borderTop: '1px solid #F8FAFC', borderBottom: '1px solid #F8FAFC'
                  }}>
                    {[
                      { label: 'Assigned', val: assignedCount, color: '#3B82F6', bg: '#EFF6FF' },
                      { label: 'Present', val: presentCount, color: '#10B981', bg: '#ECFDF5' },
                      { label: 'Working', val: workingCount, color: '#F59E0B', bg: '#FFFBEB' },
                      { label: 'Checked Out', val: checkedOutCount, color: '#8B5CF6', bg: '#F5F3FF' },
                      { label: 'Absent', val: absentCount, color: '#EF4444', bg: '#FEF2F2' },
                    ].map(s => (
                      <div key={s.label} style={{
                        background: s.bg, borderRadius: 8, padding: '4px 8px',
                        display: 'flex', alignItems: 'center', gap: 4,
                        border: `1px solid ${s.color}18`
                      }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: s.color }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: s.color }}>{s.val}</span>
                        <span style={{ fontSize: 9, fontWeight: 600, color: '#94A3B8' }}>{s.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Attendance Progress */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ flex: 1, height: 5, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`, height: '100%', borderRadius: 3,
                        background: pct >= 75 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444',
                        transition: 'width 0.6s ease'
                      }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: pct >= 75 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444' }}>
                      {pct}%
                    </span>
                  </div>


                  {/* View All Workers Link */}
                  <Link
                    to={`${basePath}/attendance/${p.projectId}`}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '11px 16px', borderRadius: 14,
                      background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
                      border: '1px solid #FCD34D',
                      fontSize: 12, fontWeight: 700, color: '#92400E',
                      textDecoration: 'none', transition: 'all 0.2s', outline: 'none'
                    }}
                  >
                    <Users style={{ width: 14, height: 14 }} strokeWidth={2.5} />
                    View All Workers
                    <ChevronRight style={{ width: 14, height: 14, marginLeft: 'auto' }} />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>

        {/* No results from search */}
        {!isLoading && projects.length > 0 && filteredProjects.length === 0 && (
          <div style={{
            background: '#FFFFFF', borderRadius: 16, padding: '32px 20px',
            textAlign: 'center', border: '1px solid #F1F5F9'
          }}>
            <Search style={{ width: 24, height: 24, color: '#CBD5E1', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 13, fontWeight: 700, color: '#64748B', margin: 0 }}>No projects match "{search}"</p>
          </div>
        )}

      </div>
    </div>
  )
}
