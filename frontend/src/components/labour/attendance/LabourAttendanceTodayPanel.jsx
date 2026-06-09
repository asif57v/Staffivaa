import { LogIn, LogOut, MapPin, Wrench } from 'lucide-react'
import { GlassPanel } from '../../ui/GlassPanel.jsx'
import { formatSecondsAsClock } from '../../../lib/formatDurationClock.js'

const TONE_RING = {
  emerald: 'ring-emerald-200 bg-emerald-50 text-emerald-800',
  amber: 'ring-amber-200 bg-amber-50 text-amber-900',
  rose: 'ring-rose-200 bg-rose-50 text-rose-800',
  sky: 'ring-sky-200 bg-sky-50 text-sky-900',
  brand: 'ring-brand/30 bg-brand/10 text-brand',
}

export function LabourAttendanceTodayPanel({
  onSite,
  workedSecondsToday,
  todayLabel,
  projectLabel,
  workLabel,
  projectOptions,
  workOptions,
  onProjectChange,
  onWorkChange,
  onTapIn,
  onTapOut,
  todayPunches,
  canTapIn,
  canTapOut,
}) {
  return (
    <div className="space-y-4">
      <GlassPanel
        className={`overflow-hidden border-2 p-4 ${onSite ? 'border-emerald-300/80 bg-emerald-50/50' : 'border-slate-200/90'}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Today</p>
            <p className="text-sm font-extrabold text-slate-900">{todayLabel}</p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ring-1 ${onSite ? TONE_RING.brand : 'bg-slate-100 text-slate-600 ring-slate-200'
              }`}
          >
            <span className={`h-2 w-2 rounded-full ${onSite ? 'animate-pulse bg-brand' : 'bg-slate-400'}`} />
            {onSite ? 'On site' : 'Not checked in'}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <MapPin className="h-3 w-3" aria-hidden />
              Project / site
            </label>
            <select
              value={projectLabel}
              onChange={(e) => onProjectChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-brand/35"
            >
              {projectOptions.map((p) => (
                <option key={p || 'none'} value={p}>
                  {p || 'Select project'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <Wrench className="h-3 w-3" aria-hidden />
              Type of work
            </label>
            <select
              value={workLabel}
              onChange={(e) => onWorkChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-brand/35"
            >
              {workOptions.map((w) => (
                <option key={w || 'none'} value={w}>
                  {w || 'Select work type'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onTapIn}
            disabled={!canTapIn}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-brand/30 bg-linear-to-br from-brand-bright to-brand py-5 text-white shadow-[0_14px_40px_-14px_rgba(255,179,71,0.55)] transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
          >
            <LogIn className="h-7 w-7" aria-hidden />
            <span className="text-sm font-extrabold">Check in</span>
          </button>
          <button
            type="button"
            onClick={onTapOut}
            disabled={!canTapOut}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white py-5 text-slate-800 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-40"
          >
            <LogOut className="h-7 w-7 text-slate-600" aria-hidden />
            <span className="text-sm font-extrabold">Check out</span>
          </button>
        </div>
        <p className="mt-3 text-center font-mono text-xs font-bold tabular-nums text-slate-600">
          {formatSecondsAsClock(workedSecondsToday)} logged today
        </p>
      </GlassPanel>

      <GlassPanel className="border-slate-200/90 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Today&apos;s punches</p>
        {todayPunches.length === 0 ? (
          <p className="mt-4 text-center text-sm text-slate-500">No punches yet — check in when you reach the site.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {[...todayPunches].reverse().map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-2.5"
              >
                <span
                  className={`rounded-lg px-2 py-0.5 text-[10px] font-black uppercase ${e.type === 'in' ? 'bg-brand/15 text-brand' : 'bg-slate-200 text-slate-700'
                    }`}
                >
                  {e.type === 'in' ? 'In' : 'Out'}
                </span>
                <span className="font-mono text-sm font-bold text-slate-900">{e.time}</span>
                <span className="ml-auto max-w-[50%] truncate text-right text-[11px] text-slate-500">
                  {[e.projectLabel, e.workLabel].filter((x) => x && x !== 'Unassigned').join(' · ') || '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>
    </div>
  )
}
