import {
  computeWithdrawalBreakdown,
  DEFAULT_SERVICE_FEES,
  MIN_NET_WITHDRAW_PAISE,
} from './labourWithdrawalFees.js'

const STORAGE_KEY = 'lc-labour-wallet-v1'
const EVENT = 'lc-labour-wallet'

export const DEFAULT_RATE_PAISE_PER_MIN = 200

export { DEFAULT_SERVICE_FEES }

function emptyWallet() {
  return {
    version: 3,
    ratePaisePerMin: DEFAULT_RATE_PAISE_PER_MIN,
    serviceFees: { ...DEFAULT_SERVICE_FEES },
    payoutProfile: { upiId: '', accountName: '', bankAccount: '', ifsc: '' },
    credits: [],
    withdrawals: [],
  }
}

function normalizeWithdrawal(w) {
  const gross = Math.round(Number(w.grossAmountPaise ?? w.amountPaise) || 0)
  if (w.netAmountPaise != null && w.platformFeePaise != null) {
    return {
      ...w,
      grossAmountPaise: gross,
      amountPaise: gross,
      status: w.status || 'completed',
    }
  }
  const breakdown = computeWithdrawalBreakdown(gross, DEFAULT_SERVICE_FEES)
  return {
    ...w,
    grossAmountPaise: gross,
    amountPaise: gross,
    platformFeePaise: breakdown.platformFeePaise,
    gstOnFeePaise: breakdown.gstOnFeePaise,
    totalDeductionPaise: breakdown.totalDeductionPaise,
    netAmountPaise: breakdown.netPaise,
    status: w.status || 'completed',
  }
}

function loadRaw() {
  if (typeof window === 'undefined') return emptyWallet()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyWallet()
    const data = JSON.parse(raw)
    const rate =
      typeof data.ratePaisePerMin === 'number' && data.ratePaisePerMin > 0
        ? Math.round(data.ratePaisePerMin)
        : DEFAULT_RATE_PAISE_PER_MIN
    const serviceFees = { ...DEFAULT_SERVICE_FEES, ...(data.serviceFees || {}) }
    const payoutProfile = {
      upiId: '',
      accountName: '',
      bankAccount: '',
      ifsc: '',
      ...(data.payoutProfile || {}),
    }
    const credits = Array.isArray(data.credits) ? data.credits : []
    const withdrawals = Array.isArray(data.withdrawals)
      ? data.withdrawals.map(normalizeWithdrawal)
      : []
    return { version: 3, ratePaisePerMin: rate, serviceFees, payoutProfile, credits, withdrawals }
  } catch {
    return emptyWallet()
  }
}

function saveRaw(data) {
  if (typeof window === 'undefined') return
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 3,
      ratePaisePerMin: data.ratePaisePerMin,
      serviceFees: data.serviceFees,
      payoutProfile: data.payoutProfile,
      credits: data.credits,
      withdrawals: data.withdrawals,
    }),
  )
  window.dispatchEvent(new CustomEvent(EVENT))
}

export function readWalletState() {
  return loadRaw()
}

export function getServiceFeeConfig(wallet = readWalletState()) {
  return { ...DEFAULT_SERVICE_FEES, ...(wallet.serviceFees || {}) }
}

export function subscribeWallet(cb) {
  if (typeof window === 'undefined') return () => {}
  const fn = () => cb(readWalletState())
  window.addEventListener(EVENT, fn)
  window.addEventListener('storage', fn)
  return () => {
    window.removeEventListener(EVENT, fn)
    window.removeEventListener('storage', fn)
  }
}

export function setRatePaisePerMin(ratePaisePerMin) {
  const data = loadRaw()
  data.ratePaisePerMin = Math.max(1, Math.round(Number(ratePaisePerMin) || DEFAULT_RATE_PAISE_PER_MIN))
  saveRaw(data)
}

export function savePayoutProfile(profile) {
  const data = loadRaw()
  data.payoutProfile = {
    ...data.payoutProfile,
    upiId: String(profile.upiId || '').trim().slice(0, 80),
    accountName: String(profile.accountName || '').trim().slice(0, 80),
    bankAccount: String(profile.bankAccount || '').trim().slice(0, 30),
    ifsc: String(profile.ifsc || '').trim().slice(0, 15),
  }
  saveRaw(data)
}

