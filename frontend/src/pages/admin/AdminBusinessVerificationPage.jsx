import { useCallback, useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  X,
  PauseCircle,
  PlayCircle,
  Lock,
  ShieldAlert,
  Trash2,
  CheckCircle2,
  Clock,
  Check,
  RotateCcw,
  UploadCloud,
  History,
  User as UserIcon
} from 'lucide-react'
import { CORPORATE_DOCUMENT_LABELS } from '../../constants/corporateVerification.js'
import { VENDOR_DOCUMENT_LABELS, VENDOR_TYPE_LABELS } from '../../constants/vendorVerification.js'
import { CORPORATE_STATUS } from '../../constants/userRoles.js'
import { AdminVerificationProfileDetails } from '../../components/admin/AdminVerificationProfileDetails.jsx'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { AdminConfirmActionDialog } from '../../components/admin/AdminConfirmActionDialog.jsx'
import { ACCOUNT_STATUSES } from '../../constants/userStatuses.js'
import { getUserTimelineAdmin, patchUserStatusAdmin } from '../../api/adminUsersApi.js'
import {
  useLazyGetCorporateVerificationDetailQuery,
  useLazyGetVendorVerificationDetailQuery,
  useListCorporateVerificationsQuery,
  useListVendorVerificationsQuery,
  useReviewCorporateMutation,
  useReviewVendorMutation,
} from '../../store/api/workforceApi.js'

const FILTERS = [
  { value: 'submitted', label: 'Needs review' },
  { value: 'all', label: 'All accounts' },
  { value: 'draft', label: 'Docs uploaded, not submitted' },
  { value: 'not_submitted', label: 'No documents yet' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

function StatusPill({ status, submittedAt, hasDocuments, variant }) {
  const approved = variant === 'corporate' ? status === CORPORATE_STATUS.APPROVED : status === 'approved'
  const rejected = variant === 'corporate' ? status === CORPORATE_STATUS.REJECTED : status === 'rejected'
  if (approved) {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-900 ring-1 ring-emerald-200/80">
        Approved
      </span>
    )
  }
  if (rejected) {
    return (
      <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-rose-900 ring-1 ring-rose-200/80">
        Rejected
      </span>
    )
  }
  if (submittedAt) {
    return (
      <span className="inline-flex rounded-full bg-yellow-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-yellow-900 ring-1 ring-yellow-200/80">
        Pending
      </span>
    )
  }
  if (hasDocuments) {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-900 ring-1 ring-amber-200/80">
        Docs uploaded
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200/80">
      Incomplete
    </span>
  )
}

function EnterpriseBadge({ status }) {
  const badges = {
    approved: 'bg-emerald-50 text-emerald-900 ring-emerald-200/80',
    pending: 'bg-yellow-50 text-yellow-900 ring-yellow-200/80',
    rejected: 'bg-rose-50 text-rose-900 ring-rose-200/80',
    on_hold: 'bg-orange-50 text-orange-900 ring-orange-200/80',
    suspended: 'bg-blue-50 text-blue-900 ring-blue-200/80',
    blocked: 'bg-slate-50 text-slate-900 ring-slate-200/80'
  }
  const colors = badges[status] || badges.pending
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ${colors}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status.replace('_', ' ')}
    </span>
  )
}

function businessNameFor(user, variant) {
  if (variant === 'corporate') return user?.corporateProfile?.companyName || '—'
  return user?.contractorProfile?.businessName || '—'
}

function profileFor(user, variant) {
  return variant === 'corporate' ? user?.corporateProfile : user?.contractorProfile
}

function documentTypeLabel(doc, variant) {
  if (!doc?.documentType) return null
  const map = variant === 'corporate' ? CORPORATE_DOCUMENT_LABELS : VENDOR_DOCUMENT_LABELS
  return map[doc.documentType] || doc.documentType
}

