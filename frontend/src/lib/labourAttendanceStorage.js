const STORAGE_KEY = 'lc-labour-attendance-v1'

function dayKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function loadRaw() {
  if (typeof window === 'undefined') return { version: 1, entries: [] }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { version: 1, entries: [] }
    const data = JSON.parse(raw)
    if (!Array.isArray(data.entries)) return { version: 1, entries: [] }
    return data
  } catch {
    return { version: 1, entries: [] }
  }
}

function saveRaw(data) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  window.dispatchEvent(new CustomEvent('lc-labour-attendance'))
}

export function readAttendanceEntries() {
  return loadRaw().entries
}

export function minutesBetween(a, b) {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000))
}

export function pairedMinutesForDay(entries, dk) {
  const day = entries.filter((e) => e.day === dk).sort((a, b) => new Date(a.at) - new Date(b.at))
  let open = null
  let mins = 0
  for (const e of day) {
    if (e.type === 'in') {
      open = e.at
    } else if (e.type === 'out' && open) {
      mins += minutesBetween(open, e.at)
      open = null
    }
  }
  return mins
}

export function lastTodayType(entries) {
  const dk = dayKey()
  const today = entries.filter((e) => e.day === dk).sort((a, b) => new Date(a.at) - new Date(b.at))
  if (!today.length) return null
  return today[today.length - 1].type
}

export function weekPairedMinutes(entries) {
  let total = 0
  for (let i = 0; i < 7; i += 1) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    total += pairedMinutesForDay(entries, dayKey(d))
  }
  return total
}

function lastOpenCheckInIsoForDay(entries, dk) {
  const day = entries.filter((e) => e.day === dk).sort((a, b) => new Date(a.at) - new Date(b.at))
  let open = null
  for (const e of day) {
    if (e.type === 'in') open = e.at
    else if (e.type === 'out' && open) open = null
  }
  return open
}

/** Completed pairs + open segment since last tap-in (for live UI clocks). */
export function liveWorkedSecondsForDay(entries, dk, now = new Date()) {
  const closed = pairedMinutesForDay(entries, dk) * 60
  const open = lastOpenCheckInIsoForDay(entries, dk)
  if (!open) return closed
  return closed + Math.max(0, Math.floor((now.getTime() - new Date(open).getTime()) / 1000))
}

export function subscribeAttendance(cb) {
  if (typeof window === 'undefined') return () => {}
  const fn = () => cb(readAttendanceEntries())
  window.addEventListener('lc-labour-attendance', fn)
  window.addEventListener('storage', fn)
  return () => {
    window.removeEventListener('lc-labour-attendance', fn)
    window.removeEventListener('storage', fn)
  }
}

/**
 * @param {'in' | 'out'} type
 * @param {{ projectLabel: string, workLabel: string }} labels
 */
/** Replace all entries (demo seed). */
export function replaceAttendanceEntries(entries) {
  const data = loadRaw()
  data.entries = Array.isArray(entries) ? entries : []
  saveRaw(data)
}

export function appendAttendancePunch(type, { projectLabel, workLabel }) {
  const data = loadRaw()
  const at = new Date().toISOString()
  const id = `${at}-${Math.random().toString(36).slice(2, 9)}`
  data.entries.push({
    id,
    type,
    at,
    day: dayKey(new Date(at)),
    projectLabel: projectLabel?.trim() || 'Unassigned',
    workLabel: workLabel?.trim() || 'Unassigned',
  })
  saveRaw(data)
}

export { dayKey }
