import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useGetEnterpriseJobsQuery, useGetEnterpriseSecuritySettingsQuery } from '../../../store/api/enterpriseApi.js'
import { EnterpriseMinimumSecurityBalanceModal } from '../components/EnterpriseMinimumSecurityBalanceModal.jsx'
import { ShieldAlert, Plus, Briefcase, Users, MapPin, Wallet, Clock, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react'

export function EnterpriseJobsPage() {
  const navigate = useNavigate()
  const { data: jobsData, isLoading } = useGetEnterpriseJobsQuery()
  const { data: securityResponse } = useGetEnterpriseSecuritySettingsQuery()

  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const jobs = jobsData?.data || []
  const securityInfo = securityResponse?.data || {}

  const handleCreateRequirementClick = () => {
    if (securityInfo.isEnabled && !securityInfo.isSufficient) {
      setShowSecurityModal(true)
      return
    }
    navigate('/enterprise/jobs/new')
  }

  return (
    <div className="mx-auto max-w-[1200px] w-full px-3.5 sm:px-6 py-5 sm:py-8 space-y-5 sm:space-y-6 min-h-screen bg-slate-50/50 pb-28">
      {/* Security Wallet Warning Banner */}
      {securityInfo.isEnabled && !securityInfo.isSufficient && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-950 font-medium">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-extrabold text-amber-950 text-sm">Security Wallet Balance Warning</p>
              <p className="text-amber-800">
                Your wallet balance (₹{securityInfo.currentBalance?.toLocaleString('en-IN')}) is below the required minimum security balance of ₹{securityInfo.requiredBalance?.toLocaleString('en-IN')}. Please recharge ₹{securityInfo.difference?.toLocaleString('en-IN')} to continue creating new jobs.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSecurityModal(true)}
            className="shrink-0 px-4 py-2 rounded-xl bg-amber-600 text-white font-extrabold shadow-sm hover:bg-amber-700 cursor-pointer"
          >
            Recharge Wallet
          </button>
        </div>
      )}

      {/* Security Balance Modal */}
      <EnterpriseMinimumSecurityBalanceModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
        securityData={securityInfo}
      />

      {/* Page Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] sm:text-[28px] font-black text-slate-900 tracking-tight leading-tight">
            Job Requirements ({jobs.length})
          </h1>
          <p className="text-[12.5px] sm:text-[14px] font-medium text-slate-500 mt-0.5">
            Manage your bulk hiring requirements, track applicant status and workforce deployment.
          </p>
        </div>
        <button 
          onClick={handleCreateRequirementClick}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 px-5 rounded-2xl text-[14px] transition active:scale-[0.98] shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" /> Create Requirement
        </button>
      </div>

      {/* Main Content Area — Responsive Cards Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 font-medium flex flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-indigo-600"></div>
          <p className="text-[13px] font-bold text-slate-500">Loading requirements...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center flex flex-col items-center justify-center space-y-3 shadow-xs">
          <div className="h-16 w-16 rounded-full bg-indigo-50 flex items-center justify-center mb-1">
            <Briefcase className="h-8 w-8 text-indigo-400" />
          </div>
          <h3 className="text-[17px] font-extrabold text-slate-900">No Job Requirements Created</h3>
          <p className="text-[13px] text-slate-500 max-w-md leading-relaxed">
            You haven't posted any hiring requirements yet. Click below to create your first job requirement and start receiving worker applications.
          </p>
          <button
            onClick={handleCreateRequirementClick}
            className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-6 py-2.5 rounded-xl text-[13px] shadow-sm transition-all"
          >
            + Create First Requirement
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jobs.map((job) => {
            const accepted = job.acceptedCount || 0
            const totalNeeded = job.numberOfWorkers || 1
            const filledPct = Math.min(Math.round((accepted / totalNeeded) * 100), 100)

            const statusBadgeClass =
              job.isFilled
                ? 'bg-purple-100 text-purple-800 border-purple-200'
                : job.isExpired
                ? 'bg-rose-100 text-rose-800 border-rose-200'
                : job.status === 'approved'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : job.status === 'rejected'
                ? 'bg-rose-100 text-rose-800 border-rose-200'
                : 'bg-amber-100 text-amber-800 border-amber-200'

            const statusText = job.isFilled
              ? 'FILLED'
              : job.isExpired
              ? 'EXPIRED'
              : job.status.toUpperCase()

            return (
              <motion.div
                key={job._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all p-4 sm:p-5 space-y-4 flex flex-col justify-between"
              >
                {/* Header Row: Title & Status */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 pr-2">
                      <span className="text-[10.5px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        {job.categoryId?.name || job.department || 'General'}
                      </span>
                      <h3 className="text-[16px] sm:text-[18px] font-extrabold text-slate-900 leading-tight mt-1.5 break-words">
                        {job.jobTitle}
                      </h3>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide border shrink-0 ${statusBadgeClass}`}>
                      {statusText}
                    </span>
                  </div>
                </div>

                {/* Progress Bar & Vacancy Stats */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-[12px] font-extrabold text-slate-800">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-indigo-600" />
                      <span>{accepted} of {totalNeeded} Vacancies Filled</span>
                    </span>
                    <span className="text-indigo-600">{filledPct}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        filledPct === 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${filledPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span className="text-emerald-700 font-bold">{job.joinedCount || 0} Joined Active</span>
                    <span>{Math.max(0, totalNeeded - accepted)} Vacancies Open</span>
                  </div>
                </div>

                {/* Specs Grid */}
                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <div className="p-2.5 bg-slate-50/70 border border-slate-100 rounded-xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Salary Payout</p>
                    <p className="text-[13px] font-extrabold text-emerald-700 mt-0.5">
                      ₹{Number(job.salary).toLocaleString('en-IN')} / {job.salaryType || 'month'}
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-50/70 border border-slate-100 rounded-xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Work Site</p>
                    <p className="text-[12px] font-bold text-slate-800 truncate mt-0.5">
                      {job.locationText || 'Main Location'}
                    </p>
                  </div>
                </div>

                {/* Footer Action Link */}
                <div className="pt-2 border-t border-slate-100">
                  <Link
                    to={`/enterprise/jobs/${job._id}`}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white font-extrabold text-[12.5px] transition-all shadow-xs"
                  >
                    View Details & Applicants <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
