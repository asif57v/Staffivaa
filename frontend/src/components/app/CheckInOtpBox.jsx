import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, LogOut, Play, ShieldCheck } from 'lucide-react'
import {
  useVerifyEnterpriseCheckInOtpMutation,
  useRequestEnterpriseCheckInMutation,
  useStartEnterpriseDirectWorkMutation,
  useEndEnterpriseDirectWorkMutation,
  useVerifyEnterpriseCheckoutOtpMutation,
} from '../../store/api/enterpriseApi.js'
import { todayCheckInOf } from '../../lib/checkInOtp.js'

const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—')

function fmtDuration(ms) {
  const totalMin = Math.max(0, Math.floor(ms / 60000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  const s = Math.max(0, Math.floor(ms / 1000) % 60)
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}

/** 4-digit OTP input. `onSubmit(code)` should throw an RTK error on mismatch. */
export function OtpEntryForm({ title, hint, onSubmit, isLoading, tone = 'indigo' }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const box = tone === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-indigo-200 bg-indigo-50'
  const text = tone === 'amber' ? 'text-amber-900' : 'text-indigo-900'
  const sub = tone === 'amber' ? 'text-amber-700' : 'text-indigo-700'
  const btn = tone === 'amber' ? 'bg-amber-600' : 'bg-indigo-600'

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await onSubmit(code)
      setCode('')
    } catch (err) {
      setError(err?.data?.message || 'Could not verify OTP')
    }
  }

  return (
    <form onSubmit={submit} className={`space-y-2 rounded-xl border p-3 ${box}`}>
      <p className={`flex items-center gap-1.5 text-[13px] font-extrabold ${text}`}>
        <ShieldCheck className="h-4 w-4" /> {title}
      </p>
      <p className={`text-[11px] font-medium ${sub}`}>{hint}</p>
      <div className="flex gap-2">
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, '').slice(0, 4))
            setError('')
          }}
          placeholder="• • • •"
          className="w-full flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center font-mono text-[20px] font-black tracking-[0.4em] text-slate-900 outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <button
          type="submit"
          disabled={code.length !== 4 || isLoading}
          className={`rounded-xl px-4 text-[13px] font-extrabold text-white disabled:opacity-50 ${btn}`}
        >
          {isLoading ? 'Checking…' : 'Verify'}
        </button>
      </div>
      {error ? <p className="text-[11.5px] font-bold text-rose-600">{error}</p> : null}
    </form>
  )
}

/**
 * Check-in OTP only (used on Home). Worker enters the OTP the employer generated; it only verifies against
 * this worker's own assignment (the server never sends the code to the worker).
 */
export function CheckInOtpBox({ job, onVerified }) {
  const [verifyOtp, { isLoading }] = useVerifyEnterpriseCheckInOtpMutation()
  const todayCheckIn = todayCheckInOf(job)
  if (todayCheckIn) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
        <div>
          <p className="text-[13px] font-extrabold text-emerald-800">Verified ✓ OTP matched</p>
          <p className="text-[11px] font-semibold text-emerald-700">Checked in today at {fmtTime(todayCheckIn.verifiedAt)}</p>
        </div>
      </div>
    )
  }
  if (!job.pendingCheckInOtp) return null
  return (
    <OtpEntryForm
      title="Enter check-in OTP"
      hint="Ask your employer for the 4-digit check-in OTP shown on their job page. Your work timer starts as soon as it matches."
      isLoading={isLoading}
      onSubmit={async (code) => {
        await verifyOtp({ jobId: job._id, code }).unwrap()
        onVerified?.(job)
      }}
    />
  )
}

/** "06:00 PM" / "18:00" → { h, m } */
function parseClock(text) {
  const match = String(text || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i)
  if (!match) return null
  let h = Number(match[1])
  const m = Number(match[2] || 0)
  const ampm = match[3]?.toUpperCase()
  if (ampm === 'PM' && h < 12) h += 12
  if (ampm === 'AM' && h === 12) h = 0
  return h > 23 || m > 59 ? null : { h, m }
}

/**
 * When today's shift ends: the shift's end time ("06:00 PM – 12:00 AM") on the work date, rolling to the next
 * day for overnight shifts. Falls back to start + working hours when the shift has no parseable times.
 */
function shiftEndFor({ since, dateKey, shift, shiftHours }) {
  const [startText, endText] = String(shift || '').split(/[–-]/)
  const startT = parseClock(startText)
  const endT = parseClock(endText)
  if (endT && dateKey) {
    const [y, mo, d] = dateKey.split('-').map(Number)
    const end = new Date(y, mo - 1, d, endT.h, endT.m, 0)
    if (startT && endT.h * 60 + endT.m <= startT.h * 60 + startT.m) end.setDate(end.getDate() + 1)
    return end.getTime()
  }
  return new Date(since).getTime() + (Number(shiftHours) || 8) * 3600000
}

