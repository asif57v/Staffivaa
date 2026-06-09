import { dayKey, pairedMinutesForDay } from './labourAttendanceStorage.js'
import { buildLabourEarningsSummary } from './labourEarningsFlow.js'
import { readWalletState } from './labourWalletStorage.js'

export const LABOUR_SUPPORT_PHONE = '18002580000'
export const LABOUR_EMERGENCY_PHONE = '112'

export const SAFETY_BANNERS = [
  {
    id: 'helmet',
    title: 'Wear your helmet on site',
    subtitle: 'Hard hat mandatory in active zones — report missing PPE to your supervisor.',
    tone: 'from-amber-500 to-orange-600',
    icon: 'helmet',
  },
  {
    id: 'rights',
    title: 'Know your labour rights',
    subtitle: 'Fair wages, safe conditions, and documented attendance protect your pay.',
    tone: 'from-brand-bright to-brand',
    icon: 'shield',
  },
  {
    id: 'hydration',
    title: 'Stay hydrated in summer',
    subtitle: 'Take water breaks every 2 hours — heat stress is preventable.',
    tone: 'from-sky-500 to-blue-600',
    icon: 'droplet',
  },
  {
    id: 'training',
    title: 'Free safety training',
    subtitle: 'Short videos on scaffolding, electrical lock-out, and first aid — coming in-app.',
    tone: 'from-violet-500 to-purple-600',
    icon: 'book',
  },
]

const DEFAULT_FACILITIES = ['Water', 'Safety kit', 'Rest area']

/** @param {import('./labourJobDemoStorage.js').loadJobDemoState extends Function ? ReturnType<typeof import('./labourJobDemoStorage.js').loadJobDemoState>['active'][0] : object} job */
export function enrichJobForHome(job) {
  if (!job) return null
  const shiftParts = String(job.shiftWindow || '').split('·')
  const timePart = shiftParts.length > 1 ? shiftParts[1].trim() : job.shiftWindow
  const durationDays = Math.max(1, Number(job.projectDurationDays) || 1)
  const startIso = job.projectStartDate || null
  let endIso = null
  if (startIso && durationDays > 0) {
    const d = new Date(`${startIso}T12:00:00`)
    if (!Number.isNaN(d.getTime())) {
      d.setDate(d.getDate() + durationDays - 1)
      endIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
  }

  return {
    id: job.id,
    title: job.title,
    siteName: job.title?.replace(/^[^—]+—\s*/, '') || job.title,
    contractor: job.contractorName || 'Assigned contractor',
    location: job.site,
    role: job.trade,
    shiftLabel: timePart || '9:00 AM – 6:00 PM',
    rateLabel: job.rateLabel,
    supervisor: job.supervisor,
    supervisorPhone: job.supervisorPhone,
    daysLabel: job.headcount,
    facilities: job.facilities || DEFAULT_FACILITIES,
    notes: job.notes,
    urgency: job.urgency,
    mapQuery: encodeURIComponent(job.site || 'construction site'),
    contractorName: job.contractorName,
    projectCode: job.projectCode,
    projectDurationDays: durationDays,
    projectStartDate: startIso,
    projectEndDate: endIso,
    reportingTime: job.reportingTime,
    endTime: job.endTime,
    gateInstruction: job.gateInstruction,
    acceptedAt: job.acceptedAt,
  }
}

export function pickTodayAssignment(demoState, apiBuckets = null) {
  const activeApi = apiBuckets?.active?.[0]
  if (activeApi) return { kind: 'active', job: enrichJobForHome(activeApi), raw: activeApi }

  const active = demoState?.active?.[0]
  if (active) return { kind: 'active', job: enrichJobForHome(active), raw: active }

  const checkIsToday = (o) => {
    const w = String(o.shiftWindow || '')
    const d = new Date()
    const todayLabel = d.toLocaleDateString(undefined, { weekday: 'short' })
    return w.toLowerCase().includes(todayLabel.toLowerCase()) || w.includes('Today')
  }

  const todayApiOffer = (apiBuckets?.offers || []).find(checkIsToday)
  if (todayApiOffer) return { kind: 'offer', job: enrichJobForHome(todayApiOffer), raw: todayApiOffer }

  const todayOffer = (demoState?.offers || []).find(checkIsToday)
  if (todayOffer) return { kind: 'offer', job: enrichJobForHome(todayOffer), raw: todayOffer }
  
  return { kind: 'none', job: null, raw: null }
}

export function buildUpcomingSchedule(demoState, limit = 4) {
  const rows = []
  for (const j of demoState?.active || []) {
    rows.push({ ...enrichJobForHome(j), when: 'Active now', tone: 'brand' })
  }
  for (const j of demoState?.offers || []) {
    const when = String(j.shiftWindow || '').split('·')[0]?.trim() || 'Upcoming'
    rows.push({ ...enrichJobForHome(j), when, tone: j.urgency === 'high' ? 'amber' : 'slate' })
  }
  return rows.slice(0, limit)
}

export function buildAttendanceHistoryRows(entries, dayCount = 7) {
  const rows = []
  for (let i = 0; i < dayCount; i += 1) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dk = dayKey(d)
    const mins = pairedMinutesForDay(entries, dk)
    const dayEntries = entries.filter((e) => e.day === dk)
    let status = 'Absent'
    let tone = 'rose'
    if (mins >= 420) {
      status = 'Present'
      tone = 'emerald'
    } else if (mins >= 180) {
      status = 'Half day'
      tone = 'amber'
    } else if (mins > 0) {
      status = 'Short shift'
      tone = 'sky'
    } else if (dayEntries.some((e) => e.type === 'in')) {
      status = 'Open shift'
      tone = 'brand'
    }
    rows.push({
      dk,
      label: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      status,
      tone,
      mins,
    })
  }
  return rows
}

export function buildEarningsGlance(entries, ratePaisePerMin, _withdrawnPaise = 0) {
  const wallet = readWalletState()
  const w =
    ratePaisePerMin && ratePaisePerMin !== wallet.ratePaisePerMin
      ? { ...wallet, ratePaisePerMin }
      : wallet
  const s = buildLabourEarningsSummary(entries, w)
  return {
    todayPaise: s.todayPaise,
    weekPaise: s.weekPaise,
    monthPaise: s.monthPaise,
    pendingPaise: s.pendingPaise,
    availablePaise: s.availableNetPaise,
    availableGrossPaise: s.availableGrossPaise,
    earnedPaise: s.grossPaise,
  }
}

export function formatInrFromPaise(paise) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(paise / 100)
}

export function offerDistanceKm(offerId) {
  let h = 0
  const s = String(offerId || '')
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 997
  return (h % 8) + 1
}

export function whatsAppSupportUrl(message = 'Hi Staffivaa, I need help on site.') {
  const phone = LABOUR_SUPPORT_PHONE.replace(/\D/g, '')
  return `https://wa.me/91${phone.slice(-10)}?text=${encodeURIComponent(message)}`
}
