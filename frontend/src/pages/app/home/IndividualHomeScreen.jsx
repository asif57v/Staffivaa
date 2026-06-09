import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Headphones,
  LayoutGrid,
  Loader2,
  HardHat,
  MapPin,
  Wrench,
  PaintRoller,
  Hammer,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound,
  Search,
} from 'lucide-react'
import { fetchLabourCategoriesGrouped } from '../../../api/labourCategoriesApi.js'
import { GlassPanel } from '../../../components/ui/GlassPanel.jsx'
import { AppBadge } from '../../../components/app-ui/data-display/AppBadge.jsx'
import { AppListSkeleton } from '../../../components/app-ui/feedback/AppListSkeleton.jsx'
import { AppSectionHeader } from '../../../components/app-ui/layout/AppSectionHeader.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { AppPressableLinkCard } from '../../../components/app/AppPressableLinkCard.jsx'
import { getPastelStyles } from '../../../lib/iconMap.jsx'
import { IndividualLabourSubcategoriesSection } from '../../../components/app/individual/IndividualLabourSubcategoriesSection.jsx'
import { flattenTradeSubcategories } from '../../../lib/labourCategoryDisplay.js'
import { CategoryPickBottomSheet } from '../../../components/app/booking/CategoryPickBottomSheet.jsx'
import { BookingTypeSheet } from '../../../components/app/booking/BookingTypeSheet.jsx'
import { writeBookingDraft, readBookingDraft } from '../../../lib/individualBookingDraft.js'
import { fetchDiscoverLabour, fetchDiscoverLabours } from '../../../api/discoverLaboursApi.js'
import { ApiError } from '../../../api/http.js'
import { LabourPublicDetailSheet } from '../labour/LabourPublicDetailSheet.jsx'
import { ConstructionIllustration } from '../../../components/landing/ConstructionIllustration.jsx'
import { enrichDiscoverLabourUi, hashSeed } from '../../../lib/discoverLabourDummyUi.js'
import {
  bookingStatusToUi,
  displayBookingsList,
  loadIndividualBookings,
} from '../../../lib/individualBookings.js'
import { buildBookingFlowPath } from '../../../lib/bookingFlowNavigation.js'

const TRADE_VISUAL_ICONS = [HardHat, Wrench, PaintRoller, Hammer, Sparkles]

const STEPS = [
  { icon: ClipboardList, title: 'Request', copy: 'Tell us what work you need' },
  { icon: Sparkles, title: 'Match', copy: 'We line up verified workers' },
  { icon: CheckCircle2, title: 'Relax', copy: 'Track status until they arrive' },
]

const TRUST_PILLS = [
  { icon: ShieldCheck, label: 'Aadhaar-verified' },
  { icon: Star, label: 'Clear rates' },
]

