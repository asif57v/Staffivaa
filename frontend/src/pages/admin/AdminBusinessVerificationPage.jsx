import { useEffect, useState } from 'react'
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
} from 'lucide-react'
import { CORPORATE_DOCUMENT_LABELS } from '../../constants/corporateVerification.js'
import { VENDOR_DOCUMENT_LABELS, VENDOR_TYPE_LABELS } from '../../constants/vendorVerification.js'
import { CORPORATE_STATUS } from '../../constants/userRoles.js'
import { AdminVerificationProfileDetails } from '../../components/admin/AdminVerificationProfileDetails.jsx'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
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
      <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-sky-900 ring-1 ring-sky-200/80">
        Submitted
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
  const [reviewNote, setReviewNote] = useState('')
  const [detailError, setDetailError] = useState('')

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

  useEffect(() => {
    if (!reviewId) {
      setDetailUser(null)
      setReviewNote('')
      setDetailError('')
      return
    }
    const fetchFn = isCorporate ? fetchCorporateDetail : fetchVendorDetail
    fetchFn(reviewId)
      .unwrap()
      .then((data) => {
        setDetailUser(data?.user ?? null)
        if (!data?.user) setDetailError('Account not found')
      })
      .catch((e) => {
        setDetailUser(null)
        setDetailError(e?.data?.message || e?.message || 'Failed to load account')
      })
  }, [reviewId, isCorporate, fetchCorporateDetail, fetchVendorDetail])

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
      setReviewId(null)
      activeQuery.refetch()
    } catch (e) {
      setDetailError(e?.data?.message || e?.message || 'Review failed')
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

  return (
    <div className="w-full space-y-6 pb-10">
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
                    const p = profileFor(u, tab)
                    const hasDocs = (p?.documents?.length ?? 0) > 0
                    const canReview =
                      hasDocs &&
                      (tab === 'corporate'
                        ? p?.status !== CORPORATE_STATUS.APPROVED
                        : p?.verificationStatus !== 'approved')
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
                            status={tab === 'corporate' ? p?.status : p?.verificationStatus}
                            submittedAt={p?.documentsSubmittedAt}
                            hasDocuments={(p?.documents?.length ?? 0) > 0}
                            variant={tab}
                          />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {p?.documents?.length ?? 0} file{(p?.documents?.length ?? 0) === 1 ? '' : 's'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setReviewId(u._id)}
                            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                              canReview
                                ? 'border border-brand/30 bg-brand/10 text-brand hover:bg-brand/15'
                                : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {canReview ? 'Review' : 'View'}
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

      {reviewId ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
            aria-label="Close"
            disabled={reviewBusy}
            onClick={() => !reviewBusy && setReviewId(null)}
          />
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-slate-200/90 bg-white shadow-2xl sm:rounded-3xl"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur-sm">
              <p className="text-sm font-extrabold text-slate-900">
                {isCorporate ? 'Corporate' : 'Vendor'} verification
              </p>
              <button
                type="button"
                disabled={reviewBusy}
                onClick={() => setReviewId(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-4">
              {detailLoading ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-brand" />
                  <p className="text-sm text-slate-600">Loading…</p>
                </div>
              ) : detailError && !detailUser ? (
                <p className="rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                  {detailError}
                </p>
              ) : detailUser ? (
                <>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400">Account</p>
                    <p className="text-base font-extrabold text-slate-900">{businessNameFor(detailUser, tab)}</p>
                    <p className="text-sm text-slate-600">{detailUser.fullName}</p>
                    <div className="mt-2">
                      <StatusPill
                        status={
                          tab === 'corporate'
                            ? profileFor(detailUser, tab)?.status
                            : profileFor(detailUser, tab)?.verificationStatus
                        }
                        submittedAt={profileFor(detailUser, tab)?.documentsSubmittedAt}
                        hasDocuments={(profileFor(detailUser, tab)?.documents?.length ?? 0) > 0}
                        variant={tab}
                      />
                    </div>
                  </div>

                  <AdminVerificationProfileDetails user={detailUser} variant={tab} />

                  <div>
                    <p className="mb-2 text-[11px] font-bold uppercase text-slate-500">Documents</p>
                    {(profileFor(detailUser, tab)?.documents ?? []).length === 0 ? (
                      <p className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                        No documents uploaded.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {(profileFor(detailUser, tab)?.documents ?? []).map((doc) => {
                          const typeLabel = documentTypeLabel(doc, tab)
                          return (
                            <li
                              key={doc._id || doc.url}
                              className="flex items-start gap-3 rounded-xl border border-slate-200/90 bg-slate-50 px-3 py-2.5"
                            >
                              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-900">
                                  {doc.label || typeLabel || 'Document'}
                                </p>
                                {typeLabel && doc.label && typeLabel !== doc.label ? (
                                  <p className="text-[11px] text-slate-500">{typeLabel}</p>
                                ) : null}
                                {doc.uploadedAt ? (
                                  <p className="text-[11px] text-slate-400">
                                    {new Date(doc.uploadedAt).toLocaleString('en-IN', {
                                      dateStyle: 'medium',
                                      timeStyle: 'short',
                                    })}
                                  </p>
                                ) : null}
                              </div>
                              {doc.url ? (
                                <a
                                  href={doc.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="shrink-0 text-xs font-bold text-brand"
                                >
                                  Open
                                </a>
                              ) : null}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>

                  {profileFor(detailUser, tab)?.reviewNote ? (
                    <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
                      Previous note: {profileFor(detailUser, tab).reviewNote}
                    </p>
                  ) : null}

                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500" htmlFor="biz-note">
                      Note if rejecting (optional)
                    </label>
                    <textarea
                      id="biz-note"
                      rows={2}
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="e.g. GST certificate is unclear — please re-upload"
                      className="w-full rounded-xl border border-slate-200/90 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
                    />
                  </div>

                  {detailError ? (
                    <p className="rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                      {detailError}
                    </p>
                  ) : null}

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      disabled={reviewBusy}
                      onClick={() => runReview('rejected')}
                      className="flex-1 rounded-2xl border border-rose-200/90 bg-rose-50 py-3 text-sm font-bold text-rose-900 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <AppPrimaryButton
                      type="button"
                      className="flex-1 py-3 text-sm"
                      disabled={
                        reviewBusy || !(profileFor(detailUser, tab)?.documents?.length > 0)
                      }
                      onClick={() => runReview('approved')}
                    >
                      {reviewBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      Approve
                    </AppPrimaryButton>
                  </div>
                </>
              ) : null}
            </div>
          </motion.div>
        </div>
      ) : null}
    </div>
  )
}
