import { formatInrFromPaise } from '../../../lib/labourEarningsFlow.js'

export function LabourServiceFeeSlip({ breakdown, fees, className = '' }) {
  if (!breakdown) return null
  const platformPct = breakdown.platformPercent ?? fees?.platformPercent ?? 8
  const gstPct = breakdown.gstPercent ?? fees?.gstOnPlatformPercent ?? 18

  return (
    <div className={`rounded-2xl border border-slate-200/90 bg-white p-4 ring-1 ring-slate-100 ${className}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Payout breakdown</p>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-600">From your balance</dt>
          <dd className="font-mono font-bold text-slate-900">{formatInrFromPaise(breakdown.grossPaise)}</dd>
        </div>
        <div className="flex justify-between gap-3 text-rose-700">
          <dt>Platform service ({platformPct}%)</dt>
          <dd className="font-mono font-bold">−{formatInrFromPaise(breakdown.platformFeePaise)}</dd>
        </div>
        <div className="flex justify-between gap-3 text-rose-700">
          <dt>GST on service ({gstPct}%)</dt>
          <dd className="font-mono font-bold">−{formatInrFromPaise(breakdown.gstOnFeePaise)}</dd>
        </div>
        <div className="border-t border-slate-100 pt-2">
          <div className="flex justify-between gap-3">
            <dt className="font-extrabold text-emerald-900">You receive</dt>
            <dd className="font-mono text-lg font-black text-emerald-700">
              {formatInrFromPaise(breakdown.netPaise)}
            </dd>
          </div>
        </div>
      </dl>
    </div>
  )
}
