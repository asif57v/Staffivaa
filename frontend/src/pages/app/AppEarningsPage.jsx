import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Briefcase, Clock, History, Sparkles } from 'lucide-react'
import { AppEmptyState } from '../../components/app/AppEmptyState.jsx'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { LabourEarningsHero } from '../../components/labour/earnings/LabourEarningsHero.jsx'
import { LabourEarningsWorkflowTimeline } from '../../components/labour/earnings/LabourEarningsWorkflowTimeline.jsx'
import { LabourWithdrawPanel } from '../../components/labour/earnings/LabourWithdrawPanel.jsx'
import {
  buildLabourEarningsSummary,
  earningsWorkflowStepIndex,
  formatInrFromPaise,
  subscribeEarnings,
} from '../../lib/labourEarningsFlow.js'
import { readAttendanceEntries, subscribeAttendance } from '../../lib/labourAttendanceStorage.js'
import { buildWalletEarningsSnapshot } from '../../lib/labourWalletFromAttendance.js'
import {
  readWalletState,
  releasePendingCredit,
} from '../../lib/labourWalletStorage.js'
import { useGetWalletBalanceQuery, useRequestRefundMutation } from '../../store/api/walletApi.js'

export function AppEarningsPage() {
  const reduce = useReducedMotion()
  const [entries, setEntries] = useState(readAttendanceEntries)
  const [wallet, setWallet] = useState(readWalletState)
  const [tab, setTab] = useState('flow')
  const [formError, setFormError] = useState('')
  const [formOk, setFormOk] = useState('')

  const { data: walletData, refetch: refetchWallet } = useGetWalletBalanceQuery()
  const [requestRefund] = useRequestRefundMutation()
  const backendTransactions = walletData?.data?.transactions || []

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
    
    const backend = backendTransactions.map((txn) => ({
      key: txn._id,
      kind: 'wallet',
      at: txn.createdAt,
      title: txn.source || txn.type,
      subtitle: txn.status === 'Pending' && txn.type === 'Refund' && txn.source?.includes('Refund Eligible') ? 'Pending Request' : txn.status,
      signedPaise: (txn.type === 'Refund' || txn.type === 'Credit') ? txn.amount * 100 : -txn.amount * 100,
      isRefundEligible: txn.status === 'Pending' && txn.type === 'Refund' && txn.source?.includes('Refund Eligible'),
      bookingId: txn.bookingId
    }))

    return [...outs, ...credits, ...seg, ...backend].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 24)
  }, [summary.ratePaisePerMin, wallet, attendanceOnly.segments, backendTransactions])

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
              <strong className="text-slate-800">1. Accept</strong> → job confirmed.{' '}
              <strong className="text-slate-800">2. Client approval</strong> → work verified.{' '}
              <strong className="text-slate-800">3. OTP verification</strong> → securely validated.{' '}
              <strong className="text-slate-800">4. Done</strong> → process complete.
            </p>
          </GlassPanel>



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
            </GlassPanel>
          ) : null}
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
                    {row.isRefundEligible && (
                      <button
                        type="button"
                        onClick={() => {
                          requestRefund(row.bookingId).unwrap().then(() => {
                            showToast('Refund requested successfully!')
                            refetchWallet()
                          }).catch(err => {
                            showToast(err?.data?.message || 'Failed to request refund.', false)
                          })
                        }}
                        className="mt-1.5 rounded-md bg-brand px-2.5 py-1 text-[10px] font-bold text-slate-900 shadow-sm transition hover:bg-brand/90"
                      >
                        Request Refund
                      </button>
                    )}
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
