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
import { useDispatch } from 'react-redux'
import { connectSocket } from '../services/socket.js'
import {
  workforceApi,
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
  useSearchModulesQuery,
  useGetAdminDashboardStatsQuery
} from '../store/api/workforceApi.js'

const STORAGE_KEY = 'lc-admin-sidebar-collapsed'

export function AdminLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { user, token, logout } = useAuth()
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

  // Search query states
  const [searchQuery, setSearchQuery] = useState('')
  const { data: searchResults } = useSearchModulesQuery({ q: searchQuery }, { skip: !searchQuery })

  // Notifications API queries
  const { data: notifData } = useGetNotificationsQuery(undefined, { skip: !user })
  const [markRead] = useMarkNotificationReadMutation()
  const [markAllRead] = useMarkAllNotificationsReadMutation()
  const [deleteNotif] = useDeleteNotificationMutation()

  // Socket setup
  useEffect(() => {
    if (!user || !token) return

    const socket = connectSocket(user, token)

    const handleDashboardUpdate = () => {
      console.log('[Socket] Refreshing admin caches...')
      dispatch(
        workforceApi.util.invalidateTags([
          'AdminRequests',
          'Assignments',
          'Attendance',
          'Invoices',
          'AdminPricing',
          'SystemPricing',
          'BusinessVerification',
          'AdminDashboard',
          'Notifications',
          'AuditLogs',
          'Tickets',
        ])
      )
    }

    socket.on('dashboard:updated', handleDashboardUpdate)
    socket.on('notification:new', (newNotif) => {
      dispatch(workforceApi.util.invalidateTags(['Notifications']))
      if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
        new window.Notification(newNotif.title, { body: newNotif.body })
      }
    })
    socket.on('booking:updated', handleDashboardUpdate)
    socket.on('attendance:updated', handleDashboardUpdate)
    socket.on('wallet:updated', handleDashboardUpdate)

    return () => {
      socket.off('dashboard:updated', handleDashboardUpdate)
      socket.off('notification:new')
      socket.off('booking:updated', handleDashboardUpdate)
      socket.off('attendance:updated', handleDashboardUpdate)
      socket.off('wallet:updated', handleDashboardUpdate)
    }
  }, [user, token, dispatch])

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

  const { data: stats } = useGetAdminDashboardStatsQuery(undefined, {
    skip: !user || user.role !== 'admin',
    pollingInterval: 60000
  })

  const [lastSeen, setLastSeen] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('admin_nav_last_seen')) || {}
    } catch {
      return {}
    }
  })

  useEffect(() => {
    if (!stats) return
    
    let updated = { ...lastSeen }
    let changed = false

    const updateSeen = (key, val) => {
      if (updated[key] !== val) {
        updated[key] = val
        changed = true
      }
    }

    if (pathname === '/admin/business-verification' || pathname === '/admin/labour') {
      updateSeen('pendingKyc', stats.pendingKyc || 0)
    }
    if (pathname === '/admin/users') {
      updateSeen('newUsersToday', stats.newUsersToday || 0)
    }
    if (pathname === '/admin/bookings') {
      updateSeen('pendingRequests', stats.pendingRequests || 0)
    }
    if (pathname === '/admin/wallet') {
      updateSeen('pendingSettlementCount', stats.pendingSettlementCount || 0)
    }
    if (pathname === '/admin/reports') {
      updateSeen('supportTickets', stats.supportTickets || 0)
    }

    if ((stats.pendingKyc || 0) < (updated.pendingKyc || 0)) updateSeen('pendingKyc', stats.pendingKyc || 0)
    if ((stats.newUsersToday || 0) < (updated.newUsersToday || 0)) updateSeen('newUsersToday', stats.newUsersToday || 0)
    if ((stats.pendingRequests || 0) < (updated.pendingRequests || 0)) updateSeen('pendingRequests', stats.pendingRequests || 0)
    if ((stats.pendingSettlementCount || 0) < (updated.pendingSettlementCount || 0)) updateSeen('pendingSettlementCount', stats.pendingSettlementCount || 0)
    if ((stats.supportTickets || 0) < (updated.supportTickets || 0)) updateSeen('supportTickets', stats.supportTickets || 0)

    if (changed) {
      setLastSeen(updated)
      localStorage.setItem('admin_nav_last_seen', JSON.stringify(updated))
    }
  }, [pathname, stats, lastSeen])

  useEffect(() => {
    setMobileOpen(false)
    setProfileOpen(false)
    setNotifOpen(false)
  }, [pathname])

  // --- FCM Token Auto-sync & Foreground Listener ---
  useEffect(() => {
    if (!user) return

    const syncFcmToken = async () => {
      try {
        if (typeof window === 'undefined' || !('Notification' in window)) {
          console.warn('Notifications not supported in this environment.')
          return
        }
        let permission = window.Notification.permission
        if (permission === 'default') {
          permission = await window.Notification.requestPermission()
        }
        if (permission === 'granted') {
          const { requestForToken } = await import('../lib/firebase.js')
          const fcmToken = await requestForToken()
          if (fcmToken) {
            const { apiClient } = await import('../api/http.js')
            await apiClient.post('/users/me/fcm-token', { token: fcmToken, deviceType: 'web' })
              .catch(err => console.error('Failed to sync FCM token:', err))
          }
        }
      } catch (err) {
        console.error('Firebase not available in AdminLayout:', err)
      }
    }

    syncFcmToken()

    const handleFcmMessage = (event) => {
      const payload = event.detail
      if (payload?.notification && Notification.permission === 'granted') {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(payload.notification.title || 'Staffivaa Admin', {
              body: payload.notification.body || '',
              icon: '/favicon.svg',
              badge: '/favicon.svg',
              requireInteraction: false,
              tag: 'staffivaa-fcm-notification', // Collapse duplicates if multiple tabs are open
              data: payload.data || {},
            })
          })
        }
      }
    }

    window.addEventListener('fcm-foreground-message', handleFcmMessage)

    const handleServiceWorkerMessage = (event) => {
      if (event.data && event.data.type === 'NAVIGATE_TO_URL' && event.data.url) {
        navigate(event.data.url)
      }
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage)
    }

    return () => {
      window.removeEventListener('fcm-foreground-message', handleFcmMessage)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage)
      }
    }
  }, [user, navigate])
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
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#FFD100] to-[#FFB300] text-white shadow-[0_8px_20px_-6px_rgba(255,209,0,0.45)] ring-1 ring-white/50 p-1.5 overflow-hidden">
            <img src="/logo-transparent.png" alt="Staffivaa Logo" className="h-full w-full object-contain brightness-0 invert" aria-hidden />
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
              {section.items.map(({ to, label, icon: Icon, end }) => {
                let badgeCount = 0
                if (stats) {
                  if (to === '/admin/business-verification' || to === '/admin/labour') badgeCount = Math.max(0, (stats.pendingKyc || 0) - (lastSeen.pendingKyc || 0))
                  else if (to === '/admin/users') badgeCount = Math.max(0, (stats.newUsersToday || 0) - (lastSeen.newUsersToday || 0))
                  else if (to === '/admin/bookings') badgeCount = Math.max(0, (stats.pendingRequests || 0) - (lastSeen.pendingRequests || 0))
                  else if (to === '/admin/wallet') badgeCount = Math.max(0, (stats.pendingSettlementCount || 0) - (lastSeen.pendingSettlementCount || 0))
                  else if (to === '/admin/reports') badgeCount = Math.max(0, (stats.supportTickets || 0) - (lastSeen.supportTickets || 0))
                }
                
                if (pathname.startsWith(to)) {
                  badgeCount = 0
                }

                return (
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
                        <div className="relative">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 transition ${
                              isActive
                                ? 'bg-white text-brand ring-brand/25 shadow-[0_4px_14px_-8px_rgba(28,175,98,0.35)]'
                                : 'bg-white text-slate-500 ring-slate-200/85 group-hover:text-brand group-hover:ring-brand/20'
                            }`}
                          >
                            <Icon className="h-[18px] w-[18px]" aria-hidden />
                          </span>
                          {badgeCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-[0_0_0_2px_white] ring-1 ring-inset ring-rose-600/20">
                              {badgeCount}
                            </span>
                          )}
                        </div>
                        <span className={`min-w-0 flex-1 truncate ${collapsed ? 'md:sr-only' : ''}`}>{label}</span>
                        {!collapsed ? (
                          <ChevronRight
                            className={`h-4 w-4 shrink-0 transition ${isActive ? 'translate-x-0 text-brand opacity-100' : 'text-slate-300 opacity-0 group-hover:translate-x-0.5 group-hover:opacity-100'}`}
                            aria-hidden
                          />
                        ) : null}
                      </>
                    )}
                  </NavLink>
                </li>
              )})}
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-slate-200/80 rounded-xl leading-5 bg-slate-50/50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand/30 focus:border-brand/40 sm:text-sm transition-all"
                placeholder="Search bookings, users, or modules..."
              />
              {searchQuery && searchResults?.results && (
                <div className="absolute left-0 right-0 mt-2 max-h-80 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 scrollbar-thin">
                  {Object.entries(searchResults.results).every(([_, list]) => !list.length) ? (
                    <p className="text-xs text-slate-500 p-2 text-center">No results found for "{searchQuery}"</p>
                  ) : (
                    Object.entries(searchResults.results).map(([category, items]) => {
                      if (!items.length) return null;
                      return (
                        <div key={category} className="mb-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">{category}</p>
                          <ul className="space-y-0.5">
                            {items.map((item) => (
                              <li key={item.id}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSearchQuery('')
                                    navigate(item.url)
                                  }}
                                  className="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded-lg transition text-xs"
                                >
                                  <p className="font-semibold text-slate-800">{item.title}</p>
                                  <p className="text-[10px] text-slate-500">{item.subtitle}</p>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
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
                {notifData?.unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                    {notifData.unreadCount}
                  </span>
                )}
              </button>
              <AnimatePresence>
                {notifOpen ? (
                  <motion.div
                    initial={reduce ? false : { opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduce ? undefined : { opacity: 0, y: 4, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[22rem] origin-top-right"
                  >
                    <GlassPanel className="p-0 overflow-hidden shadow-xl ring-1 ring-slate-200/60 max-h-[30rem] flex flex-col">
                      <div className="flex items-center justify-between border-b border-slate-100 bg-linear-to-br from-slate-50/95 to-white px-4 py-3">
                        <p className="text-sm font-bold text-slate-900">Notifications ({notifData?.unreadCount || 0})</p>
                        {notifData?.unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={() => markAllRead()}
                            className="text-xs font-bold text-brand hover:underline"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 scrollbar-thin max-h-[22rem]">
                        {!notifData?.notifications || notifData.notifications.length === 0 ? (
                          <p className="text-xs text-slate-500 p-4 text-center">No new notifications.</p>
                        ) : (
                          notifData.notifications.map((n) => {
                            const getNotificationUrl = (item) => {
                              if (item.type.startsWith('KYC')) return '/admin/business-verification'
                              if (item.type.startsWith('BOOKING')) return '/admin/bookings'
                              if (item.type.startsWith('SETTLEMENT') || item.type.startsWith('REFUND')) return '/admin/wallet'
                              if (item.type === 'SUPPORT_TICKET_CREATED') return '/admin/reports'
                              if (item.type === 'PRICING_CHANGED') return '/admin/pricing'
                              return '/admin'
                            }

                            return (
                              <div
                                key={n._id}
                                className={`flex items-start gap-2 p-3 transition hover:bg-slate-50/80 ${!n.isRead ? 'bg-emerald-50/20' : ''}`}
                              >
                                <div
                                  className="flex-1 text-left cursor-pointer"
                                  onClick={async () => {
                                    if (!n.isRead) {
                                      await markRead(n._id)
                                    }
                                    setNotifOpen(false)
                                    navigate(getNotificationUrl(n))
                                  }}
                                >
                                  <p className={`text-xs font-semibold ${!n.isRead ? 'text-slate-900 font-bold' : 'text-slate-700'}`}>
                                    {n.title}
                                  </p>
                                  <p className="text-[11px] text-slate-500 mt-0.5">{n.body}</p>
                                  <p className="text-[9px] text-slate-400 mt-1">
                                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                                <div className="flex flex-col gap-1 items-end shrink-0">
                                  {!n.isRead && (
                                    <button
                                      type="button"
                                      onClick={() => markRead(n._id)}
                                      className="text-[10px] text-brand hover:underline font-bold"
                                      title="Mark as read"
                                    >
                                      Read
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => deleteNotif(n._id)}
                                    className="text-[10px] text-rose-600 hover:underline"
                                    title="Delete"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
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
