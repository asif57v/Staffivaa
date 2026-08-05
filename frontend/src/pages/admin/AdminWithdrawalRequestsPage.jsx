import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet, IndianRupee, ArrowDownRight, ArrowUpRight, Clock, CheckCircle2, XCircle,
  AlertCircle, Search, Filter, RefreshCw, Eye, Check, X, ShieldCheck, Building2,
  Calendar, User, Landmark, Smartphone, FileText, Send, AlertTriangle, ChevronRight
} from 'lucide-react'
import {
  useGetWithdrawalsQuery,
  useGetWithdrawalDetailsQuery,
  useReviewWithdrawalMutation
} from '../../store/api/adminWalletApi.js'
import toast from 'react-hot-toast'

export function AdminWithdrawalRequestsPage() {
  const [statusFilter, setStatusFilter] = useState('Pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedWithdrawalId, setSelectedWithdrawalId] = useState(null)

  // Review Modal State
  const [reviewAction, setReviewAction] = useState(null) // 'approve' | 'reject' | 'hold'
  const [utrNumber, setUtrNumber] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [payoutMethod, setPayoutMethod] = useState('manual')

  const { data: withdrawalsData, isLoading, refetch } = useGetWithdrawalsQuery({
    status: statusFilter !== 'all' ? statusFilter : undefined,
  })

  const [reviewWithdrawal, { isLoading: isReviewing }] = useReviewWithdrawalMutation()

  const { data: detailsData, isLoading: isLoadingDetails } = useGetWithdrawalDetailsQuery(
    selectedWithdrawalId,
    { skip: !selectedWithdrawalId }
  )

  const withdrawals = withdrawalsData?.data?.withdrawals || []

  const filteredWithdrawals = withdrawals.filter((w) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    const workerName = w.requestedBy?.fullName?.toLowerCase() || ''
    const phone = w.requestedBy?.phone || ''
    const bankAcc = w.bankDetails?.accountNumber || ''
    const upiId = w.upiDetails?.upiId || ''
    return workerName.includes(q) || phone.includes(q) || bankAcc.includes(q) || upiId.includes(q)
  })

  const pendingCount = withdrawals.filter((w) => w.status === 'Pending').length
  const pendingTotal = withdrawals.filter((w) => w.status === 'Pending').reduce((sum, w) => sum + (w.amount || 0), 0)
  const completedTotal = withdrawals.filter((w) => w.status === 'Completed').reduce((sum, w) => sum + (w.amount || 0), 0)

  const handleExecuteReview = async () => {
    if (!selectedWithdrawalId || !reviewAction) return

    let targetStatus = 'Completed'
    if (reviewAction === 'reject') targetStatus = 'Rejected'
    if (reviewAction === 'hold') targetStatus = 'Hold'

    if (reviewAction === 'approve' && payoutMethod === 'manual' && !utrNumber.trim()) {
      toast.error('Please enter the UTR / Bank Reference Number for manual payout approval')
      return
    }

    if (reviewAction === 'reject' && !rejectionReason.trim()) {
      toast.error('Please enter the rejection reason for the worker')
      return
    }

    try {
      const res = await reviewWithdrawal({
        id: selectedWithdrawalId,
        status: targetStatus,
        utrNumber: utrNumber.trim(),
        rejectionReason: rejectionReason.trim(),
        adminNotes: adminNotes.trim(),
        payoutMethod,
      }).unwrap()

      toast.success(res?.message || `Withdrawal request ${targetStatus.toLowerCase()} successfully!`)
      setReviewAction(null)
      setSelectedWithdrawalId(null)
      setUtrNumber('')
      setRejectionReason('')
      setAdminNotes('')
      refetch()
    } catch (err) {
      toast.error(err?.data?.message || 'Action failed')
    }
  }

  const details = detailsData?.data || {}
  const workerDetail = details.worker || {}
  const withdrawalDetail = details.withdrawal || {}

  return (
    <div className="p-6 pb-32 space-y-6 max-w-7xl mx-auto min-h-screen bg-slate-50/50">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-black text-slate-900 leading-tight flex items-center gap-2">
            <Landmark className="h-7 w-7 text-indigo-600" /> Enterprise Payroll → Withdrawal Requests
          </h1>
          <p className="text-[13px] font-medium text-slate-500 mt-1">
            Review worker bank/UPI payout requests, verify KYC & attendance audit history, and execute bank transfers
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] font-bold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer active:scale-95 transition"
        >
          <RefreshCw className={`h-4 w-4 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Requests
        </button>
      </div>

      {/* KPI Hero Deck */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg border border-indigo-900/40">
          <p className="text-[12px] font-bold text-amber-400 uppercase tracking-wider">Pending Payout Requests</p>
          <p className="text-[36px] font-black tracking-tight mt-1">₹{pendingTotal.toLocaleString('en-IN')}</p>
          <p className="text-[12px] text-slate-400 mt-1">{pendingCount} requests awaiting Admin bank transfer verification</p>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <p className="text-[12px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" /> Total Bank Transfers Completed
          </p>
          <p className="text-[32px] font-black text-slate-900 mt-1">₹{completedTotal.toLocaleString('en-IN')}</p>
          <p className="text-[12px] font-medium text-slate-500 mt-1">Disbursed to worker bank accounts & UPI IDs</p>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <p className="text-[12px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
            <Clock className="h-4 w-4" /> Total Requests Logged
          </p>
          <p className="text-[32px] font-black text-slate-900 mt-1">{withdrawals.length} Requests</p>
          <p className="text-[12px] font-medium text-slate-500 mt-1">Across all enterprise worker payroll wallets</p>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search worker name, phone, account no, or UPI ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-[13px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 overflow-x-auto">
          {[
            { id: 'Pending', label: 'Pending Review' },
            { id: 'Hold', label: 'On Hold' },
            { id: 'Completed', label: 'Completed' },
            { id: 'Rejected', label: 'Rejected' },
            { id: 'all', label: 'All Requests' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-[12px] font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Withdrawal Requests List Table */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3 bg-white rounded-3xl border border-slate-200">
          <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin" />
          <p className="text-[14px] font-extrabold text-slate-600">Loading Withdrawal Requests...</p>
        </div>
      ) : filteredWithdrawals.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-slate-200 space-y-2">
          <CheckCircle2 className="h-10 w-10 text-slate-300 mx-auto" />
          <h3 className="text-[17px] font-extrabold text-slate-800">No withdrawal requests found</h3>
          <p className="text-[13px] text-slate-500">All worker wallet withdrawal requests are processed.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="p-4 pl-6">Worker Beneficiary</th>
                  <th className="p-4">Enterprise & Project</th>
                  <th className="p-4">Requested Amount</th>
                  <th className="p-4">Wallet Balance</th>
                  <th className="p-4">Payout Method</th>
                  <th className="p-4">Request Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[13px]">
                {filteredWithdrawals.map((w) => {
                  const worker = w.requestedBy || {}
                  const enterprise = w.enterpriseId || {}
                  const job = w.jobId || {}
                  const isPending = w.status === 'Pending'
                  const isHold = w.status === 'Hold'
                  const isCompleted = w.status === 'Completed'
                  const isRejected = w.status === 'Rejected'

                  const workerIdTag = `WRK-${(worker._id || '').slice(-6).toUpperCase()}`
                  const availableBal = worker.walletBalance || 0
                  const remainingBal = Math.max(0, availableBal - (isPending ? w.amount : 0))

                  return (
                    <tr key={w._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center text-[13px]">
                            {worker.fullName?.charAt(0) || 'W'}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900">{worker.fullName || 'Worker Name'}</p>
                            <p className="text-[11px] font-medium text-slate-500">{workerIdTag} • {worker.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-slate-800">{enterprise.companyName || enterprise.fullName || 'Staffivaa Enterprise'}</p>
                        <p className="text-[11px] text-indigo-600 font-semibold">{job.jobTitle || 'Enterprise Project'}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-[16px] font-black text-slate-900">₹{(w.amount || 0).toLocaleString('en-IN')}</p>
                        {w.payrollMonth && <p className="text-[10px] text-slate-400 font-semibold">{w.payrollMonth}</p>}
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-emerald-600">₹{availableBal.toLocaleString('en-IN')}</p>
                        <p className="text-[10px] text-slate-400">After: ₹{remainingBal.toLocaleString('en-IN')}</p>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                          {w.payoutType === 'upi' ? <Smartphone className="h-3.5 w-3.5 text-purple-600" /> : <Landmark className="h-3.5 w-3.5 text-blue-600" />}
                          {w.payoutType === 'upi' ? (w.upiDetails?.upiId || 'UPI Payout') : (w.bankDetails?.bankName || 'Bank Transfer')}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-slate-800">{new Date(w.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                        <p className="text-[10px] text-slate-400">{new Date(w.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase ${
                          isCompleted ? 'bg-emerald-100 text-emerald-900' :
                          isPending ? 'bg-amber-100 text-amber-900 animate-pulse' :
                          isHold ? 'bg-purple-100 text-purple-900' :
                          'bg-rose-100 text-rose-900'
                        }`}>
                          {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> :
                           isPending ? <Clock className="h-3.5 w-3.5 text-amber-600" /> :
                           isHold ? <AlertTriangle className="h-3.5 w-3.5 text-purple-600" /> :
                           <XCircle className="h-3.5 w-3.5 text-rose-600" />}
                          {w.status}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedWithdrawalId(w._id)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-extrabold text-[12px] flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5 text-indigo-600" /> Details
                          </button>
                          {(isPending || isHold) && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedWithdrawalId(w._id)
                                  setReviewAction('approve')
                                }}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[12px] shadow-xs cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedWithdrawalId(w._id)
                                  setReviewAction('reject')
                                }}
                                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[12px] shadow-xs cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}
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

      {/* Comprehensive Withdrawal Details Drawer / Modal */}
      <AnimatePresence>
        {selectedWithdrawalId && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white w-full max-w-4xl rounded-3xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto text-left relative"
            >
              {/* Top Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="h-6 w-6 text-indigo-600" /> Comprehensive Withdrawal Audit & Payout Approval
                  </h3>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">
                    Inspect KYC status, bank account details, wallet history, attendance summary, and salary history before approval
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedWithdrawalId(null)
                    setReviewAction(null)
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 font-bold"
                >
                  ✕
                </button>
              </div>

              {isLoadingDetails ? (
                <div className="p-12 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin" />
                  <p className="text-xs font-bold text-slate-600">Fetching worker KYC & financial ledgers...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Grid Row 1: Worker Details & Bank/UPI Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Worker Profile Card */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Worker Identity & KYC</span>
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white font-black flex items-center justify-center text-lg">
                          {workerDetail.fullName?.charAt(0) || 'W'}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 text-[15px]">{workerDetail.fullName}</p>
                          <p className="text-xs text-slate-500 font-medium">{workerDetail.phone} • {workerDetail.email || 'No Email'}</p>
                          <span className="text-[10px] font-mono text-indigo-600 font-bold">ID: {workerDetail._id}</span>
                        </div>
                      </div>

                      <div className="border-t border-slate-200/60 pt-2 space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-medium">KYC Status:</span>
                          <span className={`font-extrabold uppercase px-2 py-0.5 rounded text-[10px] ${details.kycStatus === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {details.kycStatus || 'Pending'}
                          </span>
                        </div>
                        {details.kycDetails?.aadhaarMasked && (
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-medium">Aadhaar Masked:</span>
                            <span className="font-mono font-bold text-slate-800">{details.kycDetails.aadhaarMasked}</span>
                          </div>
                        )}
                        {details.kycDetails?.panMasked && (
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-medium">PAN Masked:</span>
                            <span className="font-mono font-bold text-slate-800">{details.kycDetails.panMasked}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bank / UPI Details Card */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Target Bank / UPI Details</span>
                      
                      {withdrawalDetail.payoutType === 'upi' ? (
                        <div className="space-y-2 text-xs">
                          <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                            <p className="text-[10px] font-bold text-purple-600 uppercase">UPI Virtual Private Address (VPA)</p>
                            <p className="text-base font-black text-purple-900 mt-0.5">{withdrawalDetail.upiDetails?.upiId || details.upiDetails?.upiId || '—'}</p>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-medium">Account Holder Name:</span>
                            <span className="font-extrabold text-slate-900">{withdrawalDetail.upiDetails?.accountHolderName || details.upiDetails?.accountHolderName || '—'}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 text-xs">
                          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                            <p className="text-[10px] font-bold text-blue-600 uppercase">Bank Account Number</p>
                            <p className="text-base font-black text-blue-900 font-mono mt-0.5">{withdrawalDetail.bankDetails?.accountNumber || details.bankDetails?.accountNumber || '—'}</p>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-medium">IFSC Code:</span>
                            <span className="font-mono font-bold text-slate-900 uppercase">{withdrawalDetail.bankDetails?.ifscCode || details.bankDetails?.ifscCode || '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-medium">Account Holder Name:</span>
                            <span className="font-extrabold text-slate-900">{withdrawalDetail.bankDetails?.accountHolderName || details.bankDetails?.accountHolderName || '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-medium">Bank Name:</span>
                            <span className="font-bold text-slate-800">{withdrawalDetail.bankDetails?.bankName || details.bankDetails?.bankName || 'Bank Account'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Grid Row 2: Financial Snapshot & Attendance Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Wallet Snapshot */}
                    <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-100 space-y-1">
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider block">Wallet Balance Snapshot</span>
                      <p className="text-2xl font-black text-emerald-900">₹{(details.walletSummary?.availableBalance || 0).toLocaleString('en-IN')}</p>
                      <p className="text-[11px] font-medium text-emerald-700 pt-1">
                        Requested: <span className="font-black">₹{(withdrawalDetail.amount || 0).toLocaleString('en-IN')}</span> | Remaining: <span className="font-black">₹{Math.max(0, (details.walletSummary?.availableBalance || 0) - (withdrawalDetail.amount || 0)).toLocaleString('en-IN')}</span>
                      </p>
                    </div>

                    {/* Attendance Summary */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Attendance Summary</span>
                      <p className="text-lg font-black text-slate-900">{details.attendanceSummary?.presentDays || 0} Present Days</p>
                      <p className="text-[11px] font-medium text-slate-500">
                        Absent: {details.attendanceSummary?.absentDays || 0} | Half Days: {details.attendanceSummary?.halfDays || 0} | OT: {details.attendanceSummary?.totalOvertimeHours || 0} hrs
                      </p>
                    </div>

                    {/* Salary Credited Summary */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Lifetime Salary Credited</span>
                      <p className="text-lg font-black text-indigo-900">₹{(details.walletSummary?.totalSalaryCredited || 0).toLocaleString('en-IN')}</p>
                      <p className="text-[11px] font-medium text-slate-500">Total Withdrawn: ₹{(details.walletSummary?.totalWithdrawn || 0).toLocaleString('en-IN')}</p>
                    </div>
                  </div>

                  {/* Admin Action Control Box */}
                  <div className="bg-slate-900 text-white p-5 rounded-3xl space-y-4 shadow-xl">
                    <h4 className="text-sm font-black uppercase text-amber-400 tracking-wider flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" /> Admin Action & Bank Payout Execution
                    </h4>

                    {/* Action Selector Buttons */}
                    <div className="flex gap-2">
                      {[
                        { id: 'approve', label: 'Approve & Pay' },
                        { id: 'hold', label: 'Place On Hold' },
                        { id: 'reject', label: 'Reject & Refund' },
                      ].map((btn) => (
                        <button
                          key={btn.id}
                          onClick={() => setReviewAction(btn.id)}
                          className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            reviewAction === btn.id
                              ? 'bg-amber-400 text-slate-950 shadow-md'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>

                    {reviewAction === 'approve' && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-4 text-xs font-bold">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="payoutMethod"
                              value="manual"
                              checked={payoutMethod === 'manual'}
                              onChange={() => setPayoutMethod('manual')}
                            /> Manual Bank Transfer (IMPS/NEFT/UPI)
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer text-indigo-300">
                            <input
                              type="radio"
                              name="payoutMethod"
                              value="razorpay"
                              checked={payoutMethod === 'razorpay'}
                              onChange={() => setPayoutMethod('razorpay')}
                            /> Automated RazorpayX Payout
                          </label>
                        </div>

                        {payoutMethod === 'manual' && (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                              Bank UTR / Transaction Reference Number *
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. UTR198472910482"
                              value={utrNumber}
                              onChange={(e) => setUtrNumber(e.target.value)}
                              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono text-white outline-none focus:ring-2 focus:ring-amber-400"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {reviewAction === 'reject' && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Rejection Reason (Sent to Worker) *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Bank Account Number mismatch with Aadhaar name"
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-rose-400"
                        />
                      </div>
                    )}

                    {reviewAction === 'hold' && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Admin Verification Notes
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. On hold pending phone call verification with employer"
                          value={adminNotes}
                          onChange={(e) => setAdminNotes(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-purple-400"
                        />
                      </div>
                    )}

                    {reviewAction && (
                      <button
                        onClick={handleExecuteReview}
                        disabled={isReviewing}
                        className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-lg cursor-pointer active:scale-98 transition"
                      >
                        {isReviewing ? 'Processing Payout Action...' : `Confirm & Execute ${reviewAction.toUpperCase()}`}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
