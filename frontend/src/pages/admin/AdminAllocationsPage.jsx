import { useState } from 'react'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import {
  useCreateAllocationMutation,
  useGetAdminRequestsQuery,
} from '../../store/api/workforceApi.js'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/35'

export function AdminAllocationsPage() {
  const { data } = useGetAdminRequestsQuery({ status: 'confirmed' })
  const requests = data?.requests ?? []
  const [createAllocation, { isLoading }] = useCreateAllocationMutation()

  const [requestId, setRequestId] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [labourIdsText, setLabourIdsText] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    if (!requestId) {
      setMessage('Select a request')
      return
    }
    const labourIds = labourIdsText
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    try {
      const res = await createAllocation({
        requestId,
        vendorId: vendorId.trim() || undefined,
        labourIds,
        notes: notes.trim() || undefined,
      }).unwrap()
      setMessage(`Created ${res?.assignments?.length ?? 0} assignment(s)`)
      setLabourIdsText('')
    } catch (err) {
      setMessage(err?.data?.message || err?.message || 'Allocation failed')
    }
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Workforce allocation</h1>
        <p className="mt-2 text-sm text-slate-600">
          Assign labour IDs to a request. Comma- or space-separated MongoDB IDs.
        </p>
      </div>

      <GlassPanel className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Request</label>
            <select
              className={inputClass}
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              required
            >
              <option value="">Select request</option>
              {requests.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.reference} — {r.clientId?.fullName || r.clientId?.corporateProfile?.companyName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">
              Vendor ID (optional)
            </label>
            <input className={inputClass} value={vendorId} onChange={(e) => setVendorId(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Labour IDs</label>
            <textarea
              className={inputClass}
              rows={3}
              placeholder="id1, id2, id3"
              value={labourIdsText}
              onChange={(e) => setLabourIdsText(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Notes</label>
            <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {message ? <p className="text-sm font-semibold text-brand">{message}</p> : null}
          <AppPrimaryButton type="submit" loading={isLoading}>
            Create allocation
          </AppPrimaryButton>
        </form>
      </GlassPanel>
    </div>
  )
}
