import { Banknote, ListOrdered, Sparkles } from 'lucide-react'
import { AppPrimaryButton } from '../../app/AppPrimaryButton.jsx'
import { GlassPanel } from '../../ui/GlassPanel.jsx'
import { formatInrFromPaise } from '../../../lib/labourEarningsFlow.js'
import { WITHDRAW_DEMO_STEPS } from '../../../lib/labourEarningsDemoSeed.js'

export function LabourEarningsDemoCard({ summary, onLoadSample, onOpenWithdraw }) {
  const hasBalance = summary.availableGrossPaise >= 10000

  return (
    <GlassPanel className="border-brand/25 bg-linear-to-br from-brand/5 via-white to-emerald-50/40 p-4 ring-1 ring-brand/15">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand">
          <Sparkles className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-wider text-brand">Try withdraw (demo)</p>
          <p className="mt-1 text-sm text-slate-700">
            Load sample pay so you can run the full withdrawal flow with platform fee + GST.
          </p>
        </div>
      </div>

      {hasBalance ? (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900 ring-1 ring-emerald-100">
          Balance ready: gross <strong>{formatInrFromPaise(summary.availableGrossPaise)}</strong> · max net payout{' '}
          <strong>{formatInrFromPaise(summary.availableNetPaise)}</strong>
        </p>
      ) : (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-950 ring-1 ring-amber-100">
          No withdrawable balance yet. Load sample data (~₹8,000 gross) to test payouts.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <AppPrimaryButton type="button" className="py-2.5 text-xs" onClick={onLoadSample}>
          <Banknote className="h-3.5 w-3.5" aria-hidden />
          Load sample earnings
        </AppPrimaryButton>
        <button
          type="button"
          onClick={onOpenWithdraw}
          disabled={summary.availableGrossPaise < 10000}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 disabled:opacity-40"
        >
          Open Withdraw tab
        </button>
      </div>

      <details className="mt-4 group">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold text-slate-600 [&::-webkit-details-marker]:hidden">
          <ListOrdered className="h-3.5 w-3.5 text-brand" aria-hidden />
          How to test withdrawal
        </summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-slate-600">
          {WITHDRAW_DEMO_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </details>
    </GlassPanel>
  )
}
