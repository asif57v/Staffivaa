import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet, Plus, Download, AlertTriangle, ArrowUpRight, ArrowDownLeft,
  Search, Calendar, Filter, Clock, ShieldCheck, RefreshCw, X, Loader2,
  FileText, CheckCircle2, XCircle, CreditCard, Building2, ChevronRight, Eye
} from 'lucide-react'
import {
  useGetEnterpriseWalletSummaryQuery,
  useCreateRechargeOrderMutation,
  useVerifyRechargePaymentMutation,
  useGetEnterpriseWalletTransactionsQuery,
} from '../../../store/api/enterpriseWalletApi.js'
import {
  useGetEnterpriseInvoicesQuery,
  usePayJoiningInvoiceMutation,
  useVerifyInvoicePaymentMutation,
} from '../../../store/api/enterpriseApi.js'
import toast from 'react-hot-toast'

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

// ─── Add Money Modal (Razorpay Integration) ──────────────────────────────────
function AddMoneyModal({ summary, onClose }) {
  const [amount, setAmount] = useState('10000')
  const [paymentMethod, setPaymentMethod] = useState('Razorpay')
  const [createRechargeOrder, { isLoading: isCreating }] = useCreateRechargeOrderMutation()
  const [verifyPayment, { isLoading: isVerifying }] = useVerifyRechargePaymentMutation()

  const quickAmounts = [5000, 10000, 25000, 50000]

  const handleProceedPayment = async (e) => {
    e.preventDefault()
    const numAmount = Number(amount)
    if (!numAmount || numAmount < 100) {
      toast.error('Minimum recharge amount is ₹100')
      return
    }

    try {
      // 1. Create Razorpay order on backend
      const res = await createRechargeOrder({ amount: numAmount }).unwrap()
      const orderData = res.data

      // Load SDK
      const sdkLoaded = await loadRazorpayScript()
      if (!sdkLoaded) {
        toast.error('Razorpay SDK failed to load. Check internet connection.')
        return
      }

      // 2. Open Razorpay Checkout Modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Staffivaa Enterprise',
        description: 'Enterprise Wallet Recharge',
        order_id: orderData.orderId,
        prefill: {
          name: orderData.companyName,
          email: orderData.email,
          contact: orderData.phone,
        },
        theme: {
          color: '#4F46E5',
        },
        handler: async function (response) {
          try {
            await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              paymentMethod,
            }).unwrap()

            toast.success(`₹${numAmount.toLocaleString('en-IN')} added to wallet!`)
            onClose()
          } catch (err) {
            toast.error(err?.data?.message || 'Payment verification failed')
          }
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to initialize recharge')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden my-8"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-indigo-50/50">
          <div>
            <h3 className="text-[17px] font-extrabold text-slate-900">Recharge Enterprise Wallet</h3>
            <p className="text-[12px] font-medium text-slate-500 mt-0.5">Instant credit via secure payment gateway</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleProceedPayment} className="p-6 space-y-4">
          <div>
            <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-1.5">
              Enter Amount (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] font-extrabold text-slate-400">₹</span>
              <input
                type="number"
                required
                min="100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-[20px] font-black text-slate-900 outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
          </div>

          {/* Quick Amount Pills */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Quick Amount</label>
            <div className="grid grid-cols-4 gap-2">
              {quickAmounts.map((a) => (
                <button
                  type="button"
                  key={a}
                  onClick={() => setAmount(String(a))}
                  className={`py-2 rounded-xl text-[12px] font-extrabold border transition-all ${
                    Number(amount) === a
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  +₹{(a / 1000).toFixed(0)}k
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-2">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'UPI', label: 'UPI / GPay / PhonePe' },
                { id: 'Card', label: 'Credit / Debit Card' },
                { id: 'NetBanking', label: 'Net Banking' },
                { id: 'Razorpay', label: 'All Razorpay Options' },
              ].map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id)}
                  className={`p-3 rounded-xl border text-left text-[12px] font-bold transition-all ${
                    paymentMethod === m.id
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <button
              type="submit"
              disabled={isCreating || isVerifying}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-[14px] font-extrabold shadow-lg shadow-indigo-200 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isCreating || isVerifying ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
              ) : (
                `Proceed to Pay ₹${Number(amount || 0).toLocaleString('en-IN')}`
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Statement Download Modal ────────────────────────────────────────────────
function DownloadStatementModal({ onClose }) {
  const [period, setPeriod] = useState('current_month')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const handleDownload = () => {
    let url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'}/enterprise/wallet/statement?period=${period}`
    if (period === 'custom') {
      url += `&startDate=${startDate}&endDate=${endDate}`
    }
    window.open(url, '_blank')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden my-8"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="text-[17px] font-extrabold text-slate-900">Download Statement</h3>
            <p className="text-[12px] font-medium text-slate-500 mt-0.5">Export CSV financial statement</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            {[
              { id: 'current_month', label: 'Current Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'custom', label: 'Custom Date Range' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`w-full p-3 rounded-2xl border text-left text-[13px] font-bold transition-all ${
                  period === p.id
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-[12px] font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-[12px] font-bold"
                />
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2.5 text-[13px] font-bold text-slate-600 hover:bg-slate-50 rounded-xl">
              Cancel
            </button>
            <button
              onClick={handleDownload}
              className="px-6 py-2.5 bg-indigo-600 text-white text-[13px] font-extrabold rounded-xl shadow-md shadow-indigo-200 hover:bg-indigo-700 flex items-center gap-1.5"
            >
              <Download className="h-4 w-4" /> Download Statement CSV
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Transaction Detail Drawer ──────────────────────────────────────────────
function TransactionDetailDrawer({ transaction, onClose }) {
  if (!transaction) return null

  const isCredit = ['recharge', 'credit', 'refund'].includes(transaction.type)

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end">
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-[17px] font-extrabold text-slate-900">Transaction Details</h3>
            <p className="text-[11px] font-semibold text-slate-500 font-mono mt-0.5">{transaction.transactionId}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Amount Badge */}
          <div className="text-center py-6 bg-slate-50 rounded-3xl border border-slate-100">
            <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">Transaction Amount</p>
            <p className={`text-[32px] font-black mt-1 ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isCredit ? '+' : '-'}₹{Number(transaction.amount).toLocaleString('en-IN')}
            </p>
            <span className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full text-[11px] font-black uppercase bg-emerald-100 text-emerald-800">
              {transaction.status}
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3 text-[13px]">
            <div className="flex justify-between border-b border-slate-50 pb-2">
              <span className="font-semibold text-slate-400">Date & Time</span>
              <span className="font-bold text-slate-800">{new Date(transaction.createdAt).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between border-b border-slate-50 pb-2">
              <span className="font-semibold text-slate-400">Type</span>
              <span className="font-extrabold text-slate-900 uppercase">{transaction.type?.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between border-b border-slate-50 pb-2">
              <span className="font-semibold text-slate-400">Payment Method</span>
              <span className="font-bold text-slate-800">{transaction.paymentMethod || 'Razorpay'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-50 pb-2">
              <span className="font-semibold text-slate-400">Balance After</span>
              <span className="font-extrabold text-slate-900">₹{(transaction.balanceAfter || 0).toLocaleString('en-IN')}</span>
            </div>
            {transaction.referenceNumber && (
              <div className="flex justify-between border-b border-slate-50 pb-2">
                <span className="font-semibold text-slate-400">Reference No</span>
                <span className="font-mono font-bold text-slate-800 text-[11px]">{transaction.referenceNumber}</span>
              </div>
            )}
            {transaction.razorpayPaymentId && (
              <div className="flex justify-between">
                <span className="font-semibold text-slate-400">Razorpay Payment ID</span>
                <span className="font-mono font-bold text-indigo-600 text-[11px]">{transaction.razorpayPaymentId}</span>
              </div>
            )}
          </div>

          {transaction.description && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <p className="text-[11px] font-extrabold text-slate-400 uppercase">Description</p>
              <p className="text-[13px] font-medium text-slate-700">{transaction.description}</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ─── Main Fintech Wallet Page ─────────────────────────────────────────────────
export function EnterpriseWalletPage() {
  const [showAddMoney, setShowAddMoney] = useState(false)
  const [showStatement, setShowStatement] = useState(false)
  const [selectedTxn, setSelectedTxn] = useState(null)

  // Filters
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data: summaryData, isLoading: loadingSummary, refetch: refetchSummary } = useGetEnterpriseWalletSummaryQuery()
  const { data: txnsData, isLoading: loadingTxns, refetch: refetchTxns } = useGetEnterpriseWalletTransactionsQuery({
    type: typeFilter,
    status: statusFilter,
    search,
    page,
    limit: 15,
  })

  const summary = summaryData?.data || {}
  const transactions = txnsData?.data?.transactions || []
  const pagination = txnsData?.data?.pagination || { total: 0, page: 1, pages: 1 }

  const { data: invoicesData, refetch: refetchInvoices } = useGetEnterpriseInvoicesQuery()
  const [payJoiningInvoice, { isLoading: isPayingInvoice }] = usePayJoiningInvoiceMutation()
  const [verifyInvoicePayment] = useVerifyInvoicePaymentMutation()
  const invoices = invoicesData?.data || []
  const pendingInvoices = invoices.filter((i) => i.status === 'payment_pending')

  return (
    <div className="p-6 pb-32 space-y-6 max-w-7xl mx-auto min-h-screen bg-slate-50/50">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-extrabold text-slate-900 leading-tight">Enterprise Wallet</h1>
          <p className="text-[13px] font-medium text-slate-500 mt-1">
            Fintech ledger for joining payments, payroll, invoices, and recharges
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { refetchSummary(); refetchTxns(); refetchInvoices() }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] font-bold text-slate-700 shadow-xs hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4 text-slate-500" /> Refresh
          </button>
          <button
            onClick={() => setShowStatement(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] font-bold text-slate-700 shadow-xs hover:bg-slate-50"
          >
            <Download className="h-4 w-4 text-slate-500" /> Download Statement
          </button>
        </div>
      </div>

      {/* Low Balance Warning Banner */}
      {summary.isLowBalance && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h4 className="text-[14px] font-extrabold text-amber-900">Low Wallet Balance Warning</h4>
              <p className="text-[12px] font-medium text-amber-700">
                Your available balance is below ₹{(summary.lowBalanceThreshold || 5000).toLocaleString('en-IN')}. Please recharge to ensure uninterrupted candidate joining & payroll payments.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAddMoney(true)}
            className="shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-[12px] font-extrabold rounded-xl shadow-sm"
          >
            Recharge Now
          </button>
        </motion.div>
      )}

      {/* Main Wallet Hero Balance Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-2xl border border-indigo-900/40">
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-indigo-300 text-[12px] font-bold uppercase tracking-wider">
              <Wallet className="h-4 w-4 text-indigo-400" /> Available Wallet Balance
            </div>
            <p className="text-[36px] sm:text-[44px] font-black tracking-tight text-white">
              ₹{(summary.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[12px] font-medium text-slate-400">
              Primary payment source for joining fees, payroll & invoice settlements
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setShowAddMoney(true)}
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-indigo-500 hover:bg-indigo-600 active:scale-[0.98] text-white text-[14px] font-extrabold shadow-lg shadow-indigo-500/30 transition-all cursor-pointer"
            >
              <Plus className="h-5 w-5" /> + Add Money
            </button>
            <button
              onClick={() => setShowStatement(true)}
              className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-[14px] font-extrabold backdrop-blur-md transition-all border border-white/10 cursor-pointer"
            >
              <Download className="h-4 w-4 text-slate-300" /> Statement
            </button>
          </div>
        </div>
      </div>

      {/* 6 Top Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Current Balance', val: `₹${(summary.balance || 0).toLocaleString('en-IN')}`, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
          { label: 'Total Added', val: `₹${(summary.totalRecharged || 0).toLocaleString('en-IN')}`, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
          { label: 'Total Spent', val: `₹${(summary.totalSpent || 0).toLocaleString('en-IN')}`, color: 'text-rose-600 bg-rose-50 border-rose-100' },
          { label: 'Pending Payments', val: `₹${(summary.pendingPaymentsAmount || 0).toLocaleString('en-IN')}`, color: 'text-amber-600 bg-amber-50 border-amber-100' },
          { label: 'Total Refunded', val: `₹${(summary.totalRefunded || 0).toLocaleString('en-IN')}`, color: 'text-teal-600 bg-teal-50 border-teal-100' },
          { label: 'Last Transaction', val: summary.lastTransaction ? `₹${summary.lastTransaction.amount}` : 'None', color: 'text-slate-700 bg-slate-100 border-slate-200' },
        ].map((c) => (
          <div key={c.label} className={`p-4 rounded-2xl border ${c.color}`}>
            <p className="text-[18px] font-extrabold truncate">{c.val}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider mt-1 opacity-75">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Pending Joining Confirmation Invoices Section */}
      {pendingInvoices.length > 0 && (
        <div className="bg-white rounded-3xl border border-amber-200/80 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[18px] font-extrabold text-slate-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-600" /> Pending Joining Confirmation Invoices
              </h3>
              <p className="text-[12px] font-medium text-slate-500">
                Worker offer accepted. Pay invoice from wallet to move funds into Escrow & activate worker joining.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 font-extrabold text-[12px]">
              {pendingInvoices.length} Pending
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingInvoices.map((inv) => {
              const workerName = inv.workerId?.fullName || 'Worker Candidate'
              const jobRole = inv.jobId?.jobTitle || 'Role'
              const currentBalance = summary.balance || 0
              const isSufficient = currentBalance >= inv.totalAmount

              const invoiceDateStr = inv.invoiceDate
                ? new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : new Date(inv.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              const dueDateObj = new Date(inv.dueDate)
              const dueDateStr = dueDateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

              const diffTime = dueDateObj.getTime() - Date.now()
              const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
              const isOverdue = inv.status === 'overdue' || remainingDays < 0

              const handlePay = async () => {
                try {
                  const res = await payJoiningInvoice(inv._id).unwrap()
                  const resData = res?.data || {}
                  
                  // Case 1: Paid 100% via wallet!
                  if (resData.paymentStatus === 'paid' || res.message?.includes('fully') || !resData.razorpayOrder) {
                    toast.success(res.message || 'Joining invoice paid successfully! Funds secured in Escrow.')
                    refetchSummary()
                    refetchInvoices()
                    return
                  }

                  // Case 2 & 3: Requires Online Payment (Split or 100% gateway)
                  toast.dismiss()
                  toast.success(res.message || 'Opening Gateway for remaining balance...', { duration: 4000, id: 'gateway-toast' })
                  const sdkLoaded = await loadRazorpayScript()
                  if (!sdkLoaded) {
                    toast.error('Razorpay SDK failed to load. Check internet connection.')
                    return
                  }

                  const orderData = resData.razorpayOrder
                  const options = {
                    key: orderData.key,
                    amount: orderData.amount,
                    currency: orderData.currency || 'INR',
                    name: 'Staffivaa Enterprise',
                    description: `Joining Payment: ${workerName}`,
                    order_id: orderData.id,
                    theme: { color: '#4F46E5' },
                    handler: async function (response) {
                      const verifyId = toast.loading('Verifying payment signature...')
                      try {
                        await verifyInvoicePayment({
                          id: inv._id,
                          razorpay_order_id: response.razorpay_order_id,
                          razorpay_payment_id: response.razorpay_payment_id,
                          razorpay_signature: response.razorpay_signature,
                        }).unwrap()
                        toast.success('Joining invoice & split payment completed! Funds secured in Staffivaa Escrow.', { id: verifyId })
                        refetchSummary()
                        refetchInvoices()
                      } catch (err) {
                        toast.error(err?.data?.message || 'Payment verification failed', { id: verifyId })
                      }
                    },
                  }
                  const rzp = new window.Razorpay(options)
                  rzp.open()
                } catch (err) {
                  toast.error(err?.data?.message || 'Payment initiation failed')
                }
              }

              return (
                <div key={inv._id} className={`p-5 rounded-2xl border space-y-3 ${isOverdue ? 'bg-rose-50/70 border-rose-200' : 'bg-amber-50/60 border-amber-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-extrabold text-amber-950 text-[13px]">{inv.invoiceNumber}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${isOverdue ? 'bg-rose-600 text-white animate-pulse' : 'bg-amber-200 text-amber-900'}`}>
                      {isOverdue ? 'Overdue' : `${remainingDays} Days Remaining`}
                    </span>
                  </div>

                  <div className="text-[13px]">
                    <p className="font-extrabold text-slate-900">{workerName}</p>
                    <p className="font-bold text-indigo-600">{jobRole}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-600 bg-white/70 p-2.5 rounded-xl border border-amber-100/70">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Invoice Date</span>
                      <span className="font-extrabold text-slate-800">{invoiceDateStr}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Due Date</span>
                      <span className="font-extrabold text-slate-800">{dueDateStr}</span>
                    </div>
                  </div>

                  {/* Dynamic Fee & Milestone Breakdown */}
                  <div className="p-3 bg-white/80 rounded-xl border border-amber-100 text-[12px] space-y-1.5">
                    <div className="flex justify-between text-slate-500 font-medium">
                      <span>Project Value:</span>
                      <span className="font-extrabold text-slate-900">₹{(inv.totalProjectValue || 0).toLocaleString('en-IN')}</span>
                    </div>
                    {inv.platformFee > 0 && (
                      <div className="flex justify-between text-slate-500 font-medium">
                        <span>Platform Fee ({inv.platformFeeType === 'fixed' ? 'Fixed' : `${inv.platformFeeValue || 10}%`}):</span>
                        <span className="font-bold text-slate-800">₹{inv.platformFee.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-indigo-700 font-extrabold">
                      <span>{inv.invoiceType === 'remaining_50' ? `Remaining Amount (${inv.remainingPercentage || 50}%):` : `Advance Required (${inv.advancePercentage || 50}%):`}</span>
                      <span>₹{(inv.invoiceType === 'remaining_50' ? inv.remainingAmount : inv.advanceAmount || inv.totalAmount).toLocaleString('en-IN')}</span>
                    </div>
                    {inv.isGstApplied && inv.gstAmount > 0 && (
                      <div className="flex justify-between text-slate-500 font-medium">
                        <span>GST ({inv.gstRate || 18}%):</span>
                        <span className="font-bold text-slate-800">₹{inv.gstAmount.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {inv.walletAmountUsed > 0 && (
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Wallet Balance Applied:</span>
                        <span>-₹{inv.walletAmountUsed.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-amber-950 font-black pt-1 border-t border-amber-100 text-[13px]">
                      <span>Total Payable Amount:</span>
                      <span>₹{inv.totalAmount?.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* Pay Action & Transaction Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={handlePay}
                      disabled={isPayingInvoice}
                      className="flex-1 py-3 px-4 rounded-xl font-extrabold text-[13px] shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-indigo-500/20 active:scale-[0.98]"
                    >
                      {isPayingInvoice ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isSufficient ? (
                        <>
                          <ShieldCheck className="h-4 w-4 text-emerald-400" /> Pay {inv.invoiceType === 'remaining_50' ? 'Remaining Balance' : 'Advance'} (₹{inv.totalAmount?.toLocaleString('en-IN')})
                        </>
                      ) : currentBalance > 0 ? (
                        <>
                          <CreditCard className="h-4 w-4 text-amber-300" /> Pay ₹{currentBalance.toLocaleString('en-IN')} Wallet + ₹{(inv.totalAmount - currentBalance).toLocaleString('en-IN')} Online
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4 text-indigo-300" /> Pay ₹{inv.totalAmount?.toLocaleString('en-IN')} Online
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold"
                      title="Download Invoice PDF"
                    >
                      <Download className="h-4 w-4 text-slate-600" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Transaction History Section */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <h3 className="text-[18px] font-extrabold text-slate-900">Transaction History</h3>
            <p className="text-[12px] font-medium text-slate-500">Real-time audit log of all credits, debits & recharges</p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search Transaction ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-[12px] font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-[12px] font-semibold text-slate-700 bg-slate-50"
            >
              <option value="all">All Types</option>
              <option value="recharge">Recharge</option>
              <option value="joining_payment">Joining Payment</option>
              <option value="invoice_payment">Invoice Payment</option>
              <option value="refund">Refund</option>
              <option value="credit">Credit</option>
              <option value="debit">Debit</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-[12px] font-semibold text-slate-700 bg-slate-50"
            >
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Transaction ID</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Balance After</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingTxns && (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-slate-400">
                    Loading transactions...
                  </td>
                </tr>
              )}

              {!loadingTxns && transactions.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-slate-400">
                    No transactions found.
                  </td>
                </tr>
              )}

              {!loadingTxns &&
                transactions.map((t) => {
                  const isCredit = ['recharge', 'credit', 'refund'].includes(t.type)

                  return (
                    <tr key={t._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-800 text-[12px]">
                        {t.transactionId}
                      </td>
                      <td className="px-4 py-3 text-[12px] font-medium text-slate-600">
                        {new Date(t.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-[12px] font-medium text-slate-700 max-w-[220px] truncate">
                        {t.description || 'Wallet Activity'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">
                          {t.type?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-extrabold text-[13px] ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isCredit ? '+' : '-'}₹{Number(t.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700 text-[12px]">
                        ₹{(t.balanceAfter || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            t.status === 'success'
                              ? 'bg-emerald-100 text-emerald-800'
                              : t.status === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedTxn(t)}
                          className="text-indigo-600 hover:text-indigo-800 text-[12px] font-extrabold flex items-center gap-0.5 justify-end ml-auto"
                        >
                          <Eye className="h-3.5 w-3.5" /> Details
                        </button>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals & Drawers */}
      <AnimatePresence>
        {showAddMoney && <AddMoneyModal summary={summary} onClose={() => setShowAddMoney(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showStatement && <DownloadStatementModal onClose={() => setShowStatement(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {selectedTxn && <TransactionDetailDrawer transaction={selectedTxn} onClose={() => setSelectedTxn(null)} />}
      </AnimatePresence>
    </div>
  )
}
