import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Eye, EyeOff, FileImage, Loader2, ShieldAlert } from 'lucide-react'
import {
  getDeletedAccount,
  getDeletedAccountKyc,
  getDeletedAccountRecords,
} from '../../api/deleteAccountApi.js'
import { fmtDateTime } from './deletedAccountShared.js'
import { RoleBadge } from './RoleBadge.jsx'

const TABS = [
  { key: 'profile', label: 'Profile' },
  { key: 'kyc', label: 'KYC Documents' },
  { key: 'wallet', label: 'Wallet & Payments' },
  { key: 'activity', label: 'Activity' },
  { key: 'support', label: 'Support' },
  { key: 'deletion', label: 'Deletion Info' },
]

const WALLET_MODELS = [
  'WalletTransaction', 'Payment', 'Withdrawal', 'RefundRequest', 'Invoice', 'EarningsLedger', 'Settlement',
  'EnterpriseWalletTransaction', 'EnterpriseWallet', 'EnterpriseJoiningInvoice', 'EnterprisePayroll',
  'EnterprisePayrollInvoice', 'EnterpriseEscrowTransaction', 'EnterpriseDirectPayment', 'PayoutBatch', 'Commission',
  'WageAssignment', 'EnterpriseFinancialAuditLog',
]
const SUPPORT_MODELS = ['SupportTicket', 'Notification', 'OtpAuditLog', 'BuildMartLead']

const SKIP_KEYS = new Set(['_id', '__v', 'passwordHash', 'id'])
const SENSITIVE_RE = /aadhaar|aadhar|accountnumber|account_number|ifsc|pan(number|no)?$|upi|gst/i
const MEDIA_RE = /^(https?:\/\/|\/uploads\/).+(\.(png|jpe?g|webp|gif|pdf)(\?.*)?$|cloudinary|amazonaws|firebasestorage)/i

const humanize = (k) =>
  k
    .replace(/\./g, ' › ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())

/** Flatten an object into [path, value] rows (primitives + primitive arrays only) */
function flatten(obj, prefix = '', out = []) {
  if (obj == null) return out
  for (const [k, v] of Object.entries(obj)) {
    if (SKIP_KEYS.has(k)) continue
    const path = prefix ? `${prefix}.${k}` : k
    if (v == null || v === '') continue
    if (Array.isArray(v)) {
      if (!v.length) continue
      if (v.every((i) => typeof i !== 'object')) out.push([path, v.join(', ')])
      else out.push([path, `${v.length} item(s)`])
    } else if (typeof v === 'object') {
      if (v._bsontype || v.$oid || typeof v.toISOString === 'function') out.push([path, String(v.$oid || v)])
      else flatten(v, path, out)
    } else out.push([path, v])
  }
  return out
}

function collectMedia(obj, prefix = '', out = []) {
  if (!obj || typeof obj !== 'object') return out
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string' && MEDIA_RE.test(v)) out.push({ label: humanize(path), url: v })
    else if (Array.isArray(v)) v.forEach((i, idx) => typeof i === 'string' ? MEDIA_RE.test(i) && out.push({ label: `${humanize(path)} ${idx + 1}`, url: i }) : collectMedia(i, `${path}.${idx}`, out))
    else if (v && typeof v === 'object') collectMedia(v, path, out)
  }
  return out
}

const isDateStr = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)

function fmtValue(v) {
  if (isDateStr(v)) return fmtDateTime(v)
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

function Field({ path, value }) {
  const sensitive = SENSITIVE_RE.test(path) && typeof value === 'string' && value.length > 4
  const [show, setShow] = useState(false)
  const text = fmtValue(value)
  const masked = sensitive && !show ? `${'•'.repeat(Math.max(4, text.length - 4))}${text.slice(-4)}` : text
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{humanize(path)}</p>
      <p className="mt-0.5 flex items-center gap-2 break-words text-sm font-semibold text-slate-900">
        <span className="min-w-0 break-all">{masked}</span>
        {sensitive && (
          <button type="button" onClick={() => setShow((s) => !s)} className="shrink-0 text-slate-400 hover:text-slate-700" aria-label={show ? 'Hide' : 'Reveal'}>
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </p>
    </div>
  )
}

function FieldGrid({ data }) {
  const rows = useMemo(() => flatten(data).filter(([, v]) => !(typeof v === 'string' && (v.startsWith('data:') || v.length > 400))), [data])
  if (!rows.length) return <p className="text-sm text-slate-500">No information available.</p>
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(([p, v]) => (
        <Field key={p} path={p} value={v} />
      ))}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-700">{title}</h3>
      {children}
    </section>
  )
}

const PRIORITY_COLS = [
  'transactionId', 'reference', 'orderId', 'title', 'subject', 'type', 'status', 'amount', 'totalAmount', 'netAmount',
  'source', 'payerType', 'description', 'locationText', 'date', 'shiftDate', 'createdAt',
]

