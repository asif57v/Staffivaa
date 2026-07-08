import { useState, useMemo } from 'react'
import {
  X, Calendar, Download, FileText, Clock, Users, IndianRupee,
  DollarSign, Percent, Banknote, TrendingUp, Layers, Sparkles,
  CreditCard, Send, CheckCircle2, Lock, Info, AlertTriangle,
  FileSearch, History, ShieldAlert, ChevronLeft, ChevronRight,
  PauseCircle, PlayCircle, Plus, Eye
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  useGetRequestQuery,
  useSendPaymentReminderMutation,
  useRecordOfflinePaymentMutation,
  useReleaseVendorSettlementMutation,
  useReleasePartialSettlementMutation,
  useHoldSettlementMutation,
  useAddFinanceNoteMutation,
  useGetAuditLogsQuery,
  useGetInvoicesByRequestQuery,
  useGenerateInvoiceMutation,
} from '../../store/api/workforceApi.js'

function formatMoney(n) {
  if (n == null) return '₹0'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function formatDate(dStr) {
  if (!dStr) return '—'
  return new Date(dStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatTime(dStr) {
  if (!dStr) return ''
  return new Date(dStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export function AdminSettlementDrawer({ requestId, onClose, onNext, onPrev, hasNext, hasPrev }) {
  const { data: detailData, isLoading, isError } = useGetRequestQuery(requestId, { skip: !requestId })
  
  const [sendReminder] = useSendPaymentReminderMutation()
  const [recordPayment] = useRecordOfflinePaymentMutation()
  const [releaseSettlement, { isLoading: releasingSettlement }] = useReleaseVendorSettlementMutation()
  const [releasePartial, { isLoading: releasingPartial }] = useReleasePartialSettlementMutation()
  const [holdSettlement, { isLoading: holding }] = useHoldSettlementMutation()
  const [addFinanceNote] = useAddFinanceNoteMutation()
  const [generateInvoice] = useGenerateInvoiceMutation()

  if (!requestId) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
        <div className="w-full max-w-4xl bg-white shadow-2xl rounded-2xl flex flex-col overflow-hidden max-h-full pointer-events-auto animate-in zoom-in-95 duration-200">
          
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
            <div>
              <h2 className="text-lg font-black text-slate-900">Settlement Details</h2>
              <p className="text-xs font-semibold text-slate-500 flex items-center gap-2">
                ID: {detailData?.request?.reference || requestId}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white border border-slate-200 rounded-lg mr-2 overflow-hidden shadow-sm">
                <button onClick={onPrev} disabled={!hasPrev} className="p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition border-r border-slate-200">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={onNext} disabled={!hasNext} className="p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-500 transition">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-500" />
              </div>
            ) : isError || !detailData?.request ? (
              <div className="text-center py-10">
                <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-900">Unable to load settlement details</h3>
              </div>
            ) : (
              <SettlementContent 
                requestId={requestId}
                detailData={detailData} 
                onReleaseFinal={releaseSettlement}
                onReleasePartial={releasePartial}
                onHold={holdSettlement}
                onAddNote={addFinanceNote}
                onGenerateInvoice={generateInvoice}
                onReminder={() => sendReminder(requestId).unwrap().then(() => toast.success('Reminder sent')).catch(e => toast.error(e?.data?.message || 'Failed'))}
                onOffline={() => recordPayment(requestId).unwrap().then(() => toast.success('Payment recorded')).catch(e => toast.error(e?.data?.message || 'Failed'))}
                isReleasing={releasingSettlement || releasingPartial}
                isHolding={holding}
              />
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function SettlementContent({ requestId, detailData, onReleaseFinal, onReleasePartial, onHold, onAddNote, onGenerateInvoice, onReminder, onOffline, isReleasing, isHolding }) {
  const [activeTab, setActiveTab] = useState('overview')
  const { request, allocation, assignments, paymentSummary, quotation } = detailData

  const tabs = [
    { id: 'overview', label: 'Ledger Overview' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'notes', label: 'Notes' },
    { id: 'invoices', label: 'Invoices' },
    { id: 'audit', label: 'Audit Logs' },
  ]

  const totalLabourCost = allocation?.totalLabourCost || quotation?.grandTotal || 0
  const corpFee = request.userPlatformFee || 0
  const gstAmount = Math.round((corpFee * (request.userGstRate || 18)) / 100)
  const vendorPlatformFee = request.labourPlatformFee || 0
  const grossAmount = paymentSummary?.grandTotal || (totalLabourCost + corpFee + gstAmount)
  
  const netPayable = totalLabourCost - vendorPlatformFee
  
  const ledger = request.settlementLedger || []
  const alreadyReleased = ledger.reduce((sum, item) => sum + (item.amount || 0), 0)
  const remainingAmount = netPayable - alreadyReleased
  const expectedDate = request.endDate || request.startDate

  let health = '🟢 On Time'
  if (remainingAmount > 0 && new Date() > new Date(expectedDate)) health = '🔴 Overdue'
  else if (alreadyReleased > 0 && remainingAmount > 0) health = '🟡 Partial'

  return (
    <div className="flex h-full">
      {/* Left Sidebar Menu */}
      <div className="w-48 bg-white border-r border-slate-200 shrink-0 flex flex-col">
        <div className="p-4 space-y-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition ${
                activeTab === t.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        
        <div className="mt-auto p-4 border-t border-slate-100">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Health</p>
          <div className="text-xs font-bold text-slate-900 bg-slate-50 px-2 py-1.5 rounded border border-slate-200">
            {health}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Banner */}
        {request.status === 'settlement_on_hold' && (
          <div className="bg-rose-50 border-b border-rose-200 p-3 px-6 flex items-start gap-3 shrink-0">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
            <div>
              <p className="text-xs font-black text-rose-800 uppercase">ON HOLD: {request.holdReason}</p>
              <p className="text-[10px] text-rose-600 font-semibold mt-0.5">{request.holdNotes}</p>
              {request.expectedResumeDate && <p className="text-[10px] text-rose-500 font-medium mt-1">Expected Resume: {formatDate(request.expectedResumeDate)}</p>}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <OverviewTab 
              request={request} allocation={allocation} assignments={assignments}
              grossAmount={grossAmount} corpFee={corpFee} gstAmount={gstAmount} vendorPlatformFee={vendorPlatformFee}
              netPayable={netPayable} alreadyReleased={alreadyReleased} remainingAmount={remainingAmount} ledger={ledger}
              onReleaseFinal={onReleaseFinal} onReleasePartial={onReleasePartial} onHold={onHold}
              onReminder={onReminder} onOffline={onOffline} isReleasing={isReleasing} isHolding={isHolding}
            />
          )}
          {activeTab === 'timeline' && <TimelineTab request={request} />}
          {activeTab === 'notes' && <NotesTab request={request} onAddNote={onAddNote} />}
          {activeTab === 'invoices' && <InvoicesTab requestId={requestId} onGenerate={onGenerateInvoice} />}
          {activeTab === 'audit' && <AuditTab requestId={requestId} />}
        </div>
      </div>
    </div>
  )
}

function OverviewTab({ request, allocation, assignments, grossAmount, corpFee, gstAmount, vendorPlatformFee, netPayable, alreadyReleased, remainingAmount, ledger, onReleaseFinal, onReleasePartial, onHold, onReminder, onOffline, isReleasing, isHolding }) {
  const [isPartialModalOpen, setPartialModalOpen] = useState(false)
  const [isHoldModalOpen, setHoldModalOpen] = useState(false)
  const [isConfirmModalOpen, setConfirmModalOpen] = useState(false)
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Corporate Client</p>
          <p className="text-sm font-bold text-slate-900">{request.clientId?.corporateProfile?.companyName || request.clientId?.fullName || 'N/A'}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Assigned Vendor</p>
          <p className="text-sm font-bold text-[#6366f1]">{allocation?.vendorId?.contractorProfile?.companyName || allocation?.vendorId?.fullName || 'N/A'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 font-extrabold text-xs text-slate-900">Financial Summary</div>
          <div className="p-5 space-y-3 text-xs font-semibold flex-1">
            <div className="flex justify-between"><span className="text-slate-500">Gross Project Value</span><span className="font-bold">{formatMoney(grossAmount)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Platform Fee</span><span className="font-bold">{formatMoney(corpFee)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">GST (18%)</span><span className="font-bold">{formatMoney(gstAmount)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Vendor Platform Deduction</span><span className="font-bold text-rose-600">- {formatMoney(vendorPlatformFee)}</span></div>
            <div className="border-t border-slate-100 pt-3 mt-3 flex justify-between font-black text-sm"><span className="text-slate-900">Net Payable</span><span className="text-indigo-600">{formatMoney(netPayable)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Already Released</span><span className="font-bold text-emerald-600">{formatMoney(alreadyReleased)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Held in Escrow (Remaining)</span><span className="font-bold text-amber-600">{formatMoney(remainingAmount)}</span></div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-xl shadow-lg flex flex-col text-white">
          <div className="px-5 py-3 border-b border-slate-800 font-extrabold text-xs flex justify-between">
            <span>Admin Controls</span>
            <ShieldAlert className="h-4 w-4 text-slate-400" />
          </div>
          <div className="p-5 flex flex-col gap-3 flex-1 justify-center">
            {request.status === 'settlement_on_hold' ? (
              <button 
                onClick={() => onHold({ id: request._id, status: 'settlement_pending' }).unwrap().then(()=>toast.success('Resumed'))}
                disabled={isHolding}
                className="w-full bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"
              >
                <PlayCircle className="h-4 w-4" /> Resume Settlement
              </button>
            ) : (
              <>
                <button 
                  onClick={() => setConfirmModalOpen(true)}
                  disabled={isReleasing || remainingAmount <= 0}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black py-3 rounded-lg transition disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4 inline mr-2" /> Release Final Settlement
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setPartialModalOpen(true)} disabled={remainingAmount <= 0} className="bg-slate-800 hover:bg-slate-700 text-xs font-bold py-2.5 rounded-lg transition text-slate-300">
                    Partial Settlement
                  </button>
                  <button onClick={() => setHoldModalOpen(true)} className="bg-rose-500/20 hover:bg-rose-500/30 text-xs font-bold py-2.5 rounded-lg transition text-rose-400 border border-rose-500/30">
                    <PauseCircle className="h-4 w-4 inline mr-1" /> Hold
                  </button>
                </div>
              </>
            )}
            
            {request.advancePaymentStatus !== 'paid' && (
              <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 gap-3">
                <button onClick={onReminder} className="bg-slate-800 hover:bg-slate-700 text-xs font-bold py-2.5 rounded-lg transition text-slate-300">
                  <Send className="h-3.5 w-3.5 inline mr-1" /> Reminder
                </button>
                <button onClick={onOffline} className="bg-slate-800 hover:bg-slate-700 text-xs font-bold py-2.5 rounded-lg transition text-slate-300">
                  Offline Advance
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 font-extrabold text-xs text-slate-900">Immutable Settlement Ledger</div>
        <div className="p-0">
          {ledger.length === 0 ? (
            <p className="p-5 text-center text-xs text-slate-400 font-semibold">No payouts released yet.</p>
          ) : (
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-2">Date</th>
                  <th className="px-5 py-2">Type</th>
                  <th className="px-5 py-2">Method</th>
                  <th className="px-5 py-2">Reference</th>
                  <th className="px-5 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {ledger.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-5 py-2.5">{formatDate(item.date)}</td>
                    <td className="px-5 py-2.5"><span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] uppercase font-black border border-indigo-100">{item.type}</span></td>
                    <td className="px-5 py-2.5">{item.method}</td>
                    <td className="px-5 py-2.5 font-mono text-slate-500">{item.reference || 'N/A'}</td>
                    <td className="px-5 py-2.5 text-right font-black text-emerald-600">{formatMoney(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {isPartialModalOpen && <PartialModal maxAmount={remainingAmount} request={request} onClose={() => setPartialModalOpen(false)} onConfirm={onReleasePartial} />}
      {isHoldModalOpen && <HoldModal request={request} onClose={() => setHoldModalOpen(false)} onConfirm={onHold} />}
      {isConfirmModalOpen && <ConfirmFinalModal remainingAmount={remainingAmount} request={request} onClose={() => setConfirmModalOpen(false)} onConfirm={onReleaseFinal} />}
    </div>
  )
}

function PartialModal({ maxAmount, request, onClose, onConfirm }) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Manual Bank Transfer')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const handleRelease = async () => {
    if (Number(amount) > maxAmount || Number(amount) <= 0) return toast.error('Invalid amount')
    try {
      await onConfirm({ id: request._id, amount: Number(amount), method, reference, notes }).unwrap()
      toast.success('Partial settlement processed')
      onClose()
    } catch (e) {
      toast.error(e?.data?.message || 'Failed to process')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="text-sm font-black text-slate-900">Release Partial Settlement</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4 text-xs font-semibold">
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Amount (Max: {formatMoney(maxAmount)})</label>
            <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. 15000" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Payment Method</label>
            <select value={method} onChange={e=>setMethod(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none">
              <option>Manual Bank Transfer</option><option>RazorpayX</option><option>NEFT</option><option>RTGS</option><option>UPI</option><option>Wallet Adjustment</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">UTR / Reference (Optional)</label>
            <input type="text" value={reference} onChange={e=>setReference(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none" />
          </div>
          <button onClick={handleRelease} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg font-bold transition">Confirm & Release</button>
        </div>
      </div>
    </div>
  )
}

function HoldModal({ request, onClose, onConfirm }) {
  const [holdReason, setHoldReason] = useState('Attendance Dispute')
  const [holdNotes, setHoldNotes] = useState('')

  const handleHold = async () => {
    try {
      await onConfirm({ id: request._id, holdReason, holdNotes }).unwrap()
      toast.success('Settlement put on hold')
      onClose()
    } catch (e) { toast.error('Failed to hold') }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
        <div className="px-5 py-4 border-b border-rose-100 bg-rose-50 flex justify-between items-center">
          <h3 className="text-sm font-black text-rose-900">Hold Settlement</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-rose-400" /></button>
        </div>
        <div className="p-5 space-y-4 text-xs font-semibold">
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Reason</label>
            <select value={holdReason} onChange={e=>setHoldReason(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none">
              <option>Attendance Dispute</option><option>Corporate Complaint</option><option>Worker Verification</option><option>Document Verification</option><option>Manual Review</option><option>Other</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Internal Notes</label>
            <textarea value={holdNotes} onChange={e=>setHoldNotes(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none h-20" placeholder="Optional notes..."></textarea>
          </div>
          <button onClick={handleHold} className="w-full bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-lg font-bold transition">Confirm Hold</button>
        </div>
      </div>
    </div>
  )
}

function ConfirmFinalModal({ remainingAmount, request, onClose, onConfirm }) {
  const [method, setMethod] = useState('RazorpayX')
  const handleRelease = async () => {
    try {
      await onConfirm(request._id).unwrap()
      toast.success('Final Settlement Released')
      onClose()
    } catch(e) { toast.error('Failed') }
  }
  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
        <div className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
          <h3 className="text-lg font-black text-slate-900">Release Settlement?</h3>
          <p className="text-xs text-slate-500 font-semibold mt-1">You are about to release the final settlement amount of <span className="text-slate-900 font-black">{formatMoney(remainingAmount)}</span> to the vendor.</p>
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-black uppercase p-2 rounded-lg mt-4">This action cannot be undone.</div>
        </div>
        <div className="p-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg font-bold text-xs bg-slate-100 text-slate-600 hover:bg-slate-200">Cancel</button>
          <button onClick={handleRelease} className="flex-1 py-2.5 rounded-lg font-bold text-xs bg-emerald-500 text-slate-950 hover:bg-emerald-400">Yes, Release</button>
        </div>
      </div>
    </div>
  )
}

function TimelineTab({ request }) {
  const steps = [
    { title: 'Project Initiated', active: true, done: true },
    { title: 'Corporate Advance Received', active: request.advancePaymentStatus === 'paid', done: request.advancePaymentStatus === 'paid' },
    { title: 'Project Completed', active: request.status === 'completed' || request.status.includes('settlement'), done: request.status === 'completed' || request.status.includes('settlement') },
    { title: 'Settlement Calculated', active: request.status === 'completed' || request.status.includes('settlement'), done: request.status === 'completed' || request.status.includes('settlement') },
    { title: 'Vendor Wallet Credited', active: request.status === 'settlement_completed' || request.status === 'partially_released', done: request.status === 'settlement_completed' },
  ]
  return (
    <div className="max-w-md mx-auto space-y-6 pt-4">
      <h3 className="text-sm font-black text-slate-900 mb-6">Settlement Timeline</h3>
      <div className="relative border-l-2 border-slate-200 ml-4 space-y-8">
        {steps.map((s, i) => (
          <div key={i} className="relative pl-6">
            <div className={`absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 ${s.done ? 'bg-emerald-500 border-white ring-2 ring-emerald-200' : s.active ? 'bg-indigo-500 border-white ring-2 ring-indigo-200' : 'bg-slate-200 border-white'}`} />
            <div>
              <p className={`text-xs font-black ${s.active ? 'text-slate-900' : 'text-slate-400'}`}>{s.title}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function NotesTab({ request, onAddNote }) {
  const [note, setNote] = useState('')
  const notes = request.adminFinanceNotes || []
  const handleAdd = async () => {
    if(!note) return
    await onAddNote({ id: request._id, note }).unwrap()
    setNote('')
  }
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex gap-3">
        <input value={note} onChange={e=>setNote(e.target.value)} type="text" placeholder="Add an internal finance note..." className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500" />
        <button onClick={handleAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition">Save Note</button>
      </div>
      <div className="space-y-3">
        {notes.length === 0 ? <p className="text-xs text-slate-400 font-semibold text-center py-10">No internal notes yet.</p> : notes.slice().reverse().map((n, i) => (
          <div key={i} className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl">
            <p className="text-xs font-semibold text-slate-700">{n.note}</p>
            <p className="text-[10px] font-black uppercase text-yellow-700 mt-2">{n.adminName} &bull; {formatDate(n.date)} {formatTime(n.date)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function InvoicesTab({ requestId, onGenerate }) {
  const { data, isLoading } = useGetInvoicesByRequestQuery(requestId)
  const invoices = data?.invoices || []
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-black text-slate-900">Invoice History</h3>
        <button onClick={() => onGenerate({ requestId }).unwrap().then(()=>toast.success('Generated'))} className="bg-white border border-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-slate-50">Generate New</button>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {isLoading ? <p className="p-5 text-center text-xs">Loading...</p> : invoices.length === 0 ? <p className="p-8 text-center text-xs text-slate-400 font-semibold">No invoices generated.</p> : (
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-slate-50/50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-100">
              <tr><th className="px-5 py-2">Invoice #</th><th className="px-5 py-2">Date</th><th className="px-5 py-2">Total</th><th className="px-5 py-2">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
              {invoices.map(inv => (
                <tr key={inv._id}>
                  <td className="px-5 py-3 font-mono">{inv.invoiceNumber}</td>
                  <td className="px-5 py-3">{formatDate(inv.createdAt)}</td>
                  <td className="px-5 py-3 font-black text-slate-900">{formatMoney(inv.total)}</td>
                  <td className="px-5 py-3"><span className="bg-slate-100 px-2 py-0.5 rounded uppercase font-black text-[9px] text-slate-600">{inv.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function AuditTab({ requestId }) {
  const { data, isLoading } = useGetAuditLogsQuery({ entityId: requestId })
  const logs = data?.logs || []
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-black text-slate-900 mb-2">Security Audit Trail</h3>
      {isLoading ? <p className="text-xs">Loading logs...</p> : logs.length === 0 ? <p className="text-xs text-slate-400 text-center py-10">No logs found.</p> : (
        <div className="space-y-3">
          {logs.map(log => (
            <div key={log._id} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm text-xs">
              <div className="flex justify-between items-start mb-2">
                <span className="font-black text-slate-900">{log.action}</span>
                <span className="text-[10px] font-bold text-slate-400">{formatDate(log.createdAt)} {formatTime(log.createdAt)}</span>
              </div>
              <p className="font-medium text-slate-600 mb-1">Admin: <span className="font-bold text-slate-900">{log.admin?.firstName || 'System'}</span> (IP: {log.ipAddress || 'Unknown'})</p>
              {log.reason && <p className="font-semibold text-amber-700 bg-amber-50 inline-block px-2 py-0.5 rounded mt-1 border border-amber-100">Reason: {log.reason}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
