import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown, LogOut, MapPin, Menu, Sparkles, X, ShoppingCart, Bell } from 'lucide-react'
import { useDispatch } from 'react-redux'
import { useAuth } from '../hooks/useAuth.js'
import {
  getAppNavigation,
  getAppShellTitle,
  hideBuildMartShellHeader,
  isBuildMartRoute,
} from '../config/appNavigation.js'
import { CORPORATE_STATUS, KYC_STATUS, ROLE_LABELS, USER_ROLES } from '../constants/userRoles.js'
import { AppAmbientBackground } from '../components/app/AppAmbientBackground.jsx'
import { AppPageTransition } from '../components/app/AppPageTransition.jsx'
import { appSpring } from '../components/app/appMotion.js'
import { GlassPanel } from '../components/ui/GlassPanel.jsx'
import { AppBottomNav } from '../components/app-ui/navigation/AppBottomNav.jsx'
import { AppBadge } from '../components/app-ui/data-display/AppBadge.jsx'
import { adminInitials } from '../lib/formatAdminLastLogin.js'
import { readAppUserLocation } from '../lib/appUserLocationStorage.js'
import { AppUserLocationModal } from '../components/app/AppUserLocationModal.jsx'
import { APP_HOME_LOCATION, APP_HOME_PATH, hasBookingFlowQuery } from '../lib/bookingFlowNavigation.js'
import { useGetLabourAssignmentsQuery, workforceApi } from '../store/api/workforceApi.js'
import { loadJobDemoState, subscribeJobDemo } from '../lib/labourJobDemoStorage.js'
import { connectSocket } from '../services/socket.js'

