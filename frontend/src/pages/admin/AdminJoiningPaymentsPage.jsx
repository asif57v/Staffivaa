import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CreditCard, ShieldCheck, CheckCircle2, XCircle, RefreshCw, AlertCircle,
  Building2, UserCheck, DollarSign, Calendar, Clock, Eye, Send, ArrowUpRight,
  FileText, Shield, Sparkles, Filter, Search, Loader2, Award, ArrowDownLeft
} from 'lucide-react'
import {
  useGetAdminJoiningPaymentsQuery,
  useVerifyApproveJoiningMutation,
  useRefundJoiningPaymentMutation,
  useSendPaymentReminderMutation,
  useExtendInvoiceDueDateMutation,
  useMarkInvoicePaidOfflineMutation,
  useCancelInvoiceMutation,
} from '../../store/api/adminEnterpriseApi.js'
import toast from 'react-hot-toast'

export function AdminJoiningPaymentsPage() {
  const [activeTab, setActiveTab] = useState('pending_verification')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState(null)

  // Modals state
  const [verifyModalInvoice, setVerifyModalInvoice] = useState(null)
  const [refundModalInvoice, setRefundModalInvoice] = useState(null)
  const [extendModalInvoice, setExtendModalInvoice] = useState(null)
  const [offlineModalInvoice, setOfflineModalInvoice] = useState(null)
  
  const [adminNotes, setAdminNotes] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [partialRefundAmount, setPartialRefundAmount] = useState('')
  const [extensionDays, setExtensionDays] = useState('7')
  const [paymentReference, setPaymentReference] = useState('')

  const { data: response, isLoading, isError, refetch } = useGetAdminJoiningPaymentsQuery({
    status: activeTab,
  })

  const [verifyApproveJoining, { isLoading: isVerifying }] = useVerifyApproveJoiningMutation()
  const [refundJoiningPayment, { isLoading: isRefunding }] = useRefundJoiningPaymentMutation()
  const [sendPaymentReminder, { isLoading: isReminding }] = useSendPaymentReminderMutation()
  const [extendInvoiceDueDate, { isLoading: isExtending }] = useExtendInvoiceDueDateMutation()
  const [markInvoicePaidOffline, { isLoading: isMarkingOffline }] = useMarkInvoicePaidOfflineMutation()
  const [cancelInvoice] = useCancelInvoiceMutation()

  const handleOfflinePayment = async () => {
    if (!offlineModalInvoice) return
    try {
      await markInvoicePaidOffline({
        id: offlineModalInvoice._id,
        paymentReference,
        adminNotes,
      }).unwrap()

      toast.success('Invoice marked as paid offline & candidate joining activated!')
      setOfflineModalInvoice(null)
      setPaymentReference('')
      setAdminNotes('')
      refetch()
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to mark offline payment')
    }
  }

  const handleExtendDueDate = async () => {
    if (!extendModalInvoice) return
    try {
      await extendInvoiceDueDate({
        id: extendModalInvoice._id,
        extensionDays: Number(extensionDays),
        adminNotes,
      }).unwrap()

      toast.success('Invoice due date extended successfully!')
      setExtendModalInvoice(null)
      setAdminNotes('')
      refetch()
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to extend due date')
    }
  }

  const invoices = response?.data || []
  const metrics = response?.metrics || {}

  const filteredInvoices = invoices.filter((inv) => {
    const company = inv.enterpriseId?.enterpriseProfile?.companyName || inv.enterpriseId?.fullName || ''
    const worker = inv.workerId?.fullName || ''
    const invNum = inv.invoiceNumber || ''
    const q = searchQuery.toLowerCase()
    return company.toLowerCase().includes(q) || worker.toLowerCase().includes(q) || invNum.toLowerCase().includes(q)
  })

  const handleVerifyApprove = async () => {
    if (!verifyModalInvoice) return
    try {
      await verifyApproveJoining({
        id: verifyModalInvoice._id,
        adminNotes,
      }).unwrap()

      toast.success('Payment verified & Candidate Joining activated!')
      setVerifyModalInvoice(null)
      setAdminNotes('')
      refetch()
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to verify payment')
    }
  }

  const handleRefund = async () => {
    if (!refundModalInvoice) return
    try {
      await refundJoiningPayment({
        id: refundModalInvoice._id,
        refundReason,
        partialAmount: partialRefundAmount ? Number(partialRefundAmount) : undefined,
      }).unwrap()

      toast.success('Refund processed & credited to Enterprise Wallet!')
      setRefundModalInvoice(null)
      setRefundReason('')
      setPartialRefundAmount('')
      refetch()
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to process refund')
    }
  }

  const handleReminder = async (invoiceId) => {
    try {
      await sendPaymentReminder(invoiceId).unwrap()
      toast.success('Payment reminder notification sent to Enterprise HR!')
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to send reminder')
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Top Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <ShieldCheck className="h-7 w-7 text-indigo-600" /> Enterprise Joining Payments & Escrow
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Production fintech escrow layer. Verify enterprise joining confirmation payments, approve workforce joinings, and manage wallet refunds.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-extrabold hover:bg-slate-50 transition-all shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className="h-4 w-4 text-indigo-600" /> Refresh Feed
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-3xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-lg shadow-indigo-200 space-y-1">
          <div className="flex items-center justify-between text-indigo-100">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Escrow Secured</span>
            <Shield className="h-4 w-4" />
          </div>
          <p className="text-xl font-black">₹{(metrics.totalEscrowSecured || 0).toLocaleString('en-IN')}</p>
          <p className="text-[10px] font-medium text-indigo-200">Locked in Escrow</p>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Outstanding</span>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-xl font-black text-slate-900">₹{(metrics.totalOutstandingAmount || 0).toLocaleString('en-IN')}</p>
          <p className="text-[10px] font-medium text-amber-600 font-bold">Unpaid Invoices</p>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Pending Verification</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-xl font-black text-slate-900">{metrics.pendingVerificationCount || 0}</p>
          <p className="text-[10px] font-medium text-amber-600 font-bold">Paid by Enterprise</p>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Due Today / Week</span>
            <Calendar className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="text-xl font-black text-slate-900">{metrics.dueTodayCount || 0} / {metrics.dueThisWeekCount || 0}</p>
          <p className="text-[10px] font-medium text-indigo-600 font-bold">Due Today / This Week</p>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Overdue Invoices</span>
            <AlertCircle className="h-4 w-4 text-rose-500" />
          </div>
          <p className="text-xl font-black text-slate-900">{metrics.overdueCount || 0}</p>
          <p className="text-[10px] font-medium text-rose-600 font-bold">Past Due & Grace Period</p>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Verified & Active</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-xl font-black text-slate-900">₹{(metrics.totalReleased || 0).toLocaleString('en-IN')}</p>
          <p className="text-[10px] font-medium text-emerald-600 font-bold">{metrics.verifiedCount || 0} Joined</p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl w-full md:w-auto overflow-x-auto">
          {[
            { id: 'pending_verification', label: 'Pending Verification', badge: metrics.pendingVerificationCount },
            { id: 'released', label: 'Verified & Active', badge: metrics.verifiedCount },
            { id: 'refunded', label: 'Refunded' },
            { id: 'expired', label: 'Expired / Overdue' },
            { id: 'all', label: 'All Payments' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {tab.label}
              {tab.badge > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${activeTab === tab.id ? 'bg-white text-indigo-900' : 'bg-indigo-100 text-indigo-700'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search company, worker or INV-..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
      </div>

      {/* Invoices List / Table */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center bg-white rounded-3xl border border-slate-100">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
            <p className="text-xs font-bold text-slate-500">Loading escrow payments...</p>
          </div>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center flex flex-col items-center justify-center">
          <div className="h-16 w-16 rounded-full bg-slate-50 border border-slate-100 text-slate-400 flex items-center justify-center mb-3">
            <FileText className="h-8 w-8" />
          </div>
          <h3 className="text-base font-extrabold text-slate-800">No Payments Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            No enterprise joining invoices match the selected filter criteria or search query.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Invoice / Ref ID</th>
                  <th className="py-3.5 px-4">Enterprise Company</th>
                  <th className="py-3.5 px-4">Candidate Worker</th>
                  <th className="py-3.5 px-4">Role & Job</th>
                  <th className="py-3.5 px-4">Total Amount</th>
                  <th className="py-3.5 px-4">Payment Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {filteredInvoices.map((inv) => {
                  const company = inv.enterpriseId?.enterpriseProfile?.companyName || inv.enterpriseId?.fullName || 'Company'
                  const worker = inv.workerId?.fullName || 'Worker'
                  const jobRole = inv.jobId?.jobTitle || 'Role'
                  const escrowStatus = inv.escrowTransactionId?.status || (inv.status === 'paid' ? 'secured' : inv.status)

                  return (
                    <tr key={inv._id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Invoice ID */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-extrabold text-slate-900">{inv.invoiceNumber}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(inv.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </td>

                      {/* Enterprise */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" /> {company}
                        </div>
                        <div className="text-[10px] text-slate-400">{inv.enterpriseId?.email}</div>
                      </td>

                      {/* Worker */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> {worker}
                        </div>
                        <div className="text-[10px] text-slate-400">{inv.workerId?.phone}</div>
                      </td>

                      {/* Job Role */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-indigo-600">{jobRole}</div>
                        <div className="text-[10px] text-slate-400">{inv.jobId?.locationText || 'Indore'}</div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900 text-sm">₹{inv.totalAmount?.toLocaleString('en-IN')}</div>
                        <div className="text-[10px] text-slate-400">
                          Dep: ₹{inv.securityDeposit} + Fee: ₹{inv.platformFee} + GST
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {inv.status === 'paid' && escrowStatus === 'secured' && (
                          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-extrabold text-[11px] inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" /> Escrow Secured (Pending Verification)
                          </span>
                        )}
                        {escrowStatus === 'released' && (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold text-[11px] inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Verified & Active
                          </span>
                        )}
                        {inv.status === 'refunded' && (
                          <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 font-extrabold text-[11px] inline-flex items-center gap-1">
                            <XCircle className="h-3.5 w-3.5 text-rose-600" /> Refunded to Wallet
                          </span>
                        )}
                        {inv.status === 'payment_pending' && (
                          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-extrabold text-[11px] inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-slate-500" /> Payment Pending
                          </span>
                        )}
                        {inv.status === 'expired' && (
                          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200 font-extrabold text-[11px] inline-flex items-center gap-1">
                            Expired (72 Hours)
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.status === 'paid' && escrowStatus === 'secured' && (
                            <button
                              onClick={() => setVerifyModalInvoice(inv)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold shadow-sm flex items-center gap-1 cursor-pointer"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" /> Approve Joining
                            </button>
                          )}

                          {inv.status === 'paid' && escrowStatus === 'secured' && (
                            <button
                              onClick={() => setRefundModalInvoice(inv)}
                              className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <ArrowDownLeft className="h-3.5 w-3.5" /> Refund
                            </button>
                          )}

                          {(inv.status === 'payment_pending' || inv.status === 'overdue') && (
                            <>
                              <button
                                onClick={() => setOfflineModalInvoice(inv)}
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
                                title="Mark Paid Offline (Bank Transfer/Cheque)"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Mark Paid Offline
                              </button>

                              <button
                                onClick={() => setExtendModalInvoice(inv)}
                                className="px-2.5 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 hover:bg-indigo-100 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                title="Extend Due Date"
                              >
                                <Calendar className="h-3.5 w-3.5" /> Extend Due
                              </button>

                              <button
                                onClick={() => handleReminder(inv._id)}
                                disabled={isReminding}
                                className="px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Send className="h-3.5 w-3.5" /> Remind HR
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-[11px] font-bold cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Verify & Approve Joining Modal */}
      <AnimatePresence>
        {verifyModalInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-6 w-6 text-emerald-600" />
                  <h3 className="text-lg font-extrabold text-slate-900">Approve Joining & Release Escrow</h3>
                </div>
                <button
                  onClick={() => setVerifyModalInvoice(null)}
                  className="h-8 w-8 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100 text-xs">
                <p className="font-extrabold text-emerald-950">Invoice Ref: #{verifyModalInvoice.invoiceNumber}</p>
                <p className="font-medium text-emerald-800">
                  Enterprise: <span className="font-bold">{verifyModalInvoice.enterpriseId?.enterpriseProfile?.companyName || verifyModalInvoice.enterpriseId?.fullName}</span>
                </p>
                <p className="font-medium text-emerald-800">
                  Worker Candidate: <span className="font-bold">{verifyModalInvoice.workerId?.fullName}</span> ({verifyModalInvoice.jobId?.jobTitle})
                </p>
                <p className="font-extrabold text-emerald-950 text-sm">Escrow Amount: ₹{verifyModalInvoice.totalAmount?.toLocaleString('en-IN')}</p>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wide mb-1.5">
                  Admin Verification Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Enterprise payment verified via bank reference. Worker joining approved."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  onClick={() => setVerifyModalInvoice(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVerifyApprove}
                  disabled={isVerifying}
                  className="flex items-center gap-2 px-6 py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold shadow-md shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Verify & Activate Worker Joining
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Refund Modal */}
      <AnimatePresence>
        {refundModalInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <ArrowDownLeft className="h-6 w-6 text-rose-600" />
                  <h3 className="text-lg font-extrabold text-slate-900">Refund to Enterprise Wallet</h3>
                </div>
                <button
                  onClick={() => setRefundModalInvoice(null)}
                  className="h-8 w-8 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-2 bg-rose-50/60 p-4 rounded-2xl border border-rose-100 text-xs">
                <p className="font-extrabold text-rose-950">Invoice Ref: #{refundModalInvoice.invoiceNumber}</p>
                <p className="font-extrabold text-rose-950 text-sm">Paid Amount: ₹{refundModalInvoice.totalAmount?.toLocaleString('en-IN')}</p>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wide mb-1.5">
                  Refund Reason
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Worker unavailable or candidate declined joining"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium outline-none focus:ring-2 focus:ring-rose-200"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wide mb-1.5">
                  Partial Refund Amount (Leave blank for Full ₹{refundModalInvoice.totalAmount})
                </label>
                <input
                  type="number"
                  placeholder={`Max ₹${refundModalInvoice.totalAmount}`}
                  value={partialRefundAmount}
                  onChange={(e) => setPartialRefundAmount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium outline-none focus:ring-2 focus:ring-rose-200"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  onClick={() => setRefundModalInvoice(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRefund}
                  disabled={isRefunding}
                  className="flex items-center gap-2 px-6 py-2 rounded-xl bg-rose-600 text-white text-xs font-extrabold shadow-md shadow-rose-200 hover:bg-rose-700 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isRefunding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownLeft className="h-4 w-4" />}
                  Issue Credit Refund
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invoice Detail Drawer */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Invoice #{selectedInvoice.invoiceNumber}</h3>
                  <p className="text-xs text-slate-500 font-mono">Created {new Date(selectedInvoice.createdAt).toLocaleString('en-IN')}</p>
                </div>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="h-8 w-8 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
                {/* Fee Breakdown */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2">
                  <h4 className="font-extrabold text-slate-900 uppercase text-[10px] tracking-wider mb-2">Financial Breakdown</h4>
                  <div className="flex justify-between text-slate-600">
                    <span>Security Deposit</span>
                    <span className="font-bold text-slate-800">₹{selectedInvoice.securityDeposit?.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Platform Fee</span>
                    <span className="font-bold text-slate-800">₹{selectedInvoice.platformFee?.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>GST (18%)</span>
                    <span className="font-bold text-slate-800">₹{selectedInvoice.gstAmount?.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-black text-slate-900">
                    <span>Total Amount</span>
                    <span className="text-indigo-600">₹{selectedInvoice.totalAmount?.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Company & Candidate Details */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-white border border-slate-100 rounded-2xl space-y-1">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase">Enterprise Client</p>
                    <p className="font-extrabold text-slate-900">{selectedInvoice.enterpriseId?.enterpriseProfile?.companyName || selectedInvoice.enterpriseId?.fullName}</p>
                    <p className="text-[11px] text-slate-500">{selectedInvoice.enterpriseId?.phone}</p>
                  </div>
                  <div className="p-4 bg-white border border-slate-100 rounded-2xl space-y-1">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase">Worker Candidate</p>
                    <p className="font-extrabold text-slate-900">{selectedInvoice.workerId?.fullName}</p>
                    <p className="text-[11px] text-slate-500">{selectedInvoice.workerId?.phone}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mark Paid Offline Modal */}
      <AnimatePresence>
        {offlineModalInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  <h3 className="text-lg font-extrabold text-slate-900">Mark Invoice Paid Offline</h3>
                </div>
                <button
                  onClick={() => setOfflineModalInvoice(null)}
                  className="h-8 w-8 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-600">
                <p className="font-semibold">
                  Confirm receipt of offline payment (Bank Transfer / NEFT / Cheque) for Invoice <span className="font-mono font-bold text-slate-900">#{offlineModalInvoice.invoiceNumber}</span>.
                </p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 font-extrabold text-slate-900">
                  Total Amount to Confirm: ₹{offlineModalInvoice.totalAmount?.toLocaleString('en-IN')}
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Bank Ref / Transaction ID</label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="e.g. UTR123456789 or Cheque #987654"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-200"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Admin Notes / Verification Note</label>
                  <textarea
                    rows={2}
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Received via ICICI Corporate Banking..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setOfflineModalInvoice(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleOfflinePayment}
                  disabled={isMarkingOffline}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-extrabold text-xs shadow-md hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isMarkingOffline ? 'Confirming...' : 'Confirm Offline Payment & Activate Joining'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Extend Due Date Modal */}
      <AnimatePresence>
        {extendModalInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-6 w-6 text-indigo-600" />
                  <h3 className="text-lg font-extrabold text-slate-900">Extend Invoice Due Date</h3>
                </div>
                <button
                  onClick={() => setExtendModalInvoice(null)}
                  className="h-8 w-8 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-600">
                <p className="font-semibold">
                  Extend payment deadline for Invoice <span className="font-mono font-bold text-slate-900">#{extendModalInvoice.invoiceNumber}</span>.
                </p>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Extend By (Days)</label>
                  <select
                    value={extensionDays}
                    onChange={(e) => setExtensionDays(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="3">3 Days</option>
                    <option value="7">7 Days (+1 Week)</option>
                    <option value="15">15 Days</option>
                    <option value="30">30 Days (+1 Month)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Reason / Admin Note</label>
                  <textarea
                    rows={2}
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Granted extension upon HR request..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setExtendModalInvoice(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExtendDueDate}
                  disabled={isExtending}
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-extrabold text-xs shadow-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isExtending ? 'Updating...' : 'Save Extended Due Date'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
