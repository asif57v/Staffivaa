import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Briefcase, Clock, FastForward, History, Sparkles } from 'lucide-react'
import { AppEmptyState } from '../../components/app/AppEmptyState.jsx'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { LabourEarningsHero } from '../../components/labour/earnings/LabourEarningsHero.jsx'
import { LabourEarningsWorkflowTimeline } from '../../components/labour/earnings/LabourEarningsWorkflowTimeline.jsx'
import { LabourEarningsDemoCard } from '../../components/labour/earnings/LabourEarningsDemoCard.jsx'
import { LabourWithdrawPanel } from '../../components/labour/earnings/LabourWithdrawPanel.jsx'
import { seedSampleEarningsDemo } from '../../lib/labourEarningsDemoSeed.js'
import {
  buildLabourEarningsSummary,
  earningsWorkflowStepIndex,
  formatInrFromPaise,
  subscribeEarnings,
} from '../../lib/labourEarningsFlow.js'
import { readAttendanceEntries, subscribeAttendance } from '../../lib/labourAttendanceStorage.js'
import { buildWalletEarningsSnapshot } from '../../lib/labourWalletFromAttendance.js'
import {
  DEFAULT_RATE_PAISE_PER_MIN,
  readWalletState,
  releaseAllPendingCredits,
  releasePendingCredit,
  setRatePaisePerMin,
} from '../../lib/labourWalletStorage.js'

function rupeesPerHourFromRate(ratePaisePerMin) {
  return (ratePaisePerMin * 60) / 100
}

