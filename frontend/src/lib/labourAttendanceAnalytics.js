import { buildAssignmentDetailSnapshot, projectLabelMatches } from './labourAssignmentDetail.js'
import { dayKey, pairedMinutesForDay } from './labourAttendanceStorage.js'
import { enrichJobForHome } from './labourHomeHelpers.js'
import { formatSecondsAsClock } from './formatDurationClock.js'

const STATUS_TONE = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  sky: 'bg-sky-500',
  brand: 'bg-brand',
  slate: 'bg-slate-300',
}

export function dayStatusFromMinutes(mins, hasOpenPunch = false) {
  if (hasOpenPunch) return { label: 'On site', tone: 'brand' }
  if (mins >= 420) return { label: 'Present', tone: 'emerald' }
  if (mins >= 180) return { label: 'Half day', tone: 'amber' }
  if (mins > 0) return { label: 'Short', tone: 'sky' }
  return { label: 'Absent', tone: 'rose' }
}

function formatDayLabel(isoDay) {
  const d = new Date(`${isoDay}T12:00:00`)
  if (Number.isNaN(d.getTime())) return isoDay
  const today = dayKey()
  if (isoDay === today) return 'Today'
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (isoDay === dayKey(yesterday)) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/** Last N calendar days, newest first. */
export function buildDailyAttendanceRows(entries, dayCount = 14) {
  const rows = []
  for (let i = 0; i < dayCount; i += 1) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dk = dayKey(d)
    const dayEntries = entries.filter((e) => e.day === dk).sort((a, b) => new Date(a.at) - new Date(b.at))
    const mins = pairedMinutesForDay(entries, dk)
    const last = dayEntries[dayEntries.length - 1]
    const hasOpen = last?.type === 'in'
    const status = dayStatusFromMinutes(mins, hasOpen)
    const projects = [...new Set(dayEntries.map((e) => e.projectLabel).filter((p) => p && p !== 'Unassigned'))]
    const works = [...new Set(dayEntries.map((e) => e.workLabel).filter((w) => w && w !== 'Unassigned'))]

    rows.push({
      day: dk,
      label: formatDayLabel(dk),
      minutes: mins,
      workTime: mins > 0 ? formatSecondsAsClock(mins * 60) : '—',
      status,
      toneClass: STATUS_TONE[status.tone] || STATUS_TONE.slate,
      punches: dayEntries.map((p) => ({
        id: p.id,
        type: p.type,
        at: p.at,
        time: formatTime(p.at),
        projectLabel: p.projectLabel,
        workLabel: p.workLabel,
      })),
      projects,
      works,
      isToday: dk === dayKey(),
    })
  }
  return rows
}

export function buildWeekAttendanceSummary(entries) {
  const rows = buildDailyAttendanceRows(entries, 7)
  const totalMinutes = rows.reduce((a, r) => a + r.minutes, 0)
  const presentDays = rows.filter((r) => r.minutes >= 180).length
  const onSiteToday = rows[0]?.status?.tone === 'brand'
  return { totalMinutes, presentDays, onSiteToday, rows }
}

function uniqueJobs(demoState) {
  const seen = new Set()
  const list = []
  for (const j of [...(demoState?.active || []), ...(demoState?.history || []), ...(demoState?.offers || [])]) {
    if (!j?.id || seen.has(j.id)) continue
    seen.add(j.id)
    list.push(j)
  }
  return list
}

