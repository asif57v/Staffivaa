import { useState } from 'react'
import { IndianRupee, CheckCircle2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useGetJobDirectPaymentsQuery, usePayDirectJobMutation } from '../../../store/api/enterpriseApi.js'

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`
const fmtDateTime = (d) =>
  new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
const fmtDay = (key) => new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

/** Pay a daily/hourly job one day at a time from the enterprise wallet */
export function EnterpriseDirectPaymentPanel({ job }) {
  const { data } = useGetJobDirectPaymentsQuery(job._id)
  const [pay, { isLoading: paying }] = usePayDirectJobMutation()

  const payments = data?.data?.payments ?? []
  const quote = data?.data?.quote
  const isHourly = job.salaryType === 'hourly'

  const [periodKey, setPeriodKey] = useState('')
  const [hours, setHours] = useState('')

  if (!quote) return null

  const selectedDay = periodKey || quote.defaultPeriodKey
  const selectedHours = isHourly ? Number(hours || job.workingHours || 1) : 1
  const workers = quote.workersCount
  const amount = Math.round(job.salary * workers * selectedHours)
  const alreadyPaid = payments.some((p) => p.periodKey === selectedDay)
  const noWorkers = !job.assignedWorkers?.length

  const handlePay = async () => {
    try {
      const res = await pay({ id: job._id, periodKey: selectedDay, ...(isHourly ? { hours: selectedHours } : {}) }).unwrap()
      toast.success(res?.message || 'Payment successful')
    } catch (err) {
      toast.error(err?.data?.message || 'Payment failed')
    }
  }

  return (
    <div className="pt-3 mt-2 border-t border-current/10 space-y-3 text-slate-900">
      <p className="text-[11px] sm:text-[12px] font-extrabold uppercase tracking-wide opacity-70">
        Pay for this job ({isHourly ? 'per hour' : 'per day'})
      </p>

      <div className="rounded-xl bg-white/80 border border-white p-3 space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Work date</span>
            <input
              type="date"
              value={selectedDay}
              onChange={(e) => setPeriodKey(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold"
            />
          </label>
          {isHourly && (
            <label className="space-y-1">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Hours</span>
              <input
                type="number"
                min="1"
                max="24"
                value={hours || job.workingHours || 1}
                onChange={(e) => setHours(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold"
              />
            </label>
          )}
        </div>

        <p className="text-[12.5px] font-semibold text-slate-700">
          {inr(job.salary)} × {workers} worker(s){isHourly ? ` × ${selectedHours} hour(s)` : ' × 1 day'} ={' '}
          <span className="font-black text-emerald-700">{inr(amount)}</span>
        </p>

        {noWorkers ? (
          <p className="text-[12px] font-semibold text-amber-700">Payment opens once Staffivaa assigns workers.</p>
        ) : alreadyPaid ? (
          <p className="inline-flex items-center gap-1.5 text-[12px] font-bold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> This date is already paid.
          </p>
        ) : (
          <button
            type="button"
            disabled={paying}
            onClick={handlePay}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-[12.5px] font-extrabold text-white transition hover:bg-indigo-600 disabled:opacity-50"
          >
            {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <IndianRupee className="h-4 w-4" />}
            Pay {inr(amount)} from wallet
          </button>
        )}
      </div>

      {payments.length > 0 && (
        <ul className="space-y-1.5">
          {payments.map((p) => (
            <li key={p._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2 text-[12px]">
              <span className="font-bold">
                {fmtDay(p.periodKey)}
                {p.salaryType === 'hourly' ? ` · ${p.units}h` : ''}
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
  )
}
