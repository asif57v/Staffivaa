import { useState } from 'react'
import {
  Building2,
  MapPin,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  CalendarClock,
  Phone,
  Mail,
  IndianRupee,
  Briefcase,
  Home,
  Utensils,
  Bus,
  X,
  UserPlus,
  Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import {
  useGetAdminEnterpriseDirectRequestsQuery,
  useRespondAdminEnterpriseDirectRequestMutation,
  useRemoveDirectRequestWorkerMutation,
} from '../../store/api/adminEnterpriseApi.js'
import { EnterpriseAssignWorkersModal } from './EnterpriseAssignWorkersModal.jsx'
import { AdminDirectPaymentsList } from './AdminDirectPaymentsList.jsx'
import { AdminDirectJobPayoutPanel } from './AdminDirectJobPayoutPanel.jsx'

const STATUS_FILTERS = [
  { value: 'pending', label: 'Pending Review' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
]

const STATUS_BADGE = {
  pending: { label: 'Pending Review', icon: Clock, className: 'bg-amber-100 text-amber-800 ring-amber-200/60' },
  accepted: { label: 'Accepted', icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-800 ring-emerald-200/60' },
  rejected: { label: 'Rejected', icon: XCircle, className: 'bg-rose-100 text-rose-800 ring-rose-200/60' },
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function DetailTile({ label, icon: Icon, children }) {
  return (
    <div className="rounded-xl bg-slate-50/80 p-3 ring-1 ring-slate-100 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-700 break-words">
        {Icon && <Icon className="h-3 w-3 shrink-0 text-brand" />}
        <span className="min-w-0">{children}</span>
      </p>
    </div>
  )
}

export function AdminEnterpriseDirectRequestsPage() {
  const [statusFilter, setStatusFilter] = useState('pending')
  const { data, isLoading, isError } = useGetAdminEnterpriseDirectRequestsQuery({ status: statusFilter })
  const [respond, { isLoading: responding }] = useRespondAdminEnterpriseDirectRequestMutation()

  const [rejecting, setRejecting] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [assigningJobId, setAssigningJobId] = useState(null)
  const [removeWorker, { isLoading: removing }] = useRemoveDirectRequestWorkerMutation()

  const handleRemoveWorker = async (job, entry) => {
    if (!window.confirm(`Remove ${entry.name} from "${job.jobTitle}"?`)) return
    try {
      await removeWorker({ id: job._id, entryId: entry._id }).unwrap()
      toast.success(`${entry.name} removed`)
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to remove worker')
    }
  }

  const requests = data?.data?.requests ?? []
  const stats = data?.data?.stats ?? {}

  const handleAccept = async (job) => {
    try {
      await respond({ id: job._id, action: 'accept' }).unwrap()
      toast.success(`"${job.jobTitle}" accepted. The enterprise has been notified.`)
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to accept request')
    }
  }

  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please enter a reason')
      return
    }
    try {
      await respond({ id: rejecting._id, action: 'reject', note: rejectReason.trim() }).unwrap()
      toast.success('Request rejected. The enterprise has been notified.')
      setRejecting(null)
      setRejectReason('')
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to reject request')
    }
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-200/40">
          <CalendarClock className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Enterprise Daily / Hourly Requests</h1>
          <p className="text-sm text-slate-600">
            Daily and hourly requirements from enterprise clients come here instead of the labour feed. No interview round.
          </p>
        </div>
      </div>

      {/* Status Filters */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const count = f.value === 'all' ? null : stats[f.value]
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold ring-1 transition ${
                statusFilter === f.value
                  ? 'bg-brand text-white ring-brand shadow-sm shadow-brand/20'
                  : 'bg-white text-slate-600 ring-slate-200 hover:ring-brand/30'
              }`}
            >
              {f.label}
              {count != null && <span className="ml-1.5 opacity-80">({count})</span>}
            </button>
          )
        })}
      </div>

      {isLoading && (
        <GlassPanel className="p-8 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-slate-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-brand" />
            Loading requests…
          </div>
        </GlassPanel>
      )}

      {isError && (
        <GlassPanel className="border-rose-200 p-6">
          <p className="text-sm font-semibold text-rose-800">Failed to load enterprise requests.</p>
        </GlassPanel>
      )}

      {!isLoading && !isError && requests.length === 0 && (
        <GlassPanel className="p-10 text-center">
          <CalendarClock className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
          <p className="mt-3 text-sm font-bold text-slate-700">No requests in this view.</p>
          <p className="mt-1 text-xs text-slate-500">
            Enterprise jobs posted with a Daily or Hourly salary type will appear here.
          </p>
        </GlassPanel>
      )}

      <ul className="space-y-4">
        {requests.map((job) => {
          const company = job.enterpriseId
          const companyName = company?.enterpriseProfile?.companyName || company?.fullName || 'Enterprise Client'
          const badge = STATUS_BADGE[job.adminRequestStatus] || STATUS_BADGE.pending
          const BadgeIcon = badge.icon
          const isPending = job.adminRequestStatus === 'pending'
          const tl = job.timeline || {}
          const perks = [
            job.providesAccommodation && { label: 'Accommodation', icon: Home },
            job.providesFood && { label: 'Food', icon: Utensils },
            job.providesTransportation && { label: 'Transport', icon: Bus },
          ].filter(Boolean)

          return (
            <li key={job._id}>
              <GlassPanel className="p-0 overflow-hidden transition hover:shadow-lg hover:ring-brand/10">
                <div className="p-5 space-y-4">
                  {/* Top Row */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-700 ring-1 ring-indigo-200/60">
                          <Building2 className="h-3 w-3" />
                          Enterprise · {job.salaryType}
                        </span>
                        <span className="text-sm font-black text-slate-900">{job.jobTitle}</span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-700">{companyName}</p>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
                        {company?.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {company.phone}
                          </span>
                        )}
                        {company?.email && (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {company.email}
                          </span>
                        )}
                        <span>Received {formatDateTime(job.createdAt)}</span>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${badge.className}`}>
                      <BadgeIcon className="h-3 w-3" />
                      {badge.label}
                    </span>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <DetailTile label="Salary" icon={IndianRupee}>
                      ₹{Number(job.salary || 0).toLocaleString('en-IN')} / {job.salaryType}
                    </DetailTile>
                    <DetailTile label="Workers" icon={Users}>
                      {job.numberOfWorkers}
                    </DetailTile>
                    <DetailTile label="Location" icon={MapPin}>
                      {job.locationText || 'Not specified'}
                    </DetailTile>
                    <DetailTile label="Skill / Category" icon={Briefcase}>
                      {job.categoryId?.name || '—'}
                      {job.department ? ` · ${job.department}` : ''}
                    </DetailTile>
                    <DetailTile label="Working Hours" icon={Clock}>
                      {job.workingHours || 8} hrs/day
                    </DetailTile>
                    <DetailTile label="Shift" icon={Clock}>
                      {job.shift || '—'}
                    </DetailTile>
                    <DetailTile label="Experience">{job.experienceRequired || 'Any'}</DetailTile>
                    <DetailTile label="Contract Duration">{job.contractDuration || '—'}</DetailTile>
                    <DetailTile label="Expected Joining" icon={Calendar}>
                      {formatDate(tl.expectedJoiningDate)}
                    </DetailTile>
                    <DetailTile label="Project Start" icon={Calendar}>
                      {formatDate(tl.projectStartDate)}
                    </DetailTile>
                    <DetailTile label="Project End" icon={Calendar}>
                      {formatDate(tl.projectEndDate)}
                    </DetailTile>
                    <DetailTile label="Apply By" icon={Calendar}>
                      {formatDate(tl.applicationLastDate)}
                    </DetailTile>
                  </div>

                  {perks.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {perks.map(({ label, icon: Icon }) => (
                        <span
                          key={label}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200/60"
                        >
                          <Icon className="h-3 w-3" /> {label} provided
                        </span>
                      ))}
                    </div>
                  )}

                  {job.jobDescription && (
                    <div className="rounded-xl bg-white p-3 ring-1 ring-slate-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Job Description</p>
                      <p className="mt-1 whitespace-pre-line text-xs text-slate-700">{job.jobDescription}</p>
                    </div>
                  )}

                  {!isPending && (
                    <div
                      className={`rounded-xl px-3.5 py-2.5 text-xs ring-1 ${
                        job.adminRequestStatus === 'accepted'
                          ? 'bg-emerald-50 text-emerald-800 ring-emerald-200/60'
                          : 'bg-rose-50 text-rose-800 ring-rose-200/60'
                      }`}
                    >
                      <span className="font-bold">
                        {job.adminRequestStatus === 'accepted' ? 'Accepted' : 'Rejected'}
                        {job.adminRespondedBy?.fullName ? ` by ${job.adminRespondedBy.fullName}` : ''} on{' '}
                        {formatDateTime(job.adminRespondedAt)}
                      </span>
                      {job.adminResponseNote && <span> — {job.adminResponseNote}</span>}
                    </div>
                  )}

                  {/* Assigned Workers (optional) */}
                  {job.adminRequestStatus === 'accepted' && (
                    <div className="rounded-xl bg-white p-3.5 ring-1 ring-slate-100 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Assigned Workers ({job.assignedWorkers?.length || 0} / {job.numberOfWorkers}) · optional
                        </p>
                        {(job.assignedWorkers?.length || 0) < job.numberOfWorkers && (
                          <button
                            type="button"
                            onClick={() => setAssigningJobId(job._id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-black text-white shadow-sm hover:opacity-90"
                          >
                            <UserPlus className="h-3.5 w-3.5" /> Assign Workers
                          </button>
                        )}
                      </div>
                      {job.assignedWorkers?.length > 0 ? (
                        <ul className="grid gap-2 sm:grid-cols-2">
                          {job.assignedWorkers.map((w) => (
                            <li key={w._id} className="flex items-center gap-2.5 rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-100">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-black text-slate-600">
                                {(w.workerId?.fullName || w.name || '?').slice(0, 1).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-900 truncate">{w.workerId?.fullName || w.name}</p>
                                <p className="text-[11px] text-slate-500">
                                  {w.workerId?.phone || w.phone} ·{' '}
                                  <span className={w.isExternal ? 'text-amber-700 font-semibold' : 'text-emerald-700 font-semibold'}>
                                    {w.isExternal ? 'Not on app' : 'Registered'}
                                  </span>
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={removing}
                                onClick={() => handleRemoveWorker(job, w)}
                                className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                                aria-label={`Remove ${w.name}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-500">No workers assigned yet.</p>
                      )}
                    </div>
                  )}

                  {job.adminRequestStatus === 'accepted' && <AdminDirectJobPayoutPanel job={job} />}

                  {isPending && (
                    <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        disabled={responding}
                        onClick={() => {
                          setRejecting(job)
                          setRejectReason('')
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-xs font-bold text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-50 disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </button>
                      <button
                        type="button"
                        disabled={responding}
                        onClick={() => handleAccept(job)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Accept Request
                      </button>
                    </div>
                  )}
                </div>
              </GlassPanel>
            </li>
          )
        })}
      </ul>

      <AdminDirectPaymentsList />


      {/* Assign Workers Modal — read the job from the live list so counts stay fresh */}
      {assigningJobId && requests.find((r) => r._id === assigningJobId) && (
        <EnterpriseAssignWorkersModal
          job={requests.find((r) => r._id === assigningJobId)}
          onClose={() => setAssigningJobId(null)}
        />
      )}

      {/* Reject Modal */}
      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Reject request</h3>
                <p className="mt-0.5 text-xs text-slate-500">{rejecting.jobTitle}</p>
              </div>
              <button type="button" onClick={() => setRejecting(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Reason shown to the enterprise"
              className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand focus:bg-white"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejecting(null)}
                className="rounded-lg px-3.5 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={responding}
                onClick={handleConfirmReject}
                className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50"
              >
                Reject Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
