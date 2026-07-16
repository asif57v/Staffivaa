import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Droplets,
  Flame,
  GraduationCap,
  HardHat,
  Headphones,
  IndianRupee,
  LifeBuoy,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Navigation,
  Phone,
  Shield,
  ShieldCheck,
  Sparkles,
  Timer,
  Wallet,
  Wrench,
} from 'lucide-react'
import { KYC_STATUS } from '../../../constants/userRoles.js'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { AppSecondaryButton } from '../../../components/app/AppSecondaryButton.jsx'
import { AppSectionHeader } from '../../../components/app-ui/layout/AppSectionHeader.jsx'
import { GlassPanel } from '../../../components/ui/GlassPanel.jsx'
import { useNow } from '../../../hooks/useNow.js'
import { formatSecondsAsClock } from '../../../lib/formatDurationClock.js'
import {
  formatAppUserLocationLabel,
  hasAppUserLocation,
  readAppUserLocation,
  parseAppUserLocation,
} from '../../../lib/appUserLocationStorage.js'
import { AppUserLocationModal } from '../../../components/app/AppUserLocationModal.jsx'
import { LabourCheckOutConfirmModal } from '../../../components/labour/LabourCheckOutConfirmModal.jsx'
import { useGetNotificationsQuery } from '../../../store/api/workforceApi.js'
import {
  bucketsFromAssignments,
} from '../../../lib/labourJobDemoStorage.js'
import {
  useGetLabourAssignmentsQuery,
  useRespondAssignmentMutation,
} from '../../../store/api/workforceApi.js'

function isApiAssignment(job) {
  return Boolean(job?.requestId) && /^[a-f0-9]{24}$/i.test(String(job.id))
}
import { LabourAssignmentDetailModal } from '../../../components/labour/LabourAssignmentDetailModal.jsx'
import { useLabourPresence } from '../../../hooks/useLabourPresence.js'
import {
  appendAttendancePunch,
  dayKey,
  lastTodayType,
  liveWorkedSecondsForDay,
  readAttendanceEntries,
  subscribeAttendance,
} from '../../../lib/labourAttendanceStorage.js'
import {
  loadJobDemoState,
  nowIso,
  saveJobDemoState,
  subscribeJobDemo,
} from '../../../lib/labourJobDemoStorage.js'
import { readWalletState, subscribeWallet } from '../../../lib/labourWalletStorage.js'
import {
  buildAttendanceHistoryRows,
  buildEarningsGlance,
  buildUpcomingSchedule,
  formatInrFromPaise,
  LABOUR_EMERGENCY_PHONE,
  LABOUR_SUPPORT_PHONE,
  offerDistanceKm,
  pickTodayAssignment,
  SAFETY_BANNERS,
  whatsAppSupportUrl,
} from '../../../lib/labourHomeHelpers.js'
import {
  buildLabourNotifications,
  markNotificationRead,
  subscribeLabourNotifications,
} from '../../../lib/labourNotifications.js'

function getTimeGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function initialsFromName(name) {
  if (!name?.trim()) return '?'
  const parts = name.trim().split(/\s+/)
  const a = parts[0]?.[0]
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : ''
  return `${a || ''}${b || ''}`.toUpperCase() || '?'
}

function formatPunchTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

const QUICK_ACTIONS = [
  { to: '/app/attendance', label: 'Attendance', icon: CalendarClock, bg: 'from-sky-500/15 to-sky-50', iconTone: 'text-sky-700' },
  { to: '/app/earnings', label: 'Earnings', icon: IndianRupee, bg: 'from-emerald-500/15 to-emerald-50', iconTone: 'text-emerald-700' },
  { to: '/app/jobs', label: 'My jobs', icon: HardHat, bg: 'from-amber-500/15 to-amber-50', iconTone: 'text-amber-800' },
  { to: '/app/jobs', label: 'Site details', icon: MapPin, bg: 'from-violet-500/15 to-violet-50', iconTone: 'text-violet-700' },
  { to: '/app/work-categories', label: 'Skills', icon: Wrench, bg: 'from-orange-500/15 to-orange-50', iconTone: 'text-orange-800' },
  { to: '/app/support', label: 'Support', icon: LifeBuoy, bg: 'from-rose-500/15 to-rose-50', iconTone: 'text-rose-700' },
]

