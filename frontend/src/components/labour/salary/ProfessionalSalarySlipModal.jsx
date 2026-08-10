import React from 'react'
import { motion } from 'framer-motion'
import { X, Download, Printer, ShieldCheck, Building2, UserCheck, Calendar, CheckCircle2 } from 'lucide-react'

export function ProfessionalSalarySlipModal({ payroll, onClose }) {
  if (!payroll) return null

  const worker = payroll.workerId || {}
  const company = payroll.enterpriseId || {}
  const job = payroll.jobId || {}

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  const monthName = monthNames[(payroll.month || 1) - 1]

  const totalDeductions = (payroll.attendanceDeduction || 0) + (payroll.pfDeduction || 0) + (payroll.esicDeduction || 0) + (payroll.ptDeduction || 0) + (payroll.tdsDeduction || 0) + (payroll.otherDeductions || 0)
  const totalAdditions = (payroll.overtimeBonus || 0) + (payroll.bonus || 0)

  const handlePrint = () => {
    window.print()
  }

  // Simple number to words converter for display
  const numberToWords = (num) => {
    if (!num) return 'Zero Rupees Only'
    return `Rupees ${Number(num).toLocaleString('en-IN')} Only`
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-sm p-2 sm:p-6 flex justify-center items-start sm:items-center min-h-screen print:p-0 print:bg-white">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 15 }}
        className="w-full max-w-3xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden my-auto border border-slate-200 print:shadow-none print:border-none print:my-0 print:rounded-none max-h-[94vh] flex flex-col"
      >
        {/* Top Actions Bar (Hidden on Print) */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-100 bg-slate-900 text-white shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <span className="text-[14px] sm:text-[15px] font-black tracking-wide">Staffivaa Verified PaySlip</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handlePrint}
              className="px-3 sm:px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] sm:text-[13px] font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="h-4 w-4" /> Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable PaySlip Content */}
        <div className="p-4 sm:p-10 space-y-6 sm:space-y-8 overflow-y-auto flex-1 print:p-6 print:overflow-visible" id="printable-salary-slip">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-slate-900 pb-6">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center">S</div>
                <h1 className="text-[24px] font-black tracking-tight text-slate-900">STAFFIVAA FINTECH LEDGER</h1>
              </div>
              <p className="text-[13px] font-bold text-indigo-600 mt-1 uppercase tracking-wider">Official Employment & Wage Disbursal Statement</p>
              <p className="text-[12px] text-slate-500 font-medium">Secured & Distributed via Staffivaa Escrow System</p>
            </div>
            <div className="sm:text-right">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-900 rounded-full font-extrabold text-[12px] inline-flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> {payroll.status?.toUpperCase() || 'PAID'}
              </span>
              <p className="text-[14px] font-extrabold text-slate-800 mt-2">Pay Period: {monthName} {payroll.year}</p>
              <p className="text-[12px] font-mono text-slate-500">Ref: {payroll.paymentReference || `SAL-${payroll._id?.slice(-8).toUpperCase()}`}</p>
            </div>
          </div>

          {/* Employer & Employee Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-200/80">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Building2 className="h-3 w-3" /> Enterprise Employer
              </span>
              <p className="text-[15px] font-extrabold text-slate-900">{company.companyName || company.fullName || 'Enterprise Corporation'}</p>
              <p className="text-[12px] text-slate-600">{company.email}</p>
              <p className="text-[12px] text-slate-600">{job.workLocation || 'Standard Project Site'}</p>
            </div>

            <div className="space-y-1 sm:border-l sm:pl-6 border-slate-200">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <UserCheck className="h-3 w-3" /> Worker / Employee Details
              </span>
              <p className="text-[15px] font-extrabold text-slate-900">{worker.fullName || 'Labour Worker'}</p>
              <p className="text-[12px] text-slate-600">Designation: <span className="font-bold text-slate-800">{job.jobTitle || 'Contract Specialist'}</span></p>
              <p className="text-[12px] text-slate-600">Contact: {worker.phone || worker.email}</p>
              <p className="text-[12px] text-slate-600">Escrow ID: <span className="font-mono text-indigo-700 font-bold">{payroll.escrowId?._id || payroll.escrowId || 'ESC-VERIFIED'}</span></p>
            </div>
          </div>

          {/* Attendance Breakdown Metric Pills */}
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-400 block uppercase">Total Working Days</span>
              <span className="text-[16px] font-black text-slate-800">{payroll.totalWorkingDays || 26}</span>
            </div>
            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
              <span className="text-[11px] font-bold text-emerald-700 block uppercase">Present Days</span>
              <span className="text-[16px] font-black text-emerald-900">{payroll.presentDays || 0}</span>
            </div>
            <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200">
              <span className="text-[11px] font-bold text-rose-700 block uppercase">Absent / Leaves</span>
              <span className="text-[16px] font-black text-rose-900">{(payroll.absentDays || 0) + (payroll.leaveDays || 0)}</span>
            </div>
            <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200">
              <span className="text-[11px] font-bold text-indigo-700 block uppercase">Overtime Hours</span>
              <span className="text-[16px] font-black text-indigo-900">{payroll.overtimeHours || 0} hrs</span>
            </div>
          </div>

          {/* Earnings & Deductions Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-2 bg-slate-900 text-white font-black text-[12px] uppercase tracking-wider p-3 px-6">
              <div>Earnings / Allowances</div>
              <div>Deductions / Retainers</div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-slate-200 text-[13px]">
              {/* Earnings Column */}
              <div className="p-5 space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Agreed Gross Wage (Escrow Pool)</span>
                  <span className="font-bold text-slate-900">₹{(payroll.grossSalary || 0).toLocaleString('en-IN')}</span>
                </div>
                {(payroll.overtimeBonus > 0) && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Overtime Bonus (1.5x)</span>
                    <span>+₹{payroll.overtimeBonus.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {(payroll.bonus > 0) && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Performance Incentive</span>
                    <span>+₹{payroll.bonus.toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>

              {/* Deductions Column */}
              <div className="p-5 space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Attendance Leave Deductions</span>
                  <span className="font-bold text-rose-600">₹{(payroll.attendanceDeduction || 0).toLocaleString('en-IN')}</span>
                </div>
                {(payroll.pfDeduction > 0) && (
                  <div className="flex justify-between text-slate-600">
                    <span>Provident Fund (PF 12%)</span>
                    <span>₹{payroll.pfDeduction.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {(payroll.esicDeduction > 0) && (
                  <div className="flex justify-between text-slate-600">
                    <span>ESIC Contribution (0.75%)</span>
                    <span>₹{payroll.esicDeduction.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {(payroll.tdsDeduction > 0) && (
                  <div className="flex justify-between text-slate-600">
                    <span>TDS Tax Deduction</span>
                    <span>₹{payroll.tdsDeduction.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {(payroll.otherDeductions > 0) && (
                  <div className="flex justify-between text-slate-600">
                    <span>Other Retainers / Advance</span>
                    <span>₹{payroll.otherDeductions.toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Total Row */}
            <div className="grid grid-cols-2 divide-x divide-slate-200 bg-slate-100/80 p-4 px-5 font-black text-[14px] border-t border-slate-200">
              <div className="flex justify-between text-slate-900">
                <span>Total Gross & Bonus</span>
                <span>₹{((payroll.grossSalary || 0) + totalAdditions).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-rose-700 pl-4">
                <span>Total Deductions</span>
                <span>₹{totalDeductions.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Net Salary Payable Highlight */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
            <div>
              <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-widest block">Net Salary Disbursed to Wallet</span>
              <span className="text-[20px] font-bold text-white tracking-tight italic">{numberToWords(payroll.netSalary || 0)}</span>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[32px] font-black text-emerald-400">₹{(payroll.netSalary || 0).toLocaleString('en-IN')}</span>
              <p className="text-[11px] font-medium text-slate-400">Direct wallet deposit • Instantly withdrawable</p>
            </div>
          </div>

          {/* Verification & Signatures Footer */}
          <div className="pt-6 border-t border-slate-200 text-slate-400 text-[12px] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">✓</div>
              <p className="text-[11px]">
                This is a computer-generated salary slip verified by Staffivaa Fintech Escrow Engine. No physical signature required.
              </p>
            </div>
            <div className="text-right">
              <span className="text-[12px] font-black text-slate-600 block">Staffivaa Compliance Team</span>
              <span className="text-[10px] text-slate-400">Generated on {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
