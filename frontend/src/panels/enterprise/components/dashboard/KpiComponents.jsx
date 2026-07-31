import React from 'react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { Users, Briefcase, UserCheck, Banknote, Users2, Clock, CheckCircle2, AlertCircle } from 'lucide-react'

export function SparklineCard({ title, value, icon: Icon, trendLabel, trendColor, sparklineColor, sparklineData, strokeWidth = 2 }) {
  return (
    <div className="bg-white p-5 rounded-[24px] border border-[#E5E7EB] flex flex-col relative overflow-hidden transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-0.5 group">
      <div className="flex items-start justify-between mb-4">
        <Icon className="w-[18px] h-[18px] text-slate-400" />
        <span className={`text-[11px] font-extrabold ${trendColor}`}>{trendLabel}</span>
      </div>
      
      <div>
        <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">{title}</h3>
        <div className="text-[28px] font-extrabold text-[#111827] tracking-tight leading-none">{value}</div>
      </div>

      <div className="mt-6 h-12 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparklineData}>
            <defs>
              <linearGradient id={`grad_${title.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={sparklineColor} stopOpacity={0.2}/>
                <stop offset="95%" stopColor={sparklineColor} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={sparklineColor} 
              strokeWidth={strokeWidth} 
              fill={`url(#grad_${title.replace(/\s+/g, '')})`} 
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function KpiGrid({ kpis = {} }) {
  const genSparkline = (points, baseVal) => {
    const val = baseVal || 10
    return Array.from({ length: points }, () => ({
      value: Math.max(1, val + Math.floor(Math.random() * 5 - 2)),
    }))
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      <SparklineCard 
        title="Active Workforce" 
        value={(kpis.activeWorkforceCount || 0).toLocaleString('en-IN')} 
        icon={Users} 
        trendLabel="Real-time" 
        trendColor="text-emerald-500" 
        sparklineColor="#10B981" 
        sparklineData={genSparkline(8, kpis.activeWorkforceCount || 1)} 
      />
      <SparklineCard 
        title="Active Jobs" 
        value={(kpis.activeJobsCount || 0).toLocaleString('en-IN')} 
        icon={Briefcase} 
        trendLabel={`${kpis.totalJobsCount || 0} Total`} 
        trendColor="text-[#F59E0B]" 
        sparklineColor="#F59E0B" 
        sparklineData={genSparkline(8, kpis.activeJobsCount || 1)} 
      />
      <SparklineCard 
        title="Total Applicants" 
        value={(kpis.totalApplicantsCount || 0).toLocaleString('en-IN')} 
        icon={UserCheck} 
        trendLabel="Candidates" 
        trendColor="text-[#3B82F6]" 
        sparklineColor="#3B82F6" 
        sparklineData={genSparkline(8, kpis.totalApplicantsCount || 1)} 
      />
      <SparklineCard 
        title="Enterprise Wallet" 
        value={`₹${(kpis.walletBalance || 0).toLocaleString('en-IN')}`} 
        icon={Banknote} 
        trendLabel="Available" 
        trendColor="text-emerald-600" 
        sparklineColor="#10B981" 
        sparklineData={genSparkline(8, kpis.walletBalance || 1000)} 
      />
    </div>
  )
}

export function WorkforceStatus({ kpis = {} }) {
  const activeCount = kpis.activeWorkforceCount || 0
  const vacancies = kpis.totalVacancies || 1
  const percentage = Math.min(100, Math.round((activeCount / Math.max(1, vacancies)) * 100))

  return (
    <div className="bg-white p-5 rounded-[24px] border border-[#E5E7EB] flex flex-col justify-between">
      <div className="flex items-center gap-2 mb-4">
        <Users2 className="w-[18px] h-[18px] text-slate-400" />
        <h3 className="text-[12px] font-extrabold text-slate-500 uppercase tracking-widest">Workforce Capacity</h3>
      </div>
      <div className="flex justify-between items-end mb-3">
        <div>
          <div className="text-[32px] font-black text-[#111827] tracking-tight leading-none">{percentage}%</div>
          <p className="text-[13px] font-medium text-slate-500 mt-1">Total Filled Capacity</p>
        </div>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
        <div className="bg-[#FFC107] h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
      </div>
      <div className="flex justify-between mt-3">
        <span className="text-[11px] font-bold text-slate-500">{activeCount} Deployed</span>
        <span className="text-[11px] font-bold text-slate-400">{vacancies} Total Vacancies</span>
      </div>
    </div>
  )
}

export function AttendanceSummary({ pipeline = {} }) {
  const shortlisted = pipeline.shortlistedCount || 0
  const interviewScheduled = pipeline.interviewScheduledCount || 0
  const offerSent = pipeline.offerSentCount || 0
  const pendingPayment = pipeline.pendingJoiningPaymentCount || 0

  return (
    <div className="bg-white p-5 rounded-[24px] border border-[#E5E7EB] flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Clock className="w-[18px] h-[18px] text-slate-400" />
          <h3 className="text-[12px] font-extrabold text-slate-500 uppercase tracking-widest">Candidate Stages</h3>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-[#F8FAFC] p-4 rounded-[16px] border border-[#E5E7EB]">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 uppercase tracking-wide mb-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Shortlisted
          </span>
          <span className="text-[24px] font-black text-[#111827]">{shortlisted}</span>
        </div>
        <div className="bg-[#F8FAFC] p-4 rounded-[16px] border border-[#E5E7EB]">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-purple-600 uppercase tracking-wide mb-1">
            <AlertCircle className="w-3.5 h-3.5" /> Interview
          </span>
          <span className="text-[24px] font-black text-[#111827]">{interviewScheduled}</span>
        </div>
      </div>

      <div className="flex items-center justify-between px-2 text-[12px] font-bold text-slate-500">
        <span>Offered: <strong className="text-emerald-500">{offerSent}</strong></span>
        <span>Pending Payment: <strong className="text-rose-500">{pendingPayment}</strong></span>
      </div>
    </div>
  )
}

