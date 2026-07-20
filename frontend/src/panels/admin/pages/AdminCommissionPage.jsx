import React, { useState } from 'react'
import { Percent, CheckCircle2, Clock, AlertTriangle, MoreVertical, X, Check } from 'lucide-react'
import { useGetAdminCommissionsQuery, useMarkCommissionPaidOfflineMutation, useWaiveCommissionMutation } from '../../../store/api/commissionApi'
import { toast } from 'react-hot-toast'

const AdminCommissionPage = () => {
  const [filter, setFilter] = useState('all') // 'all', 'pending_payment', 'paid', 'overdue', 'waived'
  
  const { data: response, isLoading, refetch } = useGetAdminCommissionsQuery(
    filter !== 'all' ? { status: filter } : {}
  )
  
  const [markPaid, { isLoading: isMarking }] = useMarkCommissionPaidOfflineMutation()
  const [waive, { isLoading: isWaiving }] = useWaiveCommissionMutation()

  const commissions = response?.data?.commissions || []

  const handleMarkPaid = async (id) => {
    if (!window.confirm('Are you sure you want to mark this commission as paid manually?')) return
    try {
      await markPaid({ id, data: { transactionId: 'offline_payment', notes: 'Marked paid by Admin' } }).unwrap()
      toast.success('Marked as paid')
      refetch()
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to mark as paid')
    }
  }

  const handleWaive = async (id) => {
    if (!window.confirm('Are you sure you want to waive this commission?')) return
    try {
      await waive({ id, data: { notes: 'Waived by Admin' } }).unwrap()
      toast.success('Commission waived')
      refetch()
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to waive')
    }
  }

  const getStatusBadge = (status) => {
    switch(status) {
      case 'paid': return <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase flex items-center gap-1 w-max"><CheckCircle2 className="h-3 w-3" /> Paid</span>
      case 'overdue': return <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-black uppercase flex items-center gap-1 w-max"><AlertTriangle className="h-3 w-3" /> Overdue</span>
      case 'waived': return <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-black uppercase flex items-center gap-1 w-max"><CheckCircle2 className="h-3 w-3" /> Waived</span>
      default: return <span className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full text-[10px] font-black uppercase flex items-center gap-1 w-max"><Clock className="h-3 w-3" /> Pending</span>
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Percent className="h-7 w-7 text-[#f5b800]" />
            Success Commissions
          </h1>
          <p className="text-sm text-slate-500 mt-2 font-medium">Manage and track all vendor success commissions.</p>
        </div>
        
        <select 
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#f5b800]"
        >
          <option value="all">All Statuses</option>
          <option value="pending_payment">Pending</option>
          <option value="overdue">Overdue</option>
          <option value="paid">Paid</option>
          <option value="waived">Waived</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-[24px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Project / Client</th>
                <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Vendor</th>
                <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Quote Amt</th>
                <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Commission</th>
                <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-500 font-medium">Loading commissions...</td>
                </tr>
              ) : commissions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-slate-500">
                    <div className="flex flex-col items-center">
                      <Percent className="h-8 w-8 text-slate-300 mb-3" />
                      <p className="font-bold text-slate-700 text-lg">No Commissions Found</p>
                      <p className="text-sm mt-1">Try changing the filter or wait for new commissions to be generated.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                commissions.map((comm) => (
                  <tr key={comm._id} className="hover:bg-slate-50 transition">
                    <td className="p-4">
                      <div className="font-bold text-slate-900 text-sm">{comm.requestId?.reference || 'N/A'}</div>
                      <div className="text-xs text-slate-500 mt-1">{comm.clientId?.companyName || comm.clientId?.fullName}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800 text-sm">{comm.vendorId?.companyName || comm.vendorId?.fullName}</div>
                      <div className="text-xs text-slate-500 mt-1">{comm.vendorId?.phone}</div>
                    </td>
                    <td className="p-4 text-sm font-bold text-slate-700">
                      ₹{comm.quotationAmount?.toLocaleString()}
                    </td>
                    <td className="p-4">
                      <div className="font-black text-slate-900 text-sm">₹{comm.commissionAmount?.toLocaleString()}</div>
                      <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
                        {comm.commissionType === 'percentage' ? `${comm.commissionValue}%` : 'Fixed'}
                      </div>
                    </td>
                    <td className="p-4">
                      {getStatusBadge(comm.status)}
                      {(comm.status === 'pending_payment' || comm.status === 'overdue') && (
                        <div className="text-[10px] text-slate-500 mt-1 font-medium">Due: {new Date(comm.dueDate).toLocaleDateString()}</div>
                      )}
                    </td>
                    <td className="p-4">
                      {(comm.status === 'pending_payment' || comm.status === 'overdue') && (
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleMarkPaid(comm._id)}
                            disabled={isMarking || isWaiving}
                            className="p-1.5 bg-green-50 text-green-700 rounded hover:bg-green-100 transition"
                            title="Mark as Paid (Offline)"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleWaive(comm._id)}
                            disabled={isMarking || isWaiving}
                            className="p-1.5 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition"
                            title="Waive Commission"
                          >
                            <X className="h-4 w-4" />
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
      </div>
    </div>
  )
}

export default AdminCommissionPage