const FEATURE_CARDS = [
  {
    to: '/app/jobs',
    label: 'Browse Jobs',
    desc: 'Find new work opportunities near you',
    icon: HardHat,
    img: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=600&q=70',
    accent: '#3b82f6',
  },
  {
    to: '/app/earnings',
    label: 'Your Earnings',
    desc: 'View wages and withdraw your balance',
    icon: IndianRupee,
    img: 'https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?w=600&q=70',
    accent: '#10b981',
  },
  {
    to: '/app/work-categories',
    label: 'My Skills',
    desc: 'Update your trade & work categories',
    icon: Wrench,
    img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=70',
    accent: '#f97316',
  },
  {
    to: '/app/support',
    label: 'Support',
    desc: 'Get help or report an emergency',
    icon: Headphones,
    img: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=600&q=70',
    accent: '#8b5cf6',
  },
]

const STATUS_TONE = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  sky: 'bg-sky-500',
  brand: 'bg-brand',
}

function SafetyBannerIcon({ icon }) {
  if (icon === 'helmet') return <HardHat className="h-6 w-6" aria-hidden />
  if (icon === 'shield') return <Shield className="h-6 w-6" aria-hidden />
  if (icon === 'droplet') return <Droplets className="h-6 w-6" aria-hidden />
  return <GraduationCap className="h-6 w-6" aria-hidden />
}

/** Fades + slides up once when it enters the viewport — fires only once per load. */
function FadeInSection({ children, delay = 0, className = '' }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function SupportCarousel({ cards, reduce }) {
  const ref = useRef(null)
  const [hovered, setHovered] = useState(false)
  const idxRef = useRef(0)

  useEffect(() => {
    if (reduce || hovered) return undefined
    const id = window.setInterval(() => {
      const el = ref.current
      if (!el) return
      idxRef.current = (idxRef.current + 1) % cards.length
      el.scrollTo({ left: idxRef.current * el.clientWidth, behavior: 'smooth' })
    }, 2000)
    return () => window.clearInterval(id)
  }, [reduce, hovered, cards.length])

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={() => setHovered(true)}
      onTouchEnd={() => setHovered(false)}
      className="-mx-4 flex snap-x snap-mandatory overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden"
    >
      {cards.map((card, idx) => {
        const Tag = card.tag
        return (
          <Tag
            key={card.label}
            href={card.href}
            to={card.to}
            target={card.target}
            rel={card.rel}
            className="relative shrink-0 snap-center mx-2 first:ml-4 last:mr-4 w-[calc(100%-2rem)] overflow-hidden rounded-2xl shadow-lg active:scale-[0.98] transition"
            style={{ minWidth: 'calc(100% - 2rem)' }}
          >
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url('${card.img}')` }}
              aria-hidden
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/40 to-transparent" aria-hidden />
            <div className="relative flex h-36 flex-col justify-end p-4">
              <span
                className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl shadow-md"
                style={{ backgroundColor: card.accent }}
              >
                <card.icon className="h-4.5 w-4.5 text-white" aria-hidden />
              </span>
              <p className="text-base font-extrabold leading-tight text-white">{card.label}</p>
              <p className="mt-0.5 text-xs font-medium text-white/70">{card.desc}</p>
            </div>
            <div className="absolute bottom-3 right-4 flex gap-1">
              {cards.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === idx ? 'w-4 bg-white' : 'w-1.5 bg-white/40'
                  }`}
                />
              ))}
            </div>
          </Tag>
        )
      })}
    </div>
  )
}

/**
 * Worker home — attendance-first dashboard with jobs, earnings, site info, and safety.
 */
