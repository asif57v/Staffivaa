import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Briefcase, Search, X, SlidersHorizontal, MapPin, Wallet,
  Users, Clock, ChevronRight, Building2, ShieldCheck, Star,
  Filter, CheckCircle2, Home, Truck, UtensilsCrossed, HeartPulse,
} from 'lucide-react'
import { useGetPublicEnterpriseJobsQuery } from '../../store/api/enterpriseApi.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function fmtSalary(salary, salaryType) {
  const n = Number(salary)
  return `₹${n.toLocaleString('en-IN')} / ${salaryType || 'month'}`
}

function companyName(job) {
  return (
    job?.enterpriseId?.enterpriseProfile?.companyName ||
    job?.enterpriseId?.fullName ||
    'Enterprise Company'
  )
}

function companyLogo(job) {
  return job?.enterpriseId?.profileImageUrl || null
}

// ─── Perk chips config ────────────────────────────────────────────────────────
const PERKS = [
  { key: 'providesFood',          icon: UtensilsCrossed, label: 'Food' },
  { key: 'providesAccommodation', icon: Home,             label: 'Accommodation' },
  { key: 'providesTransportation',icon: Truck,            label: 'Transport' },
]

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function JobCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-slate-100 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-100 rounded w-2/3" />
          <div className="h-3 bg-slate-100 rounded w-1/3" />
        </div>
      </div>
      <div className="h-4 bg-slate-100 rounded w-3/4" />
      <div className="flex gap-2">
        <div className="h-6 w-20 bg-slate-100 rounded-full" />
        <div className="h-6 w-16 bg-slate-100 rounded-full" />
        <div className="h-6 w-24 bg-slate-100 rounded-full" />
      </div>
    </div>
  )
}

