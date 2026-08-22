import { useState, useMemo, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { Bell, LogOut, Search, ChevronDown, Menu, X, Plus, Home, Users, Briefcase, MoreHorizontal, CheckCircle2, LayoutDashboard, Wallet, CalendarCheck, FileText, Check, Trash2, ExternalLink } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { ENTERPRISE_STATUS } from '../constants/userRoles.js'
import { AnimatePresence, motion } from 'framer-motion'
import { connectSocket, getSocket } from '../services/socket.js'
import { enterpriseApi } from '../store/api/enterpriseApi.js'
import {
  workforceApi,
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
} from '../store/api/workforceApi.js'
import toast from 'react-hot-toast'
import { scrollToTop } from '../components/navigation/GlobalScrollManager.jsx'
import { useKeyboardOpen } from '../hooks/useKeyboardOpen.js'

const mobileNavItems = [
  { label: 'Home', icon: LayoutDashboard, path: '/enterprise' },
  { label: 'Workforce', icon: Users, path: '/enterprise/workforce' },
  { label: 'FAB', isFab: true, path: '/enterprise/jobs/new' },
  { label: 'Jobs', icon: Briefcase, path: '/enterprise/jobs' },
  { label: 'More', icon: MoreHorizontal, path: '#', isMenuTrigger: true },
]

const desktopNavGroups = [
  {
    group: 'Main Menu',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/enterprise' },
      { label: 'Workforce', icon: Users, path: '/enterprise/workforce' },
      { label: 'Jobs', icon: Briefcase, path: '/enterprise/jobs' },
      { label: 'Applications', icon: FileText, path: '/enterprise/applications' },
    ],
  },
  {
    group: 'Finance',
    items: [
      { label: 'Payroll', icon: CalendarCheck, path: '/enterprise/payroll' },
      { label: 'Wallet', icon: Wallet, path: '/enterprise/wallet' },
    ],
  },
]

