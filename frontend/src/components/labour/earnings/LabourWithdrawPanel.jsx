import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowRight, CheckCircle2, Shield } from 'lucide-react'
import { AppPrimaryButton } from '../../app/AppPrimaryButton.jsx'
import { GlassPanel } from '../../ui/GlassPanel.jsx'
import {
  computeWithdrawalBreakdown,
  formatInrFromPaise,
  MIN_NET_WITHDRAW_PAISE,
} from '../../../lib/labourEarningsFlow.js'
import { createWithdrawalRequest, savePayoutProfile } from '../../../lib/labourWalletStorage.js'
import { LabourServiceFeeSlip } from './LabourServiceFeeSlip.jsx'

export function LabourWithdrawPanel({ summary, wallet, onSuccess, onError }) {
  const [step, setStep] = useState('amount')
  const [grossRupees, setGrossRupees] = useState('')
  const [method, setMethod] = useState('upi')
  const [upiId, setUpiId] = useState(wallet.payoutProfile?.upiId || '')
  const [accountName, setAccountName] = useState(wallet.payoutProfile?.accountName || '')
  const [bankAccount, setBankAccount] = useState(wallet.payoutProfile?.bankAccount || '')
  const [ifsc, setIfsc] = useState(wallet.payoutProfile?.ifsc || '')
  const [lastWithdrawal, setLastWithdrawal] = useState(null)

  const grossPaise = useMemo(() => {
    const r = Number(grossRupees)
    if (!Number.isFinite(r) || r < 1) return 0
    return Math.round(r * 100)
  }, [grossRupees])

  const preview = useMemo(
    () => (grossPaise > 0 ? computeWithdrawalBreakdown(grossPaise, summary.fees) : null),
    [grossPaise, summary.fees],
  )

  const payoutDetail = useMemo(() => {
    if (method === 'upi') return upiId.trim()
    if (method === 'bank') return `${accountName.trim()} · ${bankAccount.trim()} · ${ifsc.trim()}`
    return 'Cash pickup at site office (demo)'
  }, [method, upiId, accountName, bankAccount, ifsc])

  const setQuickPercent = (pct) => {
    const g = Math.round(summary.availableGrossPaise * pct)
    if (g < 100) return
    setGrossRupees(String((g / 100).toFixed(0)))
  }

  const goPayout = () => {
    if (grossPaise < 100) {
      onError('Enter a valid amount from your gross balance.')
      return
    }
    if (grossPaise > summary.availableGrossPaise) {
      onError('Amount exceeds gross balance available to withdraw.')
      return
    }
    if (!preview || preview.netPaise < MIN_NET_WITHDRAW_PAISE) {
      onError(`After fees, minimum payout is ${formatInrFromPaise(MIN_NET_WITHDRAW_PAISE)}.`)
      return
    }
    setStep('payout')
  }

  const goReview = () => {
    if (method !== 'cash' && !payoutDetail.replace(/·/g, '').trim()) {
      onError(method === 'upi' ? 'Enter your UPI ID.' : 'Enter bank account details.')
      return
    }
    savePayoutProfile({ upiId, accountName, bankAccount, ifsc })
    setStep('review')
  }

  const confirmWithdraw = () => {
    const res = createWithdrawalRequest(
      {
        grossAmountPaise: grossPaise,
        method,
        payoutDetail,
        note: method === 'cash' ? 'Cash' : '',
      },
      summary.availableGrossPaise,
    )
    if (!res.ok) {
      onError(res.error || 'Withdrawal failed.')
      return
    }
    setLastWithdrawal(res.withdrawal)
    setStep('done')
    onSuccess(
      `₹${(res.breakdown.netPaise / 100).toFixed(0)} sent via ${method.toUpperCase()} (demo). Service fee deducted.`,
    )
    setGrossRupees('')
  }

  if (step === 'done' && lastWithdrawal) {
    return (
      <GlassPanel className="border-emerald-200/80 bg-emerald-50/40 p-5 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
        <p className="mt-3 text-lg font-extrabold text-slate-900">Withdrawal submitted</p>
        <p className="mt-1 font-mono text-2xl font-black text-emerald-700">
          {formatInrFromPaise(lastWithdrawal.netAmountPaise)}
        </p>
        <p className="mt-1 text-xs text-slate-600">Net payout · processing → completed in demo</p>
        <LabourServiceFeeSlip
          className="mt-4 text-left"
          breakdown={{
            grossPaise: lastWithdrawal.grossAmountPaise,
            platformFeePaise: lastWithdrawal.platformFeePaise,
            gstOnFeePaise: lastWithdrawal.gstOnFeePaise,
            netPaise: lastWithdrawal.netAmountPaise,
            platformPercent: lastWithdrawal.platformPercent,
            gstPercent: lastWithdrawal.gstPercent,
          }}
          fees={summary.fees}
        />
        <button
          type="button"
          onClick={() => {
            setStep('amount')
            setLastWithdrawal(null)
          }}
          className="mt-4 text-sm font-bold text-brand"
        >
          Withdraw again
        </button>
      </GlassPanel>
    )
  }

  return (
    <div className="space-y-4">
      <GlassPanel className="border-slate-200/90 p-4">
        <div className="flex items-start gap-2">
          <Shield className="h-4 w-4 shrink-0 text-brand" aria-hidden />
          <p className="text-xs leading-relaxed text-slate-600">
            <strong className="text-slate-800">How payout works:</strong> your gross balance is reduced by the
            withdrawal amount. Staffivaa deducts a <strong>{summary.fees.platformPercent}%</strong> platform
            service fee plus <strong>{summary.fees.gstOnPlatformPercent}% GST</strong> on that fee. You receive the
            net amount in UPI / bank / cash.
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-slate-50 px-2 py-2 ring-1 ring-slate-100">
            <p className="text-[9px] font-bold uppercase text-slate-400">Gross balance</p>
            <p className="font-mono text-sm font-black">{formatInrFromPaise(summary.availableGrossPaise)}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-2 py-2 ring-1 ring-emerald-100">
            <p className="text-[9px] font-bold uppercase text-emerald-700">Max net payout</p>
            <p className="font-mono text-sm font-black text-emerald-800">
              {formatInrFromPaise(summary.availableNetPaise)}
            </p>
          </div>
        </div>
      </GlassPanel>

      {step === 'amount' ? (
        <GlassPanel className="border-slate-200/90 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Step 1 · Amount (gross)</p>
          <p className="mt-1 text-xs text-slate-500">Enter how much to take from your balance before fees.</p>
          <div className="mt-3 flex gap-2">
            {[0.25, 0.5, 1].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setQuickPercent(p)}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-[10px] font-bold uppercase text-slate-600"
              >
                {p === 1 ? 'Max' : `${p * 100}%`}
              </button>
            ))}
          </div>
          <input
            inputMode="decimal"
            value={grossRupees}
            onChange={(e) => setGrossRupees(e.target.value)}
            placeholder="Gross amount ₹"
            className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold"
          />
          {preview ? <LabourServiceFeeSlip className="mt-3" breakdown={preview} fees={summary.fees} /> : null}
          <AppPrimaryButton
            type="button"
            className="mt-4 w-full py-3 text-sm"
            disabled={summary.availableGrossPaise < 100}
            onClick={goPayout}
          >
            Continue
            <ArrowRight className="h-4 w-4" aria-hidden />
          </AppPrimaryButton>
        </GlassPanel>
      ) : null}

      {step === 'payout' ? (
        <GlassPanel className="border-slate-200/90 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Step 2 · Payout method</p>
          <div className="mt-3 flex gap-2">
            {['upi', 'bank', 'cash'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`flex-1 rounded-xl border py-2 text-xs font-bold uppercase ${
                  method === m ? 'border-brand bg-brand/10 text-brand' : 'border-slate-200 text-slate-600'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          {method === 'upi' ? (
            <input
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="name@upi"
              className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          ) : null}
          {method === 'bank' ? (
            <div className="mt-3 space-y-2">
              <input
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Account holder name"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <input
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder="Account number"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <input
                value={ifsc}
                onChange={(e) => setIfsc(e.target.value)}
                placeholder="IFSC"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </div>
          ) : null}
          {method === 'cash' ? (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-100">
              Demo: collect net cash from site supervisor after fee deduction is recorded.
            </p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setStep('amount')}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold"
            >
              Back
            </button>
            <AppPrimaryButton type="button" className="flex-1 py-2.5 text-xs" onClick={goReview}>
              Review
            </AppPrimaryButton>
          </div>
        </GlassPanel>
      ) : null}

      {step === 'review' ? (
        <GlassPanel className="border-slate-200/90 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Step 3 · Confirm</p>
          <LabourServiceFeeSlip className="mt-3" breakdown={preview} fees={summary.fees} />
          <p className="mt-3 text-xs text-slate-600">
            Send to: <strong className="text-slate-900">{payoutDetail}</strong> via {method.toUpperCase()}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setStep('payout')}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold"
            >
              Back
            </button>
            <AppPrimaryButton type="button" className="flex-1 py-2.5 text-xs" onClick={confirmWithdraw}>
              <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden />
              Confirm withdrawal
            </AppPrimaryButton>
          </div>
        </GlassPanel>
      ) : null}
    </div>
  )
}