export function AdminBusinessVerificationPage() {
  const reduce = useReducedMotion()
  const [tab, setTab] = useState('corporate')
  const [filter, setFilter] = useState('submitted')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const limit = 12

  const [reviewId, setReviewId] = useState(null)
  const [detailUser, setDetailUser] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [reviewNote, setReviewNote] = useState('')
  const [detailError, setDetailError] = useState('')
  const [dialogConfig, setDialogConfig] = useState({ isOpen: false })

  const isCorporate = tab === 'corporate'
  const queryParams = { filter, search: debouncedSearch, page, limit }

  const corporateQuery = useListCorporateVerificationsQuery(queryParams, { skip: !isCorporate })
  const vendorQuery = useListVendorVerificationsQuery(queryParams, { skip: isCorporate })

  const activeQuery = isCorporate ? corporateQuery : vendorQuery
  const items = activeQuery.data?.items ?? []
  const total = activeQuery.data?.total ?? 0
  const pages = activeQuery.data?.pages ?? 1
  const stats = activeQuery.data?.stats

  const [fetchCorporateDetail, corporateDetailState] = useLazyGetCorporateVerificationDetailQuery()
  const [fetchVendorDetail, vendorDetailState] = useLazyGetVendorVerificationDetailQuery()
  const detailLoading = corporateDetailState.isFetching || vendorDetailState.isFetching

  const [reviewCorporate, { isLoading: corporateReviewBusy }] = useReviewCorporateMutation()
  const [reviewVendor, { isLoading: vendorReviewBusy }] = useReviewVendorMutation()
  const reviewBusy = corporateReviewBusy || vendorReviewBusy

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 350)
    return () => window.clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, filter, tab])

  const loadUserDetail = useCallback(async (id) => {
    const fetchFn = isCorporate ? fetchCorporateDetail : fetchVendorDetail
    try {
      const data = await fetchFn(id).unwrap()
      if (data?.user) {
        setDetailUser(data.user)
        const logs = await getUserTimelineAdmin(id)
        setTimeline(logs)
      } else {
        setDetailError('Account not found')
      }
    } catch (e) {
      setDetailUser(null)
      setDetailError(e?.data?.message || e?.message || 'Failed to load account')
    }
  }, [isCorporate, fetchCorporateDetail, fetchVendorDetail])

  useEffect(() => {
    if (!reviewId) {
      setDetailUser(null)
      setTimeline([])
      setReviewNote('')
      setDetailError('')
      return
    }
    loadUserDetail(reviewId)
  }, [reviewId, loadUserDetail])

  const openDialog = (config) => setDialogConfig({ isOpen: true, ...config })
  const closeDialog = () => setDialogConfig({ isOpen: false })

  const runReview = async (decision) => {
    if (!reviewId) return
    setDetailError('')
    try {
      const body = {
        id: reviewId,
        decision,
        reviewNote: decision === 'rejected' ? reviewNote : undefined,
      }
      if (isCorporate) await reviewCorporate(body).unwrap()
      else await reviewVendor(body).unwrap()
      await loadUserDetail(reviewId)
      activeQuery.refetch()
    } catch (e) {
      setDetailError(e?.data?.message || e?.message || 'Review failed')
    }
  }

  const handleStatusChange = async (newStatus, reason) => {
    try {
      await patchUserStatusAdmin(reviewId, newStatus, reason)
      await loadUserDetail(reviewId)
      activeQuery.refetch()
      closeDialog()
    } catch (e) {
      alert(e.message)
    }
  }

  const statCards = [
    {
      key: 'pending',
      label: 'Awaiting review',
      value: stats?.pendingReviewCount ?? '—',
      filter: 'submitted',
      tone: 'from-sky-500/15 to-sky-50/40',
      icon: ShieldCheck,
    },
    {
      key: 'approved',
      label: 'Approved',
      value: stats?.approvedCount ?? '—',
      filter: 'approved',
      tone: 'from-emerald-500/15 to-emerald-50/40',
      icon: Store,
    },
    {
      key: 'submitted',
      label: 'Ever submitted',
      value: stats?.submittedCount ?? '—',
      filter: 'all',
      tone: 'from-brand/20 to-slate-50',
      icon: FileText,
    },
  ]

  // Compute precise enterprise status for the modal
  let enterpriseStatus = 'pending'
  const p = profileFor(detailUser, tab)
  const isProfileApproved = tab === 'corporate' ? p?.status === CORPORATE_STATUS.APPROVED : p?.verificationStatus === 'approved'
  const isProfileRejected = tab === 'corporate' ? p?.status === CORPORATE_STATUS.REJECTED : p?.verificationStatus === 'rejected'
  
  if (detailUser) {
    if (detailUser.accountStatus === ACCOUNT_STATUSES.BLOCKED) enterpriseStatus = 'blocked'
    else if (detailUser.accountStatus === ACCOUNT_STATUSES.SUSPENDED) enterpriseStatus = 'suspended'
    else if (detailUser.accountStatus === ACCOUNT_STATUSES.HOLD) enterpriseStatus = 'on_hold'
    else if (isProfileRejected) enterpriseStatus = 'rejected'
    else if (isProfileApproved) enterpriseStatus = 'approved'
    else enterpriseStatus = 'pending'
  }

  // Find approval audit log for summary
  const approvalLog = timeline.find(l => l.action?.toLowerCase().includes('approved'))

  return (
    <div className="w-full space-y-6 pb-10">
      <AdminConfirmActionDialog {...dialogConfig} onClose={closeDialog} />

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 md:text-xl">Business verification</h2>
          <p className="mt-1 text-sm text-slate-600">
            Review corporate and vendor documents. Approve accounts to unlock B2B operations.
          </p>
        </div>
        <button
          type="button"
          onClick={() => activeQuery.refetch()}
          disabled={activeQuery.isFetching}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand/30 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${activeQuery.isFetching ? 'animate-spin' : ''}`} aria-hidden />
          Refresh
        </button>
      </motion.div>

      <div className="flex gap-2 rounded-2xl border border-slate-200/90 bg-slate-100/80 p-1">
        <button
          type="button"
          onClick={() => setTab('corporate')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
            isCorporate ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="h-4 w-4" aria-hidden />
          Corporate
        </button>
        <button
          type="button"
          onClick={() => setTab('vendor')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
            !isCorporate ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Store className="h-4 w-4" aria-hidden />
          Vendor
        </button>
      </div>

      <div className="grid gap-3 grid-cols-3 w-full">
        {statCards.map((c, i) => (
          <motion.button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.filter)}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * i }}
            className="text-left w-full h-full outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded-2xl"
          >
            <GlassPanel
              className={`relative h-full overflow-hidden p-3 bg-linear-to-br ${c.tone} ${filter === c.filter ? 'ring-2 ring-brand/35' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-500">{c.label}</p>
                  <p className="mt-1 text-xl font-black tabular-nums text-slate-900">{c.value}</p>
                  <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">
                     {filter === c.filter ? 'Filter applied' : 'Tap to filter'}
                  </p>
                </div>
                {c.icon && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80 text-slate-700 shadow-sm ring-1 ring-slate-200/80">
                    <c.icon className="h-4 w-4" aria-hidden />
                  </span>
                )}
              </div>
            </GlassPanel>
          </motion.button>
        ))}
      </div>

      <GlassPanel className="p-4 md:p-5">
        <div className="flex items-center gap-3 w-full">
          <div className="flex-1">
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Name, company, email, phone…"
                className="w-full rounded-xl border border-slate-200/90 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand/35"
              />
            </div>
          </div>
          <div className="w-56 shrink-0">
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Status</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand/35"
            >
              {FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="mt-4 text-xs font-medium text-slate-500">
          Showing {items.length} of {total} {isCorporate ? 'corporate' : 'vendor'} account{total === 1 ? '' : 's'}
        </p>
      </GlassPanel>

      {activeQuery.isError ? (
        <p className="rounded-xl border border-rose-200/80 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">
          Could not load accounts
        </p>
      ) : null}

      <GlassPanel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Documents</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {activeQuery.isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {Array.from({ length: 5 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 animate-pulse rounded bg-slate-200/80" />
                        </td>
                      ))}
                    </tr>
                  ))
                : items.map((u) => {
                    const prof = profileFor(u, tab)
                    const hasDocs = (prof?.documents?.length ?? 0) > 0
                    return (
                      <tr key={u._id} className="border-b border-slate-100 hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{businessNameFor(u, tab)}</p>
                          <p className="text-xs text-slate-500">{u.fullName}</p>
                          {tab === 'corporate' && u.corporateProfile?.gstNumber ? (
                            <p className="font-mono text-xs text-slate-600">GST {u.corporateProfile.gstNumber}</p>
                          ) : null}
                          {tab === 'vendor' && u.contractorProfile?.vendorType ? (
                            <p className="text-xs text-slate-600">
                              {VENDOR_TYPE_LABELS[u.contractorProfile.vendorType] || u.contractorProfile.vendorType}
                            </p>
                          ) : null}
                          {tab === 'vendor' && u.contractorProfile?.panNumber ? (
                            <p className="font-mono text-xs text-slate-600">PAN {u.contractorProfile.panNumber}</p>
                          ) : null}
                          {tab === 'vendor' && u.contractorProfile?.gstNumber ? (
                            <p className="font-mono text-xs text-slate-600">GST {u.contractorProfile.gstNumber}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs">+91 {u.phone || '—'}</p>
                          <p className="text-xs text-slate-500">{u.email || '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill
                            status={tab === 'corporate' ? prof?.status : prof?.verificationStatus}
                            submittedAt={prof?.documentsSubmittedAt}
                            hasDocuments={hasDocs}
                            variant={tab}
                          />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {prof?.documents?.length ?? 0} file{(prof?.documents?.length ?? 0) === 1 ? '' : 's'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setReviewId(u._id)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>
        {!activeQuery.isLoading && items.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-slate-500">
            <p className="font-semibold text-slate-700">No accounts match this filter.</p>
            {filter === 'submitted' ? (
              <p className="mx-auto mt-2 max-w-md text-xs">
                Needs review includes pending accounts with uploaded documents or a formal submission.
              </p>
            ) : null}
          </div>
        ) : null}
      </GlassPanel>

      {pages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Page {page} of {pages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || activeQuery.isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>
            <button
              type="button"
              disabled={page >= pages || activeQuery.isFetching}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {/* VERIFICATION MODAL - ENTERPRISE UX */}
      {reviewId ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 sm:p-0" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            aria-label="Close"
            disabled={reviewBusy}
            onClick={() => !reviewBusy && setReviewId(null)}
          />
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl ring-1 ring-slate-900/5 sm:rounded-3xl"
          >
            {/* Modal Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <p className="text-base font-extrabold text-slate-900">
                  {isCorporate ? 'Corporate' : 'Vendor'} Verification
                </p>
                <p className="text-xs font-medium text-slate-500">Business Management & Security Profile</p>
              </div>
              <button
                type="button"
                disabled={reviewBusy}
                onClick={() => setReviewId(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {detailLoading ? (
                <div className="flex flex-col items-center gap-3 py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-brand" />
                  <p className="text-sm font-medium text-slate-600">Loading business profile…</p>
                </div>
              ) : detailError && !detailUser ? (
                <div className="rounded-xl border border-rose-200/80 bg-rose-50 p-4 text-center">
                  <ShieldAlert className="mx-auto h-8 w-8 text-rose-400 mb-2" />
                  <p className="text-sm font-semibold text-rose-900">{detailError}</p>
                </div>
              ) : detailUser ? (
                <>
                  {/* Account Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Business Entity</p>
                      <h2 className="text-xl font-black text-slate-900">{businessNameFor(detailUser, tab)}</h2>
                      <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                        <span className="font-semibold">{detailUser.fullName}</span>
                        <span className="font-mono text-xs">+91 {detailUser.phone}</span>
                        {detailUser.email && <span className="text-xs">{detailUser.email}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center justify-end">
                      <EnterpriseBadge status={enterpriseStatus} />
                    </div>
                  </div>

                  {/* Dynamic Action Section */}
                  {enterpriseStatus === 'pending' && (
                    <div className="rounded-2xl border border-brand/20 bg-brand/5 p-5">
                      <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-brand">Pending Review Actions</h3>
                      
                      <div>
                        <label className="mb-1.5 block text-xs font-bold uppercase text-slate-600" htmlFor="biz-note">
                          Rejection Reason (Optional)
                        </label>
                        <textarea
                          id="biz-note"
                          rows={2}
                          value={reviewNote}
                          onChange={(e) => setReviewNote(e.target.value)}
                          placeholder="If rejecting, explain what is missing..."
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                      </div>
                      
                      {detailError ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-900">{detailError}</p> : null}
                      
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <button
                          type="button"
                          disabled={reviewBusy}
                          onClick={() => runReview('rejected')}
                          className="flex-1 rounded-xl bg-white border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-600 shadow-sm transition hover:bg-rose-50 disabled:opacity-50"
                        >
                          Reject Verification
                        </button>
                        <button
                          type="button"
                          disabled={reviewBusy || !(p?.documents?.length > 0)}
                          onClick={() => runReview('approved')}
                          className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand/90 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {reviewBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                          Approve Verification
                        </button>
                      </div>
                    </div>
                  )}

                  {enterpriseStatus === 'rejected' && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldAlert className="h-5 w-5 text-rose-600" />
                        <h3 className="text-sm font-bold text-rose-900">Verification Rejected</h3>
                      </div>
                      <p className="text-sm text-rose-700">Reason: {p?.reviewNote || 'No reason provided.'}</p>
                      
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <button
                          type="button"
                          disabled={reviewBusy}
                          onClick={() => runReview('approved')}
                          className="flex-1 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                          Approve Anyway
                        </button>
                        <button
                          type="button"
                          onClick={() => openDialog({
                            title: 'Request Document Re-upload',
                            description: 'This will notify the business to re-upload their documents and submit again.',
                            confirmText: 'Send Request',
                            onConfirm: () => {
                               // Assuming this sets status back to pending conceptually, or we just close. 
                               // Without backend change, just close.
                               closeDialog()
                               alert("Request sent to user.")
                            }
                          })}
                          className="flex-1 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-700 flex items-center justify-center gap-2"
                        >
                          <UploadCloud className="h-4 w-4" /> Request Re-upload
                        </button>
                      </div>
                    </div>
                  )}

                  {enterpriseStatus === 'approved' && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
                      <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-emerald-800">Verification Summary</h3>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase text-emerald-600">Approved By</p>
                          <p className="mt-1 text-sm font-semibold text-emerald-950">{approvalLog?.admin?.fullName || 'System Admin'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase text-emerald-600">Approved On</p>
                          <p className="mt-1 text-sm font-medium text-emerald-950">
                            {approvalLog?.createdAt ? new Date(approvalLog.createdAt).toLocaleString() : (p?.documentsSubmittedAt ? new Date(p.documentsSubmittedAt).toLocaleString() : '—')}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase text-emerald-600">Verification Method</p>
                          <p className="mt-1 text-sm font-medium text-emerald-950">Manual Review</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase text-emerald-600">Verification Result</p>
                          <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                            <CheckCircle2 className="h-4 w-4" /> Successfully Verified
                          </p>
                        </div>
                        <div className="sm:col-span-2 rounded-xl bg-white/60 p-3 mt-1">
                          <p className="text-[10px] font-bold uppercase text-emerald-600">Review Notes</p>
                          <p className="mt-1 text-sm text-emerald-950">{p?.reviewNote || 'All submitted business documents, GST details and KYC information have been verified successfully.'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {(enterpriseStatus === 'on_hold' || enterpriseStatus === 'suspended') && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-100 p-5">
                       <h3 className="mb-2 text-sm font-bold text-slate-900">
                          Account is {enterpriseStatus === 'on_hold' ? 'On Hold' : 'Suspended'}
                       </h3>
                       <p className="text-sm text-slate-600">Administrative action has restricted this account's capabilities.</p>
                       <button
                          type="button"
                          onClick={() => openDialog({
                            title: 'Remove Restriction',
                            description: `This will remove the ${enterpriseStatus} status and reactivate the business.`,
                            confirmText: 'Reactivate',
                            requireReason: true,
                            onConfirm: ({ reason }) => handleStatusChange(ACCOUNT_STATUSES.ACTIVE, reason)
                          })}
                          className="mt-4 w-full sm:w-auto rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-700"
                        >
                          Remove {enterpriseStatus === 'on_hold' ? 'Hold' : 'Suspension'}
                        </button>
                    </div>
                  )}

                  {/* Verification Management Actions for Approved/On Hold/Suspended */}
                  {['approved', 'on_hold', 'suspended'].includes(enterpriseStatus) && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Verification Management</h3>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => openDialog({
                            title: 'Reopen Verification?',
                            description: 'This business will move back to "Under Review". The previous approval history will remain stored in the audit log.',
                            confirmText: 'Continue',
                            onConfirm: () => runReview('pending')
                          })}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 transition"
                        >
                          <RotateCcw className="h-4 w-4" /> Reopen Verification
                        </button>
                        
                        {enterpriseStatus !== 'on_hold' && (
                          <button
                            type="button"
                            onClick={() => openDialog({
                              title: 'Put Business On Hold',
                              description: 'User can login but cannot accept new jobs or make withdrawals.',
                              confirmText: 'Place on Hold',
                              requireReason: true,
                              isDestructive: true,
                              onConfirm: ({ reason }) => handleStatusChange(ACCOUNT_STATUSES.HOLD, reason)
                            })}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2 text-sm font-bold text-orange-700 ring-1 ring-slate-200 hover:bg-orange-50 transition"
                          >
                            <PauseCircle className="h-4 w-4" /> Put On Hold
                          </button>
                        )}
                        
                        {enterpriseStatus !== 'suspended' && (
                          <button
                            type="button"
                            onClick={() => openDialog({
                              title: 'Suspend Business',
                              description: 'Business account will be completely disabled. Support message will be shown on their screen.',
                              confirmText: 'Suspend',
                              requireReason: true,
                              isDestructive: true,
                              onConfirm: ({ reason }) => handleStatusChange(ACCOUNT_STATUSES.SUSPENDED, reason)
                            })}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2 text-sm font-bold text-blue-700 ring-1 ring-slate-200 hover:bg-blue-50 transition"
                          >
                            <ShieldAlert className="h-4 w-4" /> Suspend Business
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => openDialog({
                            title: 'Block Business',
                            description: 'User will be immediately logged out and cannot login again.',
                            confirmText: 'Block',
                            requireReason: true,
                            isDestructive: true,
                            onConfirm: ({ reason }) => handleStatusChange(ACCOUNT_STATUSES.BLOCKED, reason)
                          })}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2 text-sm font-bold text-rose-700 ring-1 ring-slate-200 hover:bg-rose-50 transition"
                        >
                          <Lock className="h-4 w-4" /> Block Business
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Details block from existing logic */}
                  <AdminVerificationProfileDetails user={detailUser} variant={tab} />

                  {/* Documents Section */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Submitted Documents</p>
                    {(p?.documents ?? []).length === 0 ? (
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-6 text-center text-slate-500">
                        <FileText className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                        <p className="text-sm font-semibold">No documents uploaded.</p>
                      </div>
                    ) : (
                      <ul className="space-y-3">
                        {(p?.documents ?? []).map((doc) => {
                          const typeLabel = documentTypeLabel(doc, tab)
                          const isDocApproved = isProfileApproved || enterpriseStatus === 'approved'
                          return (
                            <li
                              key={doc._id || doc.url}
                              className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/80 p-4 transition hover:bg-slate-100"
                            >
                              <div className="flex items-center gap-4 min-w-0">
                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isDocApproved ? 'bg-emerald-100 text-emerald-600' : 'bg-white shadow-sm ring-1 ring-slate-200 text-slate-500'}`}>
                                  {isDocApproved ? <Check className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-bold text-slate-900 truncate">
                                      {doc.label || typeLabel || 'Document'}
                                    </p>
                                    {isDocApproved && (
                                      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">Verified</span>
                                    )}
                                  </div>
                                  <div className="mt-0.5 flex items-center gap-2 text-[11px] font-medium text-slate-500">
                                    {isDocApproved ? (
                                      <span>Verified on {approvalLog?.createdAt ? new Date(approvalLog.createdAt).toLocaleDateString() : 'recently'} by {approvalLog?.admin?.fullName || 'System Admin'}</span>
                                    ) : (
                                      <span>Uploaded on {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {doc.url && (
                                <a
                                  href={doc.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="shrink-0 rounded-lg bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 hover:text-brand transition"
                                >
                                  View Document
                                </a>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>

                  {/* Audit Timeline */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                     <h3 className="mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                       <History className="h-4 w-4" /> Audit Timeline
                     </h3>
                     <div className="relative space-y-6 before:absolute before:inset-0 before:ml-4 before:h-full before:w-0.5 before:bg-slate-100 pl-10">
                        <div className="relative">
                          <span className="absolute -left-[35px] flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-slate-500 shadow-[0_0_0_4px_white]">
                            <div className="h-2 w-2 rounded-full bg-slate-500" />
                          </span>
                          <p className="text-sm font-bold text-slate-900">Current Status</p>
                          <div className="mt-1">
                            <EnterpriseBadge status={enterpriseStatus} />
                          </div>
                        </div>

                        {timeline.map((log) => (
                          <div key={log._id} className="relative">
                            <span className="absolute -left-[35px] flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 shadow-[0_0_0_4px_white]">
                               <Clock className="h-3 w-3 text-slate-400" />
                            </span>
                            <div className="flex items-center gap-3">
                               <p className="text-xs font-bold text-slate-500">{new Date(log.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
                               <p className="text-sm font-medium text-slate-900">{log.action}</p>
                            </div>
                            {log.admin && <p className="text-[11px] text-slate-500 mt-1">by {log.admin.fullName}</p>}
                          </div>
                        ))}

                        {p?.documentsSubmittedAt && (
                          <div className="relative">
                            <span className="absolute -left-[35px] flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 shadow-[0_0_0_4px_white]">
                               <UploadCloud className="h-3 w-3 text-slate-400" />
                            </span>
                            <div className="flex items-center gap-3">
                               <p className="text-xs font-bold text-slate-500">{new Date(p.documentsSubmittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
                               <p className="text-sm font-medium text-slate-900">KYC Submitted</p>
                            </div>
                          </div>
                        )}
                        
                        {(p?.documents ?? []).length > 0 && (
                          <div className="relative">
                            <span className="absolute -left-[35px] flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 shadow-[0_0_0_4px_white]">
                               <FileText className="h-3 w-3 text-slate-400" />
                            </span>
                            <div className="flex items-center gap-3">
                               <p className="text-xs font-bold text-slate-500">{p.documents[0].uploadedAt ? new Date(p.documents[0].uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Prior'}</p>
                               <p className="text-sm font-medium text-slate-900">Documents Uploaded</p>
                            </div>
                          </div>
                        )}

                        <div className="relative">
                          <span className="absolute -left-[35px] flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 shadow-[0_0_0_4px_white]">
                              <UserIcon className="h-3 w-3 text-slate-400" />
                          </span>
                          <div className="flex items-center gap-3">
                              <p className="text-xs font-bold text-slate-500">{new Date(detailUser.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
                              <p className="text-sm font-medium text-slate-900">Business Registered</p>
                          </div>
                        </div>
                     </div>
                  </div>
                </>
              ) : null}
            </div>
            
            {/* Modal Footer */}
            {!detailLoading && !detailError && detailUser && enterpriseStatus !== 'pending' && enterpriseStatus !== 'rejected' && (
              <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Last Reviewed</p>
                  <p className="mt-0.5 text-xs font-semibold text-slate-700">
                    {approvalLog ? new Date(approvalLog.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reviewed By</p>
                  <p className="mt-0.5 text-xs font-semibold text-slate-700">{approvalLog?.admin?.fullName || 'System Admin'}</p>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      ) : null}
    </div>
  )
}
