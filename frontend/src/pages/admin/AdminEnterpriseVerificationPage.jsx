import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, RefreshCw, Search } from 'lucide-react'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { useGetAdminEnterpriseCompaniesQuery, useUpdateAdminEnterpriseCompanyStatusMutation } from '../../store/api/adminEnterpriseApi.js'
import { ACCOUNT_STATUSES } from '../../constants/userStatuses.js'
import { ENTERPRISE_STATUS } from '../../constants/userRoles.js'
import { AdminConfirmActionDialog } from '../../components/admin/AdminConfirmActionDialog.jsx'

export function AdminEnterpriseVerificationPage() {
  const [searchInput, setSearchInput] = useState('')
  const [filter, setFilter] = useState('all')
  const [dialogConfig, setDialogConfig] = useState({ isOpen: false })
  
  const { data: response, isLoading, isError, refetch } = useGetAdminEnterpriseCompaniesQuery()
  const [updateStatus, { isLoading: isUpdating }] = useUpdateAdminEnterpriseCompanyStatusMutation()
  
  const companies = response?.data || []
  
  const filtered = companies.filter(c => {
    if (filter !== 'all' && c.enterpriseProfile?.status !== filter) return false
    if (searchInput) {
      const lower = searchInput.toLowerCase()
      return c.enterpriseProfile?.companyName?.toLowerCase().includes(lower) || c.email?.toLowerCase().includes(lower) || c.phone?.includes(searchInput)
    }
    return true
  })

  const openDialog = (config) => setDialogConfig({ isOpen: true, ...config })
  const closeDialog = () => setDialogConfig({ isOpen: false })

  const handleAction = async (id, status, reviewNote = '') => {
    try {
      await updateStatus({ id, status, reviewNote }).unwrap()
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
          <h2 className="text-lg font-extrabold text-slate-900 md:text-xl">Enterprise Verification</h2>
          <p className="mt-1 text-sm text-slate-600">Review and approve Staffivaa Enterprise accounts.</p>
        </div>
        <button onClick={refetch} disabled={isLoading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand/30">
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <GlassPanel className="p-4 md:p-5">
        <div className="flex items-center gap-3 w-full">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Company name, email, phone..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand" />
            </div>
          </div>
          <div className="w-56">
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand">
              <option value="all">All Statuses</option>
              <option value={ENTERPRISE_STATUS.PENDING}>Pending</option>
              <option value={ENTERPRISE_STATUS.APPROVED}>Approved</option>
              <option value={ENTERPRISE_STATUS.REJECTED}>Rejected</option>
            </select>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Company Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="4" className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="4" className="px-4 py-8 text-center text-slate-500">No enterprise accounts found.</td></tr>
              ) : (
                filtered.map(u => (
                  <tr key={u._id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{u.enterpriseProfile?.companyName || '—'}</p>
                      <p className="text-xs text-slate-500">GST: {u.enterpriseProfile?.gstNumber || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{u.fullName || '—'}</p>
                      <p className="text-xs text-slate-500">+91 {u.phone} | {u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                        u.enterpriseProfile?.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                        u.enterpriseProfile?.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {u.enterpriseProfile?.status || 'pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.enterpriseProfile?.status === 'pending' && (
                        <div className="flex gap-2">
                          <button onClick={() => openDialog({
                            title: 'Approve Enterprise?',
                            description: 'This will allow the company to post jobs and hire workers.',
                            confirmText: 'Approve',
                            onConfirm: () => handleAction(u._id, ENTERPRISE_STATUS.APPROVED)
                          })} className="text-emerald-600 bg-emerald-50 px-3 py-1 rounded-md text-xs font-bold hover:bg-emerald-100">
                            Approve
                          </button>
                          <button onClick={() => openDialog({
                            title: 'Reject Enterprise?',
                            description: 'Provide a reason for rejection.',
                            confirmText: 'Reject',
                            requireReason: true,
                            isDestructive: true,
                            onConfirm: ({ reason }) => handleAction(u._id, ENTERPRISE_STATUS.REJECTED, reason)
                          })} className="text-rose-600 bg-rose-50 px-3 py-1 rounded-md text-xs font-bold hover:bg-rose-100">
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