/** Lazily loaded, paginated table for one archived model */
function RecordTable({ accountId, model, total }) {
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState([])
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [openRow, setOpenRow] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getDeletedAccountRecords(accountId, model, page, 15)
      .then((res) => {
        if (cancelled) return
        setRows(res.data.items || [])
        setPages(res.data.pages || 1)
      })
      .catch(() => !cancelled && setRows([]))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [accountId, model, page])

  const columns = useMemo(() => {
    const scalarKeys = new Set()
    rows.slice(0, 10).forEach((r) =>
      Object.entries(r || {}).forEach(([k, v]) => {
        if (!SKIP_KEYS.has(k) && v != null && typeof v !== 'object') scalarKeys.add(k)
      }),
    )
    const ordered = PRIORITY_COLS.filter((c) => scalarKeys.has(c))
    for (const k of scalarKeys) if (!ordered.includes(k) && ordered.length < 7) ordered.push(k)
    return ordered.slice(0, 7)
  }, [rows])

  return (
    <Section title={`${humanize(model)} (${total})`}>
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-2">{humanize(c)}</th>
                ))}
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <Fragment key={r._id || i}>
                  <tr className="hover:bg-slate-50">
                    {columns.map((c) => (
                      <td key={c} className="max-w-[220px] truncate px-3 py-2 text-slate-800" title={String(r[c] ?? '')}>
                        {r[c] == null ? '—' : fmtValue(r[c])}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => setOpenRow(openRow === i ? null : i)} className="font-bold text-sky-700 hover:underline">
                        {openRow === i ? 'Hide' : 'Full details'}
                      </button>
                    </td>
                  </tr>
                  {openRow === i && (
                    <tr key={`${r._id || i}-d`}>
                      <td colSpan={columns.length + 1} className="bg-slate-50 px-3 py-3">
                        <FieldGrid data={r} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="py-3 text-sm text-slate-500">No records.</p>}
        </div>
      )}
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-slate-600">
          <span>Page {page} of {pages}</span>
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-200 p-1 disabled:opacity-40" aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-200 p-1 disabled:opacity-40" aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </Section>
  )
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-slate-900">{value}</p>
    </div>
  )
}

