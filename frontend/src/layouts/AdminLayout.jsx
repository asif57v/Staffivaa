import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  HardHat,
  LogOut,
  Mail,
  Menu,
  PanelLeftClose,
  PanelLeft,
  Search,
  User,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { ADMIN_NAV_SECTIONS, getAdminTitle } from '../config/adminNavigation.js'
import { appSpring } from '../components/app/appMotion.js'
import { GlassPanel } from '../components/ui/GlassPanel.jsx'
import { adminInitials, formatLastLoginDisplay, formatLastLoginRelative } from '../lib/formatAdminLastLogin.js'
import { fetchAdminUsers } from '../api/adminUsersApi.js'

const STORAGE_KEY = 'lc-admin-sidebar-collapsed'

export function AdminLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const reduce = useReducedMotion()

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  const profileRef = useRef(null)
  const notifRef = useRef(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  useEffect(() => {
    document.body.classList.add('admin-mode')
    return () => document.body.classList.remove('admin-mode')
  }, [])

  const [navBadges, setNavBadges] = useState({ pendingKyc: 0, newUsers: 0 })

  useEffect(() => {
    let cancelled = false
    async function loadStats() {
      try {
        const kycRes = await fetchAdminUsers({ role: 'labour', kycStatus: 'pending', limit: 1 })
        const usersRes = await fetchAdminUsers({ limit: 1 })
        if (!cancelled) {
          let newUsers = 0
          if (usersRes?.items?.[0]?.createdAt) {
            const today = new Date().toISOString().split('T')[0]
            if (usersRes.items[0].createdAt.startsWith(today)) {
              newUsers = 1
            }
          }
          setNavBadges({
            pendingKyc: kycRes?.labourKycCounts?.pending || 0,
            newUsers: newUsers > 0 ? 1 : 0
          })
        }
      } catch (err) {}
    }
    loadStats()
  }, [])

  useEffect(() => {
    setMobileOpen(false)
    setProfileOpen(false)
    setNotifOpen(false)
  }, [pathname])
  useEffect(() => {
    function handlePointerDown(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    function handleKey(e) {
      if (e.key === 'Escape') {
        setProfileOpen(false)
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [])

  const title = getAdminTitle(pathname)

  function handleLogout() {
    setProfileOpen(false)
    logout()
    navigate('/admin/login', { replace: true })
  }

  const displayName = user?.fullName?.trim() || user?.email?.split('@')[0] || 'Administrator'
  const displayEmail = user?.email || '—'
  const lastLoginRaw = user?.lastLoginAt
  const lastLoginShort = formatLastLoginRelative(lastLoginRaw)
  const lastLoginFull = formatLastLoginDisplay(lastLoginRaw)
  const initials = adminInitials(user)

  const sidebarInner = (
    <>
      <div
        className={`relative flex h-17 shrink-0 items-center border-b border-slate-200/70 bg-linear-to-b from-slate-50/90 to-white px-3 ${collapsed ? 'md:justify-center' : 'justify-between gap-2'}`}
      >
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-brand/25 via-slate-200/60 to-transparent" aria-hidden />
        <Link
          to="/admin"
          className={`relative z-10 flex min-w-0 items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition hover:bg-slate-100/50 ${collapsed ? 'md:justify-center' : ''}`}
          title="Dashboard"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#FFD100] to-[#FFB300] text-white shadow-[0_8px_20px_-6px_rgba(255,209,0,0.45)] ring-1 ring-white/50">
            <HardHat className="h-[22px] w-[22px]" strokeWidth={2.5} aria-hidden />
          </span>
          <span className={`min-w-0 truncate pt-0.5 ${collapsed ? 'md:sr-only' : ''}`}>
            <span className="block text-[22px] leading-none font-black tracking-tight text-[#FFD100]" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>Staffivaa</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="relative z-10 hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-500 shadow-sm transition hover:border-brand/35 hover:text-brand md:flex"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-4 scrollbar-thin [scrollbar-color:rgba(148,163,184,0.5)_transparent]"
        aria-label="Admin navigation"
      >
        {ADMIN_NAV_SECTIONS.map((section, si) => (
          <div
            key={section.title ?? 'main'}
            className={`${si > 0 ? 'mt-5 border-t border-slate-100 pt-5' : ''} mb-1 last:mb-0`}
          >
            {section.title ? (
              <div className={`mb-2.5 flex items-center gap-2 px-3 ${collapsed ? 'md:hidden' : ''}`}>
                <span className="h-px w-4 shrink-0 rounded-full bg-brand/40" aria-hidden />
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{section.title}</p>
              </div>
            ) : null}
            <ul className="space-y-1">
              {section.items.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={Boolean(end)}
                    title={label}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 rounded-xl py-2.5 text-sm font-semibold transition duration-200 md:px-2 ${
                        collapsed ? 'md:justify-center md:px-0' : 'px-3'
                      } ${
                        isActive
                          ? 'bg-linear-to-r from-brand/12 to-emerald-50/50 text-slate-900 shadow-[inset_0_0_0_1px_rgba(28,175,98,0.12)]'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      } ${!collapsed && isActive ? 'before:absolute before:left-0 before:top-1/2 before:h-8 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-brand before:shadow-[2px_0_12px_-2px_rgba(28,175,98,0.5)]' : ''} ${
                        collapsed && isActive ? 'md:ring-2 md:ring-brand/25 md:ring-offset-2 md:ring-offset-white' : ''
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 transition ${
                            isActive
                              ? 'bg-white text-brand ring-brand/25 shadow-[0_4px_14px_-8px_rgba(28,175,98,0.35)]'
                              : 'bg-white text-slate-500 ring-slate-200/85 group-hover:text-brand group-hover:ring-brand/20'
                          }`}
                        >
                          <Icon className="h-[18px] w-[18px]" aria-hidden />
                        </span>
                        <span className={`min-w-0 flex-1 truncate ${collapsed ? 'md:sr-only' : ''}`}>{label}</span>
                        {!collapsed ? (
                          to === '/admin/labour' && navBadges.pendingKyc > 0 ? (
                             <span className="ml-auto inline-flex items-center justify-center rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm ring-1 ring-inset ring-rose-600/20">
                               {navBadges.pendingKyc}
                             </span>
                           ) : to === '/admin/users' && navBadges.newUsers > 0 ? (
                             <span className="ml-auto inline-flex items-center justify-center rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm ring-1 ring-inset ring-blue-600/20">
                               New
                             </span>
                           ) : (
                            <ChevronRight
                              className={`h-4 w-4 shrink-0 transition ${isActive ? 'translate-x-0 text-brand opacity-100' : 'text-slate-300 opacity-0 group-hover:translate-x-0.5 group-hover:opacity-100'}`}
                              aria-hidden
                            />
                           )
                        ) : null}
                        {collapsed && to === '/admin/labour' && navBadges.pendingKyc > 0 && (
                          <span className="absolute right-1 top-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-rose-500 shadow-sm ring-2 ring-white md:right-1.5 md:top-1.5" />
                        )}
                        {collapsed && to === '/admin/users' && navBadges.newUsers > 0 && (
                          <span className="absolute right-1 top-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-blue-500 shadow-sm ring-2 ring-white md:right-1.5 md:top-1.5" />
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div
        className={`relative shrink-0 border-t border-slate-200/80 bg-linear-to-t from-slate-50/40 to-white p-2 ${collapsed ? 'md:px-1.5' : ''}`}
      >
        <a
          href="/"
          className={`flex items-center gap-3 rounded-xl py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900 hover:shadow-sm ${collapsed ? 'md:justify-center' : 'px-3'}`}
          title="Public site"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm ring-1 ring-slate-200/90 transition group-hover:text-brand">
            <ExternalLink className="h-4 w-4" aria-hidden />
          </span>
          <span className={`${collapsed ? 'md:sr-only' : ''}`}>Public site</span>
        </a>
      </div>
    </>
  )

  const sidebarClassName = `
    flex h-dvh max-h-dvh shrink-0 flex-col overflow-hidden border-r border-slate-200/80 bg-white shadow-[6px_0_32px_-12px_rgba(15,23,42,0.1)] transition-[transform,width] duration-300 ease-out
    w-[min(18rem,88vw)] max-md:max-w-[18rem]
    ${collapsed ? 'md:w-19' : 'md:w-64'}
    fixed inset-y-0 left-0 z-50 md:relative md:z-20
    ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
  `

  return (
    <div className="flex h-screen w-full bg-slate-50/50 text-slate-900">
      <aside
        className={`relative z-[60] flex flex-col border-r border-slate-200/80 bg-white transition-all duration-300 ${collapsed ? 'w-20' : 'w-72'}`}
      >
        {sidebarInner}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="relative z-30 flex h-17 shrink-0 items-center gap-4 border-b border-slate-200/70 bg-white/80 px-6 shadow-[0_8px_30px_-18px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/70 bg-white text-slate-600 shadow-sm transition hover:border-brand/30 hover:shadow-md"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeft className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-6">
            <nav aria-label="Breadcrumb" className="flex items-center text-sm text-slate-500 font-medium">
              <Link to="/admin" className="hover:text-slate-900 transition">Admin</Link>
              {pathname !== '/admin' && (
                <>
                  <ChevronRight className="h-4 w-4 mx-1 text-slate-400" />
                  <span className="text-slate-900 font-semibold">{title}</span>
                </>
              )}
            </nav>

            <div className="relative flex-1 max-w-md ml-auto mr-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-slate-200/80 rounded-xl leading-5 bg-slate-50/50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand/30 focus:border-brand/40 sm:text-sm transition-all"
                placeholder="Search bookings, users, or modules (Press '/')"
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((o) => !o)
                  setProfileOpen(false)
                }}
                className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/70 bg-white text-slate-600 shadow-sm transition hover:border-brand/25 hover:text-brand hover:shadow-md"
                aria-expanded={notifOpen}
                aria-haspopup="true"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" aria-hidden />
              </button>
              <AnimatePresence>
                {notifOpen ? (
                  <motion.div
                    initial={reduce ? false : { opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduce ? undefined : { opacity: 0, y: 4, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(calc(100vw-2rem),20rem)] origin-top-right"
                  >
                    <GlassPanel className="p-4 shadow-xl ring-1 ring-slate-200/60">
                      <p className="text-sm font-bold text-slate-900">Notifications</p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">
                        No new alerts. Booking approvals, KYC queues, and payment events will appear here.
                      </p>
                    </GlassPanel>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen((o) => !o)
                  setNotifOpen(false)
                }}
                className="flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-white py-1 pl-1 pr-2 shadow-sm transition hover:border-brand/25 hover:shadow-md md:pr-3"
                aria-expanded={profileOpen}
                aria-haspopup="true"
                aria-label="Account menu"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-brand-bright to-brand text-xs font-black text-white shadow-inner ring-2 ring-white">
                  {initials}
                </span>
                <div className="min-w-0 text-left">
                  <p className="truncate text-sm font-bold text-slate-900">{displayName}</p>
                  <p className="truncate text-[11px] font-medium text-slate-500">{displayEmail}</p>
                </div>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-400 transition ${profileOpen ? '-rotate-180' : ''}`}
                  aria-hidden
                />
              </button>

              <AnimatePresence>
                {profileOpen ? (
                  <motion.div
                    initial={reduce ? false : { opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduce ? undefined : { opacity: 0, y: 4, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(calc(100vw-2rem),19rem)] origin-top-right"
                  >
                    <GlassPanel className="overflow-hidden p-0 shadow-xl ring-1 ring-slate-200/60">
                      <div className="border-b border-slate-100 bg-linear-to-br from-slate-50/95 to-white px-4 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-brand-bright to-brand text-sm font-black text-white shadow-lg ring-4 ring-white/80">
                            {initials}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold text-slate-900">{displayName}</p>
                            <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-medium text-slate-600">
                              <Mail className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                              {displayEmail}
                            </p>
                          </div>
                        </div>
                        {lastLoginFull ? (
                          <p className="mt-3 flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-100">
                            <Clock className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                            Last login: {lastLoginFull}
                          </p>
                        ) : (
                          <p className="mt-3 text-[11px] font-medium text-slate-500">Last login not available yet.</p>
                        )}
                      </div>
                      <div className="p-2">
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          onClick={() => setProfileOpen(false)}
                        >
                          <User className="h-4 w-4 text-slate-400" aria-hidden />
                          Profile settings
                          <span className="ml-auto text-[10px] font-bold uppercase text-slate-400">Soon</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-rose-700 transition hover:bg-rose-50"
                        >
                          <LogOut className="h-4 w-4" aria-hidden />
                          Log out
                        </button>
                      </div>
                    </GlassPanel>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8">
          <motion.div
            key={pathname}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? { duration: 0 } : appSpring}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}
