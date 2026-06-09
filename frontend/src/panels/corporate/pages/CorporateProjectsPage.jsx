import { Link } from 'react-router-dom'
import { Building2, ChevronRight, Plus } from 'lucide-react'
import { AppEmptyState } from '../../../components/app/AppEmptyState.jsx'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { ApprovalGate } from '../../../components/shared/ApprovalGate.jsx'
import { CORPORATE_STATUS } from '../../../constants/userRoles.js'
import { useAuth } from '../../../hooks/useAuth.js'
import { useGetCorporateProjectsQuery } from '../../../store/api/workforceApi.js'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function CorporateProjectsPage() {
  const { user } = useAuth()
  const approved = user?.corporateProfile?.status === CORPORATE_STATUS.APPROVED
  const { data, isLoading, isError } = useGetCorporateProjectsQuery(undefined, { skip: !approved })
  const projects = data?.projects ?? []

  if (!approved) {
    return (
      <div className="space-y-4">
        <ApprovalGate
          title="Corporate approval required"
          message="Your account must be approved before projects appear here. Complete verification on your profile."
          profileTo="/corporate/profile"
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Portfolio</p>
          <h2 className="text-lg font-extrabold text-slate-900">Projects & sites</h2>
        </div>
        <Link to="/corporate/projects/new">
          <AppPrimaryButton type="button" className="shrink-0">
            <Plus className="mr-1.5 h-4 w-4" />
            New
          </AppPrimaryButton>
        </Link>
      </div>

      {isLoading ? (
        <AppSurface>
          <p className="text-sm text-slate-500">Loading projects…</p>
        </AppSurface>
      ) : null}

      {isError ? (
        <AppSurface className="border-rose-200/90 bg-rose-50/40">
          <p className="text-sm font-semibold text-rose-800">Could not load projects.</p>
        </AppSurface>
      ) : null}

      {!isLoading && !isError && projects.length === 0 ? (
        <AppEmptyState
          icon={Building2}
          title="No projects yet"
          subtitle="Create a project to organise sites and bulk workforce requests."
        />
      ) : null}

      <ul className="space-y-2">
        {projects.map((p) => (
          <li key={p._id}>
            <Link to={`/corporate/projects/${p._id}`}>
              <AppSurface className="flex items-center justify-between gap-3 transition hover:border-brand/30">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{p.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {(p.sites?.length ?? 0)} site{(p.sites?.length ?? 0) === 1 ? '' : 's'} · {formatDate(p.startDate)}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
              </AppSurface>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}



