import { useState } from 'react'
import { FileText } from 'lucide-react'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { useGenerateInvoiceMutation } from '../../store/api/workforceApi.js'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/35'

export function AdminBillingPage() {
  const [requestId, setRequestId] = useState('')
  const [message, setMessage] = useState('')
  const [generateInvoice, { isLoading }] = useGenerateInvoiceMutation()

  const handleGenerate = async (e) => {
    e.preventDefault()
    setMessage('')
    if (!requestId.trim()) {
      setMessage('Enter a request ID')
      return
    }
    try {
      const res = await generateInvoice({ requestId: requestId.trim() }).unwrap()
      setMessage(`Invoice ${res?.invoice?.invoiceNumber || 'created'} generated`)
    } catch (err) {
      setMessage(err?.data?.message || err?.message || 'Generation failed')
    }
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Payments & billing</h1>
        <p className="mt-2 text-sm text-slate-600">Generate GST-ready invoices from verified attendance.</p>
      </div>

      <GlassPanel className="p-6">
        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Request ID</label>
            <input
              className={inputClass}
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              placeholder="MongoDB request _id"
            />
          </div>
          {message ? <p className="text-sm font-semibold text-brand">{message}</p> : null}
          <AppPrimaryButton type="submit" loading={isLoading}>
            Generate invoice
          </AppPrimaryButton>
        </form>
      </GlassPanel>

      <GlassPanel className="p-8 text-center">
        <FileText className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
        <p className="mt-3 text-sm text-slate-600">Invoice list view — connect list endpoint in a later pass.</p>
      </GlassPanel>
    </div>
  )
}
