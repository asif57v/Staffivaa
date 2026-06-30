import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  Calendar,
  Download,
  FileText,
  Clock,
  Users,
  IndianRupee,
  DollarSign,
  Percent,
  Banknote,
  TrendingUp,
  Layers,
  Sparkles,
  CreditCard,
  Send,
  CheckCircle2,
  Lock,
  Info,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  useGetRequestQuery,
  useGetAdminRequestsQuery,
  useSendPaymentReminderMutation,
  useRecordOfflinePaymentMutation,
  useReleaseVendorSettlementMutation,
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

export function AdminPaymentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: detailData, isLoading: loadingDetail, isError: isErrorDetail } = useGetRequestQuery(id)
  const { data: listData } = useGetAdminRequestsQuery()

  const [sendReminder, { isLoading: sendingReminder }] = useSendPaymentReminderMutation()
  const [recordPayment, { isLoading: recordingPayment }] = useRecordOfflinePaymentMutation()
  const [releaseSettlement, { isLoading: releasingSettlement }] = useReleaseVendorSettlementMutation()

  const request = detailData?.request
  const allocation = detailData?.allocation
  const assignments = detailData?.assignments || []
  const summary = detailData?.paymentSummary
  const quotation = detailData?.quotation

  const allRequests = listData?.requests || []
  // Filter for other corporate projects dynamically
  const corporatePayments = allRequests
    .filter(r => r.sourceType === 'corporate' && r._id !== id)
    .slice(0, 4)

  if (loadingDetail) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-slate-50/50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-500" />
      </div>
    )
  }

  if (isErrorDetail || !request) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-4">
        <h3 className="text-lg font-black text-slate-900">Project Not Found</h3>
        <p className="text-sm text-slate-500">The financial record for this ID does not exist.</p>
        <Link to="/admin/billing" className="inline-block bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl">
          Back to Billing
        </Link>
      </div>
    )
  }

  // Calculate real finance details based on actual backend data
  const grandTotal = summary?.grandTotal || 0
  const advancePercent = summary?.advancePercentage || 30
  const advanceAmount = summary?.advanceAmount || 0
  const remainingAmount = summary?.remainingAmount || 0
  
  const corpFee = request.userPlatformFee || 0
  const gstRate = request.userGstRate || 18
  const gstAmount = Math.round((corpFee * gstRate) / 100)
  const vendorPlatformFee = request.labourPlatformFee || 0

  const vendorReceivable = (allocation?.totalLabourCost || 0) - vendorPlatformFee

  // Escrow Wallet dynamic details
  let receivedAmount = 0
  if (request.finalPaymentStatus === 'paid') {
    receivedAmount = grandTotal
  } else if (request.advancePaymentStatus === 'paid') {
    receivedAmount = advanceAmount
  }

  let escrowBalance = 0
  if (request.status === 'settlement_completed' || request.finalPaymentStatus === 'paid') {
    escrowBalance = 0
  } else if (request.advancePaymentStatus === 'paid') {
    escrowBalance = advanceAmount
  }

  let releasedToVendor = 0
  if (request.status === 'settlement_completed' || request.finalPaymentStatus === 'paid') {
    releasedToVendor = vendorReceivable
  }

  // Calculate Payment Due Date (48 hours before start date)
  const startDateObj = new Date(request.startDate)
  const dueDateObj = new Date(startDateObj.getTime() - 48 * 60 * 60 * 1000)

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'payment_pending':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'advance_paid':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'project_active':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse'
      case 'settlement_pending':
        return 'bg-amber-50 text-amber-800 border-amber-300'
      case 'settlement_completed':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300'
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200'
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'payment_pending':
        return 'Awaiting Advance Payment'
      case 'advance_paid':
        return 'Advance Paid'
      case 'project_active':
        return 'Project Active'
      case 'settlement_pending':
        return 'Settlement Pending'
      case 'settlement_completed':
        return 'Settlement Completed'
      default:
        return status ? status.replace('_', ' ').toUpperCase() : 'PENDING'
    }
  }

  const triggerReminder = async () => {
    try {
      await sendReminder(request._id).unwrap()
      toast.success('Payment reminder sent to Corporate client.')
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to send reminder.')
    }
  }

  const triggerOfflinePayment = async () => {
    try {
      await recordPayment(request._id).unwrap()
      toast.success('Offline payment recorded successfully.')
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to record offline payment.')
    }
  }

  const triggerRelease = async () => {
    try {
      await releaseSettlement(request._id).unwrap()
      toast.success('Settlement successfully released to Vendor wallet.')
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to release settlement.')
    }
  }

  // Dynamic Recent Activity Log based on actual database tracking
  const activities = []
  if (request.createdAt) {
    activities.push({
      id: 'create',
      title: `Request created by ${request.clientId?.corporateProfile?.companyName || request.clientId?.fullName || 'Client'}`,
      time: `${formatDate(request.createdAt)}, ${formatTime(request.createdAt)}`,
      iconClass: 'bg-[#f5f3ff] text-[#6366f1] border-[#ddd6fe]',
      Icon: FileText
    })
  }
  if (request.reviewedAt) {
    activities.push({
      id: 'accept',
      title: 'Vendor accepted the request',
      time: `${formatDate(request.reviewedAt)}, ${formatTime(request.reviewedAt)}`,
      iconClass: 'bg-[#ecfdf5] text-emerald-600 border-emerald-100',
      Icon: CheckCircle2
    })
  }
  if (allocation?.createdAt) {
    activities.push({
      id: 'assign',
      title: 'Workers assigned by vendor',
      time: `${formatDate(allocation.createdAt)}, ${formatTime(allocation.createdAt)}`,
      iconClass: 'bg-[#eff6ff] text-blue-600 border-blue-100',
      Icon: Users
    })
  }
  if (request.advancePaymentStatus === 'paid') {
    activities.push({
      id: 'advance_paid_act',
      title: 'Advance payment received successfully',
      time: request.razorpayPaymentId ? `Transaction: ${request.razorpayPaymentId}` : 'Recorded Offline',
      iconClass: 'bg-[#ecfdf5] text-emerald-600 border-emerald-100',
      Icon: CheckCircle2
    })
  } else {
    activities.push({
      id: 'advance_pending_act',
      title: 'Advance payment pending',
      time: `Due: ${formatDate(dueDateObj)}`,
      iconClass: 'bg-amber-50 text-amber-600 border-amber-200',
      Icon: Clock
    })
  }

  return (
    <div className="w-full bg-[#f8fafc] min-h-screen text-slate-800 p-6 space-y-6">
      
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-xs font-semibold text-slate-400">
        <Link to="/admin/billing" className="hover:text-slate-900 transition">Payments</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-slate-800 font-bold">Project Payment Details</span>
      </div>

      {/* Header Title Row */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Project Payment Details</h1>
          <p className="text-xs text-slate-500 font-semibold mt-1">Complete payment overview and tracking for this project</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span>29 Jun 2026</span>
          </div>
          <button className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 active:scale-95 px-4 py-2 rounded-xl text-xs font-bold text-[#6366f1] transition shadow-sm">
            <Download className="h-4 w-4" /> Export Report
          </button>
        </div>
      </div>

      {/* Top Details Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Column 1: Request Info */}
        <div className="space-y-3 text-xs">
          <div className="flex items-start">
            <span className="w-24 text-slate-400 font-bold">Request ID</span>
            <span className="font-black text-slate-900 flex items-center gap-1 cursor-pointer" onClick={() => { navigator.clipboard.writeText(request.reference); toast.success('Copied reference!'); }}>
              {request.reference}
              <FileText className="h-3.5 w-3.5 text-slate-300" />
            </span>
          </div>
          <div className="flex items-start">
            <span className="w-24 text-slate-400 font-bold">Corporate</span>
            <span className="font-bold text-[#6366f1] hover:underline cursor-pointer">
              {request.clientId?.corporateProfile?.companyName || request.clientId?.fullName || 'N/A'}
            </span>
          </div>
          <div className="flex items-start">
            <span className="w-24 text-slate-400 font-bold">Vendor</span>
            <span className="font-bold text-slate-700">
              {allocation?.vendorId?.contractorProfile?.companyName || allocation?.vendorId?.fullName || 'XYZ Contractors'}
            </span>
          </div>
          <div className="flex items-start">
            <span className="w-24 text-slate-400 font-bold">Location</span>
            <span className="font-semibold text-slate-600 flex-1 leading-relaxed">
              {request.locationText || '169, 507, Corporate House, RNT Marg, Indore'}
            </span>
          </div>
          <div className="flex items-start">
            <span className="w-24 text-slate-400 font-bold">Duration</span>
            <span className="font-bold text-slate-800">
              {formatDate(request.startDate)} to {formatDate(request.endDate || request.startDate)} ({summary?.totalDurationInDays || 7} Days)
            </span>
          </div>
        </div>

        {/* Column 2: Current Status */}
        <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100/80 flex flex-col justify-between space-y-4">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Current Status</span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${getStatusBadgeClass(request.status)}`}>
              <Clock className="h-3.5 w-3.5 shrink-0" />
              {getStatusLabel(request.status)}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-xs pt-2">
            <div>
              <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Project Start Date</p>
              <p className="font-bold text-slate-800 mt-0.5">{formatDate(request.startDate)}</p>
            </div>
            <div>
              <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Payment Due Date</p>
              <p className="font-bold text-rose-600 mt-0.5">{formatDate(dueDateObj)} (48h Before Start)</p>
            </div>
          </div>
        </div>

        {/* Column 3: Request Summary */}
        <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100/80 flex flex-col justify-between space-y-4">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Request Summary</span>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-indigo-50 flex items-center justify-center text-[#6366f1] shrink-0 border border-indigo-100">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total Workers</p>
                  <p className="text-xs font-black text-slate-900 mt-0.5">{assignments.length || 1} Worker(s)</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-indigo-50 flex items-center justify-center text-[#6366f1] shrink-0 border border-indigo-100">
                  <IndianRupee className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total Project Value</p>
                  <p className="text-xs font-black text-slate-900 mt-0.5">{formatMoney(grandTotal)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center text-[#6366f1] shrink-0 border border-indigo-100">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Project Value</p>
            <p className="text-base font-black text-slate-900 mt-0.5">{formatMoney(grandTotal)}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 border border-emerald-100">
            <Percent className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Advance ({advancePercent}%)</p>
            <p className="text-base font-black text-slate-900 mt-0.5">{formatMoney(advanceAmount)}</p>
            <p className="text-[9px] font-bold text-rose-600 mt-0.5">Due: {formatDate(dueDateObj)}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 shrink-0 border border-sky-100">
            <Banknote className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Remaining (70%)</p>
            <p className="text-base font-black text-slate-900 mt-0.5">{formatMoney(remainingAmount)}</p>
            <p className="text-[9px] font-bold text-slate-400 mt-0.5">After Advance</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0 border border-amber-100">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Corporate Fee</p>
            <p className="text-base font-black text-slate-900 mt-0.5">{formatMoney(corpFee)}</p>
            <p className="text-[9px] font-bold text-slate-400 mt-0.5">Configured Fee</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 shrink-0 border border-purple-100">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Vendor Fee</p>
            <p className="text-base font-black text-slate-900 mt-0.5">{formatMoney(vendorPlatformFee)}</p>
            <p className="text-[9px] font-bold text-slate-400 mt-0.5">Configured Fee</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 shrink-0 border border-teal-100">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">GST (18%)</p>
            <p className="text-base font-black text-slate-900 mt-0.5">{formatMoney(gstAmount)}</p>
            <p className="text-[9px] font-bold text-slate-400 mt-0.5">On Fees</p>
          </div>
        </div>

      </div>

      {/* Three Center Detail Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Advance Payment Details */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <CreditCard className="h-4 w-4 text-indigo-500" /> Advance Payment Details
            </h3>
            
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Advance Amount</span>
                <span className="font-extrabold text-slate-900">{formatMoney(advanceAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Percentage</span>
                <span className="font-bold text-slate-800">{advancePercent}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Payment Due Date</span>
                <span className="font-bold text-rose-600">{formatDate(dueDateObj)} (48h Before Start)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Status</span>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                  request.advancePaymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {request.advancePaymentStatus === 'paid' ? 'Paid' : 'Pending'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Reminder</span>
                <span className="font-bold text-slate-700">Not Sent Yet</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Auto Reminder</span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Enabled</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-4">
            <button
              onClick={triggerReminder}
              disabled={sendingReminder || request.advancePaymentStatus === 'paid'}
              className="flex items-center justify-center gap-1 bg-[#f5f3ff] hover:bg-[#ede9fe] text-[#6366f1] text-xs font-bold py-2.5 rounded-xl border border-[#ddd6fe] transition disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" /> Send Reminder
            </button>
            <button
              onClick={triggerOfflinePayment}
              disabled={recordingPayment || request.advancePaymentStatus === 'paid'}
              className="flex items-center justify-center gap-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-black py-2.5 rounded-xl transition disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Record Payment
            </button>
          </div>
        </div>

        {/* Escrow Wallet (Admin) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Lock className="h-4 w-4 text-[#6366f1]" /> Escrow Wallet (Admin)
          </h3>
          
          <div className="space-y-3.5 text-xs pt-1">
            <div className="flex justify-between">
              <span className="text-slate-400 font-semibold">Received Amount</span>
              <span className="font-extrabold text-slate-900">{formatMoney(receivedAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-semibold">Held in Escrow</span>
              <span className="font-extrabold text-slate-900">{formatMoney(escrowBalance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-semibold">Released to Vendor</span>
              <span className="font-extrabold text-slate-900">{formatMoney(releasedToVendor)}</span>
            </div>

            <div className="bg-[#f5f3ff] rounded-xl p-3.5 flex justify-between items-center mt-6">
              <span className="text-[#6366f1] font-bold">Available in Escrow</span>
              <span className="text-[#6366f1] font-black text-sm">{formatMoney(escrowBalance)}</span>
            </div>
          </div>
        </div>

        {/* Settlement Overview */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <Banknote className="h-4 w-4 text-emerald-500" /> Settlement Overview
            </h3>
            
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Remaining Amount</span>
                <span className="font-extrabold text-slate-900">{formatMoney(remainingAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Expected Collection Date</span>
                <span className="font-bold text-slate-800">{formatDate(request.endDate || request.startDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Settlement Status</span>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                  request.status === 'settlement_completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {request.status === 'settlement_completed' ? 'Settled' : 'Pending'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Settlement Type</span>
                <span className="font-bold text-slate-800">After Project Completion</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Release Condition</span>
                <span className="font-bold text-slate-800">Corporate Approval + Attendance</span>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={triggerRelease}
              disabled={releasingSettlement || (request.status !== 'completed' && request.status !== 'settlement_pending')}
              className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black py-2.5 rounded-xl transition disabled:opacity-40"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Release Final Payment
            </button>
          </div>
        </div>

      </div>

      {/* Quotation & Complete Financial Breakdown */}
      {quotation && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#6366f1]" /> Quotation & Complete Financial Breakdown
            </h3>
            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded border ${
              quotation.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              quotation.status === 'revision_requested' ? 'bg-amber-50 text-amber-700 border-amber-200' :
              quotation.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
              'bg-blue-50 text-blue-700 border-blue-200'
            }`}>
              Quote Status: {quotation.status.replace('_', ' ')}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Vendor Quote Column */}
            <div className="space-y-3 bg-[#f8fafc] border border-slate-200 p-4 rounded-xl">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Vendor Quote Summary</span>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Labour Cost ({quotation.numberOfWorkers} workers &times; {quotation.workingDays} days)</span>
                  <span className="font-bold text-slate-900">{formatMoney(quotation.labourCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Logistics (Logistics, Transportation, Equipment, Food, Accommodation, Other)</span>
                  <span className="font-bold text-slate-900">{formatMoney(quotation.transportationCharges + quotation.equipmentCharges + quotation.foodCharges + quotation.accommodationCharges + quotation.otherCharges)}</span>
                </div>
                {quotation.discount > 0 && (
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>Discount</span>
                    <span>- {formatMoney(quotation.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">GST ({quotation.gstPercentage}%)</span>
                  <span className="font-bold text-slate-900">{formatMoney(quotation.gst)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-black text-sm text-slate-900">
                  <span>Vendor Grand Total</span>
                  <span>{formatMoney(quotation.grandTotal)}</span>
                </div>
              </div>
              {quotation.notes && (
                <div className="mt-2 text-[10px] text-slate-400 bg-white p-2.5 rounded-lg border border-slate-100 italic">
                  Note: "{quotation.notes}"
                </div>
              )}
            </div>

            {/* Platform Financial Breakdown Column */}
            <div className="space-y-3 bg-indigo-50/30 border border-indigo-100 p-4 rounded-xl">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">Complete Financial Breakdown (Platform + Escrow)</span>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Corporate Payment (Quote + platform fees)</span>
                  <span className="font-bold text-slate-900">{formatMoney(grandTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Platform Booking Fee</span>
                  <span className="font-bold text-slate-900">{formatMoney(corpFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">GST on Platform Fee ({gstRate}%)</span>
                  <span className="font-bold text-slate-900">{formatMoney(gstAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Vendor Platform Fee</span>
                  <span className="font-bold text-slate-900">{formatMoney(vendorPlatformFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Deducted Escrow Amount</span>
                  <span className="font-bold text-indigo-600">{formatMoney(escrowBalance)}</span>
                </div>
                <div className="flex justify-between border-t border-indigo-200 pt-2 font-black text-sm text-indigo-900">
                  <span>Vendor Net Settlement</span>
                  <span>{formatMoney(vendorReceivable)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Payment Timeline</h3>
        <div className="flex flex-wrap md:flex-nowrap items-start justify-between gap-4 overflow-x-auto pt-2 pb-4">
          
          {/* Stage 1 */}
          <div className="flex-1 min-w-[100px] flex flex-col items-center text-center space-y-2 relative">
            <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-center font-bold text-xs">1</div>
            <div>
              <p className="text-[10px] font-black text-slate-900">Request Created</p>
              <p className="text-[9px] text-slate-400 font-medium mt-0.5">{formatDate(request.createdAt)}</p>
              <p className="text-[9px] text-slate-400 font-medium">{formatTime(request.createdAt)}</p>
            </div>
            <div className="h-2.5 w-2.5 bg-emerald-500 rounded-full border-2 border-white mt-1 shadow-sm" />
          </div>

          {/* Dash */}
          <div className="hidden md:block flex-1 border-t-2 border-dashed border-emerald-300 mt-3.5 mx-2" />

          {/* Stage 2 */}
          <div className="flex-1 min-w-[100px] flex flex-col items-center text-center space-y-2">
            <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-center font-bold text-xs">2</div>
            <div>
              <p className="text-[10px] font-black text-slate-900">Vendor Accepted</p>
              <p className="text-[9px] text-slate-400 font-medium mt-0.5">{formatDate(request.reviewedAt || request.createdAt)}</p>
              <p className="text-[9px] text-slate-400 font-medium">{formatTime(request.reviewedAt || request.createdAt)}</p>
            </div>
            <div className="h-2.5 w-2.5 bg-emerald-500 rounded-full border-2 border-white mt-1 shadow-sm" />
          </div>

          {/* Dash */}
          <div className="hidden md:block flex-1 border-t-2 border-dashed border-emerald-300 mt-3.5 mx-2" />

          {/* Stage 3 */}
          <div className="flex-1 min-w-[100px] flex flex-col items-center text-center space-y-2">
            <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-center font-bold text-xs">3</div>
            <div>
              <p className="text-[10px] font-black text-slate-900">Workers Assigned</p>
              <p className="text-[9px] text-slate-400 font-medium mt-0.5">{formatDate(allocation?.createdAt || request.createdAt)}</p>
              <p className="text-[9px] text-slate-400 font-medium">{formatTime(allocation?.createdAt || request.createdAt)}</p>
            </div>
            <div className="h-2.5 w-2.5 bg-emerald-500 rounded-full border-2 border-white mt-1 shadow-sm" />
          </div>

          {/* Dash */}
          <div className="hidden md:block flex-1 border-t-2 border-dashed border-slate-200 mt-3.5 mx-2" />

          {/* Stage 4 */}
          <div className="flex-1 min-w-[120px] flex flex-col items-center text-center space-y-2">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs ${
              request.advancePaymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-yellow-400 text-slate-950 font-black border border-yellow-500'
            }`}>4</div>
            <div>
              <p className="text-[10px] font-black text-slate-900">Awaiting Advance</p>
              {request.advancePaymentStatus === 'paid' ? (
                <p className="text-[9px] text-emerald-600 font-bold mt-1">Paid</p>
              ) : (
                <>
                  <p className="text-[9px] text-rose-600 font-bold mt-0.5">Due: {formatDate(dueDateObj)}</p>
                  <span className="inline-block text-[8px] bg-yellow-50 text-yellow-700 px-1.5 py-0.5 border border-yellow-200 rounded font-black mt-1">Pending</span>
                </>
              )}
            </div>
          </div>

          {/* Dash */}
          <div className="hidden md:block flex-1 border-t-2 border-dashed border-slate-200 mt-3.5 mx-2" />

          {/* Stage 5 */}
          <div className="flex-1 min-w-[100px] flex flex-col items-center text-center space-y-2">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs ${
              request.status === 'project_active' || request.status === 'completed' || request.status === 'settlement_pending' || request.status === 'settlement_completed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-50 text-slate-400 border border-slate-200'
            }`}>5</div>
            <div>
              <p className="text-[10px] font-black text-slate-900">Project Active</p>
              <p className="text-[9px] text-slate-400 font-semibold mt-1">After Payment</p>
            </div>
          </div>

          {/* Dash */}
          <div className="hidden md:block flex-1 border-t-2 border-dashed border-slate-200 mt-3.5 mx-2" />

          {/* Stage 6 */}
          <div className="flex-1 min-w-[100px] flex flex-col items-center text-center space-y-2">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs ${
              request.status === 'completed' || request.status === 'settlement_pending' || request.status === 'settlement_completed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-50 text-slate-400 border border-slate-200'
            }`}>6</div>
            <div>
              <p className="text-[10px] font-black text-slate-900">Project Completed</p>
              <p className="text-[9px] text-slate-400 font-semibold mt-1">After Completion</p>
            </div>
          </div>

          {/* Dash */}
          <div className="hidden md:block flex-1 border-t-2 border-dashed border-slate-200 mt-3.5 mx-2" />

          {/* Stage 7 */}
          <div className="flex-1 min-w-[100px] flex flex-col items-center text-center space-y-2">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs ${
              request.status === 'settlement_completed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-50 text-slate-400 border border-slate-200'
            }`}>7</div>
            <div>
              <p className="text-[10px] font-black text-slate-900">Settlement Released</p>
              <p className="text-[9px] text-slate-400 font-semibold mt-1">After Deduction</p>
            </div>
          </div>

        </div>
      </div>

      {/* Two columns: Upcoming Payments & Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Upcoming Payments Widget */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#6366f1]" /> Upcoming Payments
            </h3>
            <button onClick={() => navigate('/admin/billing')} className="text-xs font-black text-[#6366f1] bg-[#f5f3ff] hover:bg-[#ede9fe] px-2.5 py-1 rounded-lg border border-[#ddd6fe]">
              View All
            </button>
          </div>
          
          <div className="space-y-3 pt-1">
            {corporatePayments.length === 0 ? (
              <p className="text-xs text-slate-400 font-semibold p-4 text-center">No other upcoming payments found.</p>
            ) : (
              corporatePayments.map((p) => {
                const pTotal = p.userPlatformFee ? Math.round(p.userPlatformFee * 1.18 + (p.totalLabourCost || 3000)) : 3000
                const pAdvance = Math.round(pTotal * 0.3)
                
                return (
                  <div
                    key={p._id}
                    onClick={() => navigate(`/admin/payments/${p._id}`)}
                    className="p-3 bg-[#f8fafc] border border-slate-200 rounded-xl flex items-center justify-between gap-3 hover:bg-slate-100/50 cursor-pointer transition"
                  >
                    <div>
                      <p className="text-xs font-black text-slate-900">{p.clientId?.corporateProfile?.companyName || p.clientId?.fullName || 'Client'}</p>
                      <p className="text-[9px] text-slate-400 font-semibold">Request ID: {p.reference} &middot; Advance (30%)</p>
                      <p className="text-[9px] text-rose-600 font-bold mt-0.5">Due: {formatDate(p.startDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-900">{formatMoney(pAdvance)}</p>
                      <span className={`inline-block text-[8px] px-1.5 py-0.5 border rounded font-black mt-1 ${
                        p.advancePaymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                      }`}>
                        {p.advancePaymentStatus === 'paid' ? 'Paid' : 'Pending'}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Recent Activity Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Recent Activity</h3>
          <div className="space-y-4 pt-1">
            {activities.map((act) => (
              <div key={act.id} className="flex gap-2.5 text-xs">
                <div className={`h-6 w-6 rounded-full border flex items-center justify-center shrink-0 ${act.iconClass}`}>
                  <act.Icon className="h-3 w-3" />
                </div>
                <div>
                  <p className="font-bold text-slate-900">{act.title}</p>
                  <p className="text-[9px] text-slate-400 font-medium">{act.time}</p>
                </div>
              </div>
            ))}
          </div>
          
          <button className="w-full text-center text-xs font-bold text-[#6366f1] bg-[#f5f3ff] hover:bg-[#ede9fe] border border-[#ddd6fe] py-2 rounded-xl mt-4 transition">
            View Full Activity
          </button>
        </div>

      </div>

      {/* Bottom Info Banner */}
      <div className="bg-[#fffbeb] border border-[#fef3c7] p-4 rounded-xl flex items-center gap-3 shadow-sm">
        <Info className="h-5 w-5 text-amber-500 shrink-0" />
        <p className="text-xs font-bold text-amber-800 leading-snug">
          Note: Workers will not be able to check-in until the advance payment is received and the project status is active.
        </p>
      </div>

    </div>
  )
}
