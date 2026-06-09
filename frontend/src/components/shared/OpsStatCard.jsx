import { AppSurface } from '../app-ui/cards/AppSurface.jsx'

export function OpsStatCard({ label, value, icon: Icon, tone = 'default' }) {
  const toneClass =
    tone === 'brand'
      ? 'border-brand/25 bg-brand/5'
      : tone === 'warn'
        ? 'border-amber-200/90 bg-amber-50/40'
        : 'border-slate-200/90'
  return (
    <AppSurface className={`${toneClass} p-3 sm:p-3.5`} flush>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate mb-0.5">{label}</p>
          <p className="text-xl sm:text-2xl font-extrabold tabular-nums text-slate-900 leading-none">{value}</p>
        </div>
        {Icon ? (
          <span className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-brand ring-1 ring-slate-200/80 shadow-xs">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
      </div>
    </AppSurface>
  )
}
