import { useCallback, useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { MessageCircle, Package, RefreshCw, Search } from 'lucide-react'
import {
  buildWhatsAppLeadUrl,
  fetchAdminBuildMartLeads,
  updateBuildMartLeadStatus,
} from '../../api/adminBuildmartApi.js'
import { ApiError } from '../../api/http.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
]

function StatusPill({ status }) {
  const tones = {
    new: 'bg-orange-50 text-orange-900 ring-orange-200/80',
    contacted: 'bg-sky-50 text-sky-900 ring-sky-200/80',
    quoted: 'bg-violet-50 text-violet-900 ring-violet-200/80',
    won: 'bg-emerald-50 text-emerald-900 ring-emerald-200/80',
    lost: 'bg-slate-100 text-slate-600 ring-slate-200/80',
  }
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ${tones[status] || tones.new}`}
    >
      {status}
    </span>
  )
}

export function AdminBuildMartLeadsPage() {
  const reduce = useReducedMotion()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 350)
    return () => window.clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debounced, status])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchAdminBuildMartLeads({
        search: debounced,
        status,
        page,
        limit: 15,
      })
      setItems(data?.items ?? [])
      setTotal(data?.total ?? 0)
      setPages(data?.pages ?? 1)
    } catch (e) {
      setItems([])
      setError(e instanceof ApiError ? e.message : 'Could not load leads')
    } finally {
      setLoading(false)
    }
  }, [debounced, status, page])

  useEffect(() => {
    load()
  }, [load])

  async function handleStatusChange(id, next) {
    try {
      await updateBuildMartLeadStatus(id, next)
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Update failed')
    }
  }

  return (
    <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl buildmart-gradient text-white">
              <Package className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="text-lg font-extrabold text-slate-900 md:text-xl">BuildMart quote leads</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Material quote requests from the app — {total} total lead{total === 1 ? '' : 's'}.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:border-brand/30"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          Refresh
        </button>
      </div>

      <GlassPanel className="flex items-center gap-3 p-4">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, product…"
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 w-48 shrink-0"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </GlassPanel>

      {error ? (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 ring-1 ring-rose-200/80">
          {error}
        </p>
      ) : null}

      <div className="space-y-3">
        {loading && items.length === 0 ? (
          <p className="text-sm text-slate-500">Loading leads…</p>
        ) : items.length === 0 ? (
          <GlassPanel className="p-8 text-center text-sm text-slate-600">No leads yet.</GlassPanel>
        ) : (
          items.map((lead) => {
            const wa = buildWhatsAppLeadUrl(lead)
            return (
              <GlassPanel key={lead._id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-extrabold text-slate-900">{lead.productName}</p>
                      <StatusPill status={lead.status} />
                    </div>
                    {lead.variantLabel ? (
                      <p className="text-xs font-medium text-slate-500">Variant: {lead.variantLabel}</p>
                    ) : null}
                    <p className="text-sm text-slate-700">
                      {lead.name} · <span className="font-mono">{lead.phone}</span>
                    </p>
                    <p className="text-xs text-slate-500">{lead.siteLocation}</p>
                    <p className="text-xs font-semibold text-slate-600">
                      Qty: {lead.quantity}
                      {lead.deliveryDate ? ` · Delivery ${lead.deliveryDate}` : ''}
                    </p>
                    {lead.notes ? <p className="text-xs italic text-slate-500">{lead.notes}</p> : null}
                    <p className="text-[10px] text-slate-400">
                      {new Date(lead.createdAt).toLocaleString()}
                      {lead.userRole ? ` · ${lead.userRole}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <select
                      value={lead.status}
                      onChange={(e) => handleStatusChange(lead._id, e.target.value)}
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold"
                    >
                      {STATUS_OPTIONS.filter((o) => o.value !== 'all').map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white"
                      >
                        <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                        WhatsApp
                      </a>
                    ) : null}
                  </div>
                </div>
              </GlassPanel>
            )
          })
        )}
      </div>

      {pages > 1 ? (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border px-3 py-1.5 text-sm font-bold disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600">
            Page {page} of {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border px-3 py-1.5 text-sm font-bold disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </motion.div>
  )
}