/** Assignments with per-day attendance grid (e.g. 10-day project). */
export function buildProjectAttendanceBundles(entries, demoState) {
  const jobs = uniqueJobs(demoState)
  const bundles = []
  const matchedLabels = new Set()

  for (const raw of jobs) {
    const job = enrichJobForHome(raw)
    if (!job) continue
    const detail = buildAssignmentDetailSnapshot(entries, job, raw)
    if (!detail) continue

    const hasAny =
      detail.workedDays > 0 ||
      detail.attendanceLog.some((r) => r.punches?.length > 0) ||
      demoState?.active?.some((a) => a.id === raw.id)

    if (raw.title) matchedLabels.add(String(raw.title).toLowerCase())
    if (raw.site) matchedLabels.add(String(raw.site).toLowerCase())

    bundles.push({
      id: raw.id,
      kind: demoState?.active?.some((a) => a.id === raw.id) ? 'active' : raw.completedAt ? 'completed' : 'scheduled',
      job,
      detail,
      title: job.title,
      site: job.location,
      trade: job.role,
      durationDays: detail.durationDays,
      dayIndex: detail.dayIndex,
      workedDays: detail.workedDays,
      progressPct: detail.progressPct,
      totalWorkTime: detail.totalWorkTime,
      startLabel: detail.startLabel,
      endLabel: detail.endLabel,
      attendanceLog: detail.attendanceLog,
      isMultiDay: detail.isMultiDay,
      hasAny,
    })
  }

  bundles.sort((a, b) => {
    const order = { active: 0, scheduled: 1, completed: 2 }
    return (order[a.kind] ?? 3) - (order[b.kind] ?? 3)
  })

  const orphanMap = new Map()
  for (const e of entries) {
    const label = e.projectLabel?.trim()
    if (!label || label === 'Unassigned') continue
    const low = label.toLowerCase()
    const matched = [...matchedLabels].some((m) => low === m || low.includes(m) || m.includes(low))
    if (matched) continue
    if (!orphanMap.has(label)) orphanMap.set(label, [])
    orphanMap.get(label).push(e)
  }

  for (const [label, list] of orphanMap) {
    const days = buildDailyAttendanceRows(list, 14)
    const totalMinutes = days.reduce((a, r) => a + r.minutes, 0)
    bundles.push({
      id: `orphan-${label}`,
      kind: 'manual',
      job: { title: label, location: label, role: list[0]?.workLabel || 'General' },
      detail: null,
      title: label,
      site: list[0]?.workLabel !== 'Unassigned' ? list[0].workLabel : 'Tagged punches',
      trade: list[0]?.workLabel || '—',
      durationDays: days.filter((d) => d.minutes > 0).length,
      dayIndex: days.filter((d) => d.minutes > 0).length,
      workedDays: days.filter((d) => d.minutes >= 180).length,
      progressPct: 0,
      totalWorkTime: formatSecondsAsClock(totalMinutes * 60),
      startLabel: days[days.length - 1]?.label,
      endLabel: days[0]?.label,
      attendanceLog: days.slice(0, 10).reverse().map((d) => ({
        day: d.day,
        dayLabel: d.label,
        minutes: d.minutes,
        workTime: d.workTime,
        status: d.status,
        isToday: d.isToday,
        isFuture: false,
        punches: d.punches,
      })),
      isMultiDay: false,
      hasAny: totalMinutes > 0,
    })
  }

  return bundles
}

/** Group by type of work / trade. */
export function buildWorkAttendanceGroups(entries, dayCount = 14) {
  const map = new Map()
  const dayKeys = []
  for (let i = 0; i < dayCount; i += 1) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dayKeys.push(dayKey(d))
  }

  for (const e of entries) {
    const label = e.workLabel?.trim() || 'Unassigned'
    if (!map.has(label)) map.set(label, [])
    map.get(label).push(e)
  }

  return [...map.entries()]
    .map(([label, list]) => {
      const mins = dayKeys.reduce((acc, dk) => acc + pairedMinutesForDay(list, dk), 0)
      const daysWorked = dayKeys.filter((dk) => pairedMinutesForDay(list, dk) > 0).length
      const projects = [...new Set(list.map((e) => e.projectLabel).filter((p) => p && p !== 'Unassigned'))]
      const last = [...list].sort((a, b) => new Date(b.at) - new Date(a.at))[0]
      return {
        label,
        minutes: mins,
        workTime: mins > 0 ? formatSecondsAsClock(mins * 60) : '—',
        daysWorked,
        punchCount: list.length,
        projects,
        lastAt: last?.at,
        lastTime: last ? formatTime(last.at) : '—',
      }
    })
    .sort((a, b) => b.minutes - a.minutes)
}

export function projectOptionsFromJobs(demoState, entries) {
  const opts = new Set()
  for (const j of uniqueJobs(demoState)) {
    if (j.title) opts.add(j.title)
    if (j.site) opts.add(j.site)
  }
  for (const e of entries) {
    if (e.projectLabel && e.projectLabel !== 'Unassigned') opts.add(e.projectLabel)
  }
  return ['', ...[...opts].sort((a, b) => a.localeCompare(b))]
}

export function workOptionsFromJobs(demoState, entries) {
  const opts = new Set(['Masonry', 'Electrical', 'Plumbing', 'General helper', 'Painting', 'Helper'])
  for (const j of uniqueJobs(demoState)) {
    if (j.trade) opts.add(j.trade)
  }
  for (const e of entries) {
    if (e.workLabel && e.workLabel !== 'Unassigned') opts.add(e.workLabel)
  }
  return ['', ...[...opts].sort((a, b) => a.localeCompare(b))]
}

export function defaultLabelsFromActiveJob(demoState) {
  const active = demoState?.active?.[0]
  if (!active) return { projectLabel: '', workLabel: '' }
  return {
    projectLabel: active.title || active.site || '',
    workLabel: active.trade || '',
  }
}

export { projectLabelMatches, formatTime, formatDayLabel }
