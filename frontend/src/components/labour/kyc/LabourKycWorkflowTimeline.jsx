import { CheckCircle2 } from 'lucide-react'
import { KYC_WORKFLOW } from '../../../lib/labourKycFlow.js'

const ACTIVE_RING = {
  violet: 'bg-white text-violet-700 ring-violet-400',
  sky: 'bg-white text-sky-700 ring-sky-400',
  emerald: 'bg-white text-emerald-700 ring-emerald-400',
  rose: 'bg-white text-rose-700 ring-rose-400',
}

const ACTIVE_BG = {
  violet: 'bg-violet-50 ring-violet-200/80',
  sky: 'bg-sky-50 ring-sky-200/80',
  emerald: 'bg-emerald-50 ring-emerald-200/80',
  rose: 'bg-rose-50 ring-rose-200/80',
}

const DONE_LINE = {
  violet: 'bg-violet-400/60',
  sky: 'bg-sky-400/60',
  emerald: 'bg-emerald-400/60',
  rose: 'bg-rose-400/60',
}

export function LabourKycWorkflowTimeline({ activeIndex = 0, tone = 'violet', steps = KYC_WORKFLOW }) {
  const ring = ACTIVE_RING[tone] || ACTIVE_RING.violet
  const bg = ACTIVE_BG[tone] || ACTIVE_BG.violet
  const line = DONE_LINE[tone] || DONE_LINE.violet

  return (
    <ol className="space-y-0">
      {steps.map((step, i) => {
        const done = i < activeIndex
        const active = i === activeIndex
        return (
          <li key={step.id} className={`relative flex gap-3 ${i < steps.length - 1 ? 'pb-4' : ''}`}>
            {i < steps.length - 1 ? (
              <span className={`absolute left-[0.65rem] top-7 h-[calc(100%-0.5rem)] w-px ${done ? line : 'bg-slate-200'}`} aria-hidden />
            ) : null}
            <span
              className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-2 ${
                done
                  ? 'bg-emerald-500 text-white ring-emerald-200'
                  : active
                    ? `${ring} shadow-md`
                    : 'bg-slate-100 text-slate-400 ring-slate-200'
              }`}
            >
              {done ? (
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <span className="text-[10px] font-black">{i + 1}</span>
              )}
            </span>
            <div
              className={`min-w-0 flex-1 rounded-xl px-3 py-2 ring-1 ${
                active ? bg : done ? 'bg-white ring-slate-100' : 'bg-slate-50/80 ring-slate-100'
              }`}
            >
              <p className={`text-xs font-bold ${active ? 'text-slate-900' : 'text-slate-800'}`}>{step.label}</p>
              {active ? <p className="mt-0.5 text-[10px] font-medium text-slate-600">Current step</p> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
