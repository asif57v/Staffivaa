import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { GlassPanel } from '../../ui/GlassPanel.jsx'
import { AppEmptyState } from '../../app/AppEmptyState.jsx'
import { CalendarClock } from 'lucide-react'

const STATUS_BADGE = {
  emerald: 'bg-emerald-100 text-emerald-800 ring-emerald-200/80',
  amber: 'bg-amber-100 text-amber-900 ring-amber-200/80',
  rose: 'bg-rose-100 text-rose-800 ring-rose-200/80',
  sky: 'bg-sky-100 text-sky-900 ring-sky-200/80',
  brand: 'bg-brand/10 text-brand ring-brand/25',
}

export function LabourAttendanceDailyView({ rows }) {
  const [openDay, setOpenDay] = useState(null)
  const hasAny = rows.some((r) => r.minutes > 0 || r.punches.length > 0)

  if (!hasAny) {
    return (
      <AppEmptyState
        icon={CalendarClock}
        title="No daily records yet"
        subtitle="Tap in on the Today tab when you start work. Each day will show present, half day, or absent."
      />
    )
  }

  return (
    <div className="space-y-2">
      <p className="px-1 text-xs text-slate-600">
        Last <strong className="text-slate-900">14 days</strong> — tap a row to see check-in / check-out times.
      </p>
      {rows.map((row) => {
        const open = openDay === row.day
        return (
          <GlassPanel key={row.day} className={`border-slate-200/90 p-0 ${row.isToday ? 'ring-2 ring-brand/20' : ''}`}>
            <button
              type="button"
              onClick={() => setOpenDay(open ? null : row.day)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${row.toneClass}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-slate-900">{row.label}</p>
                {(row.projects.length > 0 || row.works.length > 0) && !open ? (
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">
                    {[...row.projects, ...row.works].slice(0, 2).join(' · ')}
                  </p>
                ) : null}
              </div>
              <span
                className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${
                  STATUS_BADGE[row.status.tone] || STATUS_BADGE.rose
                }`}
              >
                {row.status.label}
              </span>
              <span className="shrink-0 font-mono text-sm font-black tabular-nums text-slate-800">{row.workTime}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>
            {open && row.punches.length > 0 ? (
              <ul className="border-t border-slate-100 px-4 py-2">
                {row.punches.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2 py-1.5 text-xs">
                    <span className="font-bold text-slate-700">{p.type === 'in' ? 'In' : 'Out'}</span>
                    <span className="font-mono font-semibold">{p.time}</span>
                    <span className="truncate text-slate-500">
                      {[p.projectLabel, p.workLabel].filter((x) => x && x !== 'Unassigned').join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {open && row.punches.length === 0 ? (
              <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">No punches this day.</p>
            ) : null}
          </GlassPanel>
        )
      })}
    </div>
  )
}
