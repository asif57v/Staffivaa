import { useMemo, useState } from 'react'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { useGetAdminDirectPaymentsQuery } from '../../store/api/adminEnterpriseApi.js'

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`
const fmtDateTime = (d) =>
  new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })

/** All enterprise payments for daily/hourly jobs, filterable by month or date */
export function AdminDirectPaymentsList() {
  const [mode, setMode] = useState('all')
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))

  const range = useMemo(() => {
    if (mode === 'month' && month) {
      const [y, m] = month.split('-').map(Number)
      return { from: new Date(y, m - 1, 1).toISOString(), to: new Date(y, m, 0, 23, 59, 59, 999).toISOString() }
    }
    if (mode === 'date' && date) {
      const [y, m, d] = date.split('-').map(Number)
      return { from: new Date(y, m - 1, d).toISOString(), to: new Date(y, m - 1, d, 23, 59, 59, 999).toISOString() }
    }
    return undefined
  }, [mode, month, date])

  const { data } = useGetAdminDirectPaymentsQuery(range)
  const payments = data?.data?.payments ?? []
  const total = data?.data?.total ?? 0

  return (
    <GlassPanel className="p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Enterprise payments</h2>
          <p className="text-xs text-slate-500">
            {payments.length} payment(s) · total <span className="font-black text-emerald-700">{inr(total)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-white p-1 ring-1 ring-slate-200">
            {[['all', 'All'], ['month', 'Month'], ['date', 'Date']].map(([key, text]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${mode === key ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {text}
              </button>
            ))}
          </div>
          {mode === 'month' && (
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium" />
          )}
          {mode === 'date' && (
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium" />
          )}
        </div>
      </div>

      {payments.length === 0 ? (
        <p className="text-sm text-slate-500">No payments in this period.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {payments.map((p) => (
            <li key={p._id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="font-bold text-slate-900 truncate">{p.jobId?.jobTitle || 'Job'}</p>
                <p className="text-xs text-slate-500">
                  {p.enterpriseId?.enterpriseProfile?.companyName || p.enterpriseId?.fullName || 'Enterprise'} · work date {p.periodKey}
                  {p.salaryType === 'hourly' ? ` · ${p.units}h` : ''} · {p.workersCount} worker(s)
                </p>
              </div>
              <div className="text-right">
                <p className="font-black text-emerald-700">{inr(p.amount)}</p>
                <p className="text-[11px] text-slate-500">Paid {fmtDateTime(p.paidAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  )
}
