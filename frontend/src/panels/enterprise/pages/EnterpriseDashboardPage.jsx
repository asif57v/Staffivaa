import React, { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useGetEnterpriseSecuritySettingsQuery, useGetEnterpriseDashboardOverviewQuery } from '../../../store/api/enterpriseApi.js'
import { ShieldAlert, Plus } from 'lucide-react'
import { CompanyOverview, QuickActionsRow, WalletOverview, SupportWidget } from './../components/dashboard/OverviewComponents.jsx'
import { KpiGrid, WorkforceStatus, AttendanceSummary } from './../components/dashboard/KpiComponents.jsx'
import { ActiveProjectsList, ProjectPerformance } from './../components/dashboard/ProjectComponents.jsx'
import { RecruitmentPipeline, PendingApprovalsList, UpcomingJoining } from './../components/dashboard/RecruitmentComponents.jsx'
import { PayrollStatusCard } from './../components/dashboard/FinanceComponents.jsx'
import { DashboardAnalytics } from './../components/dashboard/AnalyticsComponents.jsx'
import { ActivityTimeline, NotificationCenter, RecentReports } from './../components/dashboard/SystemComponents.jsx'

export function EnterpriseDashboardPage() {
  const navigate = useNavigate()

  // Security & wallet threshold checks
  const { data: securityResponse } = useGetEnterpriseSecuritySettingsQuery()
  const securityInfo = securityResponse?.data || {}

  // Real-time dashboard overview from backend
  const { data: overviewResponse } = useGetEnterpriseDashboardOverviewQuery()
  const overview = overviewResponse?.data || {}
  const kpis = overview.kpis || {}
  const pipeline = overview.pipeline || {}
  const recentApplications = overview.recentApplications || []
  const upcomingJoinings = overview.upcomingJoinings || []
  const profile = overview.profile || {}

  const currentDate = useMemo(() => {
    const d = new Date()
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }, [])

  const currentTime = useMemo(() => {
    const d = new Date()
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }, [])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-8 pb-32 lg:pb-12">

      {/* 1. Header — Company name from real profile */}
      <CompanyOverview companyName={profile.companyName} date={currentDate} time={currentTime} />

      {/* Payment Overdue Warning Banner */}
      {securityInfo.isPaymentOverdueRestricted && (
        <div className="p-4 sm:p-5 bg-rose-50 border border-rose-200 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs shadow-xs">
          <div className="flex items-center gap-3 text-rose-950 font-medium">
            <div className="h-10 w-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-6 w-6 text-rose-600" />
            </div>
            <div>
              <p className="font-extrabold text-rose-950 text-sm">Payment Overdue — Hiring Restricted</p>
              <p className="text-rose-800 mt-0.5">
                {securityInfo.overdueMessage || 'Please clear your outstanding joining invoice to continue hiring on Staffivaa.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/enterprise/wallet')}
            className="shrink-0 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            Pay Invoice Now
          </button>
        </div>
      )}

      {/* Security Wallet Balance Warning Banner */}
      {securityInfo.isEnabled && !securityInfo.isSufficient && (
        <div className="p-4 sm:p-5 bg-amber-50 border border-amber-200 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs shadow-xs">
          <div className="flex items-center gap-3 text-amber-950 font-medium">
            <div className="h-10 w-10 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="font-extrabold text-amber-950 text-sm">Security Wallet Balance Below Required Minimum</p>
              <p className="text-amber-800 mt-0.5">
                Your wallet balance (₹{securityInfo.currentBalance?.toLocaleString('en-IN')}) is below the required minimum of ₹{securityInfo.requiredBalance?.toLocaleString('en-IN')}. Please recharge ₹{securityInfo.difference?.toLocaleString('en-IN')} to continue creating new jobs.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/enterprise/wallet')}
            className="shrink-0 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Recharge Wallet
          </button>
        </div>
      )}

      {/* 2. KPI Grid — Real DB data: Active Workforce, Active Jobs, Applicants, Wallet Balance */}
      <KpiGrid kpis={kpis} />

      {/* 3. Quick Actions */}
      <QuickActionsRow />

      {/* Grid Row 1: Active Jobs & Workforce Capacity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActiveProjectsList />
        <div className="flex flex-col gap-6">
          <WorkforceStatus kpis={kpis} />
          <AttendanceSummary pipeline={pipeline} />
        </div>
      </div>

      {/* Grid Row 2: Recruitment Pipeline, Recent Applications, Upcoming Joinings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <RecruitmentPipeline pipeline={pipeline} />
          <PendingApprovalsList applications={recentApplications} />
        </div>
        <div className="flex flex-col gap-6">
          <UpcomingJoining upcomingList={upcomingJoinings} />
          <ProjectPerformance />
        </div>
      </div>

      {/* Grid Row 3: Invoice Finance Card & Enterprise Wallet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PayrollStatusCard kpis={kpis} />
        <WalletOverview walletBalance={kpis.walletBalance} />
      </div>

      {/* Grid Row 4: Analytics Charts */}
      <DashboardAnalytics />

      {/* Grid Row 5: Recent Activity Timeline, Smart Alerts, Quick Links, Support */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActivityTimeline recentApplications={recentApplications} />
        </div>
        <div className="flex flex-col gap-6">
          <NotificationCenter kpis={{ ...kpis, pipeline }} />
          <RecentReports />
          <SupportWidget />
        </div>
      </div>

      {/* Footer */}
      <div className="pt-8 flex flex-col items-center justify-center gap-2 opacity-50">
        <p className="text-[11px] font-bold text-slate-500">© 2026 Staffivaa Workforce OS</p>
        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 tracking-widest uppercase">
          <Link to="#">Privacy</Link>
          <span>•</span>
          <Link to="#">Terms</Link>
          <span>•</span>
          <Link to="#">Compliance</Link>
        </div>
      </div>

    </div>
  )
}
