import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, Building2, ChevronLeft, ChevronRight, IdCard, RefreshCw, Search, ShieldCheck, Users, Wrench, X } from 'lucide-react'
import { fetchAdminUsers } from '../../api/adminUsersApi.js'
import { fetchLabourCategoriesGrouped } from '../../api/labourCategoriesApi.js'
import { ApiError } from '../../api/http.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { ROLE_LABELS, ROLE_LIST } from '../../constants/userRoles.js'
import { ACCOUNT_STATUS_COLORS, ACCOUNT_STATUS_LABELS, ACCOUNT_STATUSES } from '../../constants/userStatuses.js'
import { formatLastLoginDisplay } from '../../lib/formatAdminLastLogin.js'

function StatusPill({ status, active }) {
  const accountStatus = status || (active !== false ? ACCOUNT_STATUSES.ACTIVE : ACCOUNT_STATUSES.DELETED)
  const colorClass = ACCOUNT_STATUS_COLORS[accountStatus] || ACCOUNT_STATUS_COLORS[ACCOUNT_STATUSES.ACTIVE]
  const label = ACCOUNT_STATUS_LABELS[accountStatus] || 'Active'

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ${colorClass}`}>
      {label}
    </span>
  )
}

function RolePill({ role }) {
  return (
    <span className="inline-flex max-w-full truncate rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize text-slate-800 ring-1 ring-slate-200/80">
      {ROLE_LABELS[role] || role}
    </span>
  )
}

function VerificationPill({ user }) {
  if (!user) return <span className="text-slate-400">—</span>

  if (user.role === 'labour') {
    const kyc = user.labourProfile?.kycStatus
    if (kyc === 'verified') {
      return (
        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200">
          Verified
        </span>
      )
    }
    if (kyc === 'failed') {
      return (
        <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-800 ring-1 ring-rose-200">
          Failed
        </span>
      )
    }
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">
        Not Verified
      </span>
    )
  }

  if (user.role === 'contractor') {
    const st = user.contractorProfile?.verificationStatus
    if (st === 'approved') {
      return (
        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200">
          Verified
        </span>
      )
    }
    if (st === 'rejected') {
      return (
        <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-800 ring-1 ring-rose-200">
          Failed
        </span>
      )
    }
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">
        Not Verified
      </span>
    )
  }

  if (user.role === 'corporate') {
    const st = user.corporateProfile?.status
    if (st === 'approved') {
      return (
        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200">
          Verified
        </span>
      )
    }
    if (st === 'rejected') {
      return (
        <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-800 ring-1 ring-rose-200">
          Failed
        </span>
      )
    }
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">
        Not Verified
      </span>
    )
  }

  if (user.role === 'enterprise') {
    const st = user.enterpriseProfile?.status
    if (st === 'approved') {
      return (
        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200">
          Verified
        </span>
      )
    }
    if (st === 'rejected') {
      return (
        <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-800 ring-1 ring-rose-200">
          Failed
        </span>
      )
    }
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">
        Not Verified
      </span>
    )
  }

  if (user.role === 'individual') {
    if (user.accountStatus === 'suspended' || user.accountStatus === 'blocked') {
      return (
        <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-800 ring-1 ring-rose-200">
          Suspended
        </span>
      )
    }
    if (user.isPhoneVerified) {
      return (
        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200">
          Verified
        </span>
      )
    }
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">
        Not Verified
      </span>
    )
  }

  if (user.isPhoneVerified) {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200">
        Verified
      </span>
    )
  }

  return <span className="text-xs text-slate-400 font-medium">—</span>
}

function getWorkerOrVendorSkills(user) {
  if (!user) return []
  if (user.role === 'contractor' || user.contractorProfile) {
    const cats = user.contractorProfile?.categoryIds || []
    const catNames = cats
      .map((c) => (c && typeof c === 'object' && c.name ? c.name : (typeof c === 'string' ? c : null)))
      .filter(Boolean)
    const rawSkills = Array.isArray(user.contractorProfile?.skills) ? user.contractorProfile.skills : []
    const cleanSkills = rawSkills.map((s) => String(s).trim()).filter(Boolean)
    return Array.from(new Set([...catNames, ...cleanSkills]))
  }
  if (user.role === 'labour' || user.labourProfile) {
    const cats = user.labourProfile?.categoryIds || []
    const catNames = cats
      .map((c) => (c && typeof c === 'object' && c.name ? c.name : (typeof c === 'string' ? c : null)))
      .filter(Boolean)
    const rawSkills = Array.isArray(user.labourProfile?.skills) ? user.labourProfile.skills : []
    const cleanSkills = rawSkills.map((s) => String(s).trim()).filter(Boolean)
    return Array.from(new Set([...catNames, ...cleanSkills]))
  }
  return []
}

function UserSkillBadges({ user, max = 3 }) {
  const skills = getWorkerOrVendorSkills(user)
  if (!skills.length) return <span className="text-xs text-slate-400 font-medium">—</span>

  const visible = skills.slice(0, max)
  const remaining = skills.length - max

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((sk, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-slate-800 ring-1 ring-amber-300/80 shadow-2xs"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#FFC107] shrink-0" />
          {sk}
        </span>
      ))}
      {remaining > 0 && (
        <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
          +{remaining} more
        </span>
      )}
    </div>
  )
}

function getRoleStatCards(role, stats) {
  if (role === 'contractor') {
    return [
      {
        key: 'pending',
        label: 'Verification pending',
        value: stats?.pending ?? '—',
        hint: 'Needs review',
        icon: ShieldCheck,
        tone: 'from-amber-500/15 to-amber-50/40',
        filter: 'pending',
      },
      {
        key: 'verified',
        label: 'Verified vendors',
        value: stats?.verified ?? '—',
        hint: 'Approved contractors',
        icon: IdCard,
        tone: 'from-brand/20 to-emerald-50/80',
        filter: 'verified',
      },
      {
        key: 'failed',
        label: 'Verification failed',
        value: stats?.failed ?? '—',
        hint: 'Rejected / follow up',
        icon: ShieldCheck,
        tone: 'from-rose-500/12 to-rose-50/35',
        filter: 'failed',
      },
      {
        key: 'total',
        label: 'Vendor accounts',
        value: stats?.total ?? '—',
        hint: 'Search + account status',
        icon: Users,
        tone: 'from-sky-500/15 to-slate-50',
        filter: null,
      },
    ]
  }

  if (role === 'corporate') {
    return [
      {
        key: 'pending',
        label: 'Verification pending',
        value: stats?.pending ?? '—',
        hint: 'Needs review',
        icon: ShieldCheck,
        tone: 'from-amber-500/15 to-amber-50/40',
        filter: 'pending',
      },
      {
        key: 'verified',
        label: 'Verified corporates',
        value: stats?.verified ?? '—',
        hint: 'Approved corporate',
        icon: IdCard,
        tone: 'from-brand/20 to-emerald-50/80',
        filter: 'verified',
      },
      {
        key: 'failed',
        label: 'Verification failed',
        value: stats?.failed ?? '—',
        hint: 'Rejected / follow up',
        icon: ShieldCheck,
        tone: 'from-rose-500/12 to-rose-50/35',
        filter: 'failed',
      },
      {
        key: 'total',
        label: 'Corporate accounts',
        value: stats?.total ?? '—',
        hint: 'Search + account status',
        icon: Users,
        tone: 'from-sky-500/15 to-slate-50',
        filter: null,
      },
    ]
  }

  if (role === 'enterprise') {
    return [
      {
        key: 'pending',
        label: 'KYC pending',
        value: stats?.pending ?? '—',
        hint: 'Needs review',
        icon: ShieldCheck,
        tone: 'from-amber-500/15 to-amber-50/40',
        filter: 'pending',
      },
      {
        key: 'verified',
        label: 'KYC verified',
        value: stats?.verified ?? '—',
        hint: 'Enterprise verified',
        icon: IdCard,
        tone: 'from-brand/20 to-emerald-50/80',
        filter: 'verified',
      },
      {
        key: 'failed',
        label: 'KYC failed',
        value: stats?.failed ?? '—',
        hint: 'Follow up',
        icon: ShieldCheck,
        tone: 'from-rose-500/12 to-rose-50/35',
        filter: 'failed',
      },
      {
        key: 'total',
        label: 'Enterprise accounts',
        value: stats?.total ?? '—',
        hint: 'Search + account status',
        icon: Users,
        tone: 'from-sky-500/15 to-slate-50',
        filter: null,
      },
    ]
  }

  if (role === 'individual') {
    return [
      {
        key: 'pending',
        label: 'Pending verification',
        value: stats?.pending ?? '—',
        hint: 'Unverified phone',
        icon: ShieldCheck,
        tone: 'from-amber-500/15 to-amber-50/40',
        filter: 'pending',
      },
      {
        key: 'verified',
        label: 'Verified users',
        value: stats?.verified ?? '—',
        hint: 'Active & phone verified',
        icon: IdCard,
        tone: 'from-brand/20 to-emerald-50/80',
        filter: 'verified',
      },
      {
        key: 'failed',
        label: 'Suspended / blocked',
        value: stats?.failed ?? '—',
        hint: 'Restricted accounts',
        icon: ShieldCheck,
        tone: 'from-rose-500/12 to-rose-50/35',
        filter: 'failed',
      },
      {
        key: 'total',
        label: 'Individual accounts',
        value: stats?.total ?? '—',
        hint: 'Search + account status',
        icon: Users,
        tone: 'from-sky-500/15 to-slate-50',
        filter: null,
      },
    ]
  }

  if (role === 'labour') {
    return [
      {
        key: 'pending',
        label: 'KYC pending',
        value: stats?.pending ?? '—',
        hint: 'Needs review',
        icon: ShieldCheck,
        tone: 'from-amber-500/15 to-amber-50/40',
        filter: 'pending',
      },
      {
        key: 'verified',
        label: 'KYC verified',
        value: stats?.verified ?? '—',
        hint: 'Ready to deploy',
        icon: IdCard,
        tone: 'from-brand/20 to-emerald-50/80',
        filter: 'verified',
      },
      {
        key: 'failed',
        label: 'KYC failed',
        value: stats?.failed ?? '—',
        hint: 'Follow up',
        icon: ShieldCheck,
        tone: 'from-rose-500/12 to-rose-50/35',
        filter: 'failed',
      },
      {
        key: 'total',
        label: 'Labour accounts',
        value: stats?.total ?? '—',
        hint: 'Search + account status',
        icon: Users,
        tone: 'from-sky-500/15 to-slate-50',
        filter: null,
      },
    ]
  }

  // Default / All Users Combined
  return [
    {
      key: 'pending',
      label: 'Pending verification',
      value: stats?.pending ?? '—',
      hint: 'Needs review',
      icon: ShieldCheck,
      tone: 'from-amber-500/15 to-amber-50/40',
      filter: 'pending',
    },
    {
      key: 'verified',
      label: 'Verified accounts',
      value: stats?.verified ?? '—',
      hint: 'Ready / approved',
      icon: IdCard,
      tone: 'from-brand/20 to-emerald-50/80',
      filter: 'verified',
    },
    {
      key: 'failed',
      label: 'Failed / restricted',
      value: stats?.failed ?? '—',
      hint: 'Follow up needed',
      icon: ShieldCheck,
      tone: 'from-rose-500/12 to-rose-50/35',
      filter: 'failed',
    },
    {
      key: 'total',
      label: 'Total accounts',
      value: stats?.total ?? '—',
      hint: 'Search + account status',
      icon: Users,
      tone: 'from-sky-500/15 to-slate-50',
      filter: null,
    },
  ]
}

export function AdminUsersPage({ fixedRole, customTitle }) {
  const reduce = useReducedMotion()
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '')
  const [debouncedSearch, setDebouncedSearch] = useState(() => (searchParams.get('search') || '').trim())
  const [role, setRole] = useState(fixedRole || '')
  const [status, setStatus] = useState(() => searchParams.get('status') || 'all')
  const [kycFilter, setKycFilter] = useState(() => {
    const k = searchParams.get('kyc')
    return ['pending', 'verified', 'failed'].includes(k) ? k : 'all'
  })
  const [skillFilter, setSkillFilter] = useState(() => searchParams.get('skill') || 'all')
  const [categoryGroups, setCategoryGroups] = useState([])
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get('page')) || 1))
  const limit = 15

  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [summaryStats, setSummaryStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchLabourCategoriesGrouped()
      .then((res) => {
        if (!cancelled && res?.data?.groups) {
          setCategoryGroups(res.data.groups)
        }
      })
      .catch((err) => {
        console.error('Failed to load category groups', err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (fixedRole) {
      setRole(fixedRole)
      return
    }
    const fromUrl = searchParams.get('role')
    if (fromUrl && ROLE_LIST.includes(fromUrl)) setRole(fromUrl)
  }, [searchParams, fixedRole])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 350)
    return () => window.clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, role, status, kycFilter, skillFilter])

  useEffect(() => {
    const next = new URLSearchParams()
    if (debouncedSearch) next.set('search', debouncedSearch)
    if (!fixedRole && role) next.set('role', role)
    if (kycFilter !== 'all') next.set('kyc', kycFilter)
    if (status !== 'all') next.set('status', status)
    if (skillFilter !== 'all') next.set('skill', skillFilter)
    if (page > 1) next.set('page', String(page))
    setSearchParams(next, { replace: true })
  }, [debouncedSearch, fixedRole, role, kycFilter, status, skillFilter, page, setSearchParams])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchAdminUsers({
        search: debouncedSearch,
        role: role || undefined,
        status,
        kycStatus: kycFilter !== 'all' ? kycFilter : undefined,
        skill: skillFilter !== 'all' ? skillFilter : undefined,
        page,
        limit,
      })
      setItems(data?.items ?? [])
      setTotal(data?.total ?? 0)
      setPages(data?.pages ?? 1)
      setSummaryStats(data?.summaryCounts || data?.labourKycCounts || null)
    } catch (e) {
      setItems([])
      setSummaryStats(null)
      setError(e instanceof ApiError ? e.message : 'Could not load users')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, role, status, kycFilter, skillFilter, page, limit])

  useEffect(() => {
    load()
  }, [load])

  const selectedSkillName = useMemo(() => {
    if (!skillFilter || skillFilter === 'all') return ''
    for (const g of categoryGroups) {
      for (const c of g.categories || []) {
        if (String(c._id) === String(skillFilter) || c.name === skillFilter) return c.name
      }
    }
    return skillFilter
  }, [skillFilter, categoryGroups])

  const activeRole = fixedRole || role || ''
  const statCards = getRoleStatCards(activeRole, summaryStats)
  const isKycLabel = activeRole === 'enterprise' || activeRole === 'labour'

  return (
    <div className="w-full space-y-6 pb-10">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 md:text-xl">{customTitle || 'All users'}</h2>
          <p className="mt-1 text-sm text-slate-600">
            Search by name, email, or mobile. Filter by verification and account status. Summary tiles use search and active/inactive only — not the verification dropdown.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {fixedRole ? (
            <Link
              to="/admin/users"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-brand/35 hover:text-brand"
            >
              All user roles
              <ArrowUpRight className="h-4 w-4 opacity-70" aria-hidden />
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand/30 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Summary KPI Cards Grid */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 w-full">
        {statCards.map((c, i) => {
          const isFilterActive = c.filter && kycFilter === c.filter
          const inner = (
            <GlassPanel
              className={`relative h-full overflow-hidden p-3 bg-linear-to-br ${c.tone} ${isFilterActive ? 'ring-2 ring-brand/50 shadow-md' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-500">{c.label}</p>
                  <p className="mt-1 text-xl font-black tabular-nums text-slate-900">{c.value}</p>
                  <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">{c.hint}</p>
                  {c.filter ? (
                    <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-wide text-brand">
                      {isFilterActive ? 'Filter on · clear' : 'Tap to filter'}
                    </p>
                  ) : null}
                </div>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80 text-slate-700 shadow-sm ring-1 ring-slate-200/80">
                  <c.icon className="h-4 w-4" aria-hidden />
                </span>
              </div>
            </GlassPanel>
          )

          if (!c.filter) {
            return (
              <motion.div
                key={c.key}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.04 * i }}
              >
                {inner}
              </motion.div>
            )
          }

          return (
            <motion.button
              key={c.key}
              type="button"
              onClick={() => setKycFilter((prev) => (prev === c.filter ? 'all' : c.filter))}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.04 * i }}
              className="text-left transition hover:opacity-95 focus-visible:outline focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              {inner}
            </motion.button>
          )
        })}
      </div>

      <GlassPanel className="p-4 md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center w-full">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Name, email, or mobile number…"
                className="w-full rounded-xl border border-slate-200/90 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm outline-none ring-slate-200/80 focus:ring-2 focus:ring-brand/35"
              />
            </div>
          </div>

          {(!fixedRole || fixedRole === 'contractor' || fixedRole === 'labour') && (
            <div className="w-full sm:w-48 shrink-0">
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Skill / Trade
              </label>
              <select
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand/35"
              >
                <option value="all">All skills / trades</option>
                {categoryGroups.map((g) => (
                  <optgroup key={g._id} label={g.name}>
                    {(g.categories || []).map((cat) => (
                      <option key={cat._id} value={cat._id}>
                        {cat.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          <div className="w-full sm:w-44 shrink-0">
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {isKycLabel ? 'KYC status' : 'Verification'}
            </label>
            <select
              value={kycFilter}
              onChange={(e) => setKycFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand/35"
            >
              <option value="all">{isKycLabel ? 'All KYC states' : 'All verification'}</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="failed">Failed / Rejected</option>
            </select>
          </div>

          {!fixedRole && (
            <div className="w-full sm:w-40 shrink-0">
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand/35"
              >
                <option value="">All roles</option>
                {ROLE_LIST.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r] || r}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="w-full sm:w-40 shrink-0">
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Account</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand/35"
            >
              <option value="all">All Statuses</option>
              {Object.values(ACCOUNT_STATUSES).map((val) => (
                <option key={val} value={val}>{ACCOUNT_STATUS_LABELS[val]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-500">
          <div className="flex flex-wrap items-center gap-1.5">
            <span>
              Showing {items.length} of {total} user{total === 1 ? '' : 's'}
              {debouncedSearch ? ` · matching “${debouncedSearch}”` : ''}
              {kycFilter !== 'all' ? ` · verification: “${kycFilter}”` : ''}
            </span>
            {selectedSkillName ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-slate-800 ring-1 ring-amber-300/80">
                <span className="h-1.5 w-1.5 rounded-full bg-[#FFC107] shrink-0" />
                Skill: {selectedSkillName}
                <button
                  type="button"
                  onClick={() => setSkillFilter('all')}
                  className="ml-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  title="Clear skill filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ) : null}
          </div>
        </div>
      </GlassPanel>

      {error ? (
        <p className="rounded-xl border border-rose-200/80 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">{error}</p>
      ) : null}

      {/* Desktop table */}
      <GlassPanel className="hidden overflow-hidden p-0 md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Name / Business</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Trades / Skills</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Verification</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {Array.from({ length: 10 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 animate-pulse rounded bg-slate-200/80" />
                        </td>
                      ))}
                    </tr>
                  ))
                : items.map((u) => (
                    <tr key={u._id} className="border-b border-slate-100 transition hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        <div>{u.fullName || '—'}</div>
                        {u.contractorProfile?.businessName ? (
                          <div className="text-[11px] font-medium text-slate-500">{u.contractorProfile.businessName}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-700">
                        {u.phone ? `+91 ${u.phone}` : '—'}
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-3 text-slate-600">
                        {u.email ? u.email : <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400/80">MAIL NOT PROVIDED</span>}
                      </td>
                      <td className="max-w-[220px] px-4 py-3">
                        <UserSkillBadges user={u} max={2} />
                      </td>
                      <td className="px-4 py-3">
                        <RolePill role={u.role} />
                      </td>
                      <td className="px-4 py-3">
                        <VerificationPill user={u} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={u.accountStatus} active={u.isActive !== false} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{formatLastLoginDisplay(u.lastLoginAt) || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/admin/user/${u._id}`}
                          className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand/10 hover:text-brand"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {!loading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Users className="h-10 w-10 text-slate-300" aria-hidden />
            <p className="font-semibold text-slate-700">No users match</p>
            <p className="max-w-sm text-xs text-slate-500">Try clearing search or widening verification / role / status filters.</p>
          </div>
        ) : null}
      </GlassPanel>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <GlassPanel key={i} className="p-4">
                <div className="h-5 w-40 animate-pulse rounded bg-slate-200/80" />
                <div className="mt-3 h-4 w-full animate-pulse rounded bg-slate-200/60" />
              </GlassPanel>
            ))
          : items.map((u) => (
              <GlassPanel key={u._id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{u.fullName || '—'}</p>
                    {u.contractorProfile?.businessName ? (
                      <p className="text-xs font-semibold text-slate-700 flex items-center gap-1 mt-0.5">
                        <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                        {u.contractorProfile.businessName}
                      </p>
                    ) : null}
                    <p className="mt-0.5 font-mono text-xs text-slate-600">+91 {u.phone || '—'}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {u.email ? u.email : <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400/80">MAIL NOT PROVIDED</span>}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <StatusPill status={u.accountStatus} active={u.isActive !== false} />
                    <VerificationPill user={u} />
                  </div>
                </div>

                {/* Additional IDs if contractor */}
                {u.contractorProfile?.panNumber || u.contractorProfile?.gstNumber || u.contractorProfile?.aadhaarNumber ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-600">
                    {u.contractorProfile.panNumber ? <span>PAN: {u.contractorProfile.panNumber}</span> : null}
                    {u.contractorProfile.gstNumber ? <span>GST: {u.contractorProfile.gstNumber}</span> : null}
                    {u.contractorProfile.aadhaarNumber ? <span>Aadhaar: {u.contractorProfile.aadhaarNumber}</span> : null}
                  </div>
                ) : null}

                {/* Trades / Skills if any */}
                {getWorkerOrVendorSkills(u).length > 0 ? (
                  <div className="mt-2 pt-2 border-t border-slate-100/80">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Trades / Skills</p>
                    <UserSkillBadges user={u} max={4} />
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2">
                    <RolePill role={u.role} />
                    <span className="text-[11px] text-slate-500">
                      Last login: {formatLastLoginDisplay(u.lastLoginAt) || '—'}
                    </span>
                  </div>
                  <Link
                    to={`/admin/user/${u._id}`}
                    className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-brand transition hover:bg-brand/10"
                  >
                    View Details
                  </Link>
                </div>
              </GlassPanel>
            ))}
        {!loading && items.length === 0 ? (
          <GlassPanel className="p-8 text-center">
            <Users className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-2 font-semibold text-slate-700">No users match</p>
          </GlassPanel>
        ) : null}
      </div>

      {pages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium text-slate-500">
            Page {page} of {pages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand/30 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Prev
            </button>
            <button
              type="button"
              disabled={page >= pages || loading}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand/30 disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
