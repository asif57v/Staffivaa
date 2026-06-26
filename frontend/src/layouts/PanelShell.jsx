import { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { LogOut, Menu, Sparkles, X, MapPin, ChevronDown, Bell } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { useDispatch } from 'react-redux'
import { workforceApi } from '../store/api/workforceApi.js'
import { AppAmbientBackground } from '../components/app/AppAmbientBackground.jsx'
import { AppPageTransition } from '../components/app/AppPageTransition.jsx'
import { appSpring } from '../components/app/appMotion.js'
import { GlassPanel } from '../components/ui/GlassPanel.jsx'
import { AppBottomNav } from '../components/app-ui/navigation/AppBottomNav.jsx'
import { AppBadge } from '../components/app-ui/data-display/AppBadge.jsx'
import { adminInitials } from '../lib/formatAdminLastLogin.js'
import { readAppUserLocation } from '../lib/appUserLocationStorage.js'
import { AppUserLocationModal } from '../components/app/AppUserLocationModal.jsx'
import { useVendorNotificationCount } from '../hooks/useVendorNotificationCount.js'
import { connectSocket } from '../services/socket.js'

export function PanelShell({
  panelId,
  brandLabel,
  headerTagline,
  bottomNav,
  drawerNav,
  getTitle,
  headerBadge = null,
  accentClass = '',
}) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { logout, user, token } = useAuth()
  const dispatch = useDispatch()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [appLocation, setAppLocation] = useState(() => readAppUserLocation())
  const reduce = useReducedMotion()

  useEffect(() => {
    if (!user || !token) return;

    const socket = connectSocket(user, token);

    const invalidateCache = () => {
      console.log('[Socket] Invalidating Corporate and Vendor cache');
      dispatch(workforceApi.util.invalidateTags([
        'VendorDashboard', 'VendorJobs', 'Requests', 
        'CorporateDashboard', 'Projects', 'Attendance', 'Invoices'
      ]));
    };

    socket.on('corporate_request_created', invalidateCache);
    socket.on('vendor_accepted_request', invalidateCache);
    socket.on('vendor_declined_request', invalidateCache);
    socket.on('vendor_accepted_request_global', invalidateCache);
    socket.on('vendor_accepted_job', invalidateCache);
    socket.on('vendor_assigned_workforce', invalidateCache);
    socket.on('work_progress_update', invalidateCache);
    socket.on('work_completed', invalidateCache);
    socket.on('payment_status_update', invalidateCache);
    socket.on('request_status_update', invalidateCache);

    return () => {
      socket.off('corporate_request_created', invalidateCache);
      socket.off('vendor_accepted_request', invalidateCache);
      socket.off('vendor_declined_request', invalidateCache);
      socket.off('vendor_accepted_request_global', invalidateCache);
      socket.off('vendor_accepted_job', invalidateCache);
      socket.off('vendor_assigned_workforce', invalidateCache);
      socket.off('work_progress_update', invalidateCache);
      socket.off('work_completed', invalidateCache);
      socket.off('payment_status_update', invalidateCache);
      socket.off('request_status_update', invalidateCache);
    };
  }, [user, token, dispatch]);

  const title = getTitle(pathname)
  const drawerInitials = adminInitials(user)
  const notifCounts = useVendorNotificationCount(panelId === 'vendor')
  const displayCount = panelId === 'vendor' ? notifCounts.total : 3

  const hideShellHeader =
    pathname.includes('/profile') ||
    pathname.includes('/support') ||
    pathname.endsWith('/new') ||
    /\/projects\/[^/]+$/.test(pathname) ||
    /\/requests\/[^/]+$/.test(pathname) ||
    /\/jobs\/[^/]+$/.test(pathname) ||
    /\/crew\/[^/]+$/.test(pathname) ||
    /\/attendance\/[^/]+\/worker\/[^/]+$/.test(pathname)

  useEffect(() => {
    queueMicrotask(() => setDrawerOpen(false))
    queueMicrotask(() => setLocationModalOpen(false))
  }, [pathname])

  useEffect(() => {
    const onMenu = () => setDrawerOpen(true)
    const onLoc = () => setLocationModalOpen(true)
    window.addEventListener('lc-open-app-drawer', onMenu)
    window.addEventListener('lc-open-location-modal', onLoc)
    return () => {
      window.removeEventListener('lc-open-app-drawer', onMenu)
      window.removeEventListener('lc-open-location-modal', onLoc)
    }
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

  const { individualLocationTitle } = useMemo(() => {
    const addr = appLocation?.address?.trim()
    const la = appLocation?.lat
    const ln = appLocation?.lng
    if (addr) {
      return { individualLocationTitle: addr }
    }
    if (la != null && ln != null) {
      return { individualLocationTitle: 'Current location' }
    }
    return { individualLocationTitle: 'Set your location' }
  }, [appLocation])

  return (
    <div className={`relative min-h-dvh w-full text-slate-900 ${accentClass}`} data-panel={panelId}>
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
                onClick={() => setDrawerOpen(false)}
              />
              <motion.aside
                key="drawer-panel"
                className="fixed inset-y-0 left-0 z-50 flex w-[min(88vw,19.5rem)] flex-col border-r border-slate-200/80 bg-white shadow-[8px_0_40px_-12px_rgba(15,23,42,0.14)]"
                initial={{ x: '-105%' }}
                animate={{ x: 0 }}
                exit={{ x: '-105%' }}
                transition={reduce ? { duration: 0.2 } : appSpring}
              >
                <div className="border-b border-slate-200/70 bg-linear-to-b from-slate-50/90 to-white px-4 pb-4 pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-brand-bright to-brand text-xs font-black text-white shadow-md ring-2 ring-white">
                        {drawerInitials}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand">{brandLabel}</p>
                        <p className="truncate text-sm font-extrabold text-slate-900">Menu</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDrawerOpen(false)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-600"
                      aria-label="Close menu"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  {headerBadge ? (
                    <div className="mt-3">
                      <AppBadge variant={headerBadge.variant}>{headerBadge.label}</AppBadge>
                    </div>
                  ) : null}
                </div>
                <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4" aria-label="Main">
                  {drawerNav.map(({ id, to, end, label, icon: Icon }) => (
                    <NavLink
                      key={`${id}-${to}`}
                      to={to}
                      end={Boolean(end)}
                      onClick={() => setDrawerOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${
                          isActive ? 'bg-brand/10 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                        }`
                      }
                    >
                      <Icon className="h-[18px] w-[18px]" aria-hidden />
                      {label}
                    </NavLink>
                  ))}
                </nav>
                <div className="border-t border-slate-200/70 p-3">
                  <Link
                    to="/"
                    className="flex w-full items-center justify-center rounded-xl border border-slate-200/90 bg-white py-3 text-sm font-semibold text-slate-700"
                  >
                    Visit website
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      logout()
                      navigate('/auth', { replace: true })
                    }}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200/90 bg-rose-50 py-3 text-sm font-semibold text-rose-800"
                  >
                    <LogOut className="h-4 w-4" />
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
        {!hideShellHeader ? (
          <header className="sticky top-0 z-30 bg-[#FFC107] px-4 pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-3 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setLocationModalOpen(true)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none transition active:opacity-70"
              >
                <MapPin className="h-5 w-5 shrink-0 text-slate-900" fill="currentColor" />
                <div className="flex flex-col min-w-0">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-800/80 mb-0.5">Location</span>
                  <div className="flex w-full items-center gap-1">
                    <span className="truncate text-[13px] font-extrabold tracking-tight text-slate-900">
                      {individualLocationTitle}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-900" />
                  </div>
                </div>
              </button>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-800 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.1)] transition hover:bg-slate-50 active:scale-95"
                  aria-label="Open menu"
                >
                  <Menu className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-800 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.1)] transition hover:bg-slate-50 active:scale-95"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {displayCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-[#FFC107]">
                      {displayCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </header>
        ) : null}

        <main
          className={`relative z-10 flex-1 px-4 pb-32 ${
            hideShellHeader ? 'pt-[max(0.5rem,env(safe-area-inset-top,0px))]' : 'pt-4'
          }`}
        >
          <AppPageTransition />
        </main>
      </div>

      <AppBottomNav items={bottomNav} />

      <AppUserLocationModal
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        onSaved={() => setAppLocation(readAppUserLocation())}
      />
    </div>
  )
}


