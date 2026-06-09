import { Link } from 'react-router-dom'
import { Building2, ClipboardList, Clock, FileText, Plus } from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth.js'
import { CORPORATE_STATUS } from '../../../constants/userRoles.js'
import { ApprovalGate } from '../../../components/shared/ApprovalGate.jsx'
import { OpsStatCard } from '../../../components/shared/OpsStatCard.jsx'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { useGetCorporateDashboardQuery } from '../../../store/api/workforceApi.js'

export function CorporateDashboardPage() {
  const { user } = useAuth()
  const approved = user?.corporateProfile?.status === CORPORATE_STATUS.APPROVED
  const { data, isLoading } = useGetCorporateDashboardQuery(undefined, { skip: !approved })

  if (!approved) {
    return (
      <div className="space-y-4">
        <ApprovalGate
          title="Corporate approval required"
          message="Upload company documents on your profile. Operations will verify your account before projects and bulk requests unlock."
          profileTo="/corporate/profile"
        />
      </div>
    )
  }

  const stats = data?.stats || {}

  return (
    <div className="space-y-5">
      <div 
        className="relative overflow-hidden rounded-3xl border border-slate-800/10 p-5 md:p-6 text-white shadow-sm"
        style={{
          backgroundImage: 'url(/corporate_bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-slate-950/70" />
        <div className="relative z-10">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Enterprise</p>
          <h2 className="mt-1 text-lg font-extrabold">
            {user?.corporateProfile?.companyName || user?.fullName}
          </h2>
          <p className="mt-2 text-sm text-white/80">Bulk workforce, attendance billing, GST-ready invoices.</p>
          <Link to="/corporate/requests/new" className="mt-4 inline-block">
            <AppPrimaryButton type="button" className="bg-white !text-slate-900 hover:bg-slate-100 shadow-xl">
              <Plus className="mr-2 h-4 w-4" />
              New workforce request
            </AppPrimaryButton>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <OpsStatCard label="Active projects" value={isLoading ? '—' : stats.activeProjects ?? 0} icon={Building2} tone="brand" />
        <OpsStatCard label="Open requests" value={isLoading ? '—' : stats.openRequests ?? 0} icon={ClipboardList} />
        <OpsStatCard label="Workers deployed" value={isLoading ? '—' : stats.activeWorkers ?? 0} icon={Clock} />
        <OpsStatCard label="Invoices due" value={isLoading ? '—' : stats.invoicesDue ?? 0} icon={FileText} tone="warn" />
      </div>
    </div>
  )
}