export function AppShell() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { logout, user, token } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [individualHeaderSolid, setIndividualHeaderSolid] = useState(false)
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [appLocation, setAppLocation] = useState(() => readAppUserLocation())
  const headerRef = useRef(null)
  const reduce = useReducedMotion()

  const { headerTagline, bottomNav, drawerNav } = useMemo(() => getAppNavigation(user?.role), [user?.role])

  const isLabour = user?.role === USER_ROLES.LABOUR
  const { data: apiData } = useGetLabourAssignmentsQuery(undefined, { skip: !isLabour })
  const [localDemo, setLocalDemo] = useState(() => loadJobDemoState())
  useEffect(() => {
    if (isLabour) return subscribeJobDemo(setLocalDemo)
  }, [isLabour])

  // --- Socket.IO Real-time Implementation ---
  useEffect(() => {
    if (!user || !token) return;

    const socket = connectSocket(user, token);

    const invalidateCache = () => {
      console.log('[Socket] Invalidating Assignments and Requests cache');
      dispatch(workforceApi.util.invalidateTags(['Assignments', 'Requests']));
    };

    socket.on('assignment_created', invalidateCache);
    socket.on('assignment_assigned', invalidateCache);
    socket.on('assignment_accepted', invalidateCache);
    socket.on('assignment_rejected', invalidateCache);
    socket.on('assignment_completed', invalidateCache);
    socket.on('assignment_cancelled', invalidateCache);

    socket.on('request_created', invalidateCache);
    socket.on('request_updated', invalidateCache);
    socket.on('request_cancelled', invalidateCache);

    return () => {
      socket.off('assignment_created', invalidateCache);
      socket.off('assignment_assigned', invalidateCache);
      socket.off('assignment_accepted', invalidateCache);
      socket.off('assignment_rejected', invalidateCache);
      socket.off('assignment_completed', invalidateCache);
      socket.off('assignment_cancelled', invalidateCache);

      socket.off('request_created', invalidateCache);
      socket.off('request_updated', invalidateCache);
      socket.off('request_cancelled', invalidateCache);
    };
  }, [user, token, dispatch]);
  // ------------------------------------------

  // --- FCM Token Auto-sync & Foreground Listener ---
  useEffect(() => {
    if (!user || !token) return;
    
    const syncFcmToken = async () => {
      try {
        if (typeof window === 'undefined' || !('Notification' in window)) {
          console.warn('Notifications not supported in this environment.');
          return;
        }
        let permission = window.Notification.permission;
        if (permission === 'default') {
          permission = await window.Notification.requestPermission();
        }
        if (permission === 'granted') {
          const { requestForToken } = await import('../lib/firebase.js');
          const fcmToken = await requestForToken();
          if (fcmToken) {
            const { apiClient } = await import('../api/http.js');
            await apiClient.post('/users/me/fcm-token', { token: fcmToken, deviceType: 'web' })
              .catch(err => console.error('Failed to sync FCM token:', err));
          }
        }
      } catch (err) {
        console.error('Firebase not available in AppShell:', err);
      }
    };

    syncFcmToken();

    const handleFcmMessage = (event) => {
      const payload = event.detail;
      if (payload?.notification && Notification.permission === 'granted') {
        // Use service worker showNotification so it appears as native OS popup
        // even when the app tab is currently focused (Chrome blocks new Notification() in foreground)
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(payload.notification.title || 'Staffivaa', {
              body: payload.notification.body || '',
              icon: '/favicon.svg',
              badge: '/favicon.svg',
              requireInteraction: false,
              tag: 'staffivaa-fcm-notification', // Collapse duplicates if multiple tabs are open
              data: payload.data || {},
            });
          });
        }
      }
    };

    window.addEventListener('fcm-foreground-message', handleFcmMessage);
    
    const handleServiceWorkerMessage = (event) => {
      if (event.data && event.data.type === 'NAVIGATE_TO_URL' && event.data.url) {
        navigate(event.data.url);
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    return () => {
      window.removeEventListener('fcm-foreground-message', handleFcmMessage);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, [user, token]);
  // ---------------------------

  const pendingJobsCount = useMemo(() => {
    let count = 0
    if (apiData?.assignments) {
      count += apiData.assignments.filter(a => a.status === 'offered').length
    }
    if (localDemo?.pending) {
      count += localDemo.pending.length
    }
    return count
  }, [apiData, localDemo])

  const finalBottomNav = useMemo(() => {
    if (!isLabour || !bottomNav) return bottomNav
    return bottomNav.map(item => {
      if (item.id === 'jobs') return { ...item, badge: pendingJobsCount > 0 ? pendingJobsCount : undefined }
      return item
    })
  }, [bottomNav, isLabour, pendingJobsCount])

  const isIndividualAppHome = user?.role === USER_ROLES.INDIVIDUAL && pathname === '/app'
  const isLabourAppHome = user?.role === USER_ROLES.LABOUR && pathname === '/app'
  const isLabourNotifications = user?.role === USER_ROLES.LABOUR && pathname === '/app/notifications'
  const isLabourJobs = user?.role === USER_ROLES.LABOUR && pathname === '/app/jobs'
  const isLabourEarnings = user?.role === USER_ROLES.LABOUR && pathname === '/app/earnings'
  const isLabourAttendance = user?.role === USER_ROLES.LABOUR && pathname === '/app/attendance'
  const isLabourKyc = user?.role === USER_ROLES.LABOUR && pathname === '/app/kyc'
  const hideShellHeader =
    pathname.startsWith('/app/booking/flow') ||
    pathname === '/app/bookings' ||
    pathname === '/app/support' ||
    pathname === '/app/profile' ||
    isLabourAppHome ||
    isLabourJobs ||
    isLabourEarnings ||
    isLabourAttendance ||
    isLabourKyc ||
    isLabourNotifications ||
    hideBuildMartShellHeader(pathname)
  const onBuildMart = isBuildMartRoute(pathname)
  const title = getAppShellTitle(pathname)
  const drawerInitials = adminInitials(user)
  const profileImageUrl = user?.profileImageUrl?.trim()

  useEffect(() => {
    queueMicrotask(() => setDrawerOpen(false))
  }, [pathname])

  useEffect(() => {
    if (pathname === APP_HOME_PATH && hasBookingFlowQuery(search)) {
      navigate(APP_HOME_LOCATION, { replace: true })
    }
  }, [navigate, pathname, search])

  useEffect(() => {
    queueMicrotask(() => setLocationModalOpen(false))
  }, [pathname])

  useEffect(() => {
    const onOpenDrawer = () => {
      queueMicrotask(() => setDrawerOpen(true))
    }
    window.addEventListener('lc-open-app-drawer', onOpenDrawer)
    return () => window.removeEventListener('lc-open-app-drawer', onOpenDrawer)
  }, [])

  useEffect(() => {
    if (!drawerOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [drawerOpen])

  useEffect(() => {
    const onLoc = () => {
      queueMicrotask(() => {
        setAppLocation(readAppUserLocation())
      })
    }
    window.addEventListener('lc-app-user-location-changed', onLoc)
    return () => window.removeEventListener('lc-app-user-location-changed', onLoc)
  }, [])

  useEffect(() => {
    if (!isIndividualAppHome) return
    queueMicrotask(() => {
      setAppLocation(readAppUserLocation())
    })
  }, [isIndividualAppHome, pathname])

  const updateIndividualHomeChrome = useCallback(() => {
    if (!isIndividualAppHome) return
    const header = headerRef.current
    if (header) {
      const h = Math.ceil(header.getBoundingClientRect().height)
      document.documentElement.style.setProperty('--individual-home-sticky-top', `${h}px`)
    }
    const sentinel = document.getElementById('individual-home-scroll-sentinel')
    const threshold = header ? header.getBoundingClientRect().bottom : 88
    if (!sentinel) {
      setIndividualHeaderSolid(false)
      return
    }
    setIndividualHeaderSolid(sentinel.getBoundingClientRect().top <= threshold + 2)
  }, [isIndividualAppHome])

  useLayoutEffect(() => {
    if (!isIndividualAppHome) {
      document.documentElement.style.removeProperty('--individual-home-sticky-top')
      return undefined
    }
    const id = requestAnimationFrame(() => {
      updateIndividualHomeChrome()
    })
    return () => {
      cancelAnimationFrame(id)
      document.documentElement.style.removeProperty('--individual-home-sticky-top')
    }
  }, [isIndividualAppHome, pathname, updateIndividualHomeChrome])

  useEffect(() => {
    if (!isIndividualAppHome) return undefined

    let raf = 0
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        updateIndividualHomeChrome()
      })
    }

    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)

    const onLayout = () => schedule()
    window.addEventListener('lc-individual-home-layout', onLayout)

    let ro
    const node = headerRef.current
    if (node && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(schedule)
      ro.observe(node)
    }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('lc-individual-home-layout', onLayout)
      ro?.disconnect()
    }
  }, [isIndividualAppHome, updateIndividualHomeChrome])

  const headerBadge = useMemo(() => {
    const role = user?.role
    if (role === USER_ROLES.CORPORATE && user?.corporateProfile?.status) {
      const s = user.corporateProfile.status
      if (s === CORPORATE_STATUS.PENDING) return { label: 'Corporate approval pending', variant: 'amber' }
      if (s === CORPORATE_STATUS.REJECTED) return { label: 'Corporate not approved', variant: 'rose' }
      if (s === CORPORATE_STATUS.APPROVED) return { label: 'Corporate approved', variant: 'emerald' }
    }
    if (role === USER_ROLES.LABOUR && user?.labourProfile?.kycStatus) {
      const k = user.labourProfile.kycStatus
      if (k === KYC_STATUS.PENDING) {
        return user.labourProfile.kycSubmittedAt
          ? { label: 'KYC with admin', variant: 'amber' }
          : { label: 'KYC not submitted', variant: 'amber' }
      }
      if (k === KYC_STATUS.FAILED) return { label: 'KYC needs attention', variant: 'rose' }
      if (k === KYC_STATUS.VERIFIED) return { label: 'KYC verified', variant: 'emerald' }
    }
    if (role === USER_ROLES.CONTRACTOR && user?.contractorProfile?.verificationStatus) {
      const v = user.contractorProfile.verificationStatus
      if (v === 'pending') return { label: 'Vendor verification pending', variant: 'amber' }
      if (v === 'rejected') return { label: 'Vendor not verified', variant: 'rose' }
      if (v === 'approved') return { label: 'Vendor verified', variant: 'emerald' }
    }
    return null
  }, [user])

  const solidIndividualHeader = isIndividualAppHome && individualHeaderSolid

  const { individualLocationTitle, individualLocationSubtitle } = useMemo(() => {
    if (!isIndividualAppHome) {
      return { individualLocationTitle: '', individualLocationSubtitle: '' }
    }
    const addr = appLocation?.address?.trim()
    const la = appLocation?.lat
    const ln = appLocation?.lng
    if (addr) {
      return {
        individualLocationTitle: addr,
        individualLocationSubtitle:
          la != null && ln != null ? `GPS ${la.toFixed(5)}, ${ln.toFixed(5)}` : 'Current work area',
      }
    }
    if (la != null && ln != null) {
      return {
        individualLocationTitle: 'Current location',
        individualLocationSubtitle: `${la.toFixed(5)}, ${ln.toFixed(5)}`,
      }
    }
    return {
      individualLocationTitle: 'Your location',
      individualLocationSubtitle: 'Tap to set address or use GPS',
    }
  }, [appLocation, isIndividualAppHome])

  return (
    <div className="relative min-h-dvh w-full text-slate-900">
      <AppAmbientBackground />

      {createPortal(
        <AnimatePresence>
          {drawerOpen ? (
            <>
              <motion.button
                key="drawer-overlay"
                type="button"
                className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-md"
                aria-label="Close menu"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                onClick={() => setDrawerOpen(false)}
              />
              <motion.aside
                key="drawer-panel"
                className="fixed inset-y-0 left-0 z-50 flex w-[min(88vw,19.5rem)] flex-col border-r border-slate-200/80 bg-white shadow-[8px_0_40px_-12px_rgba(15,23,42,0.14)]"
                initial={{ x: '-105%' }}
                animate={{ x: 0 }}
                exit={{ x: '-105%' }}
                transition={reduce ? { duration: 0.2 } : appSpring}
                aria-hidden={!drawerOpen}
              >
                <div className="relative border-b border-slate-200/70 bg-linear-to-b from-slate-50/90 to-white px-4 pb-4 pt-4">
                  <div className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-linear-to-r from-[#0f172a]/30 via-slate-200/50 to-transparent" aria-hidden />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-[#0f172a] to-[#3730A3] text-xs font-black text-white shadow-[0_8px_22px_-8px_rgba(79,70,229,0.4)] ring-2 ring-white">
                        {drawerInitials}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0f172a]">Staffivaa</p>
                        <p className="truncate text-sm font-extrabold text-slate-900">Menu</p>
                        <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
                          {ROLE_LABELS[user?.role] || 'Account'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDrawerOpen(false)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-600 shadow-sm transition hover:border-[#0f172a]/30 hover:text-slate-900"
                      aria-label="Close menu"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  {headerBadge ? (
                    <div className="relative mt-3">
                      <AppBadge variant={headerBadge.variant}>{headerBadge.label}</AppBadge>
                    </div>
                  ) : null}
                </div>
                <nav
                  className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4 scrollbar-thin [scrollbar-color:rgba(148,163,184,0.45)_transparent]"
                  aria-label="Main"
                >
                  {drawerNav.map(({ id, to, end, label, icon: Icon }) => (
                    <NavLink
                      key={`${id}-${to}`}
                      to={to}
                      end={Boolean(end)}
                      onClick={() => setDrawerOpen(false)}
                      className={({ isActive }) =>
                        `group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition duration-200 ${
                          isActive
                            ? 'bg-linear-to-r from-[#0f172a]/10 to-white text-slate-900 shadow-[inset_0_0_0_1px_rgba(79,70,229,0.15)] before:absolute before:left-0 before:top-1/2 before:z-10 before:h-9 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-[#0f172a] before:shadow-[2px_0_10px_-2px_rgba(79,70,229,0.4)]'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 transition ${
                              isActive
                                ? 'bg-[#0f172a] text-white ring-[#0f172a]/20'
                                : 'bg-white text-slate-500 ring-slate-200/80 group-hover:text-[#0f172a] group-hover:ring-[#0f172a]/15'
                            }`}
                          >
                            <Icon className="h-[18px] w-[18px]" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1 leading-snug">{label}</span>
                        </>
                      )}
                    </NavLink>
                  ))}
                </nav>
                <div className="border-t border-slate-200/70 bg-linear-to-t from-slate-50/50 to-white p-3">
                  <Link
                    to="/"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#0f172a]/25 hover:text-[#0f172a]"
                  >
                    Visit website
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      logout()
                      navigate('/auth', { replace: true })
                    }}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200/90 bg-rose-50 py-3 text-sm font-semibold text-rose-800 shadow-sm transition hover:bg-rose-50/90"
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    Sign out
                  </button>
                </div>
              </motion.aside>
            </>
          ) : null}
        </AnimatePresence>,
        document.body
      )}

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-lg flex-col">
        {isIndividualAppHome || isLabourAppHome || isLabourNotifications ? (
          <div
            className="pointer-events-none absolute left-1/2 top-0 z-0 h-[min(52vh,26rem)] w-full max-w-lg -translate-x-1/2 rounded-b-[2rem] bg-white"
            aria-hidden
          >
          </div>
        ) : null}

        {!hideShellHeader ? (
          <header ref={headerRef} className={`${isIndividualAppHome ? 'relative z-30' : 'sticky top-0 z-30 px-3 pt-3'}`}>
          {isIndividualAppHome ? (
            <div
              className={`flex items-center gap-2 px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))] transition-all duration-300 ${
                solidIndividualHeader
                  ? 'bg-yellow-300/95 shadow-md backdrop-blur-md'
                  : 'bg-yellow-300 shadow-sm'
              }`}
            >
              {/* Location — takes all remaining space */}
              <button
                type="button"
                onClick={() => setLocationModalOpen(true)}
                className="flex min-w-0 flex-1 flex-col items-start text-left outline-none transition active:opacity-70"
              >
                <span className="text-[9px] font-bold uppercase tracking-wide text-slate-800/70">Location</span>
                <div className="mt-0.5 flex min-w-0 w-full items-center gap-0.5">
                  <MapPin className="h-3 w-3 shrink-0 text-slate-900" fill="currentColor" />
                  <span className="truncate min-w-0 text-[12px] font-extrabold tracking-tight text-slate-900">
                    {individualLocationTitle}
                  </span>
                  <ChevronDown className="h-3 w-3 shrink-0 text-slate-900/70" />
                </div>
              </button>

              {/* Right action icons — fixed, never shrink */}
              <div className="flex shrink-0 items-center gap-1.5">
                <Link
                  to="/app/buildmart"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-slate-800 shadow-sm transition hover:bg-white active:scale-95"
                  aria-label="BuildMart Cart"
                >
                  <ShoppingCart className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-800 shadow-sm transition hover:bg-yellow-50 active:scale-95"
                  aria-label="Notifications & Menu"
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500 ring-1 ring-white" />
                </button>
              </div>
            </div>
          ) : (
            <GlassPanel className="flex items-center gap-3 px-3 py-2.5 border-[#e2e8f0]/20 bg-[#0f172a]/70 text-white shadow-sm">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#C7D2FE] shadow-sm transition hover:bg-white/15 border-0 active:scale-95"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-lg font-medium tracking-tight text-white">{title}</h1>
                <p className="truncate text-xs font-medium leading-snug text-[#A5B4FC]">{headerTagline}</p>
              </div>
              <motion.div
                className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-inner ring-1 sm:flex ${
                  onBuildMart
                    ? 'buildmart-gradient text-white ring-orange-300/30'
                    : 'bg-white/25 text-white ring-white/20'
                }`}
                aria-hidden
              >
                <Sparkles className="h-5 w-5" />
              </motion.div>
            </GlassPanel>
          )}
          </header>
        ) : null}

        <main
          className={`relative z-10 flex-1 px-4 pb-36 ${
            hideShellHeader
              ? isLabourAppHome
                ? 'pt-0'
                : 'pt-[max(0.5rem,env(safe-area-inset-top,0px))]'
              : isIndividualAppHome
                ? 'pt-2'
                : 'pt-4'
          }`}
        >
          <AppPageTransition />
        </main>
      </div>

      <AppBottomNav items={finalBottomNav} />

      {isIndividualAppHome ? (
        <AppUserLocationModal
          open={locationModalOpen}
          onClose={() => setLocationModalOpen(false)}
          onSaved={() => setAppLocation(readAppUserLocation())}
        />
      ) : null}
    </div>
  )
}
