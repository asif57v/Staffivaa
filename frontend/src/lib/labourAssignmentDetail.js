import { dayKey, pairedMinutesForDay } from './labourAttendanceStorage.js'
import { formatSecondsAsClock } from './formatDurationClock.js'

/** Match attendance punches to this assignment (by project title / site). */
export function projectLabelMatches(entryLabel, job) {
  const e = String(entryLabel || '')
    .trim()
    .toLowerCase()
  if (!e || e === 'unassigned') return false
  const candidates = [
    job?.title,
    job?.siteName,
    job?.location,
    job?.projectCode,
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase())
  return candidates.some((c) => c === e || c.includes(e) || e.includes(c))
}

function formatDayLabel(isoDay) {
  const d = new Date(`${isoDay}T12:00:00`)
  if (Number.isNaN(d.getTime())) return isoDay
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

function dayStatusFromMinutes(mins, hasOpenPunch) {
  if (hasOpenPunch) return { label: 'On site now', tone: 'brand' }
  if (mins >= 420) return { label: 'Present', tone: 'emerald' }
  if (mins >= 180) return { label: 'Half day', tone: 'amber' }
  if (mins > 0) return { label: 'Short shift', tone: 'sky' }
  return { label: 'Absent', tone: 'slate' }
}

function enumerateProjectDays(startIso, durationDays) {
  if (!startIso || !durationDays || durationDays < 1) return []
  const start = new Date(`${startIso}T12:00:00`)
  if (Number.isNaN(start.getTime())) return []
  const keys = []
  for (let i = 0; i < durationDays; i += 1) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    keys.push(dayKey(d))
  }
  return keys
}

/**
 * @param {Array<{ type: string, at: string, day: string, projectLabel?: string, workLabel?: string }>} entries
 * @param {ReturnType<import('./labourHomeHelpers.js').enrichJobForHome>} job
 */
export function buildAssignmentDetailSnapshot(entries, job, rawJob = null) {
  if (!job) return null

  const durationDays = Math.max(1, Number(job.projectDurationDays) || 1)
  const startIso = job.projectStartDate || dayKey()
  const projectDays = enumerateProjectDays(startIso, durationDays)
  const endIso = projectDays[projectDays.length - 1] || startIso
  const todayIso = dayKey()

  const matching = entries.filter((e) => projectLabelMatches(e.projectLabel, job))
  const punchesByDay = new Map()
  for (const e of matching) {
    if (!punchesByDay.has(e.day)) punchesByDay.set(e.day, [])
    punchesByDay.get(e.day).push(e)
  }
  for (const list of punchesByDay.values()) {
    list.sort((a, b) => new Date(a.at) - new Date(b.at))
  }

  const attendanceLog = projectDays.map((dk) => {
    const dayEntries = punchesByDay.get(dk) || []
    const mins = dayEntries.length ? pairedMinutesForDay(dayEntries, dk) : pairedMinutesForDay(
      entries.filter((e) => e.day === dk && projectLabelMatches(e.projectLabel, job)),
      dk,
    )
    const last = dayEntries[dayEntries.length - 1]
    const hasOpen = last?.type === 'in'
    const status = dayStatusFromMinutes(mins, hasOpen)
    const isToday = dk === todayIso
    const isFuture = dk > todayIso

    return {
      day: dk,
      dayLabel: formatDayLabel(dk),
      minutes: mins,
      workTime: mins > 0 ? formatSecondsAsClock(mins * 60) : '—',
      status,
      isToday,
      isFuture,
      punches: dayEntries.map((p) => ({
        type: p.type,
        at: p.at,
        time: new Date(p.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
      })),
    }
  })

  const workedDays = attendanceLog.filter((r) => r.minutes > 0 && !r.isFuture).length
  const totalMinutes = attendanceLog.reduce((a, r) => a + r.minutes, 0)
  const elapsedCalendarDays =
    projectDays.filter((dk) => dk <= todayIso && dk >= startIso).length || 1
  const dayIndex = Math.min(
    durationDays,
    Math.max(1, projectDays.indexOf(todayIso) + 1 || elapsedCalendarDays),
  )

  const timeline = []
  if (rawJob?.acceptedAt) {
    timeline.push({
      at: rawJob.acceptedAt,
      title: 'Assignment accepted',
      body: 'You joined this project on Staffivaa (demo).',
    })
  }
  timeline.push({
    at: `${startIso}T08:00:00`,
    title: 'Project start date',
    body: `${durationDays}-day deployment · ${job.contractor || 'Contractor'}`,
  })
  if (matching.length > 0) {
    const first = [...matching].sort((a, b) => new Date(a.at) - new Date(b.at))[0]
    timeline.push({
      at: first.at,
      title: 'First check-in on site',
      body: `${new Date(first.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`,
    })
  }
  timeline.sort((a, b) => new Date(b.at) - new Date(a.at))

  return {
    job,
    durationDays,
    startIso,
    endIso,
    endLabel: formatDayLabel(endIso),
    startLabel: formatDayLabel(startIso),
    dayIndex,
    daysRemaining: Math.max(0, durationDays - dayIndex),
    workedDays,
    totalWorkTime: formatSecondsAsClock(totalMinutes * 60),
    progressPct: Math.min(100, Math.round((workedDays / durationDays) * 100)),
    attendanceLog,
    timeline,
    isMultiDay: durationDays > 1,
    rawNotes: job.notes,
    gateInstruction: job.gateInstruction,
    acceptedAt: rawJob?.acceptedAt,
  }
}