export function addShiftCompletionCredit(assignment) {
  if (!assignment?.id) return null
  const data = loadRaw()
  if (data.credits.some((c) => c.assignmentId === assignment.id)) return null

  const amountPaise = assignment.dayRatePaise || parseDayRateFromLabel(assignment.rateLabel)
  const id = `cr-${assignment.id}`
  data.credits.push({
    id,
    assignmentId: assignment.id,
    requestRef: assignment.requestRef || '',
    status: 'pending',
    amountPaise,
    title: assignment.title || 'Shift completed',
    subtitle: assignment.site || 'Site',
    source: assignment.sourceType || 'assignment',
    createdAt: new Date().toISOString(),
    releasedAt: null,
  })
  saveRaw(data)
  return id
}

function parseDayRateFromLabel(rateLabel) {
  const s = String(rateLabel || '')
  const m = s.match(/₹?\s*([\d,]+(?:\.\d+)?)/)
  if (!m) return 85000
  const rupees = Number(String(m[1]).replace(/,/g, ''))
  return Number.isFinite(rupees) && rupees >= 1 ? Math.round(rupees * 100) : 85000
}

export function releaseAllPendingCredits() {
  const data = loadRaw()
  const now = new Date().toISOString()
  let changed = false
  for (const c of data.credits) {
    if (c.status === 'pending') {
      c.status = 'available'
      c.releasedAt = now
      changed = true
    }
  }
  if (changed) saveRaw(data)
  return changed
}

export function releasePendingCredit(creditId) {
  const data = loadRaw()
  const c = data.credits.find((x) => x.id === creditId)
  if (!c || c.status !== 'pending') return false
  c.status = 'available'
  c.releasedAt = new Date().toISOString()
  saveRaw(data)
  return true
}

/**
 * Full withdrawal with service fee breakdown.
 * @param {{ grossAmountPaise: number, method: string, payoutDetail: string, note?: string }} input
 * @param {number} availableGrossPaise — from buildLabourEarningsSummary
 */
export function createWithdrawalRequest(input, availableGrossPaise) {
  const data = loadRaw()
  const gross = Math.round(Number(input.grossAmountPaise) || 0)
  if (gross < 1) return { ok: false, error: 'Invalid amount.' }

  const available = Math.max(0, Math.round(Number(availableGrossPaise) || 0))
  if (gross > available) {
    return { ok: false, error: 'Amount exceeds withdrawable gross balance.' }
  }

  const fees = getServiceFeeConfig(data)
  const breakdown = computeWithdrawalBreakdown(gross, fees)

  if (breakdown.netPaise < MIN_NET_WITHDRAW_PAISE) {
    return {
      ok: false,
      error: `Minimum payout is ₹${MIN_NET_WITHDRAW_PAISE / 100} after service fees.`,
    }
  }

  const method = input.method || 'upi'
  const payoutDetail = String(input.payoutDetail || '').trim()
  if (!payoutDetail) {
    return { ok: false, error: 'Add UPI ID or bank details to receive money.' }
  }

  const id = `wd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const record = {
    id,
    grossAmountPaise: breakdown.grossPaise,
    amountPaise: breakdown.grossPaise,
    platformFeePaise: breakdown.platformFeePaise,
    gstOnFeePaise: breakdown.gstOnFeePaise,
    totalDeductionPaise: breakdown.totalDeductionPaise,
    netAmountPaise: breakdown.netPaise,
    platformPercent: breakdown.platformPercent,
    gstPercent: breakdown.gstPercent,
    method,
    payoutDetail,
    note: String(input.note || '').trim().slice(0, 120),
    status: 'processing',
    at: new Date().toISOString(),
    completedAt: null,
  }

  data.withdrawals.unshift(record)
  saveRaw(data)

  if (typeof window !== 'undefined') {
    window.setTimeout(() => {
      const latest = loadRaw()
      const w = latest.withdrawals.find((x) => x.id === id)
      if (w && w.status === 'processing') {
        w.status = 'completed'
        w.completedAt = new Date().toISOString()
        saveRaw(latest)
      }
    }, 2200)
  }

  return { ok: true, withdrawal: record, breakdown }
}

/** @deprecated use createWithdrawalRequest */
export function appendWithdrawal(amountPaise, note = '', method = 'upi') {
  return createWithdrawalRequest({
    grossAmountPaise: amountPaise,
    method,
    payoutDetail: note || 'Demo payout',
    note,
  })
}