export function AdminDeletedAccountDetailPage() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('profile')
  const [kycImages, setKycImages] = useState(null)
  const [kycLoading, setKycLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getDeletedAccount(id)
      .then((res) => !cancelled && setData(res.data))
      .catch((e) => !cancelled && setError(e?.message || 'Could not load archived account'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id])

  const account = data?.account
  const counts = useMemo(() => data?.archivedCounts || {}, [data])

  const modelsFor = useCallback(
    (tabKey) => {
      const names = Object.keys(counts)
      if (tabKey === 'wallet') return names.filter((n) => WALLET_MODELS.includes(n))
      if (tabKey === 'support') return names.filter((n) => SUPPORT_MODELS.includes(n))
      return names.filter((n) => !WALLET_MODELS.includes(n) && !SUPPORT_MODELS.includes(n))
    },
    [counts],
  )

  const snapshot = account?.userSnapshot
  const media = useMemo(() => (snapshot ? collectMedia(snapshot) : []), [snapshot])

  const loadKyc = async () => {
    setKycLoading(true)
    try {
      const res = await getDeletedAccountKyc(id)
      setKycImages(res.data.images || {})
    } catch (e) {
      setError(e?.message || 'Could not load KYC documents')
    } finally {
      setKycLoading(false)
    }
  }

  const exportJson = async () => {
    setExporting(true)
    try {
      const records = {}
      for (const model of Object.keys(counts)) {
        records[model] = []
        let page = 1
        let pages = 1
        do {
          const res = await getDeletedAccountRecords(id, model, page, 100)
          records[model].push(...(res.data.items || []))
          pages = res.data.pages || 1
          page += 1
        } while (page <= pages)
      }
      const blob = new Blob([JSON.stringify({ account, records }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `deleted-account-${account.originalUserId}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e?.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }
  if (!account) {
    return (
      <div className="space-y-3">
        <Link to="/admin/deleted-accounts" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <p className="text-sm text-rose-700">{error || 'Archived account not found'}</p>
      </div>
    )
  }

  const bookingCount = (counts.WorkforceRequest || 0) + (counts.EnterpriseJob || 0)
  const paymentCount = (counts.Payment || 0) + (counts.WalletTransaction || 0)
  const roleProfile = snapshot?.labourProfile || snapshot?.corporateProfile || snapshot?.enterpriseProfile || snapshot?.contractorProfile
  const { labourProfile, corporateProfile, enterpriseProfile, contractorProfile, bankAccountDetails, upiDetails, adminNotes, ...basic } = snapshot || {}

  return (
    <div className="space-y-5">
      <Link to="/admin/deleted-accounts" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Deleted Accounts
      </Link>

      <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-900">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          This account was deleted on <b>{fmtDateTime(account.deletedAt)}</b> by{' '}
          <b>{account.deletedBy === 'admin' ? account.deletedByName || 'an admin' : 'the user (self)'}</b>. Data below is an
          archived, read-only snapshot.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {account.profileImageUrl ? (
            <img src={account.profileImageUrl} alt="" className="h-12 w-12 rounded-full object-cover ring-1 ring-slate-200" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-lg font-extrabold text-slate-600">
              {(account.fullName || '?').charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">{account.fullName || 'Unnamed'}</h1>
            <p className="text-sm text-slate-600">{[account.companyName, account.phone, account.email].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={exportJson}
          disabled={exporting}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download JSON
        </button>
      </div>

      {error && <p className="text-sm text-rose-700">{error}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SummaryCard label="Role" value={<RoleBadge role={account.role} />} />
        <SummaryCard label="Deleted on" value={<span className="text-sm">{fmtDateTime(account.deletedAt)}</span>} />
        <SummaryCard label="Wallet at deletion" value={`₹${account.walletBalanceAtDeletion || 0}`} />
        <SummaryCard label="Bookings / Jobs" value={bookingCount} />
        <SummaryCard label="Payments & txns" value={paymentCount} />
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-bold transition ${
              tab === t.key ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="space-y-4">
          <Section title="Identity">
            <FieldGrid data={basic} />
          </Section>
          {roleProfile && (
            <Section title={`${labourProfile ? 'Worker' : corporateProfile ? 'Corporate' : enterpriseProfile ? 'Enterprise' : contractorProfile ? 'Vendor' : 'Role'} details`}>
              <FieldGrid data={roleProfile} />
            </Section>
          )}
          {(bankAccountDetails || upiDetails) && (
            <Section title="Bank / UPI (masked)">
              <FieldGrid data={{ bank: bankAccountDetails, upi: upiDetails }} />
            </Section>
          )}
          {adminNotes?.length > 0 && (
            <Section title="Admin notes">
              <ul className="space-y-1.5 text-sm text-slate-700">
                {adminNotes.map((n, i) => (
                  <li key={i} className="rounded-xl bg-slate-50 px-3 py-2">{n.text}</li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}

      {tab === 'kyc' && (
        <div className="space-y-4">
          <Section title="Documents & images">
            {media.length === 0 && !data.hasKycImages ? (
              <p className="text-sm text-slate-500">No KYC documents were uploaded for this account.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {media.map((m) => (
                  <a key={m.url} href={m.url} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    {/\.pdf(\?|$)/i.test(m.url) ? (
                      <div className="flex h-32 items-center justify-center text-slate-400"><FileImage className="h-8 w-8" /></div>
                    ) : (
                      <img src={m.url} alt={m.label} className="h-32 w-full object-cover" loading="lazy" />
                    )}
                    <p className="truncate px-2 py-1.5 text-[11px] font-semibold text-slate-700 group-hover:underline">{m.label}</p>
                  </a>
                ))}
                {kycImages &&
                  Object.entries(kycImages).map(([k, url]) => (
                    <a key={k} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                      <img src={url} alt={humanize(k)} className="h-32 w-full object-cover" />
                      <p className="truncate px-2 py-1.5 text-[11px] font-semibold text-slate-700">{humanize(k.replace('DataUrl', ''))}</p>
                    </a>
                  ))}
              </div>
            )}
            {data.hasKycImages && !kycImages && (
              <button
                type="button"
                onClick={loadKyc}
                disabled={kycLoading}
                className="mt-3 flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-60"
              >
                {kycLoading && <Loader2 className="h-4 w-4 animate-spin" />} Load archived KYC images (audit logged)
              </button>
            )}
          </Section>
          {labourProfile && (
            <Section title="KYC details (masked)">
              <FieldGrid data={labourProfile} />
            </Section>
          )}
        </div>
      )}

      {['wallet', 'activity', 'support'].includes(tab) && (
        <div className="space-y-4">
          {tab === 'wallet' && (
            <Section title="Wallet summary">
              <FieldGrid data={{ walletBalanceAtDeletion: account.walletBalanceAtDeletion, walletFrozen: snapshot?.isWalletFrozen }} />
            </Section>
          )}
          {modelsFor(tab).length === 0 ? (
            <p className="text-sm text-slate-500">No archived records in this section.</p>
          ) : (
            modelsFor(tab).map((m) => <RecordTable key={m} accountId={id} model={m} total={counts[m]} />)
          )}
        </div>
      )}

      {tab === 'deletion' && (
        <div className="space-y-4">
          <Section title="Deletion details">
            <FieldGrid
              data={{
                deletedAt: account.deletedAt,
                deletedBy: account.deletedBy === 'admin' ? `Admin (${account.deletedByName || 'unknown'})` : 'Self (user)',
                reason: account.deleteReason,
                ipAddress: account.ipAddress,
                device: account.userAgent,
                statusBeforeDeletion: account.statusBeforeDeletion,
                registeredAt: account.registeredAt,
                lastLoginAt: account.lastLoginAt,
                originalUserId: account.originalUserId,
              }}
            />
          </Section>
          <Section title="Archived records">
            <FieldGrid data={Object.fromEntries(Object.entries(account.relatedCounts || {}))} />
          </Section>
        </div>
      )}
    </div>
  )
}
