import { useState } from 'react'
import {
  useGetRefundRequestsQuery,
  useApproveRefundRequestMutation,
  useRejectRefundRequestMutation,
} from '../../../store/api/adminWalletApi'
import { CheckCircle2, XCircle, Clock, Search, Filter, AlertCircle, RefreshCw, Eye } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { AdminConfirmActionDialog } from '../../../components/admin/AdminConfirmActionDialog.jsx'

export function AdminRefundsPage() {
  console.log("AdminRefundsPage mounted!")
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [confirmDialog, setConfirmDialog] = useState(null)

  const { data, isLoading, refetch } = useGetRefundRequestsQuery({
    page,
    status: statusFilter,
  })
  
  const [approveRefund, { isLoading: isApproving }] = useApproveRefundRequestMutation()
  const [rejectRefund, { isLoading: isRejecting }] = useRejectRefundRequestMutation()

  const refunds = data?.data?.refunds || []
  const total = data?.data?.pagination?.total || 0
  const totalPages = data?.data?.pagination?.pages || 1

  const handleApprove = async (id) => {
    try {
      await approveRefund(id).unwrap()
      toast.success('Refund approved and credited successfully')
      setConfirmDialog(null)
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to approve refund')
    }
  }

  const handleReject = async (id, note) => {
    try {
      await rejectRefund({ id, adminNote: note }).unwrap()
      toast.success('Refund rejected successfully')
      setConfirmDialog(null)
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to reject refund')
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'ELIGIBLE': return 'bg-gray-100 text-gray-700'
      case 'PENDING': return 'bg-amber-50 text-amber-600 border-amber-200'
      case 'APPROVED': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'REJECTED': return 'bg-rose-50 text-rose-700 border-rose-200'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <>
      <div className="w-full space-y-6 pb-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Refund Requests</h1>
            <p className="text-sm text-slate-500 mt-1">Manage manual platform fee refunds from cancelled bookings.</p>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand w-full sm:w-auto"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending Admin Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="ELIGIBLE">Eligible (Not requested yet)</option>
            </select>
            <button
              onClick={refetch}
              className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600"
              title="Refresh"
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date & Time</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Booking / User</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex justify-center mb-2">
                        <RefreshCw className="animate-spin text-brand" size={24} />
                      </div>
                      Loading refund requests...
                    </td>
                  </tr>
                ) : refunds.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-3">
                        <Filter size={24} className="text-slate-400" />
                      </div>
                      <p>No refund requests found.</p>
                    </td>
                  </tr>
                ) : (
                  refunds.map(refund => (
                    <tr key={refund._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {new Date(refund.createdAt).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'})}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-brand">
                          #{refund.bookingId?.reference || refund.bookingId?._id?.substring(0, 8)}
                        </div>
                        <div className="text-sm text-slate-900 mt-0.5">
                          {refund.userId?.fullName} <span className="text-xs text-slate-500 capitalize">({refund.userRole})</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Phone: {refund.userId?.phone}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-slate-900">
                          ₹{refund.amount}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate max-w-[150px]" title={refund.cancellationReason}>
                          {refund.cancellationReason}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(refund.status)}`}>
                          {refund.status === 'APPROVED' && <CheckCircle2 size={12} className="mr-1" />}
                          {refund.status === 'REJECTED' && <XCircle size={12} className="mr-1" />}
                          {refund.status === 'PENDING' && <Clock size={12} className="mr-1" />}
                          {refund.status}
                        </span>
                        {refund.adminNote && (
                          <div className="text-[10px] text-slate-500 mt-1 max-w-[120px] truncate" title={refund.adminNote}>
                            Note: {refund.adminNote}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {refund.status === 'PENDING' && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setConfirmDialog({ type: 'approve', refund })}
                              className="px-3 py-1.5 bg-brand text-slate-900 text-xs font-bold rounded hover:bg-brand/90 transition-colors"
                              disabled={isApproving || isRejecting}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setConfirmDialog({ type: 'reject', refund })}
                              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded hover:bg-slate-50 transition-colors"
                              disabled={isApproving || isRejecting}
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
          
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm text-slate-500">
                Showing page <span className="font-semibold text-slate-900">{page}</span> of <span className="font-semibold text-slate-900">{totalPages}</span>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-slate-200 rounded text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border border-slate-200 rounded text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AdminConfirmActionDialog
        isOpen={!!confirmDialog}
        onClose={() => setConfirmDialog(null)}
        title={confirmDialog?.type === 'approve' ? 'Approve Refund' : 'Reject Refund'}
        description={
          confirmDialog?.type === 'approve' 
            ? `Are you sure you want to approve this refund of ₹${confirmDialog?.refund?.amount}? This will initiate a payout via Razorpay.`
            : 'Please provide a reason for rejecting this refund request. The money will be forfeited to the platform.'
        }
        type={confirmDialog?.type === 'approve' ? 'danger' : 'warning'}
        confirmText={confirmDialog?.type === 'approve' ? 'Pay via Razorpay' : 'Reject Refund'}
        requireReason={confirmDialog?.type === 'reject'}
        onConfirm={async (reason) => {
          if (confirmDialog.type === 'approve') {
            await handleApprove(confirmDialog.refund._id)
          } else {
            await handleReject(confirmDialog.refund._id, reason)
          }
        }}
        isLoading={isApproving || isRejecting}
      />
    </>
  )
}
