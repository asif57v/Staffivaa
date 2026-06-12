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
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-500">
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
          className="space-y-3"
        >
          <div className="flex items-center justify-between gap-2 px-1">
            <h3 className="text-[17px] font-bold tracking-tight text-slate-900">Nearby Labour</h3>
            <button
              type="button"
              onClick={() => setShowAllLabours(true)}
              className="flex items-center gap-1 text-[13px] font-semibold text-slate-600 hover:text-slate-900 transition"
            >
              View all <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-1 mb-1">
            {TRUST_PILLS.map(({ icon: Icon, label }) => {
              return (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-slate-100 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                >
                  <Icon className={`h-3.5 w-3.5 ${label.includes('Aadhaar') ? 'text-emerald-500' : 'text-[#F4CC34]'}`} aria-hidden />
                  {label}
                </span>
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

          {laboursLoading ? <AppListSkeleton rows={2} /> : null}

          {!laboursLoading && !laboursErr && nearbyLabours.length > 0 ? (
            <ul className="space-y-3">
              {nearbyLabours.slice(0, 1).map((l) => {
                const ui = l._ui
                const firstCat = (l.tradeCategories || [])[0]
                const dist = distanceLabelFor(l.id)
                const { label: availLabel, dot } = availabilityFromWorkHours(ui.workHoursLabel, ui.responseLabel)

                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => openDetail(l.id)}
                      className="w-full text-left transition active:scale-[0.98]"
                    >
                      <div className="relative overflow-hidden rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.05)]">
                        <div className="flex items-start gap-4">
                          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-slate-50 ring-2 ring-slate-100">
                            <img src={ui.photoUrl} alt="" className="h-full w-full object-cover object-top" loading="lazy" decoding="async" />
                            <span aria-hidden className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="truncate text-[17px] font-bold tracking-tight text-slate-900">
                                {l.displayName}
                              </h4>
                              {l.kycVerified ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                  <ShieldCheck className="h-3 w-3" /> Verified
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-0.5 truncate text-[13px] font-semibold text-slate-600">
                              {firstCat?.name || 'Skilled worker'}
                            </p>
                            
                            <div className="mt-2.5 flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-[8px] bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">
                                <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> {ui.rating.toFixed(1)} ({hashSeed(l.id, 200) + 20}+)
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-[8px] bg-slate-50 border border-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                                <ClipboardList className="h-3 w-3" /> {ui.experienceLabel}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-[8px] bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">
                                <MapPin className="h-3 w-3" /> {dist}
                              </span>
                            </div>
                            
                            <div className="mt-2.5 flex items-center justify-between">
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
                                <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> {availLabel}
                              </span>
                              <ChevronRight className="h-4 w-4 text-slate-400" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </motion.section>

        {/* Ongoing / Recent Bookings */}
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.02 }}
          className="space-y-3 mt-8"
        >
          <div className="flex items-center justify-between gap-2 px-1">
            <h3 className="text-[17px] font-bold tracking-tight text-slate-900">Ongoing / Recent Bookings</h3>
            <button
              type="button"
              onClick={() => navigate('/app/bookings')}
              className="flex items-center gap-1 text-[13px] font-semibold text-[#3730A3] hover:text-[#312E81] transition"
            >
              View all <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <Link
            to="/app/bookings"
            className="group flex items-center gap-3 rounded-[20px] border border-amber-200 bg-amber-50 p-4 transition hover:bg-amber-100 active:scale-[0.98]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F4CC34] text-white shadow-sm">
              <UserRound className="h-6 w-6" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-slate-900">Need workers on site?</p>
              <p className="text-[12px] font-medium text-slate-600 mt-0.5">Instant or scheduled booking with roles & site details</p>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition group-hover:translate-x-0.5" aria-hidden />
          </Link>

          {bookingsLoading ? <AppListSkeleton rows={2} /> : null}

          {!bookingsLoading && recentBookings.length ? (
            <motion.div className="space-y-3 mt-3">
              {recentBookings.map((b, idx) => {
                const st = bookingStatusToUi(b.status)
                const primaryLine = (b.lines || [])[0]
                const itemLabel = primaryLine?.categoryName || (b.notes ? 'Service' : 'Labour')
                const qty = primaryLine?.quantity
                const day = formatBookingDay(b.serviceDate)
                const timeHint = b.bookingType === 'instant' ? 'Anytime' : 'Slot'

                return (
                  <motion.div
                    key={b.id || b.ref || idx}
                    initial={reduce ? undefined : { opacity: 0, y: 10 }}
                    animate={reduce ? undefined : { opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, delay: idx * 0.05 }}
                    className="relative overflow-hidden rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.05)]"
                  >
                    <div className="flex gap-4">
                      {/* Thumbnail */}
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-[14px] bg-slate-100">
                        <img src={getCategoryImage(itemLabel)} alt="" className="h-full w-full object-cover" />
                      </div>
                      
                      <div className="flex-1 min-w-0 py-0.5">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="inline-flex items-center gap-1 rounded-[8px] bg-slate-50 border border-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            <CalendarClock className="h-3 w-3" />
                            {day} · {timeHint}
                          </span>
                          <span className={`inline-flex items-center rounded-[8px] px-2 py-0.5 text-[10px] font-bold ${st.tone.replace('ring-1', '')} bg-opacity-20`}>
                            {st.label}
                          </span>
                        </div>
                        
                        <h4 className="truncate text-[16px] font-bold text-slate-900">{itemLabel}</h4>
                        
                        <div className="mt-1 flex items-start gap-1 text-[11px] font-medium text-slate-500">
                          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span className="line-clamp-2 leading-snug">{b.address}</span>
                        </div>
                        
                        <div className="mt-2 flex items-center gap-3 text-[11px] font-medium text-slate-600">
                          {qty && (
                            <span className="flex items-center gap-1">
                              <ClipboardList className="h-3.5 w-3.5" /> Qty: {qty}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <UserRound className="h-3.5 w-3.5" /> {b.assignedWorker ? '1 Worker' : 'Seeking Workers'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/app/bookings?ref=${encodeURIComponent(b.ref || '')}`)}
                        className="flex-1 rounded-[12px] bg-[#F4CC34] px-4 py-2.5 text-[13px] font-bold text-slate-900 shadow-sm transition hover:brightness-[1.05] active:scale-[0.98]"
                      >
                        Track
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/app/bookings?rebookFrom=${encodeURIComponent(b.ref || '')}`)}
                        className="flex-1 rounded-[12px] border-2 border-[#F4CC34] bg-white px-4 py-2.5 text-[13px] font-bold text-[#F4CC34] shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
                      >
                        Rebook
                      </button>
                    </div>
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

        {/* Boost hiring */}
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.06 }}
          className="space-y-3 mt-8"
        >
          <div className="flex items-center justify-between gap-2 px-1">
            <h3 className="text-[17px] font-bold tracking-tight text-slate-900">Boost hiring</h3>
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#3730A3] flex items-center gap-1">
              Swipe <ChevronRight className="h-3 w-3" />
            </span>
          </div>

          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-none [&::-webkit-scrollbar]:hidden">
            {/* Emergency */}
            <motion.div
              className="relative min-w-[85%] sm:min-w-[75%] overflow-hidden rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.05)] snap-start flex gap-4"
              whileHover={reduce ? undefined : { y: -2 }}
            >
              <div className="flex-1 flex flex-col items-start">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 rounded-[6px] bg-slate-900 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                    <Sparkles className="h-2.5 w-2.5" /> Emergency
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-[6px] bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-700">
                    <CalendarClock className="h-2.5 w-2.5" /> 30 min match
                  </span>
                </div>
                
                <h4 className="text-[16px] font-extrabold text-slate-900 leading-tight">Need Labour Urgently?</h4>
                <p className="mt-1 text-[12px] font-medium text-slate-500 line-clamp-2">Get verified workers assigned within 30 minutes.</p>
                
                <button
                  type="button"
                  onClick={() => setCategorySheetOpen(true)}
                  className="mt-4 inline-flex items-center gap-1 rounded-[10px] bg-[#F4CC34] px-4 py-2 text-[12px] font-bold text-slate-900 shadow-sm transition hover:brightness-[1.05] active:scale-[0.96]"
                >
                  Hire Now <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="w-20 shrink-0 self-end opacity-90">
                <ConstructionIllustration />
              </div>
            </motion.div>

            {/* BuildMart */}
            <motion.div
              className="relative min-w-[85%] sm:min-w-[75%] overflow-hidden rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.05)] snap-start flex gap-4"
              whileHover={reduce ? undefined : { y: -2 }}
            >
              <div className="flex-1 flex flex-col items-start">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 rounded-[6px] bg-slate-900 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                    <LayoutGrid className="h-2.5 w-2.5" /> Materials
                  </span>
                </div>
                
                <h4 className="text-[16px] font-extrabold text-slate-900 leading-tight">Need Materials?</h4>
                <p className="mt-1 text-[12px] font-medium text-slate-500 line-clamp-2">Order cement, sand, steel & suppliers directly.</p>
                
                <button
                  type="button"
                  onClick={() => navigate('/app/buildmart')}
                  className="mt-4 inline-flex items-center gap-1 rounded-[10px] bg-[#F4CC34] px-4 py-2 text-[12px] font-bold text-slate-900 shadow-sm transition hover:brightness-[1.05] active:scale-[0.96]"
                >
                  Order Now <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="w-20 shrink-0 self-center">
                 {/* Placeholder for material box illustration */}
                 <div className="h-20 w-20 bg-amber-100 rounded-xl flex items-center justify-center">
                    <PaintRoller className="h-8 w-8 text-amber-500 opacity-50" />
                 </div>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* Quick actions */}
        <section className="space-y-3 mt-8">
          <h3 className="px-1 text-[17px] font-bold tracking-tight text-slate-900">Quick actions</h3>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
            {[
              { id: 'book', title: 'Book Labour', icon: UserRound, color: 'bg-indigo-100 text-indigo-600', action: () => setCategorySheetOpen(true) },
              { id: 'history', title: 'My Bookings', icon: CalendarClock, color: 'bg-emerald-100 text-emerald-600', action: () => navigate('/app/bookings') },
              { id: 'support', title: 'Support', icon: Headphones, color: 'bg-rose-100 text-rose-600', action: () => navigate('/app/support') }
            ].map((a) => (
              <button
                key={a.id}
                onClick={a.action}
                className="flex flex-1 min-w-[100px] flex-col items-center justify-center gap-2.5 rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] transition active:scale-[0.96]"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${a.color}`}>
                  <a.icon className="h-6 w-6" />
                </div>
                <span className="text-[13px] font-bold text-slate-900 whitespace-nowrap">{a.title}</span>
              </button>
            ))}
          </div>
        </section>

        {/* How it works */}
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.12 }}
          className="mt-8"
        >
          <h3 className="mb-4 px-1 text-[17px] font-bold tracking-tight text-slate-900">How it works</h3>
          <div className="flex items-start justify-between relative px-2">
             <div className="absolute top-[22px] left-[10%] right-[10%] border-t-2 border-dashed border-slate-200 z-0" />
             {STEPS.map((step, i) => (
                <div key={i} className="flex flex-col items-center relative z-10 w-1/3">
                   <div className="h-11 w-11 rounded-full bg-slate-50 border-2 border-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex items-center justify-center mb-2">
                     <span className="text-[18px] font-black text-[#3730A3]">{i + 1}</span>
                   </div>
                   <h4 className="text-[13px] font-bold text-slate-900 mb-0.5">{step.title}</h4>
                   <p className="text-[10px] text-slate-500 text-center px-1 font-medium leading-tight">{step.copy}</p>
                </div>
             ))}
          </div>
        </motion.section>

        {/* Trust */}
        <motion.section
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18, duration: 0.35 }}
          className="mt-8 bg-amber-50/50 -mx-4 px-4 py-4 border-y border-amber-100"
        >
          <div className="flex items-center justify-around">
             <div className="flex flex-col items-center gap-1.5">
                <ShieldCheck className="h-5 w-5 text-amber-500" />
                <span className="text-[10px] font-bold text-slate-700">Aadhaar Verified</span>
             </div>
             <div className="flex flex-col items-center gap-1.5">
                <Star className="h-5 w-5 text-amber-500" />
                <span className="text-[10px] font-bold text-slate-700">Clear Rates</span>
             </div>
             <div className="flex flex-col items-center gap-1.5">
                <CheckCircle2 className="h-5 w-5 text-amber-500" />
                <span className="text-[10px] font-bold text-slate-700">Safe & Reliable</span>
             </div>
          </div>
        </motion.section>

        {/* Support */}
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.22, duration: 0.35 }}
          className="mt-8 pb-4"
        >
          <div className="rounded-[20px] border border-slate-200 bg-[#FAFAFA] p-4 flex items-center justify-between gap-4">
             <div className="flex items-center gap-3">
               <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E0E7FF]">
                 <Headphones className="h-6 w-6 text-[#4F46E5]" />
               </div>
               <div>
                  <h4 className="text-[15px] font-bold text-slate-900">Need help?</h4>
                  <p className="text-[11px] font-medium text-slate-500 mt-0.5">Chat with our support team</p>
                  <p className="text-[9px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> We typically reply in under 2 minutes
                  </p>
               </div>
             </div>
             <button
               onClick={() => navigate('/app/support')}
               className="shrink-0 rounded-[12px] bg-[#4F46E5] px-4 py-3 text-[12px] font-bold text-white shadow-sm transition hover:bg-[#4338CA] active:scale-[0.98]"
             >
               Chat with support
             </button>
          </div>
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
