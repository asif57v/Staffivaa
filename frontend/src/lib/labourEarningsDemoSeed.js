/**
 * One-click sample balance for testing withdraw + fee deduction (device demo).
 */
import { dayKey, replaceAttendanceEntries } from './labourAttendanceStorage.js'
import { buildLabourEarningsSummary } from './labourEarningsFlow.js'
import { maxNetFromAvailableGross } from './labourWithdrawalFees.js'
import { readWalletState } from './labourWalletStorage.js'

const DEMO_FLAG = 'lc-earnings-demo-seeded-v1'

function makePunchPair(dayOffset, startHour, durationMinutes, projectLabel, workLabel) {
  const base = new Date()
  base.setDate(base.getDate() - dayOffset)
  base.setHours(startHour, 0, 0, 0)
  const inAt = new Date(base)
  const outAt = new Date(inAt.getTime() + durationMinutes * 60 * 1000)
  const dk = dayKey(inAt)
  const tag = `${dayOffset}-${startHour}`
  return [
    {
      id: `demo-in-${tag}`,
      type: 'in',
      at: inAt.toISOString(),
      day: dk,
      projectLabel,
      workLabel,
    },
    {
      id: `demo-out-${tag}`,
      type: 'out',
      at: outAt.toISOString(),
      day: dk,
      projectLabel,
      workLabel,
    },
  ]
}

function sampleAttendanceEntries() {
  return [
    ...makePunchPair(2, 8, 360, 'Green Villa Phase 2', 'Masonry'),
    ...makePunchPair(1, 9, 480, 'Skyline Corporate Tower', 'Helper'),
    ...makePunchPair(0, 7, 240, 'Green Villa Phase 2', 'Masonry'),
  ]
}

function sampleWalletCredits(nowIso) {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const twoDaysAgo = new Date()
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

  return [
    {
      id: 'cr-demo-shift-villa',
      assignmentId: 'demo-asg-villa',
      requestRef: 'LC-IND-2401',
      status: 'available',
      amountPaise: 350000,
      title: 'Green Villa — day shift',
      subtitle: 'Sector 62, Noida',
      source: 'individual',
      createdAt: twoDaysAgo.toISOString(),
      releasedAt: yesterday.toISOString(),
    },
    {
      id: 'cr-demo-shift-corp',
      assignmentId: 'demo-asg-corp',
      requestRef: 'LC-CORP-1182',
      status: 'available',
      amountPaise: 280000,
      title: 'Corporate tower — helper',
      subtitle: 'Cyber Hub, Gurugram',
      source: 'corporate',
      createdAt: yesterday.toISOString(),
      releasedAt: nowIso,
    },
    {
      id: 'cr-demo-shift-pending',
      assignmentId: 'demo-asg-pending',
      requestRef: 'LC-IND-2408',
      status: 'pending',
      amountPaise: 180000,
      title: 'Home renovation — painter',
      subtitle: 'Pending admin clearance',
      source: 'individual',
      createdAt: nowIso,
      releasedAt: null,
    },
  ]
}

/**
 * Load ~₹8,000+ gross balance (attendance + released payroll) for withdraw testing.
 * @param {{ force?: boolean }} [opts] — force replaces prior demo wallet lines
 */
export function seedSampleEarningsDemo(opts = {}) {
  if (typeof window === 'undefined') {
    return { ok: false, error: 'Run in browser only.' }
  }

  const force = Boolean(opts.force)
  const existing = localStorage.getItem(DEMO_FLAG)
  const wallet = readWalletState()
  const hasBalance =
    (wallet.credits || []).some((c) => c.status === 'available') ||
    (wallet.withdrawals || []).length > 0

  if (existing && hasBalance && !force) {
    const entries = sampleAttendanceEntries()
    replaceAttendanceEntries(entries)
    return summarizeAfterSeed(entries, wallet)
  }

  const nowIso = new Date().toISOString()
  const attendance = sampleAttendanceEntries()
  replaceAttendanceEntries(attendance)

  const STORAGE_KEY = 'lc-labour-wallet-v1'
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {
    version: 3,
    ratePaisePerMin: 200,
    serviceFees: { platformPercent: 8, gstOnPlatformPercent: 18, fixedFeePaise: 0 },
    payoutProfile: {},
    credits: [],
    withdrawals: [],
  }

  data.version = 3
  data.ratePaisePerMin = 200
  data.serviceFees = data.serviceFees || { platformPercent: 8, gstOnPlatformPercent: 18, fixedFeePaise: 0 }
  data.credits = sampleWalletCredits(nowIso)
  if (force) {
    data.withdrawals = []
  }
  data.payoutProfile = {
    bankAccount: 'XXXX1234',
    ifsc: 'HDFC0001234',
    ...(data.payoutProfile || {}),
    upiId: data.payoutProfile?.upiId?.trim() || 'demoworker@paytm',
    accountName: data.payoutProfile?.accountName?.trim() || 'Ramesh Kumar',
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  localStorage.setItem(DEMO_FLAG, nowIso)
  window.dispatchEvent(new CustomEvent('lc-labour-wallet'))
  window.dispatchEvent(new CustomEvent('lc-labour-attendance'))

  const freshWallet = readWalletState()
  return summarizeAfterSeed(attendance, freshWallet)
}

function summarizeAfterSeed(attendanceEntries, wallet) {
  const summary = buildLabourEarningsSummary(attendanceEntries, wallet)
  return {
    ok: true,
    attendanceMinutes: summary.totalMinutes,
    attendancePaise: summary.attendancePaise,
    creditsAvailablePaise: summary.availableCreditsPaise,
    pendingPaise: summary.pendingPaise,
    availableGrossPaise: summary.availableGrossPaise,
    availableNetPaise: summary.availableNetPaise,
    maxNetPaise: maxNetFromAvailableGross(summary.availableGrossPaise, summary.fees),
    sampleUpi: wallet.payoutProfile?.upiId || 'demoworker@paytm',
  }
}

export const WITHDRAW_DEMO_STEPS = [
  'Tap “Load sample earnings” below (adds ~₹8,000 gross balance).',
  'Open the Withdraw tab.',
  'Step 1: enter gross amount (e.g. 2000) or tap 50% / Max — see fee slip.',
  'Step 2: choose UPI (pre-filled demoworker@paytm) or bank / cash.',
  'Step 3: Confirm — status goes processing → completed in ~2 seconds.',
  'Check Activity tab for withdrawal, platform fee, and net payout lines.',
]
