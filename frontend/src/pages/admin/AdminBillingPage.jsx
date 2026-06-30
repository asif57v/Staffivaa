import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, ChevronRight } from 'lucide-react'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { AppSurface } from '../../components/app-ui/cards/AppSurface.jsx'
import { useGenerateInvoiceMutation, useGetAdminRequestsQuery } from '../../store/api/workforceApi.js'

function formatMoney(n) {
  if (n == null) return '₹0'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function formatDate(dStr) {
  if (!dStr) return '—'
  return new Date(dStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function AdminBillingPage() {
  const navigate = useNavigate()
  const [requestId, setRequestId] = useState('')
  const [message, setMessage] = useState('')
  const [generateInvoice, { isLoading }] = useGenerateInvoiceMutation()

  const { data: requestsData, isLoading: loadingRequests } = useGetAdminRequestsQuery()
  const requests = requestsData?.requests || []
  
  // Filter for projects/requests that are corporate
  const billingProjects = requests.filter(r => r.sourceType === 'corporate')

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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Payments & Billing</h1>
          <p className="mt-2 text-sm text-slate-600">Track escrow collections, advance payments, and release vendor payouts.</p>
        </div>
      </div>

      {/* Invoice Generator Form */}
      <GlassPanel className="p-6">
        <form onSubmit={handleGenerate} className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Generate GST-ready Invoice</label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/35"
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              placeholder="Enter Request ID / Project ID"
            />
          </div>
          <div className="shrink-0">
            <AppPrimaryButton type="submit" loading={isLoading}>
              Generate Invoice
            </AppPrimaryButton>
          </div>
        </form>
        {message ? <p className="text-xs font-bold text-[#FFC107] mt-3">{message}</p> : null}
      </GlassPanel>

      {/* Stripe-like Project Payments Ledger */}
      <AppSurface className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-sm font-extrabold text-slate-900">Financial Pipelines</h2>
          <span className="text-xs font-bold text-slate-500">{billingProjects.length} corporate pipeline(s)</span>
        </div>

        {loadingRequests ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading pipelines…</div>
        ) : billingProjects.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <FileText className="mx-auto h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500 font-semibold">No active billing pipelines found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-100">
                  <th className="p-4">Reference</th>
                  <th className="p-4">Corporate Client</th>
                  <th className="p-4">Project Start</th>
                  <th className="p-4">Project Status</th>
                  <th className="p-4">Advance Status</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {billingProjects.map((proj) => (
                  <tr key={proj._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-black text-slate-900">{proj.reference}</td>
                    <td className="p-4">{proj.clientId?.corporateProfile?.companyName || proj.clientId?.fullName || 'Client'}</td>
                    <td className="p-4">{formatDate(proj.startDate)}</td>
                    <td className="p-4">
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {proj.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        proj.advancePaymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {proj.advancePaymentStatus === 'paid' ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/payments/${proj._id}`)}
                        className="inline-flex items-center gap-1 text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition text-[10px] font-black"
                      >
                        Ledger <ChevronRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AppSurface>
    </div>
  )
}