function formatBookingDay(serviceDate) {
  if (!serviceDate) return 'Soon'
  const d = new Date(serviceDate)
  if (Number.isNaN(d.getTime())) return 'Soon'

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function availabilityFromWorkHours(workHoursLabel, responseLabel) {
  const s = String(workHoursLabel || '').toLowerCase()
  const r = String(responseLabel || '').toLowerCase()

  const available = s.includes('available') || s.includes('flexible') || s.includes('day wage') || s.includes('half-day')

  if (available) {
    return { label: 'Available Today', tone: 'bg-[#D1FAE5] text-[#059669] ring-1 ring-[#A7F3D0]', dot: 'bg-[#059669]' }
  }

  if (r.includes('within 30 min') || r.includes('same day') || r.includes('2 hrs')) {
    return { label: 'Likely today', tone: 'bg-[#FEF3C7] text-[#D97706] ring-1 ring-[#FDE68A]', dot: 'bg-[#D97706]' }
  }

  return { label: 'Limited slots', tone: 'bg-[#F3F4F6] text-[#6B7280] ring-1 ring-[#E5E7EB]', dot: 'bg-[#6B7280]' }
}

function distanceLabelFor(labourId) {
  const n = hashSeed(String(labourId || 'x') + ':dist', 9) + 1 // 1..9
  return `${n} KM Away`
}

function getCategoryImage(category) {
  const cat = String(category || '').toLowerCase()
  if (cat.includes('plumb')) return '/service_plumber.png'
  if (cat.includes('electric')) return '/service_electrician.png'
  if (cat.includes('carpent')) return '/service_carpenter.png'
  if (cat.includes('paint')) return '/service_painter.png'
  if (cat.includes('mason')) return '/service_mason.png'
  if (cat.includes('weld')) return '/service_welder.png'
  if (cat.includes('tile')) return '/service_tile.png'
  if (cat.includes('heavy') || cat.includes('load')) return '/service_heavy.png'
  if (cat.includes('help') || cat.includes('clean')) return '/service_helper.png'
  if (cat.includes('cook') || cat.includes('chef')) return '/service_cook.png'
  return '/home_service_hero.png'
}

/**
 * Home dashboard for homeowner / individual accounts — discovery-first, Swiggy-style categories + workers.
 */
export function IndividualHomeScreen({ user }) {
  const reduce = useReducedMotion()
  const navigate = useNavigate()

  const [tradeGroups, setTradeGroups] = useState([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [selectedGroupId, setSelectedGroupId] = useState(null)

  const categoryScrollRef = useRef(null)
  const isCategoryHoveredRef = useRef(false)

  useEffect(() => {
    const container = categoryScrollRef.current
    if (!container) return

    const interval = setInterval(() => {
      if (isCategoryHoveredRef.current) return

      const scrollWidth = container.scrollWidth
      const clientWidth = container.clientWidth
      const maxScroll = scrollWidth - clientWidth

      if (maxScroll <= 0) return

      let next = container.scrollLeft + 80
      if (next >= maxScroll - 5) {
        container.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        container.scrollTo({ left: next, behavior: 'smooth' })
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  const [labours, setLabours] = useState([])
  const [laboursLoading, setLaboursLoading] = useState(true)
  const [laboursErr, setLaboursErr] = useState('')

  const [detailId, setDetailId] = useState(null)
  const [detailLabour, setDetailLabour] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [categorySheetOpen, setCategorySheetOpen] = useState(false)
  const [quickBookTypeOpen, setQuickBookTypeOpen] = useState(false)
  const [quickBookCategory, setQuickBookCategory] = useState(null)
  const [bookingsLoading, setBookingsLoading] = useState(true)
  const [bookings, setBookings] = useState([])
  const [showAllLabours, setShowAllLabours] = useState(false)

  const enrichedLabours = useMemo(() => {
    return labours.map((l) => ({ ...l, _ui: enrichDiscoverLabourUi(l) }))
  }, [labours])

  const tradeSubcategories = useMemo(() => flattenTradeSubcategories(tradeGroups), [tradeGroups])

  const nearbyLabours = useMemo(() => {
    const available = enrichedLabours.filter((l) =>
      String(l?._ui?.workHoursLabel || '').toLowerCase().includes('available'),
    )
    return (available.length ? available : enrichedLabours).slice(0, 5)
  }, [enrichedLabours])

  const sortedBookings = useMemo(() => {
    const items = Array.isArray(bookings) ? bookings : []
    return [...items].sort((a, b) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')))
  }, [bookings])

  const ongoingBookings = useMemo(() => {
    const activeStatuses = ['pending_review', 'searching', 'accepted', 'assigned', 'in_progress', 'confirmed']
    return sortedBookings.filter((b) => activeStatuses.includes(String(b?.status).toLowerCase())).slice(0, 2)
  }, [sortedBookings])

  const acceptedBookings = useMemo(() => {
    return sortedBookings.filter((b) => !String(b?.id || '').startsWith('demo-') && ['accepted', 'assigned'].includes(String(b?.status).toLowerCase()))
  }, [sortedBookings])

  const recentBookings = useMemo(() => {
    return ongoingBookings.length ? ongoingBookings : sortedBookings.slice(0, 2)
  }, [ongoingBookings, sortedBookings])

  const actions = useMemo(
    () => [
      {
        id: 'book',
        title: 'Book labour',
        subtitle: 'Search a skill and pick workers nearby',
        icon: Sparkles,
        bgImage: '/action_book_labour.png',
      },
      {
        id: 'history',
        to: '/app/bookings',
        title: 'My bookings',
        subtitle: 'Track status and rebook past jobs',
        icon: CalendarClock,
        bgImage: '/action_my_bookings.png',
      },
    ],
    [],
  )

  useEffect(() => {
    if (!categorySheetOpen && !quickBookTypeOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [categorySheetOpen, quickBookTypeOpen])

  const handleQuickBookCategory = useCallback((cat) => {
    setQuickBookCategory(cat)
    setQuickBookTypeOpen(true)
  }, [])

  const handleQuickBookType = useCallback(
    (bookingType) => {
      if (!quickBookCategory) return
      const prev = readBookingDraft() || {}
      writeBookingDraft({
        ...prev,
        entryPoint: 'category',
        groupId: String(quickBookCategory.groupId || ''),
        groupName: quickBookCategory.groupName || '',
        categoryId: String(quickBookCategory._id),
        categoryName: quickBookCategory.name || '',
        bookingType,
        matchMode: 'smart',
        selectedWorkers: [],
      })
      setQuickBookTypeOpen(false)
      setQuickBookCategory(null)
      navigate(buildBookingFlowPath('details', { categoryId: quickBookCategory._id }))
    },
    [navigate, quickBookCategory],
  )

  useEffect(() => {
    let cancelled = false
    fetchLabourCategoriesGrouped()
      .then((res) => {
        if (cancelled) return
        const groups = res.data?.groups ?? []
        const meta = res.data?.meta ?? {}
        const tradeKind = meta.tradeKind ?? 'trade'
        setTradeGroups(groups.filter((g) => g.kind === tradeKind && (g.categories?.length ?? 0) > 0))
      })
      .catch(() => {
        if (!cancelled) setTradeGroups([])
      })
      .finally(() => {
        if (!cancelled) setGroupsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loadLabours = useCallback(async () => {
    setLaboursErr('')
    setLaboursLoading(true)
    try {
      const res = await fetchDiscoverLabours({
        groupId: selectedGroupId || undefined,
        limit: 36,
      })
      setLabours(res.data?.items ?? [])
    } catch (e) {
      setLabours([])
      setLaboursErr(e instanceof ApiError ? e.message : 'Could not load workers.')
    } finally {
      setLaboursLoading(false)
    }
  }, [selectedGroupId])

  useEffect(() => {
    queueMicrotask(() => {
      void loadLabours()
    })
  }, [loadLabours])

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('lc-individual-home-layout'))
    })
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    const t = window.setTimeout(() => {
      if (cancelled) return
      const stored = loadIndividualBookings()
      setBookings(displayBookingsList(stored))
      setBookingsLoading(false)
    }, 420)

    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [])

  const openDetail = useCallback((id) => {
    setDetailId(id)
    setDetailLabour(null)
    setDetailLoading(true)
    fetchDiscoverLabour(id)
      .then((res) => {
        setDetailLabour(res.data?.labour ?? null)
      })
      .catch(() => {
        setDetailLabour(null)
      })
      .finally(() => {
        setDetailLoading(false)
      })
  }, [])

  const closeDetail = useCallback(() => {
    setDetailId(null)
    setDetailLabour(null)
    setDetailLoading(false)
  }, [])

  return (
    <div
      className="-mx-4 flex flex-col pb-2"
      aria-label={user?.fullName ? `Home for ${user.fullName}` : 'Discover workers home'}
    >
      <section className="relative z-10 isolate w-full shrink-0 pb-1 pt-1">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          className="relative text-slate-900"
        >
          <div className="flex items-stretch overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="flex-1 p-3 flex flex-col justify-center relative z-10">
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900">
                Welcome, {user?.fullName || 'User'}! 👋
              </h2>
              <p className="mt-0.5 text-[10px] sm:text-[11px] font-medium leading-tight text-slate-500 line-clamp-2">
                Book verified experts for reliable, fast, and quality service.
              </p>
              <div className="mt-2 inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 shadow-sm border border-slate-100 w-max">
                <span className="text-[11px] sm:text-xs font-black text-[#F43F5E]">₹99/hr</span>
                <span className="ml-1 text-[8px] sm:text-[9px] font-medium text-slate-400">Starting*</span>
              </div>
            </div>
            <div className="w-[40%] relative shrink-0">
              <img
                src="/skilled_labour_hero.png"
                alt="Home Repair and Handyman Services"
                className="absolute inset-0 w-full h-full object-cover object-[center_20%]"
              />
              <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent" />
            </div>
          </div>
        </motion.div>
      </section>

      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md px-4 py-3 shadow-sm border-b border-slate-100">
        <button
          type="button"
          onClick={() => setCategorySheetOpen(true)}
          className="flex w-full items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-3.5 text-left shadow-sm transition active:scale-[0.99]"
          aria-label="Search by category"
        >
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <span className="min-w-0 flex-1 text-sm font-medium text-slate-500">
            Search electrician, plumber, mason…
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        </button>
      </div>

      <section className="relative z-10 w-full shrink-0 pt-5 pb-2 overflow-hidden">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
            <h3 className="text-sm font-semibold tracking-tight text-slate-800">Browse by work area</h3>
            {groupsLoading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden /> : null}
          </div>
          <div
            ref={categoryScrollRef}
            onMouseEnter={() => { isCategoryHoveredRef.current = true }}
            onMouseLeave={() => { isCategoryHoveredRef.current = false }}
            onTouchStart={() => { isCategoryHoveredRef.current = true }}
            onTouchEnd={() => { isCategoryHoveredRef.current = false }}
            className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 pt-1 scrollbar-none [&::-webkit-scrollbar]:hidden w-full"
          >
            <button
              type="button"
              onClick={() => setSelectedGroupId(null)}
              className={`flex min-w-[4.5rem] w-[4.5rem] shrink-0 snap-start flex-col items-center gap-1.5 rounded-2xl border px-2 pb-2.5 pt-2.5 transition shadow-sm active:scale-[0.98] ${selectedGroupId == null
                ? 'border-[#FFD100] bg-[#FFD100]/10 ring-1 ring-[#FFD100]'
                : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${selectedGroupId == null ? 'bg-[#FFD100] text-slate-900' : 'bg-slate-100 text-[#F4CC34]'
                }`}>
                <LayoutGrid className="h-4 w-4" aria-hidden />
              </span>
              <span className={`w-full text-center text-[9px] font-bold leading-tight line-clamp-2 ${selectedGroupId == null ? 'text-slate-900' : 'text-slate-600'
                }`}>All Categories</span>
            </button>
            {tradeGroups.map((g, idx) => {
              const gid = String(g._id)
              const active = selectedGroupId === gid
              const VisIcon = TRADE_VISUAL_ICONS[idx % TRADE_VISUAL_ICONS.length]
              const iconPastel = getPastelStyles(VisIcon)
              return (
                <button
                  key={gid}
                  type="button"
                  onClick={() => setSelectedGroupId(gid)}
                  className={`flex min-w-[4.5rem] w-[4.5rem] shrink-0 snap-start flex-col items-center gap-1.5 rounded-2xl border px-2 pb-2.5 pt-2.5 transition shadow-sm active:scale-[0.98] ${active
                    ? 'border-[#FFD100] bg-[#FFD100]/10 ring-1 ring-[#FFD100]'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                >
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${active ? 'bg-[#FFD100] text-slate-900' : 'bg-slate-100 text-[#F4CC34]'
                    }`}>
                    <VisIcon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className={`w-full text-center text-[9px] font-bold leading-tight line-clamp-2 ${active ? 'text-slate-900' : 'text-slate-600'
                    }`}>
                    {g.name}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="mt-2 px-0.5 text-center text-[11px] font-medium text-slate-500 italic">
            Tap a tile to filter workers — same catalogue as when you book.
          </p>
        </motion.div>
      </section>

      <section className="relative z-20 -mt-6 flex-1 space-y-5 rounded-t-[1.85rem] bg-[#FAFAFA] px-4 pb-8 pt-5 shadow-sm border-t border-[#e2e8f0]">
        <span
          id="individual-home-scroll-sentinel"
          className="pointer-events-none absolute left-0 right-0 top-0 h-px w-full"
          aria-hidden
        />
        <IndividualLabourSubcategoriesSection
          subcategories={tradeSubcategories}
          loading={groupsLoading}
          onQuickBook={handleQuickBookCategory}
          onSelect={(cat) => {
            if (cat.groupId) setSelectedGroupId(String(cat.groupId))
          }}
        />

        {/* Nearby labour */}
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.08 }}
          className="space-y-2"
        >
          <div className="flex items-end justify-between gap-2 px-0.5">
            <div className="min-w-0">
              <h3 className="text-base font-bold tracking-tight text-slate-900">Nearby Labour</h3>
            </div>
            {laboursLoading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden /> : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 px-0.5">
            {TRUST_PILLS.map(({ icon: Icon, label }) => {
              const pastel = getPastelStyles(Icon)
              return (
                <motion.span
                  key={label}
                  initial={reduce ? undefined : { opacity: 0, y: 6 }}
                  animate={reduce ? undefined : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.04 }}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-[#e2e8f0] bg-white px-3 py-2 text-[11px] font-medium text-[#111827] shadow-sm"
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-xl ${pastel.bg} ${pastel.text}`}>
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  {label}
                </motion.span>
              )
            })}
          </div>

          {laboursErr ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-center text-xs font-medium text-rose-900">
              {laboursErr}
            </p>
          ) : null}

          {!laboursLoading && !laboursErr && labours.length === 0 ? (
            <GlassPanel className="border-dashed border-[#e2e8f0] bg-white p-6 text-center">
              <UserRound className="mx-auto h-10 w-10 text-[#A5B4FC]" aria-hidden />
              <p className="mt-2 text-sm font-medium text-[#3730A3]">No profiles in this filter yet</p>
              <p className="mt-1 text-xs leading-relaxed text-[#A5B4FC]">
                Workers appear here once they pick work categories on Staffivaa. Try &quot;All&quot; or book and we&apos;ll match you manually.
              </p>
              <button
                type="button"
                onClick={() => setCategorySheetOpen(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#F4CC34] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:brightness-[1.05]"
              >
                Find a skill
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </GlassPanel>
          ) : null}

          {laboursLoading ? <AppListSkeleton rows={4} /> : null}

          {!laboursLoading && !laboursErr && nearbyLabours.length > 0 ? (
            <ul className="space-y-2.5">
              {nearbyLabours.slice(0, showAllLabours ? nearbyLabours.length : 3).map((l) => {
                const ui = l._ui
                const firstCat = (l.tradeCategories || [])[0]
                const dist = distanceLabelFor(l.id)
                const { label: availLabel, tone: availTone, dot } = availabilityFromWorkHours(ui.workHoursLabel, ui.responseLabel)

                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => openDetail(l.id)}
                      className="w-full text-left transition active:scale-[0.99]"
                    >
                      <motion.div
                        whileHover={reduce ? undefined : { y: -2 }}
                        whileTap={reduce ? undefined : { scale: 0.99 }}
                        transition={{ duration: 0.25 }}
                      >
                        <GlassPanel className="relative overflow-hidden border border-[#e2e8f0] bg-white p-3.5 shadow-sm transition hover:border-[#0f172a] hover:bg-[#FAFAFA]">
                          <div className="flex items-start gap-3">
                            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-[#FAFAFA] ring-1 ring-[#e2e8f0]">
                              <img src={ui.photoUrl} alt="" className="h-full w-full object-cover object-top" loading="lazy" decoding="async" />
                              <span
                                aria-hidden
                                className={`absolute -right-2 -top-2 h-7 w-7 rounded-full bg-white/90 shadow-sm ring-1 ring-[#e2e8f0]`}
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-[15px] font-bold tracking-tight text-slate-900">
                                    {l.displayName}
                                  </p>
                                  <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-600">
                                    {firstCat?.name || 'Skilled worker'} • {ui.rating.toFixed(1)}
                                    <Star className="inline-block h-3.5 w-3.5 -translate-y-[1px] text-[#F4CC34] fill-[#F4CC34]" aria-hidden />
                                  </p>
                                </div>
                                {l.kycVerified ? (
                                  <AppBadge variant="emerald" uppercase={false} className="shrink-0 text-[10px]">
                                    <CheckCircle2 className="h-3 w-3" aria-hidden />
                                    Verified
                                  </AppBadge>
                                ) : (
                                  <AppBadge variant="neutral" uppercase={false} className="shrink-0 text-[10px]">
                                    Pending
                                  </AppBadge>
                                )}
                              </div>

                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#e2e8f0]/40 px-2 py-1 text-[10px] font-semibold text-[#0f172a] ring-1 ring-[#e2e8f0]">
                                  <MapPin className="h-3 w-3 text-[#0f172a]" aria-hidden />
                                  {dist}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-medium ring-1 ${availTone}`}
                                >
                                  <span aria-hidden className={`h-2 w-2 rounded-full ${dot} animate-pulse`} />
                                  {availLabel}
                                </span>
                              </div>

                              <div className="mt-2 truncate text-[11px] font-medium text-slate-500">
                                Experience: {ui.experienceLabel}
                              </div>
                            </div>

                            <ChevronRight className="mt-1 h-5 w-5 shrink-0 self-center text-[#0f172a] transition" aria-hidden />
                          </div>
                        </GlassPanel>
                      </motion.div>
                    </button>
                  </li>
                )
              })}

              {!showAllLabours && nearbyLabours.length > 3 ? (
                <li className="pt-1.5">
                  <button
                    type="button"
                    onClick={() => setShowAllLabours(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.99]"
                  >
                    View all {nearbyLabours.length} nearby experts
                    <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
                  </button>
                </li>
              ) : null}
            </ul>
          ) : null}
        </motion.section>

        {/* Ongoing / Recent Bookings — below nearby labour */}
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.02 }}
          className="space-y-3"
        >
          {acceptedBookings.length > 0 ? (
            <div className="mb-6 space-y-3">
              {acceptedBookings.slice(0, 1).map((b) => {
                const workerName = b.assignedWorker?.displayName || 'A verified worker'
                return (
                  <motion.div
                    key={`accepted-${b.id || b.ref}`}
                    initial={reduce ? false : { opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-lg shadow-emerald-500/20"
                  >
                    <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/20 blur-2xl" />
                    <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
                    <div className="relative flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-md">
                        <CheckCircle2 className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Match Found!</p>
                        <p className="mt-1 text-base font-extrabold leading-tight text-white shadow-black/10 text-shadow-sm">
                          {workerName} has accepted your request
                        </p>
                        <p className="mt-1.5 truncate text-xs font-semibold text-emerald-50">
                          {b.lines?.[0]?.categoryName || 'Service'} · {formatBookingDay(b.serviceDate)}
                        </p>
                      </div>
                    </div>
                    <div className="relative mt-5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/app/bookings?ref=${encodeURIComponent(b.ref || '')}`)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-emerald-600 shadow-sm transition hover:bg-emerald-50 active:scale-[0.98]"
                      >
                        Track arrival & details
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ) : null}

          <div className="flex items-end justify-between gap-2 px-0.5">
            <div className="min-w-0">
              <h3 className="text-base font-bold tracking-tight text-slate-900">Ongoing / Recent Bookings</h3>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">Track or rebook your site requests</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/app/bookings')}
              className="shrink-0 rounded-full border border-[#e2e8f0] bg-white px-3 py-1.5 text-[11px] font-medium text-[#0f172a] shadow-sm transition hover:bg-[#FAFAFA]"
            >
              View All
            </button>
          </div>

          <Link
            to="/app/bookings"
            className="group flex items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-linear-to-r from-[#FAFAFA] to-white p-3.5 transition hover:border-[#0f172a]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F4CC34] text-white shadow-sm">
              <Sparkles className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">Need workers on site?</p>
              <p className="text-xs text-slate-500">Instant or scheduled booking with roles & site details</p>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-[#0f172a] transition group-hover:translate-x-0.5" aria-hidden />
          </Link>

          {bookingsLoading ? <AppListSkeleton rows={2} /> : null}

          {!bookingsLoading && recentBookings.length ? (
            <motion.div className="space-y-2">
              {recentBookings.map((b, idx) => {
                const st = bookingStatusToUi(b.status)
                const primaryLine = (b.lines || [])[0]
                const itemLabel = primaryLine?.categoryName || (b.notes ? 'Service' : 'Labour')
                const qty = primaryLine?.quantity
                const day = formatBookingDay(b.serviceDate)
                const timeHint = b.bookingType === 'instant' ? 'Anytime' : 'Slot'
                const pending = String(b.status).toLowerCase() === 'pending_review'

                return (
                  <motion.div
                    key={b.id || b.ref || idx}
                    initial={reduce ? undefined : { opacity: 0, y: 10 }}
                    animate={reduce ? undefined : { opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, delay: idx * 0.05 }}
                    className="group"
                  >
                    <GlassPanel className="relative overflow-hidden border border-[#e2e8f0] bg-white p-4 shadow-sm transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-brand/40 group-hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.1),0_4px_8px_-4px_rgba(244,204,52,0.15)] group-hover:bg-white">
                      <div className="pointer-events-none absolute inset-0 z-0">
                        <img src={getCategoryImage(itemLabel)} alt="" className="absolute right-0 top-0 h-full w-[60%] object-cover object-center opacity-[0.25] mix-blend-multiply transition-all duration-500 ease-out group-hover:scale-[1.08] group-hover:opacity-[0.35] group-hover:mix-blend-normal" />
                        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent" />
                      </div>
                      <div className="relative z-10 flex items-start justify-between gap-3">
                        <div className="min-w-0 max-w-[65%] sm:max-w-[75%]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#FFFBEA]/40 px-2.5 py-1 text-[10px] font-medium text-[#0f172a] ring-1 ring-[#e2e8f0]">
                              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                              {day} · {timeHint}
                            </span>
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium ring-1 ${st.tone}`}>
                              {st.label}
                            </span>
                          </div>
                          <p className="mt-2 truncate text-[14px] font-bold text-slate-900">{itemLabel}</p>
                          <p className="mt-1 line-clamp-2 text-[11px] font-medium text-slate-700">{b.address}</p>
                          {qty ? <p className="mt-1 text-[10px] font-medium text-slate-500">Quantity: {qty}</p> : null}
                        </div>
                      </div>

                      <div className="relative z-10 mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/app/bookings?ref=${encodeURIComponent(b.ref || '')}`)}
                          className="flex-1 rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-sm font-medium text-[#0f172a] shadow-sm transition hover:bg-[#FAFAFA]"
                        >
                          Track
                        </button>
                        <motion.button
                          type="button"
                          onClick={() => navigate(`/app/bookings?rebookFrom=${encodeURIComponent(b.ref || '')}`)}
                          className="flex-1 rounded-xl bg-[#FFFDE7] px-3 py-2 text-sm font-medium text-amber-800 shadow-sm border border-amber-200 transition hover:bg-[#FFF9C4] active:scale-[0.99]"
                          whileHover={reduce ? undefined : { y: -2 }}
                          animate={
                            reduce
                              ? undefined
                              : pending
                                ? { y: [0, -3, 0] }
                                : undefined
                          }
                          transition={{ duration: 2.1 + idx * 0.08, repeat: Infinity, ease: 'easeInOut' }}
                        >
                          Rebook
                        </motion.button>
                      </div>
                    </GlassPanel>
                  </motion.div>
                )
              })}
            </motion.div>
          ) : null}

          {!bookingsLoading && !recentBookings.length ? (
            <GlassPanel className="border-dashed border-[#e2e8f0] bg-white p-6 text-center">
              <UserRound className="mx-auto h-10 w-10 text-[#A5B4FC]" aria-hidden />
              <p className="mt-2 text-sm font-medium text-[#3730A3]">No bookings yet</p>
              <p className="mt-1 text-xs leading-relaxed text-[#A5B4FC]">When you book labour, your history will appear here.</p>
            </GlassPanel>
          ) : null}
        </motion.section>

        {/* Emergency Hiring Banner + BuildMart Promotion */}
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.06 }}
          className="space-y-3"
        >
          <div className="flex items-end justify-between gap-2 px-0.5">
            <div className="min-w-0">
              <h3 className="text-base font-medium tracking-tight text-[#3730A3]">Boost hiring</h3>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#A5B4FC]">Swipe</span>
          </div>

          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-none [&::-webkit-scrollbar]:hidden">
            {/* Emergency */}
            <motion.div
              className="relative min-w-[80%] overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white px-4 py-3 text-slate-900 shadow-sm snap-start"
              initial={reduce ? undefined : { opacity: 0, y: 8 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0 bg-gradient-to-t from-white/95 via-white/35 to-transparent" />
                <div className="absolute -right-6 -bottom-6 w-[7rem] opacity-25">
                  <ConstructionIllustration />
                </div>
              </div>

              <div className="relative">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#0f172a] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    <Sparkles className="h-3 w-3" aria-hidden />
                    Emergency
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#e2e8f0]/40 px-3 py-1 text-[10px] font-bold text-[#0f172a] ring-1 ring-[#e2e8f0]">
                    <CalendarClock className="h-3 w-3" aria-hidden />
                    30 min match
                  </span>
                </div>

                <h3 className="mt-2 text-sm font-bold tracking-tight text-[#3730A3]">Need Labour Urgently?</h3>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[#A5B4FC]">Get workers within 30 minutes.</p>

                <div className="mt-3 flex items-center gap-2">
                  <motion.button
                    type="button"
                    onClick={() => setCategorySheetOpen(true)}
                    className="relative inline-flex items-center gap-1.5 rounded-xl bg-[#F4CC34] px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-[#F4CC34]/20 transition hover:brightness-[1.06] active:scale-[0.99]"
                    whileHover={reduce ? undefined : { y: -2 }}
                    animate={reduce ? undefined : { y: [0, -4, 0] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Sparkles className="h-3 w-3" aria-hidden />
                    Hire Now
                  </motion.button>

                  <span className="hidden text-[10px] font-medium text-[#A5B4FC] sm:inline">
                    Fast matching + verified workers
                  </span>
                </div>
              </div>
            </motion.div>

            {/* BuildMart */}
            <motion.div
              className="relative min-w-[80%] overflow-hidden rounded-2xl border border-[#e2e8f0] bg-gradient-to-br from-[#FAFAFA] via-white to-white px-4 py-3 text-slate-900 shadow-sm snap-start"
              initial={reduce ? undefined : { opacity: 0, y: 8 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.02 }}
            >
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute -right-12 -top-12 h-[14rem] w-[14rem] rounded-full bg-[#0f172a]/10 blur-2xl" />
              </div>

              <div className="relative">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-[#0f172a] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    Materials
                  </span>
                  <span className="inline-flex items-center rounded-full bg-[#e2e8f0]/40 px-3 py-1 text-[10px] font-bold text-[#0f172a] ring-1 ring-[#e2e8f0]">
                    BuildMart
                  </span>
                </div>

                <h3 className="mt-2 text-sm font-bold tracking-tight text-[#3730A3]">Need Materials Too?</h3>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[#A5B4FC]">
                  Order Cement, Sand &amp; Steel directly from nearby suppliers.
                </p>

                <div className="mt-3">
                  <motion.button
                    type="button"
                    onClick={() => navigate('/app/buildmart')}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#F4CC34] px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-[#F4CC34]/20 transition hover:brightness-[1.06] active:scale-[0.99]"
                    whileHover={reduce ? undefined : { y: -2 }}
                    animate={reduce ? undefined : { y: [0, -3, 0] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    Explore BuildMart
                    <ArrowRight className="h-3 w-3" aria-hidden />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.section>


        {/* Quick actions */}
        <section className="space-y-3" aria-label="Quick actions">
          <AppSectionHeader className="px-0.5" title="Quick actions" />
          {actions.map((a, i) =>
            a.id === 'book' ? (
              <motion.button
                key={a.id}
                type="button"
                onClick={() => setCategorySheetOpen(true)}
                initial={reduce ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.42, delay: 0.1 + i * 0.06 }}
                className="group w-full text-left"
              >
                <GlassPanel className="relative overflow-hidden border border-[#e2e8f0] bg-white p-4 shadow-sm transition hover:border-[#0f172a] hover:bg-[#FAFAFA] active:scale-[0.985]">
                  <div className="pointer-events-none absolute inset-0 z-0">
                    {a.bgImage && <img src={a.bgImage} alt="" className="absolute right-0 top-0 h-full w-[50%] object-cover object-left opacity-[0.25] mix-blend-multiply transition-all duration-500 ease-out group-hover:scale-105 group-hover:opacity-40 group-hover:mix-blend-normal" />}
                    <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent" />
                  </div>
                  <motion.div layout className="relative z-10 flex items-start gap-3.5">
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${getPastelStyles(Sparkles).bg} ${getPastelStyles(Sparkles).text} bg-white/50 backdrop-blur-sm shadow-sm ring-1 ring-white/60`}>
                      <Sparkles className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-[15px] font-bold text-slate-900">{a.title}</span>
                      <span className="mt-1 block text-xs font-medium text-slate-500">{a.subtitle}</span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 group-hover:text-[#0f172a]" aria-hidden />
                  </motion.div>
                </GlassPanel>
              </motion.button>
            ) : (
              <AppPressableLinkCard key={a.id} to={a.to} title={a.title} subtitle={a.subtitle} icon={a.icon} delay={0.1 + i * 0.06} bgImage={a.bgImage} />
            ),
          )}
        </section>

        {/* How it works */}
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.12 }}
        >
          <AppSectionHeader className="mb-2 px-0.5" title="How it works" />
          <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 pt-0.5 scrollbar-none [&::-webkit-scrollbar]:hidden">
            {STEPS.map(({ icon: Icon, title, copy }, i) => {
              const pastel = getPastelStyles(Icon)
              return (
                <GlassPanel
                  key={title}
                  className="min-w-38 shrink-0 snap-start border border-[#e2e8f0] bg-white p-3 shadow-sm"
                >
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${pastel.bg} ${pastel.text}`}>
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <p className="mt-2 text-xs font-medium text-[#3730A3]">{title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[#A5B4FC]">{copy}</p>
                  <span className="mt-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#e2e8f0]/45 text-[10px] font-medium text-[#0f172a]">
                    {i + 1}
                  </span>
                </GlassPanel>
              )
            })}
          </div>
        </motion.section>

        {/* Trust */}
        <motion.section
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18, duration: 0.35 }}
        >
          <AppSurface className="border border-[#e2e8f0] bg-white">
            <p className="text-center text-[11px] font-medium uppercase tracking-wide text-[#3730A3]">
              Why homeowners choose us
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {TRUST_PILLS.map(({ icon: Icon, label }) => {
                const pastel = getPastelStyles(Icon)
                return (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-2xl border border-[#e2e8f0] bg-white px-3 py-2 text-[11px] font-medium text-[#111827] shadow-sm"
                  >
                    <span className={`flex h-7 w-7 items-center justify-center rounded-xl ${pastel.bg} ${pastel.text}`}>
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    {label}
                  </span>
                )
              })}
            </div>
          </AppSurface>
        </motion.section>
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.22, duration: 0.35 }}
          className="flex justify-center pb-1"
        >
          <Link
            to="/app/support"
            className="inline-flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white/80 px-4 py-3 text-sm font-semibold text-[#0f172a] shadow-sm backdrop-blur-sm transition hover:border-[#0f172a] hover:bg-[#FAFAFA]"
          >
            <Headphones className="h-4 w-4 text-[#0f172a]" aria-hidden />
            Questions? Chat with support
          </Link>
        </motion.div>
      </section>

      <CategoryPickBottomSheet
        open={categorySheetOpen}
        onClose={() => setCategorySheetOpen(false)}
        tradeGroups={tradeGroups}
        groupsLoading={groupsLoading}
      />

      <BookingTypeSheet
        open={quickBookTypeOpen}
        onClose={() => {
          setQuickBookTypeOpen(false)
          setQuickBookCategory(null)
        }}
        value={null}
        categoryLabel={quickBookCategory?.name}
        onSelect={handleQuickBookType}
      />

      <AnimatePresence>
        {detailId ? (
          <LabourPublicDetailSheet
            labour={detailLabour}
            loading={detailLoading}
            onClose={closeDetail}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}
