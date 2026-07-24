/**
 * Labour earnings pipeline — attendance → payroll → service fee → withdraw (demo).
 */
import { getCompletedShiftSegments } from './labourWalletFromAttendance.js'
import {
  computeWithdrawalBreakdown,
  maxNetFromAvailableGross,
  MIN_NET_WITHDRAW_PAISE,
} from './labourWithdrawalFees.js'
import { getServiceFeeConfig, readWalletState, subscribeWallet } from './labourWalletStorage.js'

export { computeWithdrawalBreakdown, maxNetFromAvailableGross, MIN_NET_WITHDRAW_PAISE }

export const EARNINGS_WORKFLOW = [
  { id: 'accept', label: 'Accept', short: 'Accepted' },
  { id: 'approval', label: 'Client approval', short: 'Approved' },
  { id: 'otp', label: 'OTP verification', short: 'OTP' },
  { id: 'done', label: 'Done', short: 'Done' },
]

export const CREDIT_STATUS = {
  PENDING: 'pending',
  AVAILABLE: 'available',
}

export const WITHDRAWAL_STATUS = {
  REQUESTED: 'requested',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
}

/** Parse "₹850 / day" → paise per day. */
export function parseDayRatePaise(rateLabel) {
  const s = String(rateLabel || '')
  const m = s.match(/₹?\s*([\d,]+(?:\.\d+)?)/)
  if (!m) return 85000
  const rupees = Number(String(m[1]).replace(/,/g, ''))
  if (!Number.isFinite(rupees) || rupees < 1) return 85000
  return Math.round(rupees * 100)
}

export function formatInrFromPaise(paise) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format((paise || 0) / 100)
}

function withdrawalGrossPaise(w) {
  return Math.round(Number(w?.grossAmountPaise ?? w?.amountPaise) || 0)
}

/**
 * @param {Array} attendanceEntries
 * @param {ReturnType<typeof readWalletState>} [wallet]
 */
export function buildLabourEarningsSummary(attendanceEntries, wallet = readWalletState()) {
  const fees = getServiceFeeConfig(wallet)
  const rate = Math.max(1, Math.round(wallet.ratePaisePerMin || 200))
  const segments = getCompletedShiftSegments(attendanceEntries)
  const attendancePaise = segments.reduce((acc, s) => acc + s.minutes * rate, 0)
  const totalMinutes = segments.reduce((acc, s) => acc + s.minutes, 0)

  const credits = Array.isArray(wallet.credits) ? wallet.credits : []
  const pendingCreditsPaise = credits
    .filter((c) => c.status === CREDIT_STATUS.PENDING)
    .reduce((acc, c) => acc + (c.amountPaise || 0), 0)
  const availableCreditsPaise = credits
    .filter((c) => c.status === CREDIT_STATUS.AVAILABLE)
    .reduce((acc, c) => acc + (c.amountPaise || 0), 0)

  const withdrawals = Array.isArray(wallet.withdrawals) ? wallet.withdrawals : []
  const withdrawnGrossPaise = withdrawals.reduce((acc, w) => acc + withdrawalGrossPaise(w), 0)
  const withdrawnNetPaise = withdrawals.reduce(
    (acc, w) => acc + Math.round(Number(w.netAmountPaise ?? withdrawalGrossPaise(w)) || 0),
    0,
  )
  const totalFeesPaidPaise = withdrawals.reduce(
    (acc, w) => acc + Math.round(Number(w.totalDeductionPaise ?? 0) || 0),
    0,
  )

  const grossPoolPaise = attendancePaise + availableCreditsPaise
  const availableGrossPaise = Math.max(0, grossPoolPaise - withdrawnGrossPaise)
  const availableNetPaise = maxNetFromAvailableGross(availableGrossPaise, fees)

  const grossPaise = attendancePaise + pendingCreditsPaise + availableCreditsPaise
  const pendingPaise = pendingCreditsPaise

  const now = new Date()
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const weekKeys = new Set()
  for (let i = 0; i < 7; i += 1) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    weekKeys.add(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    )
  }
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  let todayPaise = 0
  let weekPaise = 0
  let monthPaise = 0
  for (const s of segments) {
    const p = s.minutes * rate
    if (s.day === todayKey) todayPaise += p
    if (weekKeys.has(s.day)) weekPaise += p
    if (s.day.startsWith(monthPrefix)) monthPaise += p
  }
  for (const c of credits) {
    const day = String(c.createdAt || '').slice(0, 10)
    if (!day) continue
    const p = c.amountPaise || 0
    if (day === todayKey) todayPaise += p
    if (weekKeys.has(day)) weekPaise += p
    if (day.startsWith(monthPrefix)) monthPaise += p
  }

  return {
    fees,
    ratePaisePerMin: rate,
    attendancePaise,
    totalMinutes,
    segments,
    credits,
    withdrawals,
    pendingCreditsPaise,
    availableCreditsPaise,
    withdrawnGrossPaise,
    withdrawnNetPaise,
    totalFeesPaidPaise,
    grossPoolPaise,
    availableGrossPaise,
    availableNetPaise,
    grossPaise,
    pendingPaise,
    earnedPaise: grossPaise,
    availablePaise: availableGrossPaise,
    todayPaise,
    weekPaise,
    monthPaise,
  }
}

export function earningsWorkflowStepIndex(summary, attendanceEntries) {
  const hasAttendance = (attendanceEntries || []).some((e) => e.type === 'in')
  const hasPaired = (summary.segments || []).length > 0
  const hasPending = summary.pendingCreditsPaise > 0
  const hasAvailable = summary.availableGrossPaise > 0
  const hasWithdrawal = (summary.withdrawals || []).length > 0

  if (hasWithdrawal) return 3
  if (hasAvailable) return 2
  if (hasPending) return 1
  if (hasPaired || hasAttendance) return 0
  return 0
}

export function subscribeEarnings(cb) {
  return subscribeWallet(cb)
}