/** Live work clock: time worked so far + countdown to the end of today's shift. */
function WorkClock({ since, dateKey, shift, shiftHours }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const startMs = new Date(since).getTime()
  const endMs = shiftEndFor({ since, dateKey, shift, shiftHours })
  const elapsed = now - startMs
  const left = endMs - now
  const span = Math.max(1, endMs - startMs)
  const pct = Math.min(100, Math.max(0, (elapsed / span) * 100))
  return (
    <div className="space-y-1.5">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Worked</p>
          <p className="font-mono text-[22px] font-black text-slate-900">{fmtDuration(elapsed)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {left > 0 ? 'Shift ends in' : 'Overtime'}
          </p>
          <p className={`font-mono text-[15px] font-extrabold ${left > 0 ? 'text-sky-700' : 'text-amber-600'}`}>
            {fmtDuration(Math.abs(left))}
          </p>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-sky-100">
        <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/**
 * Today's full work-day flow for one admin-assigned enterprise job:
 * check-in OTP → Start job → End job → check-out OTP → completed summary.
 */
export function DirectWorkDayPanel({ job, onCheckInVerified }) {
  const [requestCheckIn, { isLoading: requesting }] = useRequestEnterpriseCheckInMutation()
  const [startWork, { isLoading: starting }] = useStartEnterpriseDirectWorkMutation()
  const [endWork, { isLoading: ending }] = useEndEnterpriseDirectWorkMutation()
  const [verifyCheckout, { isLoading: verifyingOut }] = useVerifyEnterpriseCheckoutOtpMutation()
  const [actionError, setActionError] = useState('')
  const today = job.todayAttendance

  const run = async (fn) => {
    setActionError('')
    try {
      await fn()
    } catch (err) {
      setActionError(err?.data?.message || 'Something went wrong')
    }
  }

  const errorLine = actionError ? <p className="text-[11.5px] font-bold text-rose-600">{actionError}</p> : null

  if (!today) {
    if (job.assignmentStatus === 'ended') return null
    if (job.pendingCheckInOtp) {
      return (
        <div className="space-y-1.5">
          <CheckInOtpBox job={job} onVerified={onCheckInVerified} />
          <button
            type="button"
            disabled={requesting}
            onClick={() => run(() => requestCheckIn(job._id).unwrap())}
            className="text-[11px] font-extrabold text-indigo-700 underline disabled:opacity-50"
          >
            {requesting ? 'Sending…' : 'Send a new OTP to my employer'}
          </button>
          {errorLine}
        </div>
      )
    }
    if (job.assignmentStatus === 'upcoming') {
      const startsOn = job.timeline?.expectedJoiningDate
        ? new Date(job.timeline.expectedJoiningDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : null
      return (
        <p className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-[11.5px] font-semibold text-slate-500">
          <Clock className="h-4 w-4 shrink-0 text-slate-400" />
          Check-in opens {startsOn ? `on ${startsOn}` : 'when the work starts'}.
        </p>
      )
    }
    return (
      <div className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
        <p className="text-[11.5px] font-semibold text-indigo-800">
          Reached the site? Tap Check in — your employer gets an OTP to share with you.
        </p>
        <button
          type="button"
          disabled={requesting}
          onClick={() => run(() => requestCheckIn(job._id).unwrap())}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-[14px] font-extrabold text-white active:scale-[0.98] disabled:opacity-50"
        >
          <ShieldCheck className="h-4 w-4" /> {requesting ? 'Sending OTP…' : 'Check in'}
        </button>
        {errorLine}
      </div>
    )
  }

  if (today.state === 'checked_in') {
    return (
      <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <p className="flex items-center gap-1.5 text-[13px] font-extrabold text-emerald-800">
          <CheckCircle2 className="h-4 w-4" /> Checked in at {fmtTime(today.checkInAt)}
        </p>
        <button
          type="button"
          disabled={starting}
          onClick={() => run(() => startWork(job._id).unwrap())}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-[14px] font-extrabold text-white active:scale-[0.98] disabled:opacity-50"
        >
          <Play className="h-4 w-4" /> {starting ? 'Starting…' : 'Start job'}
        </button>
        {errorLine}
      </div>
    )
  }

  if (today.state === 'working') {
    return (
      <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50 p-3">
        <p className="flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-wide text-sky-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-sky-500" /> Working · started {fmtTime(today.startedAt)}
        </p>
        <WorkClock since={today.startedAt} dateKey={today.dateKey} shift={job.shift} shiftHours={job.workingHours} />
        <button
          type="button"
          disabled={ending}
          onClick={() => {
            if (window.confirm('End today’s work? Your employer will get a check-out OTP to share with you.')) {
              run(() => endWork(job._id).unwrap())
            }
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 text-[14px] font-extrabold text-white active:scale-[0.98] disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" /> {ending ? 'Ending…' : 'End job'}
        </button>
        {errorLine}
      </div>
    )
  }

  if (today.state === 'checkout_pending') {
    return (
      <div className="space-y-2">
        <p className="text-[11.5px] font-semibold text-slate-600">
          Work ended at {fmtTime(today.endRequestedAt)} · started {fmtTime(today.startedAt)}
        </p>
        {today.checkOutOtp ? (
          <OtpEntryForm
            tone="amber"
            title="Enter check-out OTP"
            hint="Your employer just received a check-out OTP. Ask them for the code to finish today's attendance."
            isLoading={verifyingOut}
            onSubmit={(code) => verifyCheckout({ jobId: job._id, code }).unwrap()}
          />
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11.5px] font-semibold text-amber-800">
            Check-out OTP expired. Ask your employer to generate a new one, or request it again.
            <button
              type="button"
              disabled={ending}
              onClick={() => run(() => endWork(job._id).unwrap())}
              className="mt-2 block rounded-lg bg-amber-600 px-3 py-1.5 text-[12px] font-extrabold text-white disabled:opacity-50"
            >
              Request new OTP
            </button>
          </div>
        )}
        {errorLine}
      </div>
    )
  }

  // completed
  const h = Math.floor((today.totalWorkingMinutes || 0) / 60)
  const m = (today.totalWorkingMinutes || 0) % 60
  return (
    <div className="space-y-1.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
      <p className="flex items-center gap-1.5 text-[13px] font-extrabold text-emerald-800">
        <CheckCircle2 className="h-4 w-4" /> Today&apos;s work completed ✓
      </p>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-white p-2">
          <p className="text-[10px] font-bold uppercase text-slate-400">Start</p>
          <p className="text-[13px] font-extrabold text-slate-900">{fmtTime(today.startedAt)}</p>
        </div>
        <div className="rounded-lg bg-white p-2">
          <p className="text-[10px] font-bold uppercase text-slate-400">End</p>
          <p className="text-[13px] font-extrabold text-slate-900">{fmtTime(today.endedAt)}</p>
        </div>
        <div className="rounded-lg bg-white p-2">
          <p className="text-[10px] font-bold uppercase text-slate-400">Worked</p>
          <p className="flex items-center justify-center gap-1 text-[13px] font-extrabold text-slate-900">
            <Clock className="h-3 w-3" />
            {h}h {m}m
          </p>
        </div>
      </div>
    </div>
  )
}

/** Attendance log for one job (newest first) — used in the worker's Attendance tab. */
export function DirectAttendanceLog({ records = [] }) {
  if (!records.length) return <p className="text-[11.5px] font-semibold text-slate-400">No attendance recorded yet.</p>
  const STATE = {
    completed: 'text-emerald-700',
    working: 'text-sky-700',
    checked_in: 'text-indigo-700',
    checkout_pending: 'text-amber-700',
  }
  const LABEL = { completed: 'Completed', working: 'Working', checked_in: 'Checked in', checkout_pending: 'Check-out pending' }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100">
      <table className="w-full text-left text-[11.5px]">
        <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-2.5 py-2">Date</th>
            <th className="px-2.5 py-2">In</th>
            <th className="px-2.5 py-2">Start–End</th>
            <th className="px-2.5 py-2">Hours</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {records.map((r) => (
            <tr key={r._id}>
              <td className="px-2.5 py-2 font-bold text-slate-800">
                {new Date(`${r.dateKey}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                <span className={`block text-[10px] font-extrabold ${STATE[r.state] || 'text-slate-500'}`}>{LABEL[r.state] || r.state}</span>
              </td>
              <td className="px-2.5 py-2 text-slate-600">{fmtTime(r.checkInAt)}</td>
              <td className="px-2.5 py-2 text-slate-600">
                {fmtTime(r.startedAt)} – {fmtTime(r.endedAt || r.endRequestedAt)}
              </td>
              <td className="px-2.5 py-2 font-extrabold text-slate-900">
                {r.state === 'completed' ? `${Math.floor(r.totalWorkingMinutes / 60)}h ${r.totalWorkingMinutes % 60}m` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
