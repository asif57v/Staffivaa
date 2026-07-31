import React, { useState } from 'react'
import { RefreshCw, Search, Users, CheckCircle2 } from 'lucide-react'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { useGetAdminEnterpriseJobsQuery, useUpdateAdminEnterpriseJobStatusMutation } from '../../store/api/adminEnterpriseApi.js'
import { AdminConfirmActionDialog } from '../../components/admin/AdminConfirmActionDialog.jsx'

export function AdminEnterpriseJobsPage() {
  const [searchInput, setSearchInput] = useState('')
  const [dialogConfig, setDialogConfig] = useState({ isOpen: false })

  const { data: response, isLoading, refetch } = useGetAdminEnterpriseJobsQuery()
  const [updateStatus] = useUpdateAdminEnterpriseJobStatusMutation()

  const jobs = response?.data || []

  const filtered = jobs.filter((j) => {
    if (searchInput) {
      const lower = searchInput.toLowerCase()
      return (
        j.jobTitle?.toLowerCase().includes(lower) ||
        j.enterpriseId?.enterpriseProfile?.companyName?.toLowerCase().includes(lower)
      )
    }
    return true
  })

  const openDialog = (config) => setDialogConfig({ isOpen: true, ...config })
  const closeDialog = () => setDialogConfig({ isOpen: false })

  const handleAction = async (id, status, isLive, adminReviewNote = '') => {
    try {
      await updateStatus({ id, status, isLive, adminReviewNote }).unwrap()
      closeDialog()
    } catch (e) {
      alert(e?.data?.message || 'Action failed')
    }
  }

  return (
    <div className="w-full space-y-6 pb-10">
      <AdminConfirmActionDialog {...dialogConfig} onClose={closeDialog} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 md:text-xl">Enterprise Jobs & Hiring Activity</h2>
          <p className="mt-1 text-sm text-slate-600">Review corporate requirements, candidate applications, and filled placements.</p>
        </div>
        <button
          onClick={refetch}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand/30"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <GlassPanel className="p-4 md:p-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by job title or company..."
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand"
          />
        </div>
      </GlassPanel>

      <GlassPanel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap min-w-[850px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Job Details</th>
                <th className="px-4 py-3">Vacancies Filled</th>
                <th className="px-4 py-3">Total Applicants</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-slate-500">
                    No jobs found.
                  </td>
                </tr>
              ) : (
                filtered.map((j) => (
                  <tr key={j._id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {j.enterpriseId?.enterpriseProfile?.companyName || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">{j.jobTitle}</p>
                      <p className="text-xs text-slate-500">₹{j.salary} / {j.salaryType}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-extrabold text-slate-900">
                        {j.acceptedCount || 0} / {j.numberOfWorkers} Filled
                      </p>
                      <p className="text-xs font-bold text-emerald-600">
                        {j.joinedCount || 0} Joined Workforce
                      </p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-full text-xs font-bold text-slate-800">
                        <Users className="h-3 w-3 text-slate-500" /> {j.totalApplications || 0} Applied
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                          j.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : j.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {j.status}
                      </span>
                      {j.isLive && (
                        <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] rounded-full">
                          Live
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {j.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              openDialog({
                                title: 'Approve Job?',
                                description: 'This will make the job live on the Labour App.',
                                confirmText: 'Approve',
                                onConfirm: () => handleAction(j._id, 'approved', true),
                              })
                            }
                            className="text-emerald-600 bg-emerald-50 px-3 py-1 rounded-md text-xs font-bold hover:bg-emerald-100"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() =>
                              openDialog({
                                title: 'Reject Job?',
                                description: 'Provide a reason for rejection.',
                                confirmText: 'Reject',
                                requireReason: true,
                                isDestructive: true,
                                onConfirm: ({ reason }) => handleAction(j._id, 'rejected', false, reason),
                              })
                            }
                            className="text-rose-600 bg-rose-50 px-3 py-1 rounded-md text-xs font-bold hover:bg-rose-100"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>
  )
}
