import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, ShieldCheck, CheckCircle2, XCircle, Clock, AlertTriangle,
  Building2, UserCheck, Search, Filter, Loader2, RefreshCw, DollarSign,
  Send, Eye, ArrowUpRight, Calendar, User, CreditCard, Wallet, Smartphone, Check, X, Info
} from 'lucide-react'
import {
  useGetAdminEnterprisePayrollsQuery,
  useReviewEnterprisePayrollMutation,
  useReleaseEnterpriseSalaryMutation,
} from '../../store/api/adminEnterpriseApi.js'
import { ProfessionalSalarySlipModal } from '../../components/labour/salary/ProfessionalSalarySlipModal.jsx'
import toast from 'react-hot-toast'

export function AdminEnterprisePayrollsPage() {
  const [statusFilter, setStatusFilter] = useState('under_review')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSlip, setSelectedSlip] = useState(null)
  const [selectedAttendance, setSelectedAttendance] = useState(null)
  const [selectedTransactions, setSelectedTransactions] = useState(null)

  const { data: payrollsData, isLoading, refetch } = useGetAdminEnterprisePayrollsQuery({
    status: statusFilter !== 'all' ? statusFilter : undefined,
  })
  const [reviewPayroll, { isLoading: isReviewing }] = useReviewEnterprisePayrollMutation()
  const [releaseSalary, { isLoading: isReleasing }] = useReleaseEnterpriseSalaryMutation()

  const payrolls = payrollsData?.data || []
  const filteredPayrolls = payrolls.filter((p) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      p.workerId?.fullName?.toLowerCase().includes(q) ||
      p.workerId?.phone?.includes(q) ||
      p.enterpriseId?.companyName?.toLowerCase().includes(q) ||
      p.enterpriseId?.fullName?.toLowerCase().includes(q)
    )
  })

  const totalPendingPayouts = payrolls.filter((p) => ['under_review', 'approved'].includes(p.status)).reduce((sum, p) => sum + (p.netSalary || 0), 0)
  const totalDisbursed = payrolls.filter((p) => ['released', 'paid'].includes(p.status)).reduce((sum, p) => sum + (p.netSalary || 0), 0)

  const handleApprove = async (id) => {
    try {
      await reviewPayroll({ id, action: 'approve' }).unwrap()
      toast.success('Payroll verified & approved!')
      refetch()
    } catch (err) {
      toast.error(err?.data?.message || 'Approval failed')
    }
  }

  const handleReleaseSalary = async (p) => {
    if (!window.confirm(`Release ₹${p.netSalary.toLocaleString('en-IN')} from Escrow directly to ${p.workerId?.fullName}'s wallet?`)) {
      return
    }

    try {
      const res = await releaseSalary(p._id).unwrap()
      toast.success(res.message || 'Salary credited to worker wallet successfully!')
      refetch()
    } catch (err) {
      toast.error(err?.data?.message || 'Fund release failed')
    }
  }

  return (
    <div className="p-6 pb-32 space-y-6 max-w-7xl mx-auto min-h-screen bg-slate-50/50">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-black text-slate-900 leading-tight flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-indigo-600" /> Enterprise Payroll Dashboard
          </h1>
          <p className="text-[13px] font-medium text-slate-500 mt-1">
            Audit worker attendance salaries, verify statutory deductions, and credit net salaries into Worker Staffivaa Wallets
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] font-bold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer active:scale-95 transition"
        >
          <RefreshCw className={`h-4 w-4 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} /> Sync Payrolls
        </button>
      </div>

      {/* KPI Hero Deck */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg border border-indigo-900/40">
          <p className="text-[12px] font-bold text-amber-400 uppercase tracking-wider">Pending Payout Pool</p>
          <p className="text-[36px] font-black tracking-tight mt-1">₹{totalPendingPayouts.toLocaleString('en-IN')}</p>
          <p className="text-[12px] text-slate-400 mt-1">Awaiting credit from Staffivaa Escrow to worker wallets</p>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <p className="text-[12px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" /> Total Salary Credited to Wallets
          </p>
          <p className="text-[32px] font-black text-slate-900 mt-1">₹{totalDisbursed.toLocaleString('en-IN')}</p>
          <p className="text-[12px] font-medium text-slate-500 mt-1">Successfully credited to Worker Staffivaa Wallets</p>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <p className="text-[12px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
            <Building2 className="h-4 w-4" /> Active Payroll Batches
          </p>
          <p className="text-[32px] font-black text-slate-900 mt-1">{payrolls.length} Records</p>
          <p className="text-[12px] font-medium text-slate-500 mt-1">Across corporate & enterprise hiring partners</p>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search worker name, phone, worker ID, or enterprise..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-[13px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
          {[
            { id: 'under_review', label: 'Under Review' },
            { id: 'approved', label: 'Approved & Ready' },
            { id: 'paid', label: 'Credited to Wallet' },
            { id: 'all', label: 'All History' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id === 'paid' ? 'released' : tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-[12px] font-extrabold transition-all cursor-pointer ${
                (statusFilter === tab.id || (tab.id === 'paid' && ['released', 'paid'].includes(statusFilter)))
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Detailed Worker Cards / List */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3 bg-white rounded-3xl border border-slate-200">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
          <p className="text-[14px] font-extrabold text-slate-600">Loading Enterprise Payroll Cards...</p>
        </div>
      ) : filteredPayrolls.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-slate-200 space-y-2">
          <FileText className="h-10 w-10 text-slate-300 mx-auto" />
          <h3 className="text-[17px] font-extrabold text-slate-800">No payroll records found for selected filter</h3>
          <p className="text-[13px] text-slate-500">All enterprise salary calculations are currently up to date.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPayrolls.map((row) => {
            const company = row.enterpriseId || {}
            const worker = row.workerId || {}
            const isReleased = ['released', 'paid'].includes(row.status)
            const isApproved = row.status === 'approved'
            const isReview = row.status === 'under_review'

            const workerIdTag = `WRK-${(worker._id || '').slice(-6).toUpperCase()}`
            const hasAadhaar = Boolean(worker.labourProfile?.aadhaarMasked || worker.labourProfile?.kycStatus === 'approved')
            const hasBank = Boolean(worker.bankAccountDetails?.accountNumber)
            const hasUpi = Boolean(worker.upiDetails?.upiId)

            return (
              <div key={row._id} className="bg-white rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow p-6 space-y-5">
                {/* Top Section: Worker & Enterprise Metadata */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      {worker.profileImageUrl ? (
                        <img src={worker.profileImageUrl} alt={worker.fullName} className="h-14 w-14 rounded-2xl object-cover border border-slate-200" />
                      ) : (
                        <div className="h-14 w-14 rounded-2xl bg-indigo-600 text-white font-black flex items-center justify-center text-xl shadow-md shadow-indigo-200">
                          {worker.fullName?.charAt(0) || 'W'}
                        </div>
                      )}
                      <span className="absolute -bottom-1 -right-1 bg-slate-900 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border border-white">
                        {workerIdTag}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-[17px] font-black text-slate-900">{worker.fullName || 'Worker Name'}</h3>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${worker.accountStatus === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {worker.accountStatus || 'Active'}
                        </span>
                      </div>
                      <p className="text-[12px] font-bold text-slate-500 mt-0.5">{worker.phone} • {worker.email || 'No email'}</p>

                      {/* Verification Badges */}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-lg ${hasAadhaar ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                          {hasAadhaar ? <Check className="h-3 w-3 text-emerald-600" /> : <X className="h-3 w-3 text-slate-400" />} Aadhaar Verification
                        </span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-lg ${hasBank ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-500'}`}>
                          {hasBank ? <Check className="h-3 w-3 text-blue-600" /> : <X className="h-3 w-3 text-slate-400" />} Bank Account
                        </span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-lg ${hasUpi ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-slate-100 text-slate-500'}`}>
                          {hasUpi ? <Check className="h-3 w-3 text-purple-600" /> : <X className="h-3 w-3 text-slate-400" />} UPI Linked
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Enterprise Context */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-left lg:text-right space-y-1">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Enterprise & Project</p>
                    <p className="text-[14px] font-extrabold text-slate-900">{company.companyName || company.fullName || 'Enterprise Employer'}</p>
                    <p className="text-[12px] font-semibold text-indigo-600">{row.jobId?.jobTitle || 'Role: Skilled Labour'}</p>
                    <p className="text-[11px] font-medium text-slate-500">Pay Period: Month {row.month} / {row.year}</p>
                  </div>
                </div>

                {/* Middle Section: Breakdown Grids */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Attendance Summary Box */}
                  <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-indigo-600" /> Attendance Summary
                      </span>
                      <button
                        onClick={() => setSelectedAttendance(row)}
                        className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        View Details
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center pt-1">
                      <div className="bg-white p-2 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400">Present</p>
                        <p className="text-[16px] font-black text-emerald-600">{row.presentDays || 0} Days</p>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400">Absent</p>
                        <p className="text-[16px] font-black text-rose-600">{row.absentDays || 0} Days</p>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400">Half Days</p>
                        <p className="text-[16px] font-black text-amber-600">{row.halfDays || 0}</p>
                      </div>
                    </div>
                    <p className="text-[11px] font-medium text-slate-500 pt-1">
                      Overtime: <span className="font-extrabold text-slate-900">{row.overtimeHours || 0} hrs</span> | Total Hours: <span className="font-extrabold text-slate-900">{row.totalWorkingHours || (row.presentDays * 8)} hrs</span>
                    </p>
                  </div>

                  {/* Financial Breakdown Box */}
                  <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100 space-y-2">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5 text-indigo-600" /> Payroll Calculation
                    </span>
                    <div className="space-y-1 text-[12px] pt-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Monthly Gross Salary:</span>
                        <span className="font-extrabold text-slate-900">₹{(row.grossSalary || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-rose-600">
                        <span>Attendance Deduction:</span>
                        <span className="font-bold">-₹{(row.attendanceDeduction || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-emerald-600">
                        <span>Bonus & Overtime:</span>
                        <span className="font-bold">+₹{((row.bonus || 0) + (row.overtimeBonus || 0)).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-rose-600">
                        <span>Statutory (PF/ESIC/TDS):</span>
                        <span className="font-bold">-₹{((row.pfDeduction || 0) + (row.esicDeduction || 0) + (row.tdsDeduction || 0)).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-200/60 pt-1 text-[13px] font-black text-indigo-900">
                        <span>Net Payable Salary:</span>
                        <span className="text-[15px]">₹{(row.netSalary || 0).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Wallet Status Box */}
                  <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Wallet className="h-3.5 w-3.5 text-indigo-600" /> Worker Wallet Details
                      </span>
                      <button
                        onClick={() => setSelectedTransactions(row)}
                        className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        Transactions
                      </button>
                    </div>
                    <div className="space-y-1 text-[12px] pt-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Current Balance:</span>
                        <span className="font-black text-emerald-600">₹{(worker.walletBalance || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Salary Credited Status:</span>
                        <span className={`font-bold ${isReleased ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {isReleased ? 'Credited Successfully' : 'Pending Escrow Release'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Escrow Pool Status:</span>
                        <span className="font-bold text-indigo-700">Secured in Staffivaa</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-black uppercase ${
                      isReleased ? 'bg-emerald-100 text-emerald-900' :
                      isApproved ? 'bg-purple-100 text-purple-900' :
                      isReview ? 'bg-amber-100 text-amber-900 animate-pulse' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {isReleased ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> :
                       isApproved ? <ShieldCheck className="h-3.5 w-3.5 text-purple-600" /> :
                       <Clock className="h-3.5 w-3.5 text-amber-600" />}
                      Status: {row.status.replace('_', ' ')}
                    </span>
                    {row.paymentReference && (
                      <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                        Ref: {row.paymentReference}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    <button
                      onClick={() => setSelectedSlip(row)}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-extrabold text-[12px] flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="h-4 w-4 text-indigo-600" /> View Salary Slip
                    </button>

                    {isReview && (
                      <button
                        onClick={() => handleApprove(row._id)}
                        disabled={isReviewing}
                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-[12px] shadow-sm cursor-pointer"
                      >
                        Verify & Approve
                      </button>
                    )}

                    {(isReview || isApproved) && (
                      <button
                        onClick={() => handleReleaseSalary(row)}
                        disabled={isReleasing}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[12px] shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
                      >
                        <Send className="h-3.5 w-3.5" /> Credit Salary to Wallet
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Salary Slip Preview Modal */}
      <AnimatePresence>
        {selectedSlip && (
          <ProfessionalSalarySlipModal
            payroll={selectedSlip}
            onClose={() => setSelectedSlip(null)}
          />
        )}
      </AnimatePresence>

      {/* Attendance Detail Modal */}
      {selectedAttendance && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-600" /> Attendance Breakdown
              </h3>
              <button onClick={() => setSelectedAttendance(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <p className="font-bold text-slate-800">Worker: {selectedAttendance.workerId?.fullName}</p>
              <p className="text-xs text-slate-500">Period: Month {selectedAttendance.month} / {selectedAttendance.year}</p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-500 font-bold">Total Working Days</p>
                  <p className="text-lg font-black text-slate-900">{selectedAttendance.totalWorkingDays || 26} Days</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl">
                  <p className="text-xs text-emerald-600 font-bold">Present Days</p>
                  <p className="text-lg font-black text-emerald-700">{selectedAttendance.presentDays || 0} Days</p>
                </div>
                <div className="p-3 bg-rose-50 rounded-xl">
                  <p className="text-xs text-rose-600 font-bold">Absent Days</p>
                  <p className="text-lg font-black text-rose-700">{selectedAttendance.absentDays || 0} Days</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl">
                  <p className="text-xs text-amber-600 font-bold">Overtime Hours</p>
                  <p className="text-lg font-black text-amber-700">{selectedAttendance.overtimeHours || 0} Hours</p>
                </div>
              </div>
            </div>
            <button onClick={() => setSelectedAttendance(null)} className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs">Close</button>
          </div>
        </div>
      )}

      {/* Transactions Detail Modal */}
      {selectedTransactions && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Wallet className="h-5 w-5 text-emerald-600" /> Wallet Details & Status
              </h3>
              <button onClick={() => setSelectedTransactions(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <p className="font-bold text-slate-800">Worker: {selectedTransactions.workerId?.fullName}</p>
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-1">
                <p className="text-xs font-bold text-emerald-600 uppercase">Current Staffivaa Wallet Balance</p>
                <p className="text-2xl font-black text-emerald-800">₹{(selectedTransactions.workerId?.walletBalance || 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="space-y-2 pt-2 text-xs">
                <p className="font-extrabold text-slate-700">Salary Credit Reference:</p>
                <p className="font-mono text-slate-600 bg-slate-100 p-2 rounded-xl">{selectedTransactions.paymentReference || 'Pending release execution'}</p>
              </div>
            </div>
            <button onClick={() => setSelectedTransactions(null)} className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
