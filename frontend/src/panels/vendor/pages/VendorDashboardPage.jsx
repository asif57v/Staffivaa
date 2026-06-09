import { Link } from 'react-router-dom'
import { ClipboardList, IndianRupee, Users } from 'lucide-react'
import { ApprovalGate } from '../../../components/shared/ApprovalGate.jsx'
import { OpsStatCard } from '../../../components/shared/OpsStatCard.jsx'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { useAuth } from '../../../hooks/useAuth.js'
import { useGetVendorDashboardQuery } from '../../../store/api/workforceApi.js'

export function VendorDashboardPage() {
  const { user } = useAuth()
  const approved = user?.contractorProfile?.verificationStatus === 'approved'
  const { data, isLoading } = useGetVendorDashboardQuery(undefined, { skip: !approved })

  if (!approved) {
    return (
      <ApprovalGate
        title="Vendor verification required"
        message="Upload business documents on your profile. Operations will verify your account before jobs and crew linking unlock."
        profileTo="/vendor/profile"
      />
    )
  }

  const stats = data?.stats || {}

  return (
    <div className="space-y-5">
      <AppSurface tone="brandWash" className="border-slate-800/10 bg-slate-900 text-white">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Supply partner</p>
        <h2 className="mt-1 text-lg font-extrabold">
          {user?.contractorProfile?.businessName || user?.fullName}
        </h2>
        <p className="mt-2 text-sm text-white/80">Accept admin allocations and manage your crew.</p>
        <Link to="/vendor/jobs" className="mt-4 inline-block">
          <AppPrimaryButton type="button" className="bg-white text-slate-900 hover:bg-slate-100">
            View supply jobs
          </AppPrimaryButton>
        </Link>
      </AppSurface>

      <div className="grid grid-cols-2 gap-3">
        <OpsStatCard label="Crew linked" value={isLoading ? '—' : stats.crewCount ?? 0} icon={Users} tone="brand" />
        <OpsStatCard label="Open jobs" value={isLoading ? '—' : stats.openJobs ?? 0} icon={ClipboardList} />
        <OpsStatCard
          label="Active deployments"
          value={isLoading ? '—' : stats.activeAssignments ?? 0}
          icon={IndianRupee}
        />
      </div>
    </div>
  )
}
