import { CheckCircle2, Circle } from 'lucide-react'

function ChecklistItems({ items }) {
  if (!items.length) return null
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.id}
          className={`flex gap-3 rounded-xl border px-3 py-2.5 ${
            item.done
              ? 'border-emerald-200/80 bg-emerald-50/50'
              : item.required
                ? 'border-amber-200/70 bg-amber-50/30'
                : 'border-slate-200/80 bg-slate-50/50'
          }`}
        >
          {item.done ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          ) : (
            <Circle className="h-5 w-5 shrink-0 text-slate-300" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold ${item.done ? 'text-emerald-950' : 'text-slate-900'}`}>
              {item.label}
              {!item.required ? (
                <span className="ml-1 text-[10px] font-semibold uppercase text-slate-400">Optional</span>
              ) : null}
            </p>
            {item.hint && !item.done ? <p className="mt-0.5 text-[11px] text-slate-500">{item.hint}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  )
}

export function CorporateVerificationChecklist({ checklist, requiredDone, requiredTotal }) {
  const pct = requiredTotal > 0 ? Math.round((requiredDone / requiredTotal) * 100) : 0
  const requiredItems = checklist.filter((i) => i.required)
  const optionalItems = checklist.filter((i) => !i.required)

  return (
    <div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Verification checklist</p>
          <p className="mt-0.5 text-sm font-extrabold text-slate-900">
            {requiredDone} of {requiredTotal} required items complete
          </p>
        </div>
        <span className="text-lg font-black tabular-nums text-brand">{pct}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Required</p>
      <div className="mt-2">
        <ChecklistItems items={requiredItems} />
      </div>

      {optionalItems.length > 0 ? (
        <>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Optional</p>
          <div className="mt-2">
            <ChecklistItems items={optionalItems} />
          </div>
        </>
      ) : null}
    </div>
  )
}
