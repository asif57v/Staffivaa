import { BarChart3, Building2, ClipboardList, Clock, FileText } from 'lucide-react'
import { CORPORATE_STATUS } from '../../../constants/userRoles.js'
import { ApprovalGate } from '../../../components/shared/ApprovalGate.jsx'
import { OpsStatCard } from '../../../components/shared/OpsStatCard.jsx'
import { useAuth } from '../../../hooks/useAuth.js'
import { useGetCorporateDashboardQuery } from '../../../store/api/workforceApi.js'

export function CorporateAnalyticsPage() {
  const { user } = useAuth()
  const approved = user?.corporateProfile?.status === CORPORATE_STATUS.APPROVED
  const { data, isLoading } = useGetCorporateDashboardQuery(undefined, { skip: !approved })

  if (!approved) {
    return (
      <ApprovalGate
        title="Analytics locked"
        message="Complete corporate verification to view deployment and billing analytics."
        profileTo="/corporate/profile"
      />
    )
  }

  const stats = data?.stats || {}

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Insights</p>
        <h2 className="text-lg font-extrabold text-slate-900">Analytics</h2>
        <p className="mt-1 text-sm text-slate-600">Executive snapshot from your corporate dashboard.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <OpsStatCard
          label="Active projects"
          value={isLoading ? '—' : stats.activeProjects ?? 0}
          icon={Building2}
          tone="brand"
        />
        <OpsStatCard
          label="Open requests"
          value={isLoading ? '—' : stats.openRequests ?? 0}
          icon={ClipboardList}
        />
        <OpsStatCard
          label="Workers deployed"
          value={isLoading ? '—' : stats.activeWorkers ?? 0}
          icon={Clock}
        />
        <OpsStatCard
          label="Present today"
          value={isLoading ? '—' : stats.attendanceToday ?? 0}
          icon={BarChart3}
        />
        <OpsStatCard
          label="Invoices due"
          value={isLoading ? '—' : stats.invoicesDue ?? 0}
          icon={FileText}
          tone="warn"
        />
      </div>
    </div>
  )
}
