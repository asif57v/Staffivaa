import React from 'react'
import { Wallet, Info, CalendarClock, IndianRupee } from 'lucide-react'
import { AppSurface } from '../app-ui/cards/AppSurface.jsx'
import { useGetLabourEarningsQuery } from '../../store/api/payrollApi.js'

export function LabourProjectEarningsCard({ projectId }) {
  const { data, isLoading } = useGetLabourEarningsQuery(projectId, { skip: !projectId })

  if (isLoading) {
    return (
      <AppSurface className="animate-pulse">
        <div className="h-24 bg-slate-100 rounded-xl"></div>
      </AppSurface>
    )
  }

  if (!data?.summary) return null

  const { dailyRate, accruedAmount, pendingAmount, paidAmount, nextPayoutDate } = data.summary

  return (
    <AppSurface className="bg-gradient-to-br from-brand/10 to-transparent border-brand/20 relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-brand" />
          <h3 className="text-sm font-bold text-slate-900">Your Earnings</h3>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Daily Rate</span>
          <span className="text-sm font-black text-slate-900 flex items-center">
            <IndianRupee className="w-3.5 h-3.5 mr-0.5" />{dailyRate}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white p-3 rounded-xl border border-slate-100">
          <span className="text-[10px] font-bold text-slate-500 block mb-1">Accrued (Unpaid)</span>
          <span className="text-lg font-black text-brand">₹{accruedAmount + pendingAmount}</span>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-100">
          <span className="text-[10px] font-bold text-slate-500 block mb-1">Total Paid</span>
          <span className="text-lg font-black text-emerald-600">₹{paidAmount}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-brand/5 p-2 rounded-lg">
        <CalendarClock className="w-4 h-4 text-brand/70 shrink-0" />
        <span>Next expected payout: {new Date(nextPayoutDate).toLocaleDateString()}</span>
      </div>
    </AppSurface>
  )
}
