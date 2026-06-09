import { useEffect, useState, useMemo } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { LogOut, Menu, Sparkles, X, MapPin, ChevronDown, Bell } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { AppAmbientBackground } from '../components/app/AppAmbientBackground.jsx'
import { AppPageTransition } from '../components/app/AppPageTransition.jsx'
import { appSpring } from '../components/app/appMotion.js'
import { GlassPanel } from '../components/ui/GlassPanel.jsx'
import { AppBottomNav } from '../components/app-ui/navigation/AppBottomNav.jsx'
import { AppBadge } from '../components/app-ui/data-display/AppBadge.jsx'
import { adminInitials } from '../lib/formatAdminLastLogin.js'
import { readAppUserLocation } from '../lib/appUserLocationStorage.js'
import { AppUserLocationModal } from '../components/app/AppUserLocationModal.jsx'

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
  const { logout, user } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [appLocation, setAppLocation] = useState(() => readAppUserLocation())
  const reduce = useReducedMotion()

  const title = getTitle(pathname)
  const drawerInitials = adminInitials(user)

  const hideShellHeader =
    pathname.includes('/profile') ||
    pathname.includes('/support') ||
    pathname.endsWith('/new') ||
    /\/projects\/[^/]+$/.test(pathname) ||
    /\/requests\/[^/]+$/.test(pathname) ||
    /\/jobs\/[^/]+$/.test(pathname) ||
    /\/crew\/[^/]+$/.test(pathname)

  useEffect(() => {
    queueMicrotask(() => setDrawerOpen(false))
    queueMicrotask(() => setLocationModalOpen(false))
  }, [pathname])

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
      </AnimatePresence>

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-lg flex-col">
        {!hideShellHeader ? (
          <header className="sticky top-0 z-30 bg-[#FFD166] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top,0.5rem))] shadow-sm rounded-b-2xl">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setLocationModalOpen(true)}
                className="flex min-w-0 flex-1 flex-col items-start text-left outline-none transition active:opacity-70"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-800/80 mb-0.5">Location</span>
                <div className="flex w-full items-center gap-1.5">
                  <MapPin className="h-4 w-4 shrink-0 text-slate-900" fill="currentColor" />
                  <span className="truncate text-[14px] font-extrabold tracking-tight text-slate-900">
                    {individualLocationTitle}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-900" />
                </div>
              </button>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="flex h-[42px] w-[42px] items-center justify-center rounded-2xl bg-white text-slate-800 shadow-sm transition hover:bg-slate-50 active:scale-95"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="relative flex h-[42px] w-[42px] items-center justify-center rounded-2xl bg-white text-slate-800 shadow-sm transition hover:bg-slate-50 active:scale-95"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-[#FFD166]">
                    3
                  </span>
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


