import { X, CheckCircle2, AlertCircle, Clock, Banknote, Building2, User, Bell } from 'lucide-react'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { useGetVendorSettlementDetailsQuery, useRemindAdminForSettlementMutation } from '../../../store/api/workforceApi.js'
import { createPortal } from 'react-dom'
import { useState } from 'react'

function formatMoney(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export function VendorSettlementDrawer({ settlementId, onClose }) {
  const { data, isLoading, isError } = useGetVendorSettlementDetailsQuery(settlementId, { skip: !settlementId })
  const [remindAdmin, { isLoading: isReminding }] = useRemindAdminForSettlementMutation()
  
  const [remindSuccess, setRemindSuccess] = useState(false)

  if (!settlementId) return null

  const settlement = data?.settlement

  const handleRemind = async () => {
    try {
      await remindAdmin(settlementId).unwrap()
      setRemindSuccess(true)
      setTimeout(() => setRemindSuccess(false), 3000)
    } catch (e) {
      console.error('Failed to remind admin', e)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] flex justify-end bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md h-full bg-slate-50 flex flex-col shadow-2xl animate-slide-left overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between z-10 shrink-0">
          <div>
            <h2 className="text-[16px] font-extrabold text-slate-900">Settlement Details</h2>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{settlement?.reference || 'Loading...'}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition">
            <X className="h-4 w-4 text-slate-600" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar pb-24">
          {isLoading ? (
            <div className="p-4 text-center text-sm font-semibold text-slate-500">Loading details...</div>
          ) : isError || !settlement ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Failed to load settlement details.
            </div>
          ) : (
            <>
              {/* Status Badge */}
              <AppSurface className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-bold text-slate-500">Status</p>
                  <p className="text-[15px] font-black uppercase mt-0.5 text-slate-900 flex items-center gap-1.5">
                    {settlement.status === 'settlement_completed' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    {settlement.status === 'settlement_pending' && <Clock className="h-4 w-4 text-amber-500" />}
                    {settlement.status === 'settlement_on_hold' && <AlertCircle className="h-4 w-4 text-rose-500" />}
                    {settlement.status === 'waiting_for_corporate_payment' && <Clock className="h-4 w-4 text-blue-500" />}
                    {settlement.status.replace(/_/g, ' ')}
                  </p>
                </div>
                {!settlement.isPlaceholder && (
                  <div className="text-right">
                    <p className="text-[12px] font-bold text-slate-500">Net Settlement</p>
                    <p className="text-[20px] font-black text-emerald-600">{formatMoney(settlement.financials?.netSettlement)}</p>
                  </div>
                )}
              </AppSurface>

              {/* Project & Client */}
              <AppSurface className="p-0 overflow-hidden divide-y divide-slate-100">
                <div className="p-4 flex gap-3 items-start">
                  <Building2 className="h-5 w-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold text-slate-500">Project</p>
                    <p className="text-[14px] font-bold text-slate-900">{settlement.projectName}</p>
                  </div>
                </div>
                <div className="p-4 flex gap-3 items-start">
                  <User className="h-5 w-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold text-slate-500">Corporate Client</p>
                    <p className="text-[14px] font-bold text-slate-900">{settlement.corporateName}</p>
                  </div>
                </div>
              </AppSurface>

              {/* Earnings Breakdown */}
              {!settlement.isPlaceholder && (
                <AppSurface className="p-5 space-y-4">
                  <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Banknote className="h-4 w-4" /> Earnings Breakdown {settlement.milestone && `(${settlement.milestone.toUpperCase()})`}
                  </h3>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] font-semibold text-slate-600">Gross Earnings</span>
                      <span className="text-[13px] font-bold text-slate-900">{formatMoney(settlement.financials?.grossEarnings)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] font-semibold text-rose-500">Platform Fee</span>
                      <span className="text-[13px] font-bold text-rose-600">- {formatMoney(settlement.financials?.platformFee)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] font-semibold text-rose-500">GST Deducted</span>
                      <span className="text-[13px] font-bold text-rose-600">- {formatMoney(settlement.financials?.gst)}</span>
                    </div>
                    {settlement.financials?.otherDeductions > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-[13px] font-semibold text-rose-500">Other Deductions</span>
                        <span className="text-[13px] font-bold text-rose-600">- {formatMoney(settlement.financials?.otherDeductions)}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-[14px] font-black text-slate-900">Final Net Settlement</span>
                    <span className="text-[16px] font-black text-emerald-600">{formatMoney(settlement.financials?.netSettlement)}</span>
                  </div>
                </AppSurface>
              )}

              {/* Timeline */}
              <AppSurface className="p-5">
                <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-wider mb-4">Settlement Timeline</h3>
                
                <div className="relative border-l-2 border-slate-200 ml-2 space-y-6 pb-2">
                  
                  <div className="relative pl-6">
                    <div className="absolute w-3 h-3 bg-emerald-500 rounded-full -left-[7px] top-1.5 ring-4 ring-white" />
                    <p className="text-[13px] font-bold text-slate-900">Project Accepted</p>
                    <p className="text-[11px] font-semibold text-slate-500">{formatDate(settlement.timeline?.acceptedAt)}</p>
                  </div>
                  
                  {!settlement.isPlaceholder && (
                    <div className="relative pl-6">
                      <div className="absolute w-3 h-3 bg-blue-500 rounded-full -left-[7px] top-1.5 ring-4 ring-white" />
                      <p className="text-[13px] font-bold text-slate-900">Settlement Created</p>
                      <p className="text-[11px] font-semibold text-slate-500">{formatDate(settlement.timeline?.createdAt)}</p>
                    </div>
                  )}

                  {settlement.status === 'settlement_on_hold' && (
                    <div className="relative pl-6">
                      <div className="absolute w-3 h-3 bg-rose-500 rounded-full -left-[7px] top-1.5 ring-4 ring-white" />
                      <p className="text-[13px] font-bold text-rose-600">On Hold</p>
                      <p className="text-[11px] font-semibold text-slate-500">Reason: {settlement.holdReason || 'Admin Manual Hold'}</p>
                      <p className="text-[11px] font-semibold text-slate-400 mt-1">{formatDate(settlement.timeline?.updatedAt)}</p>
                    </div>
                  )}

                  {['settlement_completed', 'partially_released'].includes(settlement.status) && (
                    <div className="relative pl-6">
                      <div className="absolute w-3 h-3 bg-amber-500 rounded-full -left-[7px] top-1.5 ring-4 ring-white" />
                      <p className="text-[13px] font-bold text-slate-900">Released by Admin</p>
                      <p className="text-[11px] font-semibold text-slate-500">Wallet Credited</p>
                      <p className="text-[11px] font-semibold text-slate-400 mt-1">{formatDate(settlement.timeline?.updatedAt)}</p>
                    </div>
                  )}
                  
                </div>
              </AppSurface>

              {/* Remind Admin Action */}
              {settlement.status === 'settlement_pending' && (
                <div className="pt-4">
                  <button
                    onClick={handleRemind}
                    disabled={isReminding || remindSuccess}
                    className={`w-full py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 font-black text-[13px] transition-all shadow-sm ${
                      remindSuccess 
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50'
                    }`}
                  >
                    {remindSuccess ? (
                      <><CheckCircle2 className="h-4 w-4" /> Reminder Sent to Admin</>
                    ) : isReminding ? (
                      'Sending...'
                    ) : (
                      <><Bell className="h-4 w-4" /> Request Settlement Release</>
                    )}
                  </button>
                  <p className="text-center mt-2 text-[10px] font-bold text-slate-400">
                    If this settlement has been pending for over 24 hours, you can manually notify the admin.
                  </p>
                </div>
              )}

            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
