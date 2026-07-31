import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, Wallet, Plus, ArrowRight, LifeBuoy, FileText } from 'lucide-react'

export function CompanyOverview({ companyName, date, time }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#111827] tracking-tight flex items-center gap-2">
        Welcome, {companyName || 'Enterprise Client'} <CheckCircle2 className="w-5 h-5 text-blue-500 fill-blue-500/20 mt-1" />
      </h1>
      <p className="text-[12px] sm:text-[13px] font-bold text-slate-500 uppercase tracking-widest">
        {date} | {time}
      </p>
    </div>
  )
}

export function QuickActionsRow() {
  const navigate = useNavigate()
  return (
    <div>
      <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">Quick Actions</h3>
      <div className="flex items-center gap-3 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 hide-scrollbar">
        <Link to="/enterprise/jobs/new" className="flex items-center gap-2 shrink-0 bg-[#FFC107] hover:bg-[#e0a800] text-[#111827] text-[14px] font-extrabold px-6 py-3.5 rounded-[16px] shadow-sm transition-transform active:scale-95">
          <Plus className="w-5 h-5" />
          Create Job
        </Link>
        <button
          onClick={() => navigate('/app/enterprise/wallet')}
          className="flex items-center gap-2 shrink-0 bg-[#111827] hover:bg-slate-800 text-white text-[14px] font-extrabold px-6 py-3.5 rounded-[16px] shadow-sm transition-transform active:scale-95 cursor-pointer"
        >
          <Wallet className="w-5 h-5 text-slate-400" />
          Recharge Wallet
        </button>
        <button
          onClick={() => navigate('/app/enterprise/wallet')}
          className="flex items-center gap-2 shrink-0 bg-white border border-[#E5E7EB] hover:border-slate-300 hover:bg-slate-50 text-[#111827] text-[14px] font-extrabold px-6 py-3.5 rounded-[16px] shadow-[0_2px_10px_rgb(0,0,0,0.02)] transition-all active:scale-95 cursor-pointer"
        >
          <FileText className="w-5 h-5 text-slate-400" />
          Financial Statement
        </button>
      </div>
    </div>
  )
}

export function WalletOverview({ walletBalance = 0 }) {
  const navigate = useNavigate()
  return (
    <div className="bg-white p-5 rounded-[24px] border border-[#E5E7EB] flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-[18px] h-[18px] text-slate-400" />
          <h3 className="text-[12px] font-extrabold text-slate-500 uppercase tracking-widest">Enterprise Wallet</h3>
        </div>
        <span className="text-[11px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">Active</span>
      </div>
      <div>
        <div className="text-[32px] font-black text-[#111827] tracking-tight leading-none">
          ₹{(walletBalance || 0).toLocaleString('en-IN')}
        </div>
        <p className="text-[13px] font-medium text-slate-500 mt-1">Available wallet balance for bulk hiring</p>
      </div>
      <button
        onClick={() => navigate('/enterprise/wallet')}
        className="mt-6 w-full flex items-center justify-center gap-2 bg-[#F8FAFC] hover:bg-slate-100 border border-[#E5E7EB] text-[#111827] text-[13px] font-extrabold py-3 rounded-[12px] transition-colors cursor-pointer"
      >
        Recharge Account
      </button>
    </div>
  )
}

export function SupportWidget() {
  return (
    <div className="bg-[#111827] text-white p-5 rounded-[24px] shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-md">
          <LifeBuoy className="w-5 h-5 text-[#FFC107]" />
        </div>
        <div>
          <h3 className="text-[15px] font-extrabold">Need Assistance?</h3>
          <p className="text-[12px] text-slate-300 font-medium">Your Account Manager is online.</p>
        </div>
      </div>
      <button className="w-full mt-2 bg-[#FFC107] hover:bg-[#e0a800] text-[#111827] text-[13px] font-extrabold py-3 rounded-[12px] transition-colors active:scale-95">
        Contact Support
      </button>
    </div>
  )
}
