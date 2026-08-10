import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Plus, Search, Filter, CheckCircle2, Clock, AlertTriangle,
  Users, DollarSign, ArrowRight, ShieldCheck, Download, Calendar, Loader2,
  RefreshCw, ChevronRight, UserCheck, X
} from 'lucide-react'
import {
  useGetEnterprisePayrollsQuery,
  useCalculateEnterprisePayrollMutation,
  useSubmitPayrollForReviewMutation,
  useGetActiveWorkforceQuery,
} from '../../../store/api/enterpriseApi.js'
import { ProfessionalSalarySlipModal } from '../../../components/labour/salary/ProfessionalSalarySlipModal.jsx'
import toast from 'react-hot-toast'

export function EnterprisePayrollPage() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [statusFilter, setStatusFilter] = useState('all')
  const [showComputeModal, setShowComputeModal] = useState(false)
  const [selectedPayrollForSlip, setSelectedPayrollForSlip] = useState(null)

  const { data: payrollsData, isLoading, refetch } = useGetEnterprisePayrollsQuery({
    month: selectedMonth,
    year: selectedYear,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  })
  const [submitForReview, { isLoading: isSubmitting }] = useSubmitPayrollForReviewMutation()

  const payrolls = payrollsData?.data || []

  // Calculate high-level KPIs
  const totalNetSalary = payrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0)
  const totalDeductions = payrolls.reduce((sum, p) => sum + (p.attendanceDeduction || 0) + (p.pfDeduction || 0) + (p.esicDeduction || 0) + (p.tdsDeduction || 0), 0)
  const totalOvertimeBonus = payrolls.reduce((sum, p) => sum + (p.overtimeBonus || 0) + (p.bonus || 0), 0)
  const releasedCount = payrolls.filter((p) => ['released', 'paid'].includes(p.status)).length
  const pendingCount = payrolls.filter((p) => ['draft', 'under_review', 'on_hold'].includes(p.status)).length

  const handleSubmitReview = async (id) => {
    try {
      await submitForReview(id).unwrap()
      toast.success('Payroll submitted to Staffivaa Admin for verification & Escrow fund release!')
      refetch()
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to submit payroll for review')
    }
  }

  const months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' },
    { value: 3, label: 'March' }, { value: 4, label: 'April' },
    { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' },
    { value: 9, label: 'September' }, { value: 10, label: 'October' },
    { value: 11, label: 'November' }, { value: 12, label: 'December' },
  ]

  return (
    <div className="p-6 pb-32 space-y-6 max-w-7xl mx-auto min-h-screen bg-slate-50/50">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-extrabold text-slate-900 leading-tight">Enterprise Payroll & Salary Slips</h1>
          <p className="text-[13px] font-medium text-slate-500 mt-1">
            Automated attendance calculation, statutory deduction rules & Escrow fund disbursal
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-all"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => setShowComputeModal(true)}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-extrabold shadow-md shadow-indigo-500/20 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" /> + Compute Monthly Payroll
          </button>
        </div>
      </div>

      {/* Hero Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white shadow-lg border border-indigo-900/40 relative overflow-hidden">
          <p className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">Total Net Payroll</p>
          <p className="text-[28px] font-black tracking-tight mt-1">₹{totalNetSalary.toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-slate-400 mt-1">For {months.find((m) => m.value === selectedMonth)?.label} {selectedYear}</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Released / Paid
          </p>
          <p className="text-[26px] font-black text-slate-900 mt-1">{releasedCount} Workers</p>
          <p className="text-[11px] font-medium text-slate-500 mt-1">Funds disbursed from Escrow to wallet</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> Pending / Under Review
          </p>
          <p className="text-[26px] font-black text-slate-900 mt-1">{pendingCount} Records</p>
          <p className="text-[11px] font-medium text-slate-500 mt-1">Awaiting verification or HR submission</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5" /> Total Deductions / Overtime
          </p>
          <p className="text-[20px] font-black text-slate-900 mt-1">
            -₹{totalDeductions.toLocaleString('en-IN')} <span className="text-emerald-600 text-[14px]">|+₹{totalOvertimeBonus.toLocaleString('en-IN')} OT</span>
          </p>
          <p className="text-[11px] font-medium text-slate-500 mt-1">Attendance leaves & statutory compliance</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-800 outline-none"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-800 outline-none"
            >
              {[selectedYear - 1, selectedYear, selectedYear + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'all', label: 'All Status' },
              { id: 'draft', label: 'Drafts' },
              { id: 'under_review', label: 'Under Review' },
              { id: 'paid', label: 'Paid / Released' },
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
      </div>

      {/* Payroll Records List */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3 bg-white rounded-3xl border border-slate-200 shadow-xs">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
          <p className="text-[14px] font-extrabold text-slate-600">Loading payroll calculations & Escrow ledgers...</p>
        </div>
      ) : payrolls.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto text-indigo-600">
            <FileText className="h-7 w-7" />
          </div>
          <h3 className="text-[18px] font-extrabold text-slate-900">No Payroll Records Computed Yet</h3>
          <p className="text-[13px] font-medium text-slate-500 max-w-md mx-auto">
            Click "+ Compute Monthly Payroll" to run attendance-based salary calculations for your active workforce for this month.
          </p>
          <button
            onClick={() => setShowComputeModal(true)}
            className="mt-2 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-[13px] shadow-sm hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> Compute Now
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="p-4 pl-6">Worker Employee</th>
                  <th className="p-4">Attendance Summary</th>
                  <th className="p-4">Agreed Salary Pool</th>
                  <th className="p-4">Deductions & OT</th>
                  <th className="p-4">Net Salary Payable</th>
                  <th className="p-4">Status & Escrow</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[13px]">
                {payrolls.map((row) => {
                  const workerName = row.workerId?.fullName || 'Labour Employee'
                  const workerPhone = row.workerId?.phone || row.workerId?.email || 'N/A'
                  const isPaid = ['released', 'paid'].includes(row.status)
                  const isReview = row.status === 'under_review'
                  const isDraft = row.status === 'draft'

                  return (
                    <tr key={row._id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-black flex items-center justify-center text-[14px] shrink-0">
                            {workerName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors">{workerName}</p>
                            <p className="text-[11px] font-medium text-slate-500">{workerPhone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1 text-[12px]">
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md text-[11px]">
                            {row.presentDays || 26} Days Present
                          </span>
                          {row.absentDays > 0 && (
                            <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-md text-[11px] ml-1">
                              {row.absentDays} Absent
                            </span>
                          )}
                          {row.overtimeHours > 0 && (
                            <p className="text-[11px] font-extrabold text-indigo-600">+{row.overtimeHours} hrs Overtime</p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="font-extrabold text-slate-800">₹{(row.grossSalary || 0).toLocaleString('en-IN')}</p>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Per Escrow Agreement</span>
                      </td>
                      <td className="p-4">
                        <div className="text-[12px]">
                          <p className="font-bold text-rose-600">
                            -₹{((row.attendanceDeduction || 0) + (row.pfDeduction || 0) + (row.esicDeduction || 0) + (row.tdsDeduction || 0)).toLocaleString('en-IN')}
                          </p>
                          {row.overtimeBonus > 0 && (
                            <p className="text-[11px] font-extrabold text-emerald-600">+₹{row.overtimeBonus.toLocaleString('en-IN')} OT</p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-[16px] font-black text-indigo-900">₹{(row.netSalary || 0).toLocaleString('en-IN')}</p>
                        <span className="text-[10px] font-extrabold text-indigo-500 uppercase">Ready for Transfer</span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide ${
                          isPaid ? 'bg-emerald-100 text-emerald-900' :
                          isReview ? 'bg-blue-100 text-blue-900' :
                          row.status === 'on_hold' ? 'bg-amber-100 text-amber-900' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {isPaid ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> :
                           isReview ? <Clock className="h-3.5 w-3.5 text-blue-600" /> :
                           <AlertTriangle className="h-3.5 w-3.5 text-slate-500" />}
                          {row.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isDraft && (
                            <button
                              onClick={() => handleSubmitReview(row._id)}
                              disabled={isSubmitting}
                              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[12px] shadow-xs cursor-pointer"
                            >
                              Submit for Release
                            </button>
                          )}
                          {isReview && (
                            <span className="text-[12px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl">
                              Pending Admin Approval
                            </span>
                          )}
                          <button
                            onClick={() => setSelectedPayrollForSlip(row)}
                            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold flex items-center gap-1 text-[12px] cursor-pointer"
                            title="View Professional Salary Slip"
                          >
                            <FileText className="h-4 w-4 text-indigo-600" /> Slip
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

      {/* Compute Monthly Payroll Modal */}
      <AnimatePresence>
        {showComputeModal && (
          <ComputePayrollModal
            months={months}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onClose={() => setShowComputeModal(false)}
            onSuccess={() => { setShowComputeModal(false); refetch(); }}
          />
        )}
      </AnimatePresence>

      {/* Professional Salary Slip Modal */}
      <AnimatePresence>
        {selectedPayrollForSlip && (
          <ProfessionalSalarySlipModal
            payroll={selectedPayrollForSlip}
            onClose={() => setSelectedPayrollForSlip(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function ComputePayrollModal({ months, selectedMonth, selectedYear, onClose, onSuccess }) {
  const [workerId, setWorkerId] = useState('')
  const [month, setMonth] = useState(selectedMonth)
  const [year, setYear] = useState(selectedYear)
  const [customGrossSalary, setCustomGrossSalary] = useState('25000')
  const [bonus, setBonus] = useState('0')
  const [otherDeductions, setOtherDeductions] = useState('0')
  const [applyPf, setApplyPf] = useState(false)
  const [applyEsic, setApplyEsic] = useState(false)
  const [applyPt, setApplyPt] = useState(false)

  const { data: workforceData, isLoading: loadingWorkforce } = useGetActiveWorkforceQuery()
  const [calculatePayroll, { isLoading: isComputing }] = useCalculateEnterprisePayrollMutation()

  const workforce = workforceData?.data || []

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!workerId) {
      toast.error('Please select a worker from your active workforce')
      return
    }

    try {
      await calculatePayroll({
        workerId,
        month: Number(month),
        year: Number(year),
        customGrossSalary: Number(customGrossSalary),
        bonus: Number(bonus),
        otherDeductions: Number(otherDeductions),
        applyPf,
        applyEsic,
        applyPt,
      }).unwrap()
      toast.success('Monthly payroll computed & attendance deductions applied successfully!')
      onSuccess()
    } catch (err) {
      toast.error(err?.data?.message || 'Calculation failed')
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 flex justify-center items-start sm:items-center min-h-screen">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden my-auto border border-slate-100 max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-indigo-50/50">
          <div>
            <h3 className="text-[17px] font-extrabold text-slate-900">Compute Monthly Payroll</h3>
            <p className="text-[12px] font-medium text-slate-500 mt-0.5">Auto-aggregate attendance logs & statutory deductions</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[12px] font-extrabold text-slate-700 uppercase tracking-wide mb-1.5">
              Select Active Worker
            </label>
            {loadingWorkforce ? (
              <div className="p-3 text-[13px] text-slate-500">Loading active workforce...</div>
            ) : workforce.length === 0 ? (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[13px] font-medium">
                No active joined workers found. Make sure workers are marked as Joined first.
              </div>
            ) : (
              <select
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value)}
                required
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-[14px] font-extrabold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="">-- Select Worker --</option>
                {workforce.map((w) => (
                  <option key={w.workerId?._id || w._id} value={w.workerId?._id || w.workerId}>
                    {w.workerId?.fullName || 'Worker'} ({w.jobId?.jobTitle || 'Assigned Role'})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Month</label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 font-bold text-[13px]"
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 font-bold text-[13px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-extrabold text-slate-700 uppercase mb-1">
              Agreed Gross Salary / Month (₹)
            </label>
            <input
              type="number"
              value={customGrossSalary}
              onChange={(e) => setCustomGrossSalary(e.target.value)}
              required
              className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 font-black text-[16px] text-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-emerald-700 uppercase mb-1">+ Performance Bonus (₹)</label>
              <input
                type="number"
                value={bonus}
                onChange={(e) => setBonus(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/30 font-bold text-[13px]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-rose-700 uppercase mb-1">- Other Deductions (₹)</label>
              <input
                type="number"
                value={otherDeductions}
                onChange={(e) => setOtherDeductions(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-rose-200 bg-rose-50/30 font-bold text-[13px]"
              />
            </div>
          </div>

          {/* Statutory Deductions Options */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
            <p className="text-[12px] font-extrabold text-slate-800 uppercase tracking-wide">Statutory Compliances (Optional)</p>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex items-center gap-2 text-[12px] font-bold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={applyPf} onChange={(e) => setApplyPf(e.target.checked)} className="rounded text-indigo-600 focus:ring-0" />
                PF (12%)
              </label>
              <label className="flex items-center gap-2 text-[12px] font-bold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={applyEsic} onChange={(e) => setApplyEsic(e.target.checked)} className="rounded text-indigo-600 focus:ring-0" />
                ESIC (0.75%)
              </label>
              <label className="flex items-center gap-2 text-[12px] font-bold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={applyPt} onChange={(e) => setApplyPt(e.target.checked)} className="rounded text-indigo-600 focus:ring-0" />
                Prof. Tax (₹200)
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-[13px] text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isComputing}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[13px] shadow-md flex items-center gap-2 cursor-pointer"
            >
              {isComputing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Compute & Generate Draft
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
