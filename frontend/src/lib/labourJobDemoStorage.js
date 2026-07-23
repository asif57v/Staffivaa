const STORAGE_KEY = 'lc-labour-jobs-demo-v1'
const EVENT = 'lc-labour-jobs-demo'
const LEGACY_SEED_DISABLED_KEY = 'lc-labour-jobs-seed-off'

function nowIso() {
  return new Date().toISOString()
}

function shiftDateLabel(daysFromNow) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function isoDateDaysFromToday(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

export function getDefaultJobDemoState() {
  return {
    version: 1,
    offers: [
      {
        id: 'demo-offer-1',
        title: 'Bathroom Plumbing Fix',
        site: 'Villa 34, Palm Springs',
        shiftWindow: `${shiftDateLabel(1)} · 10:00–12:00`,
        rateLabel: '₹400 / task',
        trade: 'Plumber',
        sourceType: 'individual',
        requestRef: 'DEMO-SEED-IND',
      },
    ],
    active: [],
    history: [],
  }
}

function readLegacyBuckets() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || data.version !== 1) return null
    return {
      offers: Array.isArray(data.offers) ? data.offers : [],
      active: Array.isArray(data.active) ? data.active : [],
      history: Array.isArray(data.history) ? data.history : [],
    }
  } catch {
    return null
  }
}

export function loadJobDemoState() {
  const legacy = readLegacyBuckets()
  if (legacy) return { version: 1, ...legacy }
  if (typeof window !== 'undefined' && localStorage.getItem(LEGACY_SEED_DISABLED_KEY)) {
    return { version: 1, offers: [], active: [], history: [] }
  }
  return getDefaultJobDemoState()
}

export function saveJobDemoState(state) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LEGACY_SEED_DISABLED_KEY, '1')
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 1,
      offers: state.offers,
      active: state.active,
      history: state.history,
    }),
  )
  window.dispatchEvent(new CustomEvent(EVENT))
}

export function subscribeJobDemo(cb) {
  if (typeof window === 'undefined') return () => {}
  const fn = () => cb(loadJobDemoState())
  window.addEventListener(EVENT, fn)
  window.addEventListener('storage', fn)
  return () => {
    window.removeEventListener(EVENT, fn)
    window.removeEventListener('storage', fn)
  }
}

export function resetJobDemoToSeed() {
  if (typeof window === 'undefined') return getDefaultJobDemoState()
  localStorage.removeItem(LEGACY_SEED_DISABLED_KEY)
  localStorage.removeItem(STORAGE_KEY)
  const next = getDefaultJobDemoState()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent(EVENT))
  return next
}

export { nowIso }

/** Map API assignment + request to job card shape */
export function assignmentToJobCard(assignment) {
  const req = assignment.requestId
  const loc = typeof req === 'object' ? req?.locationText : ''
  const catName = assignment.categoryId?.name || req?.lines?.[0]?.categoryId?.name
  const company = typeof req === 'object' ? req?.clientId?.companyName : null
  const fullName = typeof req === 'object' ? req?.clientId?.fullName : null
  const phone = typeof req === 'object' ? req?.clientId?.phone : null

  return {
    id: assignment._id,
    requestId: typeof req === 'object' ? req?._id : req,
    title: loc || 'Site assignment',
    site: loc || 'See job details',
    location: loc || '',
    shiftWindow: '09:00 AM - 06:00 PM',
    rateLabel: 'Per shift',
    trade: catName || 'Labour',
    role: catName || 'Worker',
    shiftLabel: 'Day shift',
    contractor: company || fullName || 'Contractor',
    supervisor: fullName || '',
    supervisorPhone: phone || '',
    sourceType: typeof req === 'object' ? req?.sourceType : 'individual',
    requestRef: typeof req === 'object' ? req?.reference : '',
    status: assignment.status,
    mapQuery: encodeURIComponent(loc || 'India'),
    locationLat: typeof req === 'object' ? req?.locationLat : undefined,
    locationLng: typeof req === 'object' ? req?.locationLng : undefined,
    paymentStatus: typeof req === 'object' ? req?.paymentStatus : 'pending',
    requestStatus: typeof req === 'object' ? req?.status : assignment.status,
    labourPaymentStatus: typeof req === 'object' ? req?.labourPaymentStatus : 'pending',
    labourPlatformFee: typeof req === 'object' ? req?.labourPlatformFee : undefined,
    distanceKm: typeof req === 'object' ? req?.distanceKm : undefined,
    platformFeePendingAt: typeof req === 'object' ? req?.platformFeePendingAt : undefined,
  }
}

export function bucketsFromAssignments(assignments = []) {
  const offers = []
  const active = []
  const history = []
  for (const a of assignments) {
    const card = assignmentToJobCard(a)
    if (a.status === 'offered') {
      offers.push(card)
    } else if (a.status === 'accepted' || a.status === 'on_site' || a.status === 'in_progress') {
      active.push(card)
    } else if (a.status === 'completed') {
      history.push(card)
    } else {
      history.push(card)
    }
  }
  return { offers, active, history }
}
