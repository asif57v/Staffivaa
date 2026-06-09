import { Layers } from 'lucide-react'
import { GlassPanel } from '../../ui/GlassPanel.jsx'
import { AppEmptyState } from '../../app/AppEmptyState.jsx'

export function LabourAttendanceWorkView({ groups }) {
  if (!groups.length) {
    return (
      <AppEmptyState
        icon={Layers}
        title="No work-type records"
        subtitle="When you tap in, pick a trade (masonry, electrical, etc.) to see hours grouped by work type."
      />
    )
  }

  return (
    <div className="space-y-3">
      <p className="px-1 text-xs text-slate-600">
        Hours grouped by <strong className="text-slate-900">type of work</strong> over the last 14 days.
      </p>
      {groups.map((g) => (
        <GlassPanel key={g.label} className="border-slate-200/90 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-orange-500/15 to-amber-50 text-orange-800">
                <Layers className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-900">{g.label}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {g.daysWorked} day{g.daysWorked === 1 ? '' : 's'} · {g.punchCount} punches · last {g.lastTime}
                </p>
                {g.projects.length > 0 ? (
                  <p className="mt-1 truncate text-[11px] text-slate-500">Projects: {g.projects.join(', ')}</p>
                ) : null}
              </div>
            </div>
            <span className="shrink-0 rounded-xl bg-brand/10 px-2.5 py-1 font-mono text-sm font-black text-brand">
              {g.workTime}
            </span>
          </div>
        </GlassPanel>
      ))}
    </div>
  )
}
