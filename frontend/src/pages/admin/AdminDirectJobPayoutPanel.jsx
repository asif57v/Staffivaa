import { useState } from 'react'
import { BellRing, IndianRupee, Wallet, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useGetAdminDirectPaymentsQuery,
  useSendDirectRequestReminderMutation,
  usePayoutDirectRequestWorkerMutation,
} from '../../store/api/adminEnterpriseApi.js'

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`
const fmtDateTime = (d) =>
  new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
const fmtDay = (key) => new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

const MANUAL_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank', label: 'Bank' },
  { value: 'other', label: 'Other' },
]

/** Reminder, enterprise payments and per-worker payouts for an accepted daily/hourly request */
export function AdminDirectJobPayoutPanel({ job }) {
  const { data } = useGetAdminDirectPaymentsQuery({ jobId: job._id })
  const payments = data?.data?.payments ?? []
  const [sendReminder, { isLoading: reminding }] = useSendDirectRequestReminderMutation()
  const [payout, { isLoading: paying }] = usePayoutDirectRequestWorkerMutation()

  const [hoursBefore, setHoursBefore] = useState('1')
  const [customHours, setCustomHours] = useState('')
  const [period, setPeriod] = useState('')
  const [manualMode, setManualMode] = useState('cash')

  const activePeriod = payments.some((p) => p.periodKey === period) ? period : payments[0]?.periodKey || ''
  const reminders = job.reminders || []

  const handleReminder = async () => {
    const hours = hoursBefore === 'custom' ? Number(customHours) : Number(hoursBefore)
    if (!Number.isFinite(hours) || hours <= 0) {
      toast.error('Enter valid hours')
      return
    }
    try {
      await sendReminder({ id: job._id, hoursBefore: hours }).unwrap()
      toast.success('Reminder sent to the enterprise')
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to send reminder')
    }
  }

  const handlePayout = async (w, isRegistered) => {
    try {
      const res = await payout({
        id: job._id,
        entryId: w._id,
        periodKey: activePeriod,
        ...(isRegistered ? {} : { mode: manualMode }),
      }).unwrap()
      toast.success(res?.message || 'Payout recorded')
    } catch (err) {
      toast.error(err?.data?.message || 'Payout failed')
    }
  }

  return (
    <div className="space-y-4">
      {/* Job-end reminder */}
      <div className="rounded-xl bg-white p-3.5 ring-1 ring-slate-100 space-y-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Job-end reminder to enterprise</p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={hoursBefore}
            onChange={(e) => setHoursBefore(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700"
          >
            <option value="1">Job ends in 1 hour</option>
            <option value="2">Job ends in 2 hours</option>
            <option value="3">Job ends in 3 hours</option>
            <option value="custom">Custom…</option>
          </select>
          {hoursBefore === 'custom' && (
            <input
              type="number"
              min="1"
              max="72"
              value={customHours}
              onChange={(e) => setCustomHours(e.target.value)}
              placeholder="Hours"
              className="w-20 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold"
            />
          )}
          <button
            type="button"
            disabled={reminding}
            onClick={handleReminder}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50"
          >
            <BellRing className="h-3.5 w-3.5" /> Send reminder
          </button>
        </div>
        {reminders.length > 0 && (
          <ul className="space-y-0.5 text-[11px] text-slate-500">
            {reminders.slice(-3).reverse().map((r) => (
              <li key={r._id}>
                Sent {fmtDateTime(r.sentAt)} · "ends in {r.hoursBefore}h"
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Enterprise payments */}
      <div className="rounded-xl bg-white p-3.5 ring-1 ring-slate-100 space-y-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Enterprise payments</p>
        {payments.length === 0 ? (
          <p className="text-xs text-slate-500">The enterprise has not paid for any period yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {payments.map((p) => (
              <li key={p._id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-xs">
                <span className="font-semibold text-slate-800">
                  {fmtDay(p.periodKey)}
                  {p.salaryType === 'hourly' ? ` · ${p.units}h` : ''} · {p.workersCount} worker(s)
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-black text-emerald-700">{inr(p.amount)}</span>
                  <span className="text-[11px] text-slate-500">Paid {fmtDateTime(p.paidAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Worker payouts */}
      {payments.length > 0 && job.assignedWorkers?.length > 0 && (
        <div className="rounded-xl bg-white p-3.5 ring-1 ring-slate-100 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Worker payouts</p>
            <select
              value={activePeriod}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700"
            >
              {payments.map((p) => (
                <option key={p._id} value={p.periodKey}>
                  {fmtDay(p.periodKey)}
                </option>
              ))}
            </select>
          </div>
          <ul className="space-y-2">
            {job.assignedWorkers.map((w) => {
              const isRegistered = Boolean(w.workerId) && !w.isExternal
              const paid = (w.payouts || []).find((p) => p.periodKey === activePeriod)
              const payment = payments.find((p) => p.periodKey === activePeriod)
              const amount = payment ? Math.round(payment.rate * payment.units) : 0
              return (
                <li key={w._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-100">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{w.workerId?.fullName || w.name}</p>
                    <p className="text-[11px] text-slate-500">{isRegistered ? 'Registered · wallet payout' : 'Not on app · manual payout'}</p>
                  </div>
                  {paid ? (
                    <p className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Paid {inr(paid.amount)} ({paid.mode}) · {fmtDateTime(paid.paidAt)}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2">
                      {!isRegistered && (
                        <select
                          value={manualMode}
                          onChange={(e) => setManualMode(e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
                        >
                          {MANUAL_MODES.map((m) => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </select>
                      )}
                      <span className="text-[11px] font-black text-amber-700">Pending · {inr(amount)}</span>
                      <button
                        type="button"
                        disabled={paying}
                        onClick={() => handlePayout(w, isRegistered)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {isRegistered ? <Wallet className="h-3.5 w-3.5" /> : <IndianRupee className="h-3.5 w-3.5" />}
                        {isRegistered ? 'Add to wallet' : 'Mark as paid'}
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
