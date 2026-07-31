import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useGetEnterpriseJobsQuery, useGetEnterpriseSecuritySettingsQuery } from '../../../store/api/enterpriseApi.js'
import { EnterpriseMinimumSecurityBalanceModal } from '../components/EnterpriseMinimumSecurityBalanceModal.jsx'
import { ShieldAlert, Plus } from 'lucide-react'

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
    <div className="mx-auto max-w-[1200px] w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6">
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[22px] sm:text-[28px] font-extrabold text-slate-900 tracking-tight leading-tight">
            Job Requirements
          </h1>
          <p className="text-[13px] sm:text-[14px] font-medium text-slate-500">
            Manage your bulk hiring requirements and track applicants.
          </p>
        </div>
        <button 
          onClick={handleCreateRequirementClick}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-[12px] text-[14px] transition active:scale-[0.98] shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Create Requirement
        </button>
      </div>

      <div className="bg-white rounded-[16px] shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-100">
            <tr>
              <th className="px-6 py-4">Job Title</th>
              <th className="px-6 py-4">Vacancies</th>
              <th className="px-6 py-4">Salary</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                  <div className="flex justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600"></div></div>
                </td>
              </tr>
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="h-12 w-12 bg-slate-50 rounded-full flex items-center justify-center mb-2">
                      <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                    </div>
                    <p className="font-bold text-slate-900">No jobs posted yet</p>
                    <p className="text-slate-500 text-[13px]">Create a job requirement to start hiring.</p>
                  </div>
                </td>
              </tr>
            ) : (
              jobs.map(job => (
                <tr key={job._id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900">{job.jobTitle}</p>
                    <p className="text-[12px] text-slate-500">{job.categoryId?.name || job.department || 'General'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-extrabold text-slate-900">
                      {job.acceptedCount || 0} / {job.numberOfWorkers} Filled
                    </p>
                    <p className="text-[11px] font-bold text-emerald-600">
                      {job.joinedCount || 0} Active Joined
                    </p>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-700">₹{job.salary} / {job.salaryType}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      job.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                      job.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link to={`/enterprise/jobs/${job._id}`} className="text-indigo-600 hover:text-indigo-800 font-bold text-[13px]">
                      View Details
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
