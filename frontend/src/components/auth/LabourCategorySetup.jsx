import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useDispatch } from 'react-redux'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  HardHat,
  Layers,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { AppSearchBar } from '../app-ui/inputs/AppSearchBar.jsx'
import { AppPrimaryButton } from '../app/AppPrimaryButton.jsx'
import { GlassPanel } from '../ui/GlassPanel.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { setUser } from '../../store/slices/authSlice.js'
import { fetchLabourCategoriesGrouped } from '../../api/labourCategoriesApi.js'
import { updateMyLabourCategories } from '../../api/userLabourApi.js'
import { ApiError } from '../../api/http.js'

function categoryId(c) {
  return String(c._id)
}

function SelectRow({ label, subtitle, selected, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-4 rounded-[18px] px-4 py-4 text-left transition-all duration-300 ease-out active:scale-[0.98] shadow-sm ${
        selected
          ? 'border border-brand bg-brand/10 ring-1 ring-brand/50'
          : 'border border-[#e2e8f0] bg-[#EAE9E7] hover:bg-[#E0DFDD] hover:border-brand/80'
      }`}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors duration-300 ${
          selected ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white'
        }`}
        aria-hidden
      >
        {selected ? <Check className="h-4 w-4 stroke-[3]" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-[#0f172a]">{label}</span>
        {subtitle ? <span className="mt-0.5 block text-[13px] leading-relaxed text-slate-500">{subtitle}</span> : null}
      </span>
    </button>
  )
}

function AreaCard({ group, selectedInGroup, onOpen }) {
  const initial = group.name.replace(/[^a-zA-Z0-9]/g, '').charAt(0).toUpperCase() || '?'
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-stretch gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 text-left shadow-sm transition hover:border-brand/25 hover:shadow-md active:scale-[0.99]"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-brand/15 via-emerald-50 to-white text-lg font-black text-brand ring-1 ring-brand/15">
        {initial}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="font-bold leading-snug text-slate-900">{group.name}</p>
        {group.description ? (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{group.description}</p>
        ) : null}
        <p className="mt-2 text-[11px] font-semibold text-brand">
          {(group.categories || []).length} roles · tap to choose
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end justify-center gap-1 pl-1">
        {selectedInGroup > 0 ? (
          <span className="rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-black text-white">
            {selectedInGroup}
          </span>
        ) : (
          <ChevronRight className="h-5 w-5 text-slate-300" aria-hidden />
        )}
      </div>
    </button>
  )
}

/**
 * Worker trade + role picker (onboarding or profile update).
 * @param {{ variant?: 'auth' | 'app', onComplete?: () => void }} props
 */