export function EnterpriseShell() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { pathname } = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const keyboardOpen = useKeyboardOpen()

  const { data: notificationsData } = useGetNotificationsQuery()
  const [markRead] = useMarkNotificationReadMutation()
  const [markAllRead] = useMarkAllNotificationsReadMutation()
  const [deleteNotif] = useDeleteNotificationMutation()

  const rawNotifs = notificationsData?.notifications || notificationsData?.data?.notifications || notificationsData?.data || []
  const unreadCount = notificationsData?.unreadCount ?? notificationsData?.data?.unreadCount ?? rawNotifs.filter(n => !n.isRead).length

  // Close menus on route change
  useEffect(() => {
    setSidebarOpen(false)
    setMobileMenuOpen(false)
    setNotificationsOpen(false)
  }, [pathname])

  // Real-time socket & Notification listener
  useEffect(() => {
    if (!user || !token) return

    const socket = connectSocket(user, token)

    const handleAppCreated = (data) => {
      toast.success('💼 New worker candidate applied!', { id: 'new-app-toast', duration: 6000 })
      dispatch(enterpriseApi.util.invalidateTags(['EnterpriseJobs', 'EnterpriseApplications', 'EnterpriseWorkforce']))
    }

    const handleNewNotif = (notif) => {
      const title = notif?.title || notif?.notification?.title || 'New Notification 💼'
      const body = notif?.body || notif?.notification?.body || notif?.message || ''
      if (title) {
        toast.success(`${title}\n${body}`, {
          id: 'notif-toast-' + (notif?._id || Date.now()),
          icon: '🔔',
          duration: 6000,
        })
      }
      dispatch(enterpriseApi.util.invalidateTags(['EnterpriseJobs', 'EnterpriseApplications', 'EnterpriseWorkforce']))
      dispatch(workforceApi.util.invalidateTags(['Notifications']))
    }

    socket.on('enterprise_application_created', handleAppCreated)
    socket.on('notification:new', handleNewNotif)
    socket.on('dashboard:updated', handleAppCreated)

    return () => {
      socket.off('enterprise_application_created', handleAppCreated)
      socket.off('notification:new', handleNewNotif)
      socket.off('dashboard:updated', handleAppCreated)
    }
  }, [user, token, dispatch])

  // FCM Push Token Auto-sync & Foreground Listener
  useEffect(() => {
    if (!user || !token) return

    const syncFcmToken = async () => {
      try {
        const { syncPushToken } = await import('../lib/pushNotifications.js')
        await syncPushToken({ accessToken: token, role: user?.role })
      } catch (err) {
        console.error('Firebase FCM sync error in EnterpriseShell:', err)
      }
    }

    syncFcmToken()

    const handleFcmMessage = (event) => {
      const payload = event.detail
      const targetUserId = payload?.data?.targetUserId
      if (targetUserId && user?._id && String(targetUserId) !== String(user._id)) return

      const title = payload?.data?.title || payload?.notification?.title
      const body = payload?.data?.body || payload?.data?.message || payload?.notification?.body || ''
      if (title) {
        toast.success(`${title}\n${body}`, { id: 'fcm-ent-toast-' + Date.now(), duration: 6000 })
      }
    }

    window.addEventListener('fcm-foreground-message', handleFcmMessage)
    return () => {
      window.removeEventListener('fcm-foreground-message', handleFcmMessage)
    }
  }, [user?._id, token])

  const companyName = user?.enterpriseProfile?.companyName || user?.fullName || 'Luminary Corp'
  const companyInitials = companyName.substring(0, 2).toUpperCase()
  const userAvatar = user?.profilePic || `https://api.dicebear.com/7.x/notionists/svg?seed=${companyInitials}`

  const statusBadge = useMemo(() => {
    const s = user?.enterpriseProfile?.status
    if (s === ENTERPRISE_STATUS.APPROVED) return <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20" />
    return null
  }, [user])

  const handleLogout = async () => {
    await logout()
    navigate('/auth', { replace: true })
  }

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] overflow-hidden text-slate-900 font-sans relative">
      {/* -------------------- MOBILE OVERLAYS -------------------- */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl pb-safe lg:hidden"
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-lg">Menu</h3>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-6">
              {desktopNavGroups.map((group, i) => (
                <div key={i}>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">{group.group}</h4>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.path === '/enterprise'}
                        onClick={() => setMobileMenuOpen(false)}
                        className={({ isActive }) => `
                          flex items-center gap-3 px-4 py-3 rounded-2xl text-[15px] font-semibold transition-all duration-200
                          ${isActive ? 'bg-[#FFC107]/15 text-slate-900 font-bold' : 'text-slate-600 active:bg-slate-50'}
                        `}
                      >
                        <item.icon className={`w-5 h-5 ${pathname === item.path ? 'text-indigo-600' : 'text-slate-400'}`} />
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
              <div className="pt-4 border-t border-slate-100 px-2">
                <button onClick={handleLogout} className="flex items-center gap-3 w-full p-3 text-[15px] font-semibold text-rose-600 rounded-2xl active:bg-rose-50">
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* -------------------- DESKTOP SIDEBAR -------------------- */}
      <div className="hidden lg:flex lg:flex-col absolute inset-y-0 left-0 z-40 w-64 bg-white border-r border-[#E5E7EB] shrink-0">
        {/* Branding */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-[#E5E7EB]">
          <div className="w-8 h-8 rounded-lg bg-[#FFC107] flex items-center justify-center">
            <div className="grid grid-cols-2 gap-0.5 w-4 h-4">
              <div className="bg-slate-900 rounded-[2px]" />
              <div className="bg-slate-900 rounded-[2px]" />
              <div className="bg-slate-900 rounded-[2px]" />
              <div className="bg-slate-900 rounded-[2px]" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-[14px] font-extrabold tracking-tight text-slate-900 leading-none">
              Workforce OS
            </span>
            <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mt-0.5 truncate max-w-[140px]">
              {companyName}
            </span>
          </div>
        </div>

        {/* Sidebar Nav */}
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8">
          {desktopNavGroups.map((group, i) => (
            <div key={i}>
              <h3 className="px-3 text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                {group.group}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/enterprise'}
                      className={({ isActive }) => `
                        flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-[14px] font-semibold transition-all duration-200
                        ${
                          isActive
                            ? 'bg-slate-900 text-white shadow-md'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }
                      `}
                    >
                      <Icon className={`w-5 h-5 ${pathname === item.path ? 'text-[#FFC107]' : 'text-slate-400'}`} />
                      {item.label}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* -------------------- MAIN CONTENT AREA -------------------- */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 overflow-hidden bg-[#F8FAFC]">
        {/* Top Header (Mobile & Desktop) */}
        <header className="h-[60px] lg:h-16 bg-[#F8FAFC] lg:bg-white lg:border-b border-[#E5E7EB] flex items-center justify-between px-4 sm:px-8 z-30 shrink-0">
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="w-7 h-7 rounded-lg bg-[#FFC107] flex items-center justify-center">
              <div className="grid grid-cols-2 gap-0.5 w-3.5 h-3.5">
                <div className="bg-slate-900 rounded-[1px]" />
                <div className="bg-slate-900 rounded-[1px]" />
                <div className="bg-slate-900 rounded-[1px]" />
                <div className="bg-slate-900 rounded-[1px]" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-extrabold tracking-tight text-slate-900 leading-none">Workforce OS</span>
              <span className="text-[9px] font-bold tracking-widest uppercase text-slate-500 mt-0.5 truncate max-w-[120px]">{companyName}</span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-3 bg-slate-50 border border-[#E5E7EB] px-3 py-2 rounded-full w-96 focus-within:ring-2 focus-within:ring-[#FFC107]/50 focus-within:border-[#FFC107] transition-all">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search jobs, workers, or wallet..."
              className="bg-transparent border-none outline-none text-[13px] font-medium w-full text-slate-900 placeholder-slate-400"
            />
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Bell Icon & Real-Time Notification Popover */}
            <div className="relative">
              <button
                onClick={() => {
                  setNotificationsOpen(!notificationsOpen)
                  setProfileDropdownOpen(false)
                }}
                className="relative p-2 text-slate-500 hover:text-slate-800 transition rounded-full hover:bg-slate-100 focus:outline-none"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white shadow-xs ring-2 ring-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {notificationsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="fixed inset-x-3 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 py-3 z-50 overflow-hidden"
                    >
                      <div className="px-4 pb-2.5 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className="text-[14px] font-extrabold text-slate-900">Notifications</h4>
                          {unreadCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700">
                              {unreadCount} New
                            </span>
                          )}
                        </div>
                        {unreadCount > 0 && (
                          <button
                            onClick={async () => {
                              try {
                                await markAllRead().unwrap()
                                toast.success('All marked as read')
                              } catch {}
                            }}
                            className="text-[11px] font-extrabold text-indigo-600 hover:text-indigo-800"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                        {rawNotifs.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 font-medium text-[13px]">
                            No notifications yet.
                          </div>
                        ) : (
                          rawNotifs.slice(0, 10).map((n) => {
                            const isUnread = !n.isRead
                            const timeStr = n.createdAt ? new Date(n.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Just now'
                            return (
                              <div
                                key={n._id}
                                onClick={async () => {
                                  if (!n.isRead) markRead(n._id).catch(() => {})
                                  setNotificationsOpen(false)
                                   if (n.relatedModel === 'EnterpriseJoiningInvoice' || n.type === 'JOB_SHIFT_COMPLETED' || n.type === 'JOB_COMPLETED' || n.type?.includes('PAYMENT')) {
                                     navigate('/enterprise/wallet')
                                   } else if (n.relatedModel === 'EnterpriseApplication' || n.type === 'NEW_JOB_APPLICATION') {
                                     navigate('/enterprise/applications')
                                   } else if (n.relatedModel === 'EnterpriseJob') {
                                     navigate(`/enterprise/jobs/${n.relatedId}`)
                                   } else {
                                     navigate('/enterprise/wallet')
                                   }
                                }}
                                className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-start gap-3 ${
                                  isUnread ? 'bg-indigo-50/30' : ''
                                }`}
                              >
                                <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold ${
                                  n.type === 'NEW_JOB_APPLICATION' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  <Bell className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <p className={`text-[12.5px] font-extrabold truncate ${isUnread ? 'text-slate-900' : 'text-slate-700'}`}>
                                      {n.title}
                                    </p>
                                    <span className="text-[10px] font-medium text-slate-400 shrink-0">{timeStr}</span>
                                  </div>
                                  <p className="text-[11.5px] font-medium text-slate-500 leading-snug line-clamp-2 mt-0.5">
                                    {n.body || n.message}
                                  </p>
                                </div>
                                {isUnread && (
                                  <span className="h-2 w-2 rounded-full bg-indigo-600 shrink-0 mt-1.5" />
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>

                      <div className="px-4 pt-2.5 border-t border-slate-100 text-center bg-slate-50/50">
                        <button
                          onClick={() => {
                            setNotificationsOpen(false)
                            navigate('/enterprise/notifications')
                          }}
                          className="text-[12px] font-extrabold text-slate-700 hover:text-indigo-600 flex items-center justify-center gap-1 w-full py-1"
                        >
                          View All Notifications <ExternalLink className="h-3 w-3" />
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm transition hover:scale-105 active:scale-95 focus:ring-2 focus:ring-[#FFC107]"
              >
                <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />
              </button>

              <AnimatePresence>
                {profileDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileDropdownOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-56 bg-white rounded-[16px] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-100 py-2 z-50 overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-slate-50">
                        <p className="text-[14px] font-bold text-slate-900 truncate flex items-center gap-1">
                          {companyName} {statusBadge}
                        </p>
                        <p className="text-[12px] text-slate-500 font-medium truncate">{user?.phone}</p>
                      </div>
                      <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition">
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
          <div className="w-full h-full pb-36 lg:pb-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* -------------------- MOBILE BOTTOM NAV -------------------- */}
      {!keyboardOpen && (
        <div 
          className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-[#E5E7EB] z-40 flex items-center justify-around px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)', paddingTop: '8px' }}
        >
          {mobileNavItems.map((item) => {
          if (item.isFab) {
            return (
              <div key="fab" className="relative -top-3 flex flex-col items-center justify-center">
                <button
                  onClick={() => navigate(item.path)}
                  className="w-[50px] h-[50px] bg-[#111827] text-white rounded-[18px] flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                >
                  <Plus className="w-5 h-5 text-[#FFC107]" strokeWidth={3} />
                </button>
              </div>
            )
          }

          if (item.isMenuTrigger) {
            return (
              <button
                key="more"
                onClick={() => setMobileMenuOpen(true)}
                className="flex flex-col items-center justify-center w-16 gap-0.5 active:scale-95 transition-transform py-0.5"
              >
                <item.icon className="w-5 h-5 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-500">{item.label}</span>
              </button>
            )
          }

          const isActive = pathname === item.path || (item.path !== '/enterprise' && pathname.startsWith(item.path))

          return (
            <button
              key={item.label}
              onClick={() => {
                if (isActive) {
                  scrollToTop(true)
                } else {
                  navigate(item.path)
                }
              }}
              className="flex flex-col items-center justify-center w-16 gap-0.5 active:scale-95 transition-transform py-0.5"
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-[#FFC107]' : 'text-slate-400'}`} />
              <span className={`text-[10px] font-bold ${isActive ? 'text-[#111827]' : 'text-slate-500'}`}>{item.label}</span>
            </button>
          )
        })}
      </div>
      )}
    </div>
  )
}
