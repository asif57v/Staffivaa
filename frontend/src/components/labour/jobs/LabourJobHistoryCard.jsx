import { CheckCircle2, ChevronRight, IndianRupee } from 'lucide-react'

export function LabourJobHistoryCard({ job, onOpenDetail }) {
  const completed = job.completedAt
    ? new Date(job.completedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : '—'

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpenDetail?.(job)}
        className="flex w-full items-center gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-sm ring-1 ring-slate-100/80 transition hover:border-brand/25 hover:shadow-md"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-slate-900">{job.title}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{job.site}</p>
          <p className="mt-1 text-[10px] font-medium text-slate-400">Completed {completed}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-black text-brand">{job.rateLabel}</p>
          <ChevronRight className="ml-auto mt-1 h-4 w-4 text-slate-300" aria-hidden />
        </div>
      </button>
      
      {job.paymentStatus === 'paid' && (
        <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-[0_2px_10px_-2px_rgba(16,185,129,0.1)]">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <IndianRupee className="h-3 w-3" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Payment Received</p>
          </div>
        </div>
      )}
    </li>
  )
}
