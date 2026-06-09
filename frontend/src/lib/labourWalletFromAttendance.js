import { minutesBetween } from './labourAttendanceStorage.js'

/**
 * Completed tap-in → tap-out segments (labels taken from the check-in row).
 * @returns {{ minutes: number, projectLabel: string, workLabel: string, day: string, outAt: string }[]}
 */
export function getCompletedShiftSegments(entries) {
  const byDay = new Map()
  for (const e of entries) {
    if (!e?.day) continue
    if (!byDay.has(e.day)) byDay.set(e.day, [])
    byDay.get(e.day).push(e)
  }
  const days = [...byDay.keys()].sort((a, b) => a.localeCompare(b))
  const segments = []
  for (const dk of days) {
    const sorted = [...byDay.get(dk)].sort((a, b) => new Date(a.at) - new Date(b.at))
    let openIn = null
    for (const e of sorted) {
      if (e.type === 'in') openIn = e
      else if (e.type === 'out' && openIn) {
        const mins = minutesBetween(openIn.at, e.at)
        if (mins > 0) {
          segments.push({
            minutes: mins,
            projectLabel: openIn.projectLabel || 'Unassigned',
            workLabel: openIn.workLabel || 'Unassigned',
            day: openIn.day,
            outAt: e.at,
          })
        }
        openIn = null
      }
    }
  }
  return segments
}

function bucketAggregate(segments, ratePaisePerMin, field) {
  const map = new Map()
  for (const s of segments) {
    const label = s[field] || 'Unassigned'
    if (!map.has(label)) map.set(label, { minutes: 0, paise: 0 })
    const row = map.get(label)
    row.minutes += s.minutes
    row.paise += s.minutes * ratePaisePerMin
  }
  return [...map.entries()]
    .map(([label, v]) => ({ label, minutes: v.minutes, paise: v.paise }))
    .sort((a, b) => b.paise - a.paise)
}

/**
 * @param {Array<{ type: string, at: string, day: string, projectLabel?: string, workLabel?: string }>} entries
 */
export function buildWalletEarningsSnapshot(entries, ratePaisePerMin) {
  const rate = Math.max(1, Math.round(ratePaisePerMin || 1))
  const segments = getCompletedShiftSegments(entries)
  const earnedPaise = segments.reduce((acc, s) => acc + s.minutes * rate, 0)
  const totalMinutes = segments.reduce((acc, s) => acc + s.minutes, 0)
  const byProject = bucketAggregate(segments, rate, 'projectLabel').map((row) => ({
    ...row,
    pct: earnedPaise > 0 ? Math.round((row.paise / earnedPaise) * 100) : 0,
  }))
  const byWork = bucketAggregate(segments, rate, 'workLabel').map((row) => ({
    ...row,
    pct: earnedPaise > 0 ? Math.round((row.paise / earnedPaise) * 100) : 0,
  }))
  return { segments, earnedPaise, totalMinutes, byProject, byWork, ratePaisePerMin: rate }
}