export function AppEarningsPage() {
  const reduce = useReducedMotion()
  const [entries, setEntries] = useState(readAttendanceEntries)
  const [wallet, setWallet] = useState(readWalletState)
  const [tab, setTab] = useState('flow')
  const [formError, setFormError] = useState('')
  const [formOk, setFormOk] = useState('')
  const [rateRupeesPerHr, setRateRupeesPerHr] = useState(() =>
    String(Math.round(rupeesPerHourFromRate(readWalletState().ratePaisePerMin || DEFAULT_RATE_PAISE_PER_MIN))),
  )

  useEffect(() => {
    const offA = subscribeAttendance(() => setEntries(readAttendanceEntries()))
    const offW = subscribeEarnings(() => setWallet(readWalletState()))
    return () => {
      offA()
      offW()
    }
  }, [])

  const summary = useMemo(() => buildLabourEarningsSummary(entries, wallet), [entries, wallet])
  const attendanceOnly = useMemo(
    () => buildWalletEarningsSnapshot(entries, wallet.ratePaisePerMin),
    [entries, wallet.ratePaisePerMin],
  )

  const workflowStep = useMemo(() => earningsWorkflowStepIndex(summary, entries), [summary, entries])

  const pendingCredits = useMemo(
    () => (wallet.credits || []).filter((c) => c.status === 'pending'),
    [wallet.credits],
  )

  const showToast = useCallback((msg, ok = true) => {
    if (ok) {
      setFormOk(msg)
      setFormError('')
    } else {
      setFormError(msg)
      setFormOk('')
    }
    window.setTimeout(() => {
      setFormOk('')
      setFormError('')
    }, 3200)
  }, [])

  const handleSaveRate = () => {
    const hr = Number(rateRupeesPerHr)
    if (!Number.isFinite(hr) || hr < 20 || hr > 2000) {
      showToast('Use an hourly rate between ₹20 and ₹2000 (demo).', false)
      return
    }
    setRatePaisePerMin(Math.round((hr * 100) / 60))
    setWallet(readWalletState())
    showToast('Attendance rate updated for estimates.')
  }

  const handleLoadSample = () => {
    const res = seedSampleEarningsDemo({ force: true })
    if (!res.ok) {
      showToast(res.error || 'Could not load sample.', false)
      return
    }
    setEntries(readAttendanceEntries())
    setWallet(readWalletState())
    showToast(
      `Sample loaded: ${formatInrFromPaise(res.availableGrossPaise)} gross · ${formatInrFromPaise(res.availableNetPaise)} max net. Open Withdraw tab.`,
    )
  }

  const handleReleaseAllPending = () => {
    if (!releaseAllPendingCredits()) {
      showToast('No pending payroll lines to release.', false)
      return
    }
    setWallet(readWalletState())
    showToast('Pending pay released to available balance.')
  }

  const activity = useMemo(() => {
    const rate = summary.ratePaisePerMin
    const outs = (wallet.withdrawals || []).flatMap((w) => {
      const gross = w.grossAmountPaise ?? w.amountPaise ?? 0
      const fee = w.totalDeductionPaise ?? 0
      const net = w.netAmountPaise ?? gross
      const rows = [
        {
          key: `${w.id}-gross`,
          kind: 'withdraw',
          at: w.completedAt || w.at,
          title: w.status === 'processing' ? 'Withdrawal (processing)' : 'Withdrawal',
          subtitle: `${w.method?.toUpperCase() || 'UPI'} · ${w.payoutDetail || w.note || ''}`,
          signedPaise: -gross,
        },
      ]
      if (fee > 0) {
        rows.push({
          key: `${w.id}-fee`,
          kind: 'fee',
          at: w.completedAt || w.at,
          title: 'Platform service fee',
          subtitle: `Platform ${w.platformPercent ?? 8}% + GST on fee`,
          signedPaise: -fee,
        })
      }
      rows.push({
        key: `${w.id}-net`,
        kind: 'payout',
        at: w.completedAt || w.at,
        title: 'Net paid to you',
        subtitle: formatInrFromPaise(net),
        signedPaise: net,
      })
      return rows
    })
    const credits = (wallet.credits || []).map((c) => ({
      key: c.id,
      kind: 'payroll',
      at: c.releasedAt || c.createdAt,
      title: c.status === 'pending' ? 'Shift pay (pending)' : 'Shift pay (released)',
      subtitle: `${c.title} · ${c.requestRef || c.subtitle}`,
      signedPaise: c.amountPaise,
    }))
    const seg = [...attendanceOnly.segments]
      .sort((a, b) => new Date(b.outAt) - new Date(a.outAt))
      .slice(0, 12)
      .map((s, i) => ({
        key: `seg-${i}`,
        kind: 'attendance',
        at: s.outAt,
        title: 'Attendance credited',
        subtitle: `${s.projectLabel} · ${s.workLabel} · ${s.minutes} min`,
        signedPaise: s.minutes * rate,
      }))
    return [...outs, ...credits, ...seg].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 24)
  }, [summary.ratePaisePerMin, wallet, attendanceOnly.segments])

  const hasStory = activity.length > 0

  return (
    <div className="space-y-4 pb-8">
      <AnimatePresence>
        {formOk ? (
          <motion.p
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0 }}
            className="fixed left-4 right-4 top-[max(4.5rem,env(safe-area-inset-top))] z-[120] mx-auto max-w-md rounded-2xl border border-emerald-300/40 bg-emerald-900/95 px-4 py-3 text-center text-sm font-semibold text-white shadow-xl"
            role="status"
          >
            {formOk}
          </motion.p>
        ) : null}
        {formError ? (
          <motion.p
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed left-4 right-4 top-[max(4.5rem,env(safe-area-inset-top))] z-[120] mx-auto max-w-md rounded-2xl border border-rose-300/40 bg-rose-900/95 px-4 py-3 text-center text-sm font-semibold text-white shadow-xl"
            role="alert"
          >
            {formError}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <LabourEarningsDemoCard
        summary={summary}
        onLoadSample={handleLoadSample}
        onOpenWithdraw={() => setTab('withdraw')}
      />

      <LabourEarningsHero
        availableNetPaise={summary.availableNetPaise}
        availableGrossPaise={summary.availableGrossPaise}
        pendingPaise={summary.pendingPaise}
        grossPaise={summary.grossPaise}
        totalFeesPaidPaise={summary.totalFeesPaidPaise}
        fees={summary.fees}
      />

      <GlassPanel className="border-slate-200/90 p-1.5">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100/90 p-0.5">
          {[
            { id: 'flow', label: 'Pipeline' },
            { id: 'activity', label: 'Activity' },
            { id: 'withdraw', label: 'Withdraw' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg py-2.5 text-xs font-bold transition ${
                tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </GlassPanel>

      {tab === 'flow' ? (
        <motion.div className="space-y-4" initial={false} animate={{ opacity: 1 }}>
          <GlassPanel className="border-slate-200/90 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Your pay journey</p>
            <div className="mt-3">
              <LabourEarningsWorkflowTimeline activeIndex={workflowStep} />
            </div>
            <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-100">
              <strong className="text-slate-800">1. Attendance</strong> → time pay.{' '}
              <strong className="text-slate-800">2. Complete shift</strong> → payroll (pending).{' '}
              <strong className="text-slate-800">3. Release pay</strong> → gross balance.{' '}
              <strong className="text-slate-800">4. Withdraw</strong> → platform fee + GST deducted → net to UPI/bank.
            </p>
          </GlassPanel>

          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              to="/app/attendance"
              className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100 transition hover:border-brand/30"
            >
              <Clock className="h-8 w-8 text-brand" aria-hidden />
              <span>
                <p className="text-sm font-extrabold text-slate-900">1. Mark attendance</p>
                <p className="text-xs text-slate-500">Tap in / out on site</p>
              </span>
              <ArrowRight className="ml-auto h-4 w-4 text-slate-300" aria-hidden />
            </Link>
            <Link
              to="/app/jobs"
              className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100 transition hover:border-brand/30"
            >
              <Briefcase className="h-8 w-8 text-brand" aria-hidden />
              <span>
                <p className="text-sm font-extrabold text-slate-900">2. Complete shift</p>
                <p className="text-xs text-slate-500">Triggers payroll line</p>
              </span>
              <ArrowRight className="ml-auto h-4 w-4 text-slate-300" aria-hidden />
            </Link>
          </div>

          {pendingCredits.length > 0 ? (
            <GlassPanel className="border-amber-200/80 bg-amber-50/50 p-4">
              <p className="text-xs font-extrabold text-amber-950">Pending payroll ({pendingCredits.length})</p>
              <ul className="mt-3 space-y-2">
                {pendingCredits.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200/60 bg-white px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{c.title}</p>
                      <p className="text-[10px] text-slate-500">{c.requestRef}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black text-amber-900">
                        {formatInrFromPaise(c.amountPaise)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          releasePendingCredit(c.id)
                          setWallet(readWalletState())
                          showToast('Line released to available balance.')
                        }}
                        className="rounded-lg bg-amber-600 px-2 py-1 text-[10px] font-bold text-white"
                      >
                        Release
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <AppPrimaryButton type="button" className="mt-3 w-full py-2.5 text-xs" onClick={handleReleaseAllPending}>
                <FastForward className="h-3.5 w-3.5" aria-hidden />
                Demo: release all pending pay
              </AppPrimaryButton>
            </GlassPanel>
          ) : null}

          <GlassPanel className="border-slate-200/90 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Attendance rate (demo)</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">₹/hr</span>
              <input
                type="number"
                min={20}
                max={2000}
                value={rateRupeesPerHr}
                onChange={(e) => setRateRupeesPerHr(e.target.value)}
                className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
              />
              <button
                type="button"
                onClick={handleSaveRate}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              >
                Apply
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {summary.totalMinutes} min paired · attendance {formatInrFromPaise(summary.attendancePaise)}
            </p>
          </GlassPanel>
        </motion.div>
      ) : null}

      {tab === 'activity' ? (
        <GlassPanel className="border-slate-200/90 p-4">
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-brand" aria-hidden />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Ledger</h3>
          </div>
          {!hasStory ? (
            <AppEmptyState
              icon={Sparkles}
              title="No earnings yet"
              subtitle="Check in on attendance or complete a job shift to see credits here."
            />
          ) : (
            <ul className="space-y-2">
              {activity.map((row) => (
                <li
                  key={row.key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{row.title}</p>
                    <p className="truncate text-xs text-slate-500">{row.subtitle}</p>
                  </div>
                  <span
                    className={`shrink-0 font-mono text-sm font-black ${row.signedPaise < 0 ? 'text-rose-700' : 'text-emerald-700'}`}
                  >
                    {row.signedPaise < 0 ? '−' : '+'}
                    {formatInrFromPaise(Math.abs(row.signedPaise))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
      ) : null}

      {tab === 'withdraw' ? (
        <LabourWithdrawPanel
          summary={summary}
          wallet={wallet}
          onSuccess={(msg) => {
            setWallet(readWalletState())
            showToast(msg)
          }}
          onError={(msg) => showToast(msg, false)}
        />
      ) : null}
    </div>
  )
}
