import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, ShieldCheck, CheckCircle2, XCircle, Clock, AlertTriangle,
  Building2, UserCheck, Search, Filter, Loader2, RefreshCw, DollarSign,
  Send, Eye, ArrowUpRight
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
  const [rejectionModalData, setRejectionModalData] = useState(null)

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
      toast.success('Payroll calculation verified & approved!')
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
      toast.success(res.message || 'Salary released to worker wallet successfully!')
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
            <ShieldCheck className="h-7 w-7 text-indigo-600" /> Enterprise Payroll & Escrow Salary Payouts
          </h1>
          <p className="text-[13px] font-medium text-slate-500 mt-1">
            Audit monthly attendance wages and execute atomic Escrow releases to Labour Wallets
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] font-bold text-slate-700 shadow-xs hover:bg-slate-50"
        >
          <RefreshCw className={`h-4 w-4 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Ledgers
        </button>
      </div>

      {/* KPI Hero Deck */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg border border-indigo-900/40">
          <p className="text-[12px] font-bold text-amber-400 uppercase tracking-wider">Pending Payout Pool</p>
          <p className="text-[36px] font-black tracking-tight mt-1">₹{totalPendingPayouts.toLocaleString('en-IN')}</p>
          <p className="text-[12px] text-slate-400 mt-1">Awaiting release from Staffivaa Escrow to worker wallets</p>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <p className="text-[12px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" /> Total Disbursed Salaries
          </p>
          <p className="text-[32px] font-black text-slate-900 mt-1">₹{totalDisbursed.toLocaleString('en-IN')}</p>
          <p className="text-[12px] font-medium text-slate-500 mt-1">Successfully transferred to worker accounts</p>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <p className="text-[12px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
            <Building2 className="h-4 w-4" /> Active Enterprise Requests
          </p>
          <p className="text-[32px] font-black text-slate-900 mt-1">{payrolls.length} Batches</p>
          <p className="text-[12px] font-medium text-slate-500 mt-1">Across corporate & enterprise hiring partners</p>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search worker name, phone, or corporate employer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-[13px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
          {[
            { id: 'under_review', label: 'Under Review' },
            { id: 'approved', label: 'Approved & Ready' },
            { id: 'paid', label: 'Released / Paid' },
            { id: 'all', label: 'All History' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id === 'paid' ? 'released' : tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-[12px] font-extrabold transition-all ${
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

      {/* Table */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3 bg-white rounded-3xl border border-slate-200">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
          <p className="text-[14px] font-extrabold text-slate-600">Loading Enterprise Payout Ledgers...</p>
        </div>
      ) : filteredPayrolls.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-slate-200 space-y-2">
          <FileText className="h-10 w-10 text-slate-300 mx-auto" />
          <h3 className="text-[17px] font-extrabold text-slate-800">No payroll requests found for selected filter</h3>
          <p className="text-[13px] text-slate-500">All enterprise salary disbursements are currently up to date.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="p-4 pl-6">Enterprise Partner</th>
                  <th className="p-4">Labour Beneficiary</th>
                  <th className="p-4">Pay Period</th>
                  <th className="p-4">Gross & Deductions</th>
                  <th className="p-4">Net Payout</th>
                  <th className="p-4">Escrow Status</th>
                  <th className="p-4 pr-6 text-right">Payout Execution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[13px]">
                {filteredPayrolls.map((row) => {
                  const company = row.enterpriseId || {}
                  const worker = row.workerId || {}
                  const isReleased = ['released', 'paid'].includes(row.status)
                  const isApproved = row.status === 'approved'
                  const isReview = row.status === 'under_review'

                  return (
                    <tr key={row._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-4 pl-6">
                        <p className="font-extrabold text-slate-900">{company.companyName || company.fullName || 'Corporate Employer'}</p>
                        <p className="text-[11px] font-medium text-slate-500">{company.email}</p>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center text-[12px]">
                            {worker.fullName?.charAt(0) || 'W'}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900">{worker.fullName}</p>
                            <p className="text-[11px] font-medium text-slate-500">{worker.phone || worker.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-slate-800">Month {row.month} / {row.year}</p>
                        <span className="text-[11px] font-medium text-slate-500">{row.presentDays || 26} Days Present</span>
                      </td>
                      <td className="p-4">
                        <p className="font-extrabold text-slate-800">₹{(row.grossSalary || 0).toLocaleString('en-IN')} Gross</p>
                        <p className="text-[11px] font-bold text-rose-600">-₹{((row.attendanceDeduction || 0) + (row.pfDeduction || 0) + (row.esicDeduction || 0)).toLocaleString('en-IN')} Deduct</p>
                      </td>
                      <td className="p-4">
                        <p className="text-[16px] font-black text-indigo-900">₹{(row.netSalary || 0).toLocaleString('en-IN')}</p>
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Escrow Secured</span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide ${
                          isReleased ? 'bg-emerald-100 text-emerald-900' :
                          isApproved ? 'bg-purple-100 text-purple-900' :
                          isReview ? 'bg-amber-100 text-amber-900 animate-pulse' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {isReleased ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> :
                           isApproved ? <ShieldCheck className="h-3.5 w-3.5 text-purple-600" /> :
                           <Clock className="h-3.5 w-3.5 text-amber-600" />}
                          {row.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isReview && (
                            <>
                              <button
                                onClick={() => handleApprove(row._id)}
                                disabled={isReviewing}
                                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-[12px] shadow-sm cursor-pointer"
                              >
                                Verify & Approve
                              </button>
                            </>
                          )}
                          {(isReview || isApproved) && (
                            <button
                              onClick={() => handleReleaseSalary(row)}
                              disabled={isReleasing}
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[12px] shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
                            >
                              <Send className="h-3.5 w-3.5" /> Release Salary
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedSlip(row)}
                            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold flex items-center gap-1 text-[12px]"
                            title="View Professional Salary Slip"
                          >
                            <Eye className="h-4 w-4 text-indigo-600" />
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

      {/* Salary Slip Preview Modal */}
      <AnimatePresence>
        {selectedSlip && (
          <ProfessionalSalarySlipModal
            payroll={selectedSlip}
            onClose={() => setSelectedSlip(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