export function LabourCategorySetup({ variant = 'app', onComplete }) {
  const reduce = useReducedMotion()
  const dispatch = useDispatch()
  const { user } = useAuth()

  const [groups, setGroups] = useState([])
  const [meta, setMeta] = useState({ profileKind: 'profile', tradeKind: 'trade' })
  const [selected, setSelected] = useState(() => new Set())
  const [hubSearch, setHubSearch] = useState('')
  const [roleSearch, setRoleSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [optionalOpen, setOptionalOpen] = useState(false)
  const [step, setStep] = useState('areas')
  const [activeGroupId, setActiveGroupId] = useState(null)

  const tradeCategoryIds = useMemo(() => {
    const s = new Set()
    for (const g of groups) {
      if (g.kind !== meta.tradeKind) continue
      for (const c of g.categories || []) s.add(categoryId(c))
    }
    return s
  }, [groups, meta.tradeKind])

  const tradeSelectedCount = useMemo(
    () => [...selected].filter((id) => tradeCategoryIds.has(id)).length,
    [selected, tradeCategoryIds],
  )

  const hasTradeSelected = tradeSelectedCount > 0
  const hasExistingCategories = (user?.labourProfile?.categoryIds?.length ?? 0) > 0
  const profileGroups = useMemo(() => groups.filter((g) => g.kind === meta.profileKind), [groups, meta.profileKind])
  const tradeGroups = useMemo(() => groups.filter((g) => g.kind === meta.tradeKind), [groups, meta.tradeKind])

  const activeGroup = useMemo(
    () => tradeGroups.find((g) => String(g._id) === String(activeGroupId)),
    [tradeGroups, activeGroupId],
  )

  const countInGroup = useCallback(
    (g) => {
      let n = 0
      for (const c of g.categories || []) {
        if (selected.has(categoryId(c))) n += 1
      }
      return n
    },
    [selected],
  )

  const areasWithPicks = useMemo(() => tradeGroups.filter((g) => countInGroup(g) > 0).length, [tradeGroups, countInGroup])

  const filteredTradeGroups = useMemo(() => {
    const q = hubSearch.trim().toLowerCase()
    if (!q) return tradeGroups
    return tradeGroups.filter((g) => {
      if (g.name.toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q)) return true
      return (g.categories || []).some((c) => `${c.name} ${c.subtitle || ''}`.toLowerCase().includes(q))
    })
  }, [tradeGroups, hubSearch])

  const syncFromUser = useCallback(() => {
    const raw = user?.labourProfile?.categoryIds ?? []
    const ids = raw.map((x) => (typeof x === 'object' && x?._id ? String(x._id) : String(x)))
    setSelected(new Set(ids))
  }, [user])

  useEffect(() => {
    queueMicrotask(() => syncFromUser())
  }, [syncFromUser])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setLoading(true)
    })
    fetchLabourCategoriesGrouped()
      .then((res) => {
        if (!cancelled) {
          setGroups(res.data?.groups ?? [])
          if (res.data?.meta) setMeta((m) => ({ ...m, ...res.data.meta }))
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load work categories. Pull to refresh or try again.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (step !== 'roles' || !activeGroupId || activeGroup) return
    queueMicrotask(() => {
      setStep('areas')
      setActiveGroupId(null)
    })
  }, [step, activeGroupId, activeGroup])

  function toggle(id) {
    const key = String(id)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function openGroup(g) {
    setActiveGroupId(String(g._id))
    setRoleSearch('')
    setStep('roles')
  }

  function closeRoles() {
    setStep('areas')
    setActiveGroupId(null)
    setRoleSearch('')
  }

  async function handleSave() {
    setError('')
    if (!hasTradeSelected) {
      setError('Choose at least one role in any work area.')
      return
    }
    setSaving(true)
    try {
      const res = await updateMyLabourCategories([...selected])
      dispatch(setUser(res.data.user))
      onComplete?.()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save your work types')
    } finally {
      setSaving(false)
    }
  }

  const roleQ = roleSearch.trim().toLowerCase()
  const visibleRoles =
    activeGroup?.categories?.filter((c) => {
      if (!roleQ) return true
      return `${c.name} ${c.subtitle || ''}`.toLowerCase().includes(roleQ)
    }) ?? []

  const showBack = variant === 'app' && hasExistingCategories && step === 'areas'

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-24">
      <header className="mb-4">
        <div className="flex items-center gap-2">
          {step === 'roles' ? (
            <button
              type="button"
              onClick={closeRoles}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-800 shadow-sm transition hover:border-brand/35"
              aria-label="Back to work areas"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </button>
          ) : showBack ? (
            <Link
              to="/app"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-800 shadow-sm transition hover:border-brand/35"
              aria-label="Back to app"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </Link>
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand ring-1 ring-brand/20">
              <Wrench className="h-5 w-5" aria-hidden />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
              {variant === 'auth' ? 'Worker setup' : 'Work types'}
            </p>
            <h2 className="text-lg font-black tracking-tight text-slate-900">
              {step === 'areas' ? 'What work do you do?' : activeGroup?.name}
            </h2>
          </div>

          <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-black text-brand ring-1 ring-brand/20">
            {hasTradeSelected ? tradeSelectedCount : '0'}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
              step === 'areas' ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            1 · Work area
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden />
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
              step === 'roles' ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            2 · Roles
          </span>
        </div>

        {step === 'areas' ? (
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            {variant === 'auth'
              ? 'Pick the trades you actually work — we use this to match you to nearby jobs.'
              : 'Open a work area, then tick every role you can do on site.'}
          </p>
        ) : activeGroup?.description ? (
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{activeGroup.description}</p>
        ) : null}
      </header>

      {variant === 'auth' ? (
        <GlassPanel className="mb-4 flex items-start gap-2.5 border-brand/20 bg-brand/5 p-3 ring-1 ring-brand/15">
          <HardHat className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
          <p className="text-[11px] leading-relaxed text-slate-700">
            <span className="font-bold text-slate-900">Almost done.</span> Select at least one job role so homeowners and
            contractors can find you.
          </p>
        </GlassPanel>
      ) : null}

      {loading ? (
        <p className="py-12 text-center text-sm font-medium text-slate-500">Loading work categories…</p>
      ) : (
        <AnimatePresence mode="wait">
          {step === 'areas' ? (
            <motion.div
              key="areas"
              initial={reduce ? false : { opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? false : { opacity: 0, x: 12 }}
              className="space-y-4"
            >
              <AppSearchBar
                value={hubSearch}
                onChange={(e) => setHubSearch(e.target.value)}
                placeholder="Search areas or roles…"
                className="border-slate-200/90 shadow-sm ring-1 ring-slate-200/80"
              />

              {areasWithPicks > 0 ? (
                <p className="text-center text-[11px] font-semibold text-slate-500">
                  {areasWithPicks} area{areasWithPicks === 1 ? '' : 's'} with selected roles
                </p>
              ) : null}

              <div className="space-y-2.5">
                {filteredTradeGroups.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">No areas match your search.</p>
                ) : (
                  filteredTradeGroups.map((g) => {
                    if ((g.categories || []).length === 0) return null
                    return (
                      <AreaCard
                        key={g._id}
                        group={g}
                        selectedInGroup={countInGroup(g)}
                        onOpen={() => openGroup(g)}
                      />
                    )
                  })
                )}
              </div>

              <button
                type="button"
                onClick={() => setOptionalOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200/90 bg-white px-4 py-3.5 text-left text-sm font-bold text-slate-700 shadow-sm"
              >
                <span className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-brand" aria-hidden />
                  Profile tags <span className="font-normal text-slate-400">(optional)</span>
                </span>
                <ChevronDown className={`h-5 w-5 text-slate-400 transition ${optionalOpen ? 'rotate-180' : ''}`} />
              </button>
              {optionalOpen ? (
                <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-slate-50/80 p-3">
                  {profileGroups.map((g) => (
                    <div key={g._id}>
                      <p className="mb-2 text-xs font-bold text-slate-700">{g.name}</p>
                      <ul className="space-y-2">
                        {(g.categories || []).map((c) => {
                          const id = categoryId(c)
                          return (
                            <li key={id}>
                              <SelectRow
                                label={c.name}
                                subtitle={c.subtitle || undefined}
                                selected={selected.has(id)}
                                onToggle={() => toggle(id)}
                              />
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : null}
            </motion.div>
          ) : (
            <motion.div
              key="roles"
              initial={reduce ? false : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? false : { opacity: 0, x: -12 }}
              className="space-y-3"
            >
              <AppSearchBar
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                placeholder="Filter roles in this area…"
                className="border-slate-200/90 shadow-sm ring-1 ring-slate-200/80"
              />
              <ul className="space-y-2">
                {visibleRoles.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">No roles match.</p>
                ) : (
                  visibleRoles.map((c) => {
                    const id = categoryId(c)
                    return (
                      <li key={id}>
                        <SelectRow
                          label={c.name}
                          subtitle={c.subtitle || undefined}
                          selected={selected.has(id)}
                          onToggle={() => toggle(id)}
                        />
                      </li>
                    )
                  })
                )}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200/80 bg-white/90 px-4 pt-3 shadow-[0_-12px_40px_-12px_rgba(15,23,42,0.12)] backdrop-blur-xl pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-lg">
          {error ? <p className="mb-2 text-center text-xs font-semibold text-rose-700">{error}</p> : null}
          {step === 'areas' ? (
            <AppPrimaryButton
              type="button"
              disabled={saving || loading || !hasTradeSelected}
              className="w-full py-3.5 text-[15px]"
              onClick={() => void handleSave()}
            >
              {saving ? 'Saving…' : variant === 'auth' ? 'Finish & enter app' : 'Save & continue'}
              <Sparkles className="h-4 w-4" aria-hidden />
            </AppPrimaryButton>
          ) : (
            <button
              type="button"
              onClick={closeRoles}
              className="w-full rounded-2xl border border-slate-200/90 bg-white py-3.5 text-sm font-bold text-slate-800 shadow-sm transition hover:border-brand/30"
            >
              Done — choose another area
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
