import { useState } from 'react'
import { Layers } from 'lucide-react'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { useGetAdminPricingQuery, useUpsertPricingMutation } from '../../store/api/workforceApi.js'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/35'

export function AdminPricingPage() {
  const { data, isLoading } = useGetAdminPricingQuery()
  const [upsert, { isLoading: saving }] = useUpsertPricingMutation()
  const rates = data?.rates ?? []

  const [categoryId, setCategoryId] = useState('')
  const [clientType, setClientType] = useState('individual')
  const [ratePerShift, setRatePerShift] = useState('')
  const [workerRatePerShift, setWorkerRatePerShift] = useState('')
  const [gstPercent, setGstPercent] = useState('18')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    try {
      await upsert({
        categoryId,
        clientType,
        ratePerShift: Number(ratePerShift),
        workerRatePerShift: workerRatePerShift ? Number(workerRatePerShift) : undefined,
        gstPercent: Number(gstPercent) || 18,
      }).unwrap()
      setMessage('Rate saved')
      setCategoryId('')
      setRatePerShift('')
    } catch (err) {
      setMessage(err?.data?.message || err?.message || 'Save failed')
    }
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Pricing & rates</h1>
        <p className="mt-2 text-sm text-slate-600">Per skill, per client type — attendance-based billing.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassPanel className="p-6">
          <h2 className="text-sm font-bold uppercase text-slate-500">Add rate</h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <input
              className={inputClass}
              placeholder="Category ID"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            />
            <select className={inputClass} value={clientType} onChange={(e) => setClientType(e.target.value)}>
              <option value="individual">Individual</option>
              <option value="corporate">Corporate</option>
            </select>
            <input
              className={inputClass}
              type="number"
              placeholder="Rate per shift (₹)"
              value={ratePerShift}
              onChange={(e) => setRatePerShift(e.target.value)}
              required
            />
            <input
              className={inputClass}
              type="number"
              placeholder="Worker rate (optional)"
              value={workerRatePerShift}
              onChange={(e) => setWorkerRatePerShift(e.target.value)}
            />
            <input
              className={inputClass}
              type="number"
              placeholder="GST %"
              value={gstPercent}
              onChange={(e) => setGstPercent(e.target.value)}
            />
            {message ? <p className="text-sm font-semibold text-brand">{message}</p> : null}
            <AppPrimaryButton type="submit" loading={saving}>
              Save rate
            </AppPrimaryButton>
          </form>
        </GlassPanel>

        <GlassPanel className="p-6">
          <h2 className="text-sm font-bold uppercase text-slate-500">Active rates</h2>
          {isLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading…</p>
          ) : rates.length === 0 ? (
            <div className="mt-6 text-center">
              <Layers className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
              <p className="mt-2 text-sm text-slate-500">No rates configured.</p>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {rates.map((r) => (
                <li key={r._id} className="flex justify-between py-3 text-sm">
                  <span className="text-slate-600">
                    {String(r.categoryId).slice(-6)} · {r.clientType}
                  </span>
                  <span className="font-bold text-slate-900">₹{r.ratePerShift}/shift</span>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
      </div>
    </div>
  )
}
