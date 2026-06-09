import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, Calendar, Clock, Users, Building2 } from 'lucide-react'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { PipelineTimeline } from '../../../components/shared/PipelineTimeline.jsx'
import { useAcceptVendorJobMutation, useGetVendorJobsQuery } from '../../../store/api/workforceApi.js'
import { useNavigate } from 'react-router-dom'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function VendorJobDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, isLoading } = useGetVendorJobsQuery()
  const [acceptJob, { isLoading: accepting }] = useAcceptVendorJobMutation()

  const allocation = (data?.allocations ?? []).find((a) => String(a._id) === String(id))
  const req = allocation?.requestId

  if (isLoading) {
    return (
      <AppSurface>
        <p className="text-sm text-slate-500">Loading job…</p>
      </AppSurface>
    )
  }

  if (!allocation) {
    return (
      <AppSurface className="border-rose-200/90">
        <p className="text-sm font-semibold text-rose-800">Job not found.</p>
        <Link to="/vendor/jobs" className="mt-3 inline-block text-sm font-bold text-brand">
          Back
        </Link>
      </AppSurface>
    )
  }

  const pending = !allocation.vendorAcceptedAt

  return (
    <div className="space-y-4 pb-8">
      <Link to="/vendor/jobs" className="inline-flex items-center gap-2 text-sm font-bold text-brand">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Jobs
      </Link>

      <AppSurface>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Allocation</p>
        <h2 className="mt-1 text-lg font-extrabold text-slate-900">{req?.reference || 'Supply job'}</h2>
        
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <div className="flex gap-2.5 items-start">
            <MapPin className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
            <p className="text-sm text-slate-600">{req?.locationText || 'Location TBD'}</p>
          </div>

          <div className="flex gap-2.5 items-start">
            <Calendar className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
            <div>
              <p className="text-sm text-slate-900 font-semibold capitalize">{req?.scheduleType || 'Daily'} Schedule</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {formatDate(req?.startDate)}
                {req?.endDate ? ` – ${formatDate(req?.endDate)}` : ''}
              </p>
            </div>
          </div>

          <div className="flex gap-2.5 items-start">
            <Clock className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
            <p className="text-sm text-slate-600">
              Shift: <span className="font-semibold text-slate-900">{req?.shiftStart || '08:00'} - {req?.shiftEnd || '18:00'}</span>
            </p>
          </div>
        </div>
      </AppSurface>

      {req?.lines?.length > 0 && (
        <AppSurface>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-brand" />
            <p className="text-sm font-extrabold text-slate-900">Skill Requirements</p>
          </div>
          <div className="space-y-2">
            {req.lines.map((line, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <p className="text-sm font-bold text-slate-900">{line.categoryId?.name || 'Worker'}</p>
                  {line.categoryId?.group && (
                    <p className="text-xs text-slate-500 mt-0.5">{line.categoryId.group}</p>
                  )}
                </div>
                <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wide mr-1.5">Qty</span>
                  <span className="text-sm font-extrabold text-slate-900">{line.quantity}</span>
                </div>
              </div>
            ))}
          </div>
        </AppSurface>
      )}

      {req?.status ? <PipelineTimeline status={req.status} /> : null}

      {allocation.assignments && allocation.assignments.length > 0 ? (
        <AppSurface>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-brand" aria-hidden />
            <p className="text-sm font-extrabold text-slate-900">Assigned Crew</p>
          </div>
          <ul className="mt-3 divide-y divide-slate-100">
            {allocation.assignments.map((a) => (
              <li key={a._id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{a.labourId?.fullName || 'Worker'}</p>
                    <p className="text-xs text-slate-500">{a.labourId?.phone}</p>
                  </div>
                </div>
                {a.categoryId?.name ? (
                  <span className="inline-block rounded bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                    {a.categoryId.name}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </AppSurface>
      ) : null}

      <AppSurface>
        <p className="text-sm font-extrabold text-slate-900">Deployment notes</p>
        <p className="mt-2 text-sm text-slate-600">{allocation.notes || 'No notes from operations.'}</p>
        {allocation.deployedAt ? (
          <p className="mt-2 text-xs text-slate-500">
            Deployed {new Date(allocation.deployedAt).toLocaleString('en-IN')}
          </p>
        ) : null}
        {allocation.vendorAcceptedAt ? (
          <p className="mt-1 text-xs font-bold text-emerald-700">
            Accepted {new Date(allocation.vendorAcceptedAt).toLocaleString('en-IN')}
          </p>
        ) : null}
      </AppSurface>

      {pending ? (
        <AppPrimaryButton type="button" className="w-full" loading={accepting} onClick={() => acceptJob(id)}>
          Accept job
        </AppPrimaryButton>
      ) : req?.status === 'accepted' ? (
        <AppPrimaryButton 
          type="button" 
          className="w-full bg-slate-900 text-white hover:bg-slate-800" 
          onClick={() => navigate(`/vendor/jobs/${id}/assign`)}
        >
          Assign Workers
        </AppPrimaryButton>
      ) : null}
    </div>
  )
}
