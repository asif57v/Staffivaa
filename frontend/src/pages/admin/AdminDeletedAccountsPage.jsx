import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, ShieldAlert, UserX } from 'lucide-react'
import { listDeletedAccounts } from '../../api/deleteAccountApi.js'
import { fmtDateTime } from './deletedAccountShared.js'
import { RoleBadge } from './RoleBadge.jsx'

const ROLE_TABS = [
  { key: 'all', label: 'All' },
  { key: 'individual', label: 'Individual' },
  { key: 'corporate', label: 'Corporate' },
  { key: 'enterprise', label: 'Enterprise' },
  { key: 'contractor', label: 'Vendor' },
  { key: 'labour', label: 'Worker' },
]

export function AdminDeletedAccountsPage() {
  const [role, setRole] = useState('all')
  const [deletedBy, setDeletedBy] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0, pages: 1, roleCounts: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await listDeletedAccounts({ role, deletedBy, from, to, search, page, limit: 20 })
      setData(res.data)
    } catch (e) {
      setError(e?.message || 'Could not load deleted accounts')
    } finally {
      setLoading(false)
    }
  }, [role, deletedBy, from, to, search, page])

  useEffect(() => {
    load()
  }, [load])

  const totalAll = Object.values(data.roleCounts || {}).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold text-slate-900">
            <UserX className="h-5 w-5 text-rose-600" aria-hidden /> Deleted Accounts
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Archive of accounts deleted by users or admins. Read-only — kept for security and audit purposes.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {ROLE_TABS.map((t) => {
          const count = t.key === 'all' ? totalAll : data.roleCounts?.[t.key] || 0
          const active = role === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setRole(t.key)
                setPage(1)
              }}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold ring-1 transition ${
                active ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {t.label} <span className={active ? 'text-white/70' : 'text-slate-400'}>{count}</span>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, phone, email, company"
            className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
          />
        </div>
        <select
          value={deletedBy}
          onChange={(e) => {
            setDeletedBy(e.target.value)
            setPage(1)
          }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
        >
          <option value="all">Deleted by: anyone</option>
          <option value="self">Deleted by user (self)</option>
          <option value="admin">Deleted by admin</option>
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value)
            setPage(1)
          }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          aria-label="Deleted from date"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value)
            setPage(1)
          }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          aria-label="Deleted to date"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <ShieldAlert className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Phone / Email</th>
                <th className="px-4 py-3">Deleted on</th>
                <th className="px-4 py-3">Deleted by</th>
                <th className="px-4 py-3 text-right">Wallet at deletion</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && !data.items.length ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : !data.items.length ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    No deleted accounts found.
                  </td>
                </tr>
              ) : (
                data.items.map((a) => (
                  <tr key={a._id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">{a.fullName || '—'}</p>
                      {a.companyName && <p className="text-xs text-slate-500">{a.companyName}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={a.role} />
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <p>{a.phone || '—'}</p>
                      <p className="text-xs text-slate-500">{a.email || ''}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{fmtDateTime(a.deletedAt)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ring-1 ${
                          a.deletedBy === 'admin'
                            ? 'bg-amber-50 text-amber-800 ring-amber-200'
                            : 'bg-slate-100 text-slate-700 ring-slate-200'
                        }`}
                      >
                        {a.deletedBy === 'admin' ? a.deletedByName || 'Admin' : 'Self'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">₹{a.walletBalanceAtDeletion || 0}</td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-slate-600" title={a.deleteReason}>
                      {a.deleteReason || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/admin/deleted-accounts/${a._id}`}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700"
                      >
                        View details
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
          <span>
            {data.total} account{data.total === 1 ? '' : 's'} · Page {page} of {data.pages || 1}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={page >= (data.pages || 1)}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
