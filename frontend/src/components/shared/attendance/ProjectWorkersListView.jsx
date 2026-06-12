import { useState, useMemo } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Search, MapPin, UserCircle,
  Clock, CheckCircle2, AlertCircle, CalendarDays, Building2, Users
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

export function ProjectWorkersListView({ basePath = '/vendor' }) {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const today = new Date().toISOString().split('T')[0]

  const queryParams = useMemo(() => {
    return { date: today }
  }, [today])

  const { data: monitorData, isLoading } = useGetAttendanceMonitorQuery(queryParams)
  const projects = monitorData?.projects ?? []
  const project = projects.find(p => p.projectId === projectId)

  const assignedCount = project?.assignedWorkers || 0
  const presentCount = project?.present || 0
  const absentCount = project?.absent || 0
  const lateCount = project?.late || 0
  const weeklyOffCount = project?.weeklyOff || 0
  const pct = assignedCount > 0 ? Math.round((presentCount / assignedCount) * 100) : 0

  const allWorkers = project?.workers || []

  // Filter workers by search and status
  const filteredWorkers = useMemo(() => {
    let list = allWorkers
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(w =>
        w.workerName?.toLowerCase().includes(q) ||
        w.role?.toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all') {
      list = list.filter(w => {
        const st = w.status
        if (statusFilter === 'present') return st === 'Present' || st === 'working' || st === 'completed'
        if (statusFilter === 'absent') return st === 'Absent'
        if (statusFilter === 'late') return st === 'Late'
        if (statusFilter === 'off') return st === 'Weekly Off'
        return true
      })
    }
    return list
  }, [allWorkers, search, statusFilter])

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, border: '3px solid #F1F5F9', borderTopColor: '#F59E0B',
            borderRadius: '50%', margin: '0 auto 16px',
            animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: '#64748B', margin: 0 }}>Loading workers...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  if (!project) {
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
          <p style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 4px' }}>Project not found</p>
          <p style={{ fontSize: 12, fontWeight: 500, color: '#94A3B8', margin: '0 0 16px' }}>This project may not have active assignments today.</p>
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

  const filterChips = [
    { key: 'all', label: 'All', count: allWorkers.length, color: '#334155', bg: '#F1F5F9' },
    { key: 'present', label: 'Present', count: presentCount, color: '#10B981', bg: '#ECFDF5' },
    { key: 'absent', label: 'Absent', count: absentCount, color: '#EF4444', bg: '#FEF2F2' },
    { key: 'late', label: 'Late', count: lateCount, color: '#F59E0B', bg: '#FFFBEB' },
    { key: 'off', label: 'Off', count: weeklyOffCount, color: '#8B5CF6', bg: '#F5F3FF' },
  ]

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
          onClick={() => navigate(`${basePath}/attendance`)}
          style={{
            width: 38, height: 38, borderRadius: 12, border: '1.5px solid #E2E8F0',
            background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s'
          }}
        >
          <ChevronLeft style={{ width: 18, height: 18, color: '#475569' }} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>
            {project.projectName}
          </h1>
          <p style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', margin: 0, marginTop: 1 }}>
            {formatDate(today)} • {assignedCount} Workers
          </p>
        </div>
      </header>

      <div style={{ padding: '16px 16px 0' }}>

        {/* ──── Project Info Card ──── */}
        <div style={{
          background: '#FFFFFF', borderRadius: 18, overflow: 'hidden',
          border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
          marginBottom: 16, display: 'flex', alignItems: 'stretch'
        }}>
          <div style={{ width: 80, flexShrink: 0, background: '#E2E8F0' }}>
            <img
              src="https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=200&q=80"
              alt="Project"
              style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: 80 }}
            />
          </div>
          <div style={{ padding: '12px 14px', flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 8 }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {project.projectName}
              </p>
              <span style={{
                background: project.projectStatus === 'completed' ? '#ECFDF5' : '#F0FDF4',
                color: '#10B981', padding: '2px 8px', borderRadius: 6,
                fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
                border: '1px solid #BBF7D0', whiteSpace: 'nowrap', flexShrink: 0
              }}>
                {project.projectStatus === 'completed' ? 'Completed' : 'Active'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, color: '#64748B' }}>
              <Building2 style={{ width: 11, height: 11, flexShrink: 0 }} />
              <p style={{ fontSize: 11, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {project.corporateName || 'Corporate Client'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, color: '#94A3B8' }}>
              <MapPin style={{ width: 11, height: 11, flexShrink: 0 }} />
              <p style={{ fontSize: 10, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {project.projectLocation || 'Location TBD'}
              </p>
            </div>
          </div>
        </div>

        {/* ──── Stats Grid (2x2 + full width) ──── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Assigned', value: assignedCount, sub: 'Workers', icon: UserCircle, color: '#3B82F6', bg: '#EFF6FF', border: '#DBEAFE' },
            { label: 'Present', value: presentCount, sub: `${pct}%`, icon: CheckCircle2, color: '#10B981', bg: '#ECFDF5', border: '#D1FAE5' },
            { label: 'Absent', value: absentCount, sub: `${assignedCount ? Math.round((absentCount/assignedCount)*100) : 0}%`, icon: AlertCircle, color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
            { label: 'Late', value: lateCount, sub: `${assignedCount ? Math.round((lateCount/assignedCount)*100) : 0}%`, icon: Clock, color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
          ].map(s => (
            <div key={s.label} style={{
              background: s.bg, borderRadius: 16, padding: '14px 14px',
              border: `1px solid ${s.border}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <s.icon style={{ width: 18, height: 18, color: s.color }} strokeWidth={2} />
                <span style={{ fontSize: 9, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</span>
              </div>
              <p style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', margin: 0, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', margin: '2px 0 0' }}>{s.sub}</p>
            </div>
          ))}
          {/* Weekly Off — full width */}
          <div style={{
            gridColumn: '1 / -1',
            background: '#F5F3FF', borderRadius: 16, padding: '12px 16px',
            border: '1px solid #E9D5FF',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarDays style={{ width: 16, height: 16, color: '#8B5CF6' }} />
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, color: '#8B5CF6', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Weekly Off</p>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', margin: 0 }}>Workers off today</p>
              </div>
            </div>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>{weeklyOffCount}</p>
          </div>
        </div>

        {/* ──── Section Header + Search ──── */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h4 style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: 0 }}>Today's Attendance</h4>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: '#ECFDF5', borderRadius: 6, padding: '2px 8px',
                border: '1px solid #D1FAE5'
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10B981', animation: 'pulse 2s ease-in-out infinite' }} />
                <span style={{ fontSize: 8, fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Live</span>
              </span>
              <style>{`@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>
            </div>
          </div>

          {/* Filter Chips */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, marginBottom: 10, scrollbarWidth: 'none' }}>
            {filterChips.map(f => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                style={{
                  flex: '0 0 auto',
                  background: statusFilter === f.key ? f.bg : '#FFFFFF',
                  border: `1.5px solid ${statusFilter === f.key ? f.color : '#E2E8F0'}`,
                  borderRadius: 10, padding: '6px 12px',
                  display: 'flex', alignItems: 'center', gap: 5,
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: statusFilter === f.key ? f.color : '#64748B'
                }}>{f.label}</span>
                <span style={{
                  fontSize: 10, fontWeight: 800,
                  color: statusFilter === f.key ? f.color : '#94A3B8',
                  background: statusFilter === f.key ? `${f.color}15` : '#F8FAFC',
                  padding: '1px 5px', borderRadius: 5
                }}>{f.count}</span>
              </button>
            ))}
          </div>

          {/* Search */}
          {allWorkers.length > 5 && (
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search worker..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%', padding: '11px 16px 11px 40px',
                  background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: 14,
                  fontSize: 13, fontWeight: 600, color: '#0F172A', outline: 'none',
                  boxSizing: 'border-box', transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#F59E0B'}
                onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
              />
              <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#94A3B8' }} />
            </div>
          )}
        </div>

        {/* ──── Workers List ──── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredWorkers.map((w) => {
            const status = w.status
            const isPresent = status === 'Present' || status === 'working' || status === 'completed'
            const isAbsent = status === 'Absent'
            const isLate = status === 'Late'

            const stColor = isPresent ? '#10B981' : isAbsent ? '#EF4444' : isLate ? '#F59E0B' : '#8B5CF6'
            const stBg = isPresent ? '#ECFDF5' : isAbsent ? '#FEF2F2' : isLate ? '#FFFBEB' : '#F5F3FF'
            const stText = isPresent ? 'Present' : isAbsent ? 'Absent' : isLate ? 'Late' : status || 'Off'
            const StatusIcon = isPresent ? CheckCircle2 : isAbsent ? AlertCircle : isLate ? Clock : CalendarDays

            const r = w.records && w.records[0] ? w.records[0] : null
            const hasCheckIn = r?.checkInAt != null
            const hasCheckOut = r?.checkOutAt != null
            
            let hoursText = '0h'
            if (r && r.totalHours) {
              hoursText = `${r.totalHours}h`
            } else if (hasCheckIn && hasCheckOut) {
              const diffMs = new Date(r.checkOutAt) - new Date(r.checkInAt)
              const mins = Math.floor(diffMs / 60000)
              const h = Math.floor(mins / 60)
              const m = mins % 60
              hoursText = `${h}h ${m}m`
            } else if (hasCheckIn) {
              const diffMs = new Date() - new Date(r.checkInAt)
              const mins = Math.max(0, Math.floor(diffMs / 60000))
              const h = Math.floor(mins / 60)
              const m = mins % 60
              hoursText = `${h}h ${m}m`
            }

            return (
              <Link
                key={w.workerId}
                to={`${basePath}/attendance/${projectId}/worker/${w.workerId}`}
                style={{ textDecoration: 'none', display: 'block', transition: 'transform 0.15s' }}
              >
                <div style={{
                  background: '#FFFFFF', borderRadius: 16, padding: '12px',
                  border: '1px solid #F1F5F9',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  display: 'flex', alignItems: 'center', gap: 12
                }}>
                  {/* Avatar */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(w.workerName)}&background=random&size=48`}
                      alt={w.workerName}
                      style={{ width: 48, height: 48, borderRadius: 14, objectFit: 'cover' }}
                    />
                    <div style={{
                      position: 'absolute', bottom: -2, right: -2,
                      width: 14, height: 14, borderRadius: '50%',
                      background: stColor, border: '2px solid #FFFFFF',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <StatusIcon style={{ width: 7, height: 7, color: '#FFFFFF' }} strokeWidth={3} />
                    </div>
                  </div>

                  {/* Worker Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 3 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {w.workerName}
                      </p>
                      <span style={{
                        background: stBg, color: stColor,
                        padding: '3px 8px', borderRadius: 6,
                        fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px',
                        border: `1px solid ${stColor}20`, flexShrink: 0
                      }}>
                        {stText}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', margin: '0 0 6px' }}>{w.role}</p>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin style={{ width: 11, height: 11, color: hasCheckIn ? '#10B981' : '#CBD5E1' }} />
                        <span style={{ fontSize: 10, fontWeight: 600, color: hasCheckIn ? '#10B981' : '#CBD5E1' }}>
                          {hasCheckIn ? 'GPS Verified' : 'Not Verified'}
                        </span>
                      </div>
                      <div style={{
                        display: 'flex', gap: 6, flexWrap: 'wrap',
                        background: '#F8FAFC', padding: '4px 8px', borderRadius: 8,
                        border: '1px solid #F1F5F9'
                      }}>
                        <span style={{ fontSize: 9, fontWeight: 600, color: '#94A3B8' }}>
                          IN <span style={{ fontWeight: 700, color: '#334155', marginLeft: 2 }}>{r?.checkInAt ? formatTime(r.checkInAt) : '—'}</span>
                        </span>
                        <span style={{ fontSize: 9, fontWeight: 600, color: '#94A3B8' }}>
                          OUT <span style={{ fontWeight: 700, color: '#334155', marginLeft: 2 }}>{r?.checkOutAt ? formatTime(r.checkOutAt) : '—'}</span>
                        </span>
                        <span style={{ fontSize: 9, fontWeight: 600, color: '#94A3B8', borderLeft: '1px solid #E2E8F0', paddingLeft: 6 }}>
                          HRS <span style={{ fontWeight: 800, color: '#0F172A', marginLeft: 2 }}>{hoursText}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <ChevronRight style={{ width: 16, height: 16, color: '#CBD5E1', flexShrink: 0 }} />
                </div>
              </Link>
            )
          })}

          {/* Empty State */}
          {filteredWorkers.length === 0 && (
            <div style={{
              background: '#FFFFFF', borderRadius: 16, padding: '40px 20px',
              textAlign: 'center', border: '1px solid #F1F5F9'
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', background: '#F8FAFC',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 10px'
              }}>
                <UserCircle style={{ width: 24, height: 24, color: '#CBD5E1' }} />
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#64748B', margin: 0 }}>No workers found</p>
              <p style={{ fontSize: 11, fontWeight: 500, color: '#94A3B8', margin: '4px 0 0' }}>
                {search ? `No results for "${search}"` : 'No workers assigned in this filter.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
