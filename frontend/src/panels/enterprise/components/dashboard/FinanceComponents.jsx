import React from 'react'
import { Banknote, Download, CheckCircle2, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function PayrollStatusCard({ kpis = {} }) {
  const navigate = useNavigate()
  const pendingAmount = kpis.pendingInvoicesAmount || 0
  const totalSpent = kpis.totalSpent || 0
  const pendingCount = kpis.pendingInvoicesCount || 0

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[24px] shadow-lg p-5 sm:p-6 text-white relative overflow-hidden">
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
      
      <div className="flex items-center justify-between mb-6 relative z-10">
        <h2 className="text-[16px] font-extrabold flex items-center gap-2">
          <Banknote className="w-5 h-5 text-[#FFC107]" /> Joining Invoice Status
        </h2>
        {pendingCount > 0 && (
          <span className="bg-rose-500/80 text-white text-[11px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
            {pendingCount} Pending
          </span>
        )}
        {pendingCount === 0 && (
          <span className="bg-white/20 text-white text-[11px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
            All Clear
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pending Amount</p>
          <p className="text-[22px] font-black leading-none">₹{pendingAmount.toLocaleString('en-IN')}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Spent</p>
          <p className="text-[22px] font-black leading-none flex items-center gap-1">
            ₹{totalSpent.toLocaleString('en-IN')} <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 relative z-10">
        <button
          onClick={() => navigate('/enterprise/wallet')}
          className="text-[12px] font-extrabold text-indigo-600 hover:text-indigo-700"
        >
          Manage Wallet →
        </button>
      </div>

      <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Enterprise Wallet</span>
          <button
            onClick={() => navigate('/enterprise/wallet')}
            className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
          >
            Recharge <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