// ─── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({ job, index = 0 }) {
  const navigate = useNavigate()
  const logo = companyLogo(job)
  const name = companyName(job)
  const category = job?.categoryId?.name || 'General'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.035, duration: 0.3 }}
      onClick={() => navigate(`/app/enterprise-jobs/${job._id}`)}
      className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 cursor-pointer active:scale-[0.99] hover:border-indigo-200 hover:shadow-md transition-all"
    >
      {/* Company row */}
      <div className="flex items-start gap-3 mb-3">
        <div className="shrink-0 h-12 w-12 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden shadow-sm">
          {logo
            ? <img src={logo} alt={name} className="h-full w-full object-cover" />
            : <Building2 className="h-6 w-6 text-indigo-400" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12px] font-semibold text-slate-600 truncate max-w-[160px]">{name}</span>
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-100">
              <ShieldCheck className="h-3 w-3" /> VERIFIED
            </span>
          </div>
          <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full mt-1 inline-block">
            {category}
          </span>
        </div>
        <span className="text-[10px] font-medium text-slate-400 shrink-0">{timeAgo(job.createdAt)}</span>
      </div>

      {/* Title */}
      <h3 className="text-[15px] font-extrabold text-slate-900 leading-tight mb-3 line-clamp-2">
        {job.jobTitle}
      </h3>

      {/* Info chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="flex items-center gap-1 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-1 text-[11px] font-bold text-emerald-700">
          <Wallet className="h-3 w-3" /> {fmtSalary(job.salary, job.salaryType)}
        </span>
        <span className="flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-full px-2.5 py-1 text-[11px] font-medium text-slate-600">
          <MapPin className="h-3 w-3 text-slate-400" /> {job.locationText || 'Location N/A'}
        </span>
        <span className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 rounded-full px-2.5 py-1 text-[11px] font-bold text-indigo-700">
          <Users className="h-3 w-3" /> {job.numberOfWorkers} {job.numberOfWorkers === 1 ? 'vacancy' : 'vacancies'}
        </span>
      </div>

      {/* Perks */}
      {(job.providesFood || job.providesAccommodation || job.providesTransportation) && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {PERKS.filter(p => job[p.key]).map(p => (
            <span key={p.key} className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
              <p.icon className="h-3 w-3" /> {p.label}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-50">
        {job.experienceRequired
          ? <span className="text-[11px] font-medium text-slate-500">{job.experienceRequired} exp.</span>
          : <span className="text-[11px] font-medium text-slate-400">Freshers welcome</span>
        }
        <span className="flex items-center gap-1 text-[12px] font-bold text-indigo-600">
          View Details <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
      </div>
    </motion.div>
  )
}

// ─── Company chip ─────────────────────────────────────────────────────────────
function CompanyChip({ job }) {
  const logo = companyLogo(job)
  const name = companyName(job)
  return (
    <div className="shrink-0 flex flex-col items-center gap-2 bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 w-28">
      <div className="h-11 w-11 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden">
        {logo
          ? <img src={logo} alt={name} className="h-full w-full object-cover" />
          : <Building2 className="h-5 w-5 text-indigo-400" />
        }
      </div>
      <span className="text-[10px] font-bold text-slate-700 text-center leading-tight line-clamp-2">{name}</span>
    </div>
  )
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────
const SALARY_RANGES = [
  { label: 'Any', min: '', max: '' },
  { label: '< ₹10k', min: '', max: '10000' },
  { label: '₹10k–25k', min: '10000', max: '25000' },
  { label: '₹25k–50k', min: '25000', max: '50000' },
  { label: '₹50k+', min: '50000', max: '' },
]

function FilterPanel({ filters, setFilters, categories, onClose }) {
  const [local, setLocal] = useState(filters)

  const apply = () => { setFilters(local); onClose() }
  const reset = () => { setLocal({ minSalary: '', maxSalary: '', location: '', category: '', perks: [] }); }

  const togglePerk = (p) =>
    setLocal(f => ({
      ...f,
      perks: f.perks.includes(p) ? f.perks.filter(x => x !== p) : [...f.perks, p]
    }))

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 280 }}
      className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[80vh] overflow-y-auto pb-8"
    >
      {/* Handle */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="h-1 w-10 rounded-full bg-slate-200" />
      </div>
      <div className="px-5 pt-2 pb-4 flex items-center justify-between border-b border-slate-100">
        <h3 className="text-[16px] font-extrabold text-slate-900">Filters</h3>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-50">
          <X className="h-5 w-5 text-slate-500" />
        </button>
      </div>

      <div className="px-5 pt-4 space-y-5">
        {/* Salary */}
        <div>
          <p className="text-[12px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">Salary</p>
          <div className="flex flex-wrap gap-2">
            {SALARY_RANGES.map(r => (
              <button
                key={r.label}
                onClick={() => setLocal(f => ({ ...f, minSalary: r.min, maxSalary: r.max }))}
                className={`px-3 py-1.5 rounded-full text-[12px] font-bold border transition-all ${
                  local.minSalary === r.min && local.maxSalary === r.max
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div>
          <p className="text-[12px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">Location</p>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="e.g. Delhi, Mumbai…"
              value={local.location}
              onChange={e => setLocal(f => ({ ...f, location: e.target.value }))}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] font-medium text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
        </div>

        {/* Category */}
        {categories.length > 0 && (
          <div>
            <p className="text-[12px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">Category</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setLocal(f => ({ ...f, category: '' }))}
                className={`px-3 py-1.5 rounded-full text-[12px] font-bold border transition-all ${
                  !local.category ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'
                }`}
              >All</button>
              {categories.map(c => (
                <button
                  key={c._id}
                  onClick={() => setLocal(f => ({ ...f, category: c._id }))}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-bold border transition-all ${
                    local.category === c._id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >{c.name}</button>
              ))}
            </div>
          </div>
        )}

        {/* Perks */}
        <div>
          <p className="text-[12px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">Benefits</p>
          <div className="flex flex-wrap gap-2">
            {PERKS.map(p => (
              <button
                key={p.key}
                onClick={() => togglePerk(p.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold border transition-all ${
                  local.perks.includes(p.key) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                <p.icon className="h-3 w-3" /> {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 pt-5 flex gap-3">
        <button onClick={reset} className="flex-1 py-3 rounded-xl border border-slate-200 text-[13px] font-bold text-slate-600">
          Reset
        </button>
        <button onClick={apply} className="flex-2 flex-[2] py-3 rounded-xl bg-indigo-600 text-white text-[13px] font-bold shadow-md shadow-indigo-200">
          Apply Filters
        </button>
      </div>
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function LabourEnterpriseJobsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const [filters, setFilters] = useState({ minSalary: '', maxSalary: '', location: '', category: '', perks: [] })
  const [visibleCount, setVisibleCount] = useState(10)

  // Build query params
  const params = useMemo(() => {
    const p = {}
    if (filters.minSalary) p.minSalary = filters.minSalary
    if (filters.maxSalary) p.maxSalary = filters.maxSalary
    if (filters.location)  p.location  = filters.location
    if (filters.category)  p.category  = filters.category
    if (search.trim())     p.search    = search.trim()
    return p
  }, [filters, search])

  const { data, isLoading, isError } = useGetPublicEnterpriseJobsQuery(params)
  const allJobs = data?.data || []

  // Client-side perk filter (server doesn't filter perks)
  const jobs = useMemo(() => {
    if (!filters.perks.length) return allJobs
    return allJobs.filter(j => filters.perks.every(k => j[k] === true))
  }, [allJobs, filters.perks])

  // Category chips derived from jobs
  const categories = useMemo(() => {
    const seen = new Map()
    allJobs.forEach(j => {
      if (j.categoryId?._id && !seen.has(j.categoryId._id)) {
        seen.set(j.categoryId._id, j.categoryId)
      }
    })
    return [...seen.values()]
  }, [allJobs])

  // Top companies (unique)
  const topCompanies = useMemo(() => {
    const seen = new Set()
    return allJobs.filter(j => {
      const id = j.enterpriseId?._id
      if (!id || seen.has(String(id))) return false
      seen.add(String(id))
      return true
    }).slice(0, 6)
  }, [allJobs])

  const featured = jobs.slice(0, 3)
  const visible  = jobs.slice(0, visibleCount)
  const hasMore  = visibleCount < jobs.length

  const activeFiltersCount =
    (filters.minSalary || filters.maxSalary ? 1 : 0) +
    (filters.location ? 1 : 0) +
    (filters.category ? 1 : 0) +
    filters.perks.length

  return (
    <div className="-mx-4 min-h-screen bg-[#F8F9FB] overflow-x-hidden">

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-purple-700 px-5 pt-12 pb-20">
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-white/5" />
        <div className="absolute top-20 -left-6 h-32 w-32 rounded-full bg-white/5" />

        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <span className="text-white/80 text-[12px] font-bold tracking-widest uppercase">Enterprise Jobs</span>
          </div>
          <h1 className="text-[26px] font-extrabold text-white leading-tight mb-1">
            Find Your Dream Job
          </h1>
          <p className="text-indigo-200 text-[13px] font-medium mb-5">
            {isLoading ? 'Loading...' : `${jobs.length} live opportunit${jobs.length === 1 ? 'y' : 'ies'} available`}
          </p>
        </motion.div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Job title, skill, keyword…"
            value={search}
            onChange={e => { setSearch(e.target.value); setVisibleCount(10) }}
            className="w-full pl-11 pr-11 py-3.5 rounded-2xl bg-white text-[13px] font-medium text-slate-800 placeholder-slate-400 border-0 shadow-lg outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* ── Sticky Filter bar ───────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-[#F8F9FB] px-4 py-2 -mt-4 border-b border-slate-100">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
          {/* Filter button */}
          <button
            onClick={() => setShowFilter(true)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold border transition-all ${
              activeFiltersCount > 0
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200'
                : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-indigo-600 text-[10px] font-black">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Category chips */}
          {categories.map(c => (
            <button
              key={c._id}
              onClick={() => {
                setFilters(f => ({ ...f, category: f.category === c._id ? '' : c._id }))
                setVisibleCount(10)
              }}
              className={`shrink-0 px-3 py-2 rounded-xl text-[12px] font-bold border transition-all ${
                filters.category === c._id
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-6 pb-32">

        {/* ── Error ─────────────────────────────────────────────────────────── */}
        {isError && (
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-center">
            <p className="text-[13px] font-bold text-rose-600">Failed to load jobs. Please try again.</p>
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────────────────────── */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <JobCardSkeleton key={i} />)}
          </div>
        )}

        {/* ── Empty ─────────────────────────────────────────────────────────── */}
        {!isLoading && jobs.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 text-center gap-3"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 border border-indigo-100">
              <Briefcase className="h-7 w-7 text-indigo-300" />
            </div>
            <p className="text-[15px] font-extrabold text-slate-800">
              {search || activeFiltersCount > 0 ? 'No matching jobs' : 'No active jobs right now'}
            </p>
            <p className="text-[12px] text-slate-500 max-w-[200px] leading-snug">
              {search || activeFiltersCount > 0
                ? 'Try different keywords or clear filters.'
                : 'New enterprise jobs are posted regularly. Check back soon!'}
            </p>
            {(search || activeFiltersCount > 0) && (
              <button
                onClick={() => { setSearch(''); setFilters({ minSalary: '', maxSalary: '', location: '', category: '', perks: [] }) }}
                className="mt-1 text-[12px] font-bold text-indigo-600 underline underline-offset-2"
              >
                Clear all
              </button>
            )}
          </motion.div>
        )}

        {!isLoading && jobs.length > 0 && (
          <>
            {/* ── Featured ───────────────────────────────────────────────────── */}
            {featured.length > 0 && !search && !activeFiltersCount && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Star className="h-4 w-4 text-amber-500" />
                  <h2 className="text-[14px] font-extrabold text-slate-800">Featured Jobs</h2>
                </div>
                <div className="space-y-3">
                  {featured.map((job, i) => <JobCard key={job._id} job={job} index={i} />)}
                </div>
              </section>
            )}

            {/* ── Top Companies ──────────────────────────────────────────────── */}
            {topCompanies.length > 1 && !search && !activeFiltersCount && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[14px] font-extrabold text-slate-800">Top Hiring Companies</h2>
                </div>
                <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
                  {topCompanies.map(job => <CompanyChip key={job._id} job={job} />)}
                </div>
              </section>
            )}

            {/* ── All Jobs ───────────────────────────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[14px] font-extrabold text-slate-800">
                  {search || activeFiltersCount > 0 ? `Results (${jobs.length})` : 'All Jobs'}
                </h2>
                <span className="text-[11px] font-medium text-slate-400">{jobs.length} found</span>
              </div>
              <div className="space-y-3">
                <AnimatePresence>
                  {visible.map((job, i) => <JobCard key={job._id} job={job} index={i} />)}
                </AnimatePresence>
              </div>

              {/* Show more */}
              {hasMore && (
                <button
                  onClick={() => setVisibleCount(c => c + 10)}
                  className="mt-4 w-full py-3.5 rounded-2xl border border-slate-200 bg-white text-[13px] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Show More ({jobs.length - visibleCount} remaining)
                </button>
              )}
            </section>
          </>
        )}
      </div>

      {/* ── Filter Panel overlay ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showFilter && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFilter(false)}
              className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
            />
            <FilterPanel
              filters={filters}
              setFilters={(f) => { setFilters(f); setVisibleCount(10) }}
              categories={categories}
              onClose={() => setShowFilter(false)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
