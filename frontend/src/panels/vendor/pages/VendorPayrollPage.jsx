import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, ChevronRight, Clock, AlertCircle } from 'lucide-react'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { useAuth } from '../../../hooks/useAuth.js'
import { useGetWalletBalanceQuery } from '../../../store/api/walletApi.js'
import { useGetVendorBatchesQuery, useApproveBatchMutation } from '../../../store/api/payrollApi.js'
import toast from 'react-hot-toast'

export function VendorPayrollPage() {
  const { data: walletData } = useGetWalletBalanceQuery()
  const { data: batchesData, isLoading, refetch } = useGetVendorBatchesQuery()
  const [approveBatch, { isLoading: isApproving }] = useApproveBatchMutation()
  
  const vendorBalance = walletData?.walletBalance || 0
  const batches = batchesData?.batches || []

  const handleApprove = async (batchId, amount) => {
    if (vendorBalance < amount) {
      toast.error('Insufficient wallet balance to process this payroll batch.')
      return
    }
    
    try {
      await approveBatch(batchId).unwrap()
      toast.success('Payroll batch approved successfully. Funds transferred to labour.')
      refetch()
    } catch (error) {
      toast.error(error?.data?.message || 'Failed to approve batch.')
    }
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <Link to="/vendor" className="inline-flex items-center gap-2 text-sm font-bold text-brand">
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Link>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Payroll Approvals</h2>
          <p className="text-xs font-semibold text-slate-500">Approve wages for your crew</p>
        </div>
      </div>

      <AppSurface className="bg-brand text-white border-none relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Clock className="w-24 h-24" />
        </div>
        <div className="relative z-10">
          <p className="text-sm font-medium text-white/80">Available Wallet Balance</p>
          <h3 className="text-2xl font-black mt-1">₹{vendorBalance.toLocaleString()}</h3>
          <p className="text-xs text-white/70 mt-2">Ensure sufficient balance before approving payrolls.</p>
        </div>
      </AppSurface>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading payroll batches...</p>
      ) : batches.length === 0 ? (
        <AppSurface className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 border-dashed">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
          <h3 className="text-sm font-bold text-slate-900">All Caught Up!</h3>
          <p className="text-xs text-slate-500 mt-1">There are no pending payroll batches to approve.</p>
        </AppSurface>
      ) : (
        <div className="space-y-4">
          {batches.map((batch) => (
            <AppSurface key={batch._id} className="flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {batch.labourId?.firstName} {batch.labourId?.lastName}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Period: {new Date(batch.periodStart).toLocaleDateString()} - {new Date(batch.periodEnd).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-brand">₹{batch.totalAmount}</span>
                  <div className={`mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block ${
                    batch.status === 'pending_approval' ? 'bg-amber-100 text-amber-700' :
                    batch.status === 'insufficient_funds' ? 'bg-rose-100 text-rose-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {batch.status.replace('_', ' ')}
                  </div>
                </div>
              </div>

              {(batch.status === 'pending_approval' || batch.status === 'insufficient_funds') && (
                <div className="pt-3 border-t border-slate-100">
                  {batch.status === 'insufficient_funds' && (
                    <div className="flex items-center gap-2 text-rose-600 bg-rose-50 p-2 rounded-lg mb-3">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <p className="text-[11px] font-semibold">Insufficient funds to approve this batch.</p>
                    </div>
                  )}
                  <AppPrimaryButton
                    onClick={() => handleApprove(batch._id, batch.totalAmount)}
                    disabled={isApproving || vendorBalance < batch.totalAmount}
                    className="w-full"
                  >
                    Approve & Transfer ₹{batch.totalAmount}
                  </AppPrimaryButton>
                </div>
              )}
            </AppSurface>
          ))}
        </div>
      )}
    </div>
  )
}