export function LabourHomeScreen({ user }) {
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const now = useNow(1000)
  const [entries, setEntries] = useState(readAttendanceEntries)
  const [wallet, setWallet] = useState(readWalletState)
  const [jobs, setJobs] = useState(loadJobDemoState)
  const [toast, setToast] = useState('')
  const [safetyIdx, setSafetyIdx] = useState(0)
  const [appLocation, setAppLocation] = useState(() => readAppUserLocation())
  const [workAreaModalOpen, setWorkAreaModalOpen] = useState(false)
  const [checkOutModalOpen, setCheckOutModalOpen] = useState(false)
  const [pendingCheckIn, setPendingCheckIn] = useState(false)
  const [notifTick, setNotifTick] = useState(0)
  const [assignmentDetailOpen, setAssignmentDetailOpen] = useState(false)
  const [showAllSkills, setShowAllSkills] = useState(false)
  const { online, setOnline } = useLabourPresence()

  const { data: apiData, refetch } = useGetLabourAssignmentsQuery(undefined)
  const [respondAssignment] = useRespondAssignmentMutation()
  const apiBuckets = useMemo(
    () => bucketsFromAssignments(apiData?.assignments || []),
    [apiData?.assignments],
  )

  const firstName = user?.fullName?.split(/\s/)?.[0]
  const greeting = getTimeGreeting()
  const initials = initialsFromName(user?.fullName)
  const profileImageUrl = user?.profileImageUrl?.trim()
  const kyc = user?.labourProfile?.kycStatus
  const kycOk = kyc === KYC_STATUS.VERIFIED
  const categories = user?.labourProfile?.categoryIds
  const primaryTrade =
    Array.isArray(categories) && categories.length > 0
      ? typeof categories[0] === 'object' && categories[0]?.name
        ? categories[0].name
        : 'Skilled worker'
      : 'Worker'

  useEffect(() => subscribeAttendance(setEntries), [])
  useEffect(() => subscribeWallet(setWallet), [])
  useEffect(() => subscribeJobDemo(setJobs), [])
  useEffect(() => subscribeLabourNotifications(() => setNotifTick((t) => t + 1)), [])

  useEffect(() => {
    const onLoc = () => setAppLocation(readAppUserLocation())
    window.addEventListener('lc-app-user-location-changed', onLoc)
    return () => window.removeEventListener('lc-app-user-location-changed', onLoc)
  }, [])

  useEffect(() => {
    if (reduce) return undefined
    const id = window.setInterval(() => {
      setSafetyIdx((i) => (i + 1) % SAFETY_BANNERS.length)
    }, 5200)
    return () => window.clearInterval(id)
  }, [reduce])

  const quickActionsRef = useRef(null)
  const [isQuickActionsHovered, setIsQuickActionsHovered] = useState(false)
  const carouselIdxRef = useRef(0)

  useEffect(() => {
    if (reduce || isQuickActionsHovered) return undefined

    const intervalId = window.setInterval(() => {
      const el = quickActionsRef.current
      if (!el) return
      const cardWidth = el.clientWidth
      const totalCards = FEATURE_CARDS.length
      carouselIdxRef.current = (carouselIdxRef.current + 1) % totalCards
      el.scrollTo({ left: carouselIdxRef.current * cardWidth, behavior: 'smooth' })
    }, 2000)

    return () => window.clearInterval(intervalId)
  }, [reduce, isQuickActionsHovered])

  const todayKey = dayKey()
  const lastType = lastTodayType(entries)
  const onSite = lastType === 'in'
  const workedSecondsToday = useMemo(
    () => liveWorkedSecondsForDay(entries, todayKey, now),
    [entries, todayKey, now],
  )

  const todayPunches = useMemo(
    () => entries.filter((e) => e.day === todayKey).sort((a, b) => new Date(a.at) - new Date(b.at)),
    [entries, todayKey],
  )
  const lastIn = useMemo(() => [...todayPunches].reverse().find((e) => e.type === 'in'), [todayPunches])

  const todayAssignment = useMemo(() => pickTodayAssignment(jobs, apiBuckets), [jobs, apiBuckets])
  const todayJob = todayAssignment.job
  const schedule = useMemo(() => buildUpcomingSchedule(jobs), [jobs])
  const historyRows = useMemo(() => buildAttendanceHistoryRows(entries), [entries])

  const withdrawnPaise = useMemo(
    () => wallet.withdrawals.reduce((acc, w) => acc + w.amountPaise, 0),
    [wallet.withdrawals],
  )
  const earnings = useMemo(
    () => buildEarningsGlance(entries, wallet.ratePaisePerMin, withdrawnPaise),
    [entries, wallet.ratePaisePerMin, withdrawnPaise],
  )

  const { data: notifRes } = useGetNotificationsQuery(undefined, { pollingInterval: 10000 })
  const notifications = useMemo(() => ({
    unreadCount: notifRes?.data?.unreadCount || 0
  }), [notifRes])

  const hasWorkLocation = useMemo(() => hasAppUserLocation(appLocation), [appLocation])
  const locationLabel = formatAppUserLocationLabel(appLocation) || 'Set your work area'
  const { area: labourLocationTitle, detail: labourLocationSubtitle } = useMemo(() => {
    return parseAppUserLocation(appLocation)
  }, [appLocation])
  const siteLabel = lastIn?.projectLabel && lastIn.projectLabel !== 'Unassigned'
    ? lastIn.projectLabel
    : todayJob?.siteName || todayJob?.title || 'No site assigned'

  const showToast = useCallback((msg) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2600)
  }, [])

  const punchLabels = useMemo(
    () => ({
      projectLabel: todayJob?.title || todayJob?.siteName || lastIn?.projectLabel || 'Unassigned',
      workLabel: todayJob?.role || lastIn?.workLabel || primaryTrade,
    }),
    [todayJob, lastIn, primaryTrade],
  )

  const performCheckIn = useCallback(() => {
    appendAttendancePunch('in', punchLabels)
    setEntries(readAttendanceEntries())
    setOnline(true)
    showToast('Checked in — stay safe on site.')
  }, [punchLabels, setOnline, showToast])

  const handleCheckIn = () => {
    if (lastType === 'in') {
      showToast('You are already checked in.')
      return
    }
    if (!hasWorkLocation) {
      setPendingCheckIn(true)
      setWorkAreaModalOpen(true)
      showToast('Set your work area before check-in.')
      return
    }
    performCheckIn()
  }

  const handleCheckOutRequest = () => {
    if (lastType !== 'in') {
      showToast('Check in first to start your shift.')
      return
    }
    setCheckOutModalOpen(true)
  }

  const confirmCheckOut = useCallback(() => {
    appendAttendancePunch('out', punchLabels)
    setEntries(readAttendanceEntries())
    setOnline(false)
    setCheckOutModalOpen(false)
    showToast('You are offline. No new job requests until you check in again.')
  }, [punchLabels, setOnline, showToast])

  const handleWorkAreaSaved = useCallback(() => {
    const next = readAppUserLocation()
    setAppLocation(next)
    if (pendingCheckIn && hasAppUserLocation(next)) {
      setPendingCheckIn(false)
      if (lastTodayType(readAttendanceEntries()) !== 'in') {
        performCheckIn()
      }
    }
  }, [pendingCheckIn, performCheckIn])


  const openDrawer = () => window.dispatchEvent(new CustomEvent('lc-open-app-drawer'))



  const safetyBanner = SAFETY_BANNERS[safetyIdx]

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative -mx-4 space-y-5 overflow-x-hidden pb-4"
      aria-label={user?.fullName ? `Worker home for ${user.fullName}` : 'Worker home'}
    >
      <AnimatePresence>
        {toast ? (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[480px] z-[9999] rounded-xl border border-amber-300/30 bg-[#0f172a]/95 px-4 py-3 text-center text-sm font-semibold text-[#F4CC34] shadow-xl backdrop-blur-md"
            role="status"
          >
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* 1. Header */}
      <section className="relative pb-0">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-b-[2rem] border-b border-slate-200 bg-white text-slate-900 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.1)]"
        >
          <motion.div className="relative pb-2 sm:pb-3">
            <div className="flex items-center justify-between gap-3 px-4 pb-1.5 pt-2 bg-[#FFD100] shadow-sm min-h-[56px]">
              {/* Location */}
              <button
                type="button"
                onClick={() => setWorkAreaModalOpen(true)}
                className="flex items-center gap-2 min-w-0 flex-1 text-left outline-none transition active:opacity-70 group"
              >
                <div className="flex shrink-0 items-center justify-center">
                  <MapPin className="h-[24px] w-[24px] text-slate-900" strokeWidth={2} />
                </div>
                
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={labourLocationTitle + labourLocationSubtitle}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col items-start min-w-0 w-full"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 w-full">
                      <span className="truncate min-w-0 text-[17px] font-extrabold tracking-tight text-[#111827]">
                        {labourLocationTitle}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-600 transition-transform group-hover:translate-y-0.5" strokeWidth={2.5} />
                    </div>
                    <span className="truncate min-w-0 w-full text-[10px] font-semibold tracking-wider uppercase text-slate-600">
                      {labourLocationSubtitle}
                    </span>
                  </motion.div>
                </AnimatePresence>
              </button>

              {/* Right action icons — fixed, never shrink */}
              <div className="flex shrink-0 items-center gap-2">
                {/* Online/Offline Toggle */}
                <div className="flex flex-col items-center justify-center mr-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !online;
                      setOnline(next);
                      showToast(next ? 'You are now online and ready for jobs.' : 'You are offline. No new job requests.');
                    }}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/75 ${
                      online ? 'bg-emerald-500' : 'bg-white/80 ring-1 ring-black/5'
                    }`}
                    aria-checked={online}
                    role="switch"
                    aria-label="Online status toggle"
                  >
                    <span className="sr-only">Toggle online status</span>
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        online ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                  <span className={`text-[8px] font-bold tracking-wide mt-0.5 ${online ? 'text-emerald-700' : 'text-slate-600'}`}>
                    {online ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={openDrawer}
                  className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
                  aria-label="Open menu"
                >
                  <Menu className="h-[18px] w-[18px]" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/app/notifications')}
                  className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
                  aria-label={
                    notifications.unreadCount > 0
                      ? `Notifications, ${notifications.unreadCount} unread`
                      : 'Notifications'
                  }
                >
                  <Bell className="h-[18px] w-[18px]" />
                  {notifications.unreadCount > 0 ? (
                    <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-white" />
                  ) : null}
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-stretch gap-2.5 sm:gap-3 px-4 sm:px-5">
              <Link
                to="/app/profile"
                className="relative shrink-0 self-center rounded-2xl p-0.5 ring-2 ring-slate-200 transition hover:ring-slate-300"
                aria-label="Open profile"
              >
                {profileImageUrl ? (
                  <img
                    src={profileImageUrl}
                    alt=""
                    className="h-14 w-14 rounded-[0.85rem] object-cover sm:h-16 sm:w-16 sm:rounded-[0.9rem]"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-[0.85rem] bg-slate-100 text-lg font-black text-slate-700 sm:h-16 sm:w-16 sm:rounded-[0.9rem] sm:text-xl">
                    {initials}
                  </span>
                )}
                {kycOk ? (
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white ring-2 ring-white sm:h-6 sm:w-6">
                    <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={3} aria-hidden />
                  </span>
                ) : null}
              </Link>

              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <p className="text-[11px] font-semibold text-slate-500">
                  {greeting}
                  {firstName ? `, ${firstName}` : ''} 👋
                </p>
                <h1 className="truncate text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
                  {user?.fullName?.trim() || firstName || 'Worker'}
                </h1>
                <p className="truncate text-xs font-medium text-slate-600">{primaryTrade}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {kycOk ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                      <ShieldCheck className="h-2.5 w-2.5" aria-hidden />
                      Verified
                    </span>
                  ) : (
                    <Link
                      to="/app/kyc"
                      className="inline-flex items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700"
                    >
                      KYC
                      <ChevronRight className="h-2.5 w-2.5" aria-hidden />
                    </Link>
                  )}
                </div>
              </div>

              <div className="flex w-[7.4rem] shrink-0 flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-2.5 shadow-sm sm:w-[8.25rem] sm:p-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">This month</p>
                  <p className="mt-0.5 font-mono text-base font-black leading-tight tabular-nums text-slate-900 sm:text-lg">
                    {formatInrFromPaise(earnings.monthPaise)}
                  </p>
                  {(earnings.availablePaise ?? 0) > 0 ? (
                    <p className="mt-0.5 truncate text-[9px] font-semibold text-emerald-600">
                      {formatInrFromPaise(earnings.availablePaise)} withdraw
                    </p>
                  ) : earnings.pendingPaise > 0 ? (
                    <p className="mt-0.5 truncate text-[9px] font-semibold text-amber-600">
                      {formatInrFromPaise(earnings.pendingPaise)} clearing
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[9px] text-slate-500">From attendance</p>
                  )}
                </div>
                <Link
                  to="/app/earnings"
                  className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl bg-linear-to-r from-brand-bright to-brand py-2 text-[10px] font-black text-white shadow-md shadow-brand/30 transition hover:brightness-110 active:scale-[0.98]"
                >
                  <Wallet className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Withdraw
                </Link>
              </div>
            </div>

          </motion.div>
        </motion.div>
      </section>

      <div className="space-y-5 px-4 pt-3">


        {/* 3. Today's job */}
        <FadeInSection delay={0.05}>
        <section className="pt-0">
          <AppSectionHeader 
            title="Today's assignment" 
            actionLabel="View all"
            actionTo="/app/jobs"
            className="mb-4 px-0.5 relative z-10" 
          />
          {todayJob ? (
            <motion.div
              role="button"
              tabIndex={0}
              onClick={() => setAssignmentDetailOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setAssignmentDetailOpen(true)
                }
              }}
              className="cursor-pointer overflow-hidden rounded-[1.5rem] border border-slate-200/90 bg-white shadow-[0_16px_40px_-24px_rgba(15,23,42,0.2)] transition hover:border-brand/30 hover:shadow-lg active:scale-[0.99]"
            >
              <div className="relative h-28 bg-linear-to-br from-slate-700 to-slate-900">
                <div
                  className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&q=60')] bg-cover bg-center opacity-40"
                  aria-hidden
                />
                <motion.div className="absolute inset-0 bg-linear-to-t from-slate-950/90 to-transparent" aria-hidden />
                <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-800">
                  {todayAssignment.kind === 'active' ? 'On assignment' : 'Scheduled'}
                </span>
              </div>
              <div className="space-y-2 p-4">
                <p className="flex items-start gap-2 text-sm font-extrabold text-slate-900">
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                  {todayJob.siteName || todayJob.title}
                </p>
                <p className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <HardHat className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  {todayJob.role} · {todayJob.contractor}
                </p>
                <p className="flex items-center gap-2 text-xs text-slate-600">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  {todayJob.location}
                </p>
                <p className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                  <Clock className="h-3.5 w-3.5 text-brand" aria-hidden />
                  {todayJob.shiftLabel}
                </p>
                {todayJob.rateLabel ? (
                  <p className="text-xs font-bold text-brand">{todayJob.rateLabel}</p>
                ) : null}
                <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                  <AppSecondaryButton
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/app/navigation/${todayJob.id}`, { state: { job: todayJob } })
                    }}
                    className="flex-1 py-2.5 text-xs bg-slate-900 text-white border-0"
                  >
                    <Navigation className="h-3.5 w-3.5" aria-hidden />
                    Map
                  </AppSecondaryButton>
                  <AppSecondaryButton
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setAssignmentDetailOpen(true)
                    }}
                    className="flex-1 py-2.5 text-xs bg-slate-900 text-white border-0"
                  >
                    Details
                  </AppSecondaryButton>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="overflow-hidden rounded-[1.25rem] bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-5 pb-5 text-center border border-slate-100">
              <div className="relative mx-auto h-24 w-24 mb-2 flex items-center justify-center">
                <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-xl" />
                <img 
                  src="/hardhat_3d.png" 
                  alt="Ready for work" 
                  className="relative z-10 h-20 w-20 object-contain drop-shadow-md hover:scale-105 transition-transform duration-500 mix-blend-multiply" 
                />
                <div className="absolute top-1 right-1 h-2 w-2 rounded-full bg-purple-400 opacity-60 animate-pulse" />
                <div className="absolute bottom-2 left-0 h-1.5 w-1.5 rounded-full bg-amber-400 opacity-80" />
                <div className="absolute top-6 left-1 h-1 w-1 rounded-full bg-blue-400 opacity-60" />
              </div>
              
              <div className="flex items-center justify-center gap-1.5 mb-1.5">
                <span className="text-lg">🎯</span>
                <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">Ready for work!</h3>
              </div>
              
              <p className="text-xs font-bold text-slate-600 mb-1">No active assignment for today</p>
              <p className="text-xs font-medium text-slate-500 mb-4 px-2">Check new job alerts below or open My Jobs.</p>
              
              <Link 
                to="/app/jobs"
                className="group relative flex w-full items-center justify-center overflow-hidden rounded-xl bg-[#FFC000] py-3 text-[14px] font-bold text-slate-900 transition-all hover:bg-[#F0B400] active:scale-[0.98]"
              >
                Browse Jobs
                <span className="absolute right-3 flex h-6 w-6 items-center justify-center rounded-full border border-slate-900/20 text-slate-900 transition-transform group-hover:translate-x-1">
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
              </Link>
            </div>
          )}
        </section>
        </FadeInSection>

        {/* 4. Feature carousel */}
        <FadeInSection delay={0.07}>
        <section aria-label="Quick actions">
          <AppSectionHeader title="Quick actions" className="mb-2 px-0.5" />
          <div
            ref={quickActionsRef}
            onMouseEnter={() => setIsQuickActionsHovered(true)}
            onMouseLeave={() => setIsQuickActionsHovered(false)}
            onTouchStart={() => setIsQuickActionsHovered(true)}
            onTouchEnd={() => setIsQuickActionsHovered(false)}
            className="-mx-4 flex snap-x snap-mandatory overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden"
          >
            {FEATURE_CARDS.map((card, idx) => (
              <Link
                key={card.label}
                to={card.to}
                className="relative shrink-0 snap-center mx-2 first:ml-4 last:mr-4 w-[calc(100%-2rem)] overflow-hidden rounded-2xl shadow-lg active:scale-[0.98] transition"
                style={{ minWidth: 'calc(100% - 2rem)' }}
              >
                {/* Background image */}
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url('${card.img}')` }}
                  aria-hidden
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/40 to-transparent" aria-hidden />
                {/* Content */}
                <div className="relative flex h-36 flex-col justify-end p-4">
                  <span
                    className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl shadow-md"
                    style={{ backgroundColor: card.accent }}
                  >
                    <card.icon className="h-4.5 w-4.5 text-white" aria-hidden />
                  </span>
                  <p className="text-base font-extrabold leading-tight text-white">{card.label}</p>
                  <p className="mt-0.5 text-xs font-medium text-white/70">{card.desc}</p>
                </div>
                {/* Dot indicators */}
                <div className="absolute bottom-3 right-4 flex gap-1">
                  {FEATURE_CARDS.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === idx ? 'w-4 bg-white' : 'w-1.5 bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>
        </FadeInSection>

        {/* 5. Earnings breakdown */}
        <FadeInSection delay={0.05}>
        <section aria-label="Earnings breakdown">
          <AppSectionHeader title="Earnings breakdown" className="mb-2 px-0.5" />
          <GlassPanel className="border-slate-200/90 p-3">
            <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">All-time earned</p>
              <p className="font-mono text-sm font-black tabular-nums text-slate-900">
                {formatInrFromPaise(earnings.earnedPaise ?? 0)}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Today', value: earnings.todayPaise },
                { label: 'This week', value: earnings.weekPaise },
                { label: 'Available', value: earnings.availablePaise ?? 0 },
              ].map((cell) => (
                <Link
                  key={cell.label}
                  to="/app/earnings"
                  className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-2 py-2 text-center transition hover:border-brand/30 hover:bg-brand/5"
                >
                  <p className="text-[9px] font-bold uppercase text-slate-500">{cell.label}</p>
                  <p className="mt-0.5 text-xs font-black tabular-nums text-slate-900">
                    {formatInrFromPaise(cell.value)}
                  </p>
                </Link>
              ))}
            </div>
          </GlassPanel>
        </section>
        </FadeInSection>


        {/* 7. Upcoming schedule */}
        {schedule.length > 0 ? (
          <FadeInSection>
          <section aria-label="Upcoming schedule">
            <AppSectionHeader title="Upcoming schedule" className="mb-2 px-0.5" />
            <ol className="relative space-y-0 border-l-2 border-slate-200/90 pl-4 ml-1.5">
              {schedule.map((row, i) => (
                <li key={`${row.id}-${i}`} className="relative pb-4 last:pb-0">
                  <span
                    className={`absolute -left-[1.3rem] top-1 flex h-3 w-3 rounded-full ring-4 ring-white ${
                      row.tone === 'brand' ? 'bg-brand' : row.tone === 'amber' ? 'bg-amber-500' : 'bg-slate-300'
                    }`}
                    aria-hidden
                  />
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{row.when}</p>
                  <p className="mt-0.5 text-sm font-extrabold text-slate-900">{row.siteName || row.title}</p>
                  <p className="text-xs text-slate-600">
                    {row.role} · {row.shiftLabel}
                  </p>
                </li>
              ))}
            </ol>
          </section>
          </FadeInSection>
        ) : null}

        {/* 8. Site details */}
        {todayJob ? (
          <FadeInSection>
          <section aria-label="Site details">
            <AppSectionHeader title="Current site" className="mb-2 px-0.5" />
            <GlassPanel className="border-slate-200/90 p-4">
              <p className="text-sm font-extrabold text-slate-900">{todayJob.siteName || todayJob.title}</p>
              <p className="mt-1 text-xs text-slate-600">{todayJob.location}</p>
              <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-400">Supervisor</p>
                <p className="mt-0.5 text-sm font-bold text-slate-900">{todayJob.supervisor || '—'}</p>
                {todayJob.supervisorPhone ? (
                  <a
                    href={`tel:${todayJob.supervisorPhone}`}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-brand"
                  >
                    <Phone className="h-3 w-3" aria-hidden />
                    {todayJob.supervisorPhone}
                  </a>
                ) : null}
              </div>
              <p className="mt-3 text-[10px] font-bold uppercase text-slate-400">Facilities on site</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {(todayJob.facilities || []).map((f) => (
                  <li
                    key={f}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-900"
                  >
                    <Check className="h-3 w-3" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <AppSecondaryButton
                as="a"
                href={`https://www.google.com/maps/search/?api=1&query=${todayJob.mapQuery}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 w-full py-3 text-sm"
              >
                <MapPin className="h-4 w-4" aria-hidden />
                Open map
              </AppSecondaryButton>
            </GlassPanel>
          </section>
          </FadeInSection>
        ) : null}

        {/* 9. Skills & KYC */}
        <FadeInSection>
        <section aria-label="Skills and verification">
          <AppSectionHeader title="Skills & verification" className="mb-2 px-0.5" />
          <GlassPanel className="border-slate-200/90 p-4">
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                {kycOk ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
                )}
                {kycOk ? 'Aadhaar verified' : 'Aadhaar verification pending'}
              </li>
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {Array.isArray(categories) && categories.length > 0 ? (
                <>
                  {(showAllSkills ? categories : categories.slice(0, 5)).map((c) => (
                    <span
                      key={typeof c === 'object' && c?._id ? c._id : String(c)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm"
                    >
                      <Wrench className="h-3 w-3 text-brand" aria-hidden />
                      {typeof c === 'object' && c?.name ? c.name : 'Skill'}
                    </span>
                  ))}
                  {!showAllSkills && categories.length > 5 && (
                    <button
                      onClick={() => setShowAllSkills(true)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-100 transition cursor-pointer"
                    >
                      +{categories.length - 5} more
                    </button>
                  )}
                  {showAllSkills && categories.length > 5 && (
                    <button
                      onClick={() => setShowAllSkills(false)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-100 transition cursor-pointer"
                    >
                      Show less
                    </button>
                  )}
                </>
              ) : (
                <span className="text-xs text-slate-500">Add your work types for better job matching.</span>
              )}
            </div>
            <Link
              to="/app/work-categories"
              className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand underline-offset-4 hover:underline"
            >
              Update skills
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </GlassPanel>
        </section>
        </FadeInSection>

        {/* 11. Support & emergency */}
        <FadeInSection>
        <section aria-label="Support and emergency">
          <AppSectionHeader title="Support &amp; emergency" className="mb-2 px-0.5" />
          {(() => {
            const SUPPORT_CARDS = [
              {
                tag: 'a',
                href: `tel:${LABOUR_SUPPORT_PHONE}`,
                label: 'Call Support',
                desc: 'Speak directly with our support team',
                icon: Phone,
                img: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=600&q=70',
                accent: '#0ea5e9',
              },
              {
                tag: 'a',
                href: `tel:${LABOUR_EMERGENCY_PHONE}`,
                label: 'Emergency',
                desc: 'Call emergency services immediately',
                icon: AlertTriangle,
                img: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&q=70',
                accent: '#ef4444',
              },
              {
                tag: 'a',
                href: whatsAppSupportUrl(),
                target: '_blank',
                rel: 'noopener noreferrer',
                label: 'WhatsApp',
                desc: 'Chat with us on WhatsApp anytime',
                icon: MessageCircle,
                img: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&q=70',
                accent: '#22c55e',
              },
              {
                tag: Link,
                to: '/app/support',
                label: 'Support Centre',
                desc: 'View FAQs, raise tickets & get help',
                icon: Headphones,
                img: 'https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=600&q=70',
                accent: '#8b5cf6',
              },
            ]
            return (
              <SupportCarousel cards={SUPPORT_CARDS} reduce={reduce} />
            )
          })()}
        </section>
        </FadeInSection>

        {/* 12. Safety / training carousel */}
        <FadeInSection>
        <section aria-label="Safety tips">
          <AppSectionHeader title="Safety & training" className="mb-2 px-0.5" />
          <AnimatePresence mode="wait">
            <motion.div
              key={safetyBanner.id}
              initial={reduce ? false : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? undefined : { opacity: 0, x: -12 }}
              transition={{ duration: 0.35 }}
              className={`overflow-hidden rounded-[1.35rem] bg-linear-to-br ${safetyBanner.tone} p-4 text-white shadow-lg`}
            >
              <div className="flex gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                  <SafetyBannerIcon icon={safetyBanner.icon} />
                </span>
                <div>
                  <p className="text-sm font-extrabold">{safetyBanner.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/90">{safetyBanner.subtitle}</p>
                </div>
              </div>
              <motion.div className="mt-3 flex justify-center gap-1.5">
                {SAFETY_BANNERS.map((b, i) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSafetyIdx(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === safetyIdx ? 'w-5 bg-white' : 'w-1.5 bg-white/40'
                    }`}
                    aria-label={`Show tip: ${b.title}`}
                  />
                ))}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </section>
        </FadeInSection>

        <p className="flex items-center justify-center gap-1.5 pb-2 text-center text-[10px] font-medium text-slate-400">
          <Sparkles className="h-3 w-3" aria-hidden />
          Demo jobs & earnings on this device — syncs when backend is live
        </p>
      </div>

      <AppUserLocationModal
        open={workAreaModalOpen}
        onClose={() => {
          setWorkAreaModalOpen(false)
          setPendingCheckIn(false)
        }}
        onSaved={handleWorkAreaSaved}
        title="Work area"
        subtitle="Required for check-in — enter manually or fetch GPS"
        saveLabel={pendingCheckIn ? 'Save & check in' : 'Save work area'}
        requireLocation
      />

      <LabourCheckOutConfirmModal
        open={checkOutModalOpen}
        onClose={() => setCheckOutModalOpen(false)}
        onConfirm={confirmCheckOut}
      />

      <LabourAssignmentDetailModal
        open={assignmentDetailOpen}
        onClose={() => setAssignmentDetailOpen(false)}
        job={todayJob}
        rawJob={todayAssignment.raw}
        assignmentKind={todayAssignment.kind}
      />
    </motion.div>
  )
}
