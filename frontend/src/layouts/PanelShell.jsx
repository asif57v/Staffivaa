import { useEffect, useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { LogOut, Menu, Sparkles, X, MapPin, ChevronDown, Bell, ShoppingCart, MoreVertical, Check } from 'lucide-react'
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
import { readAppUserLocation, parseAppUserLocation, autoFetchLiveLocation } from '../lib/appUserLocationStorage.js'
import { AppUserLocationModal } from '../components/app/AppUserLocationModal.jsx'
import { useVendorNotificationCount } from '../hooks/useVendorNotificationCount.js'
import { connectSocket } from '../services/socket.js'
import { fetchMe } from '../api/authApi.js'
import { setUser } from '../store/slices/authSlice.js'

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

  const injectNotificationIntoFeed = useCallback((notif) => {
    const newNotif = {
      _id: notif._id || 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      title: notif.title || 'Notification Update',
      body: notif.body || notif.message || 'You have a new real-time notification.',
      type: notif.type || 'ACCOUNT_STATUS_UPDATE',
      isRead: false,
      createdAt: notif.createdAt || new Date().toISOString()
    };
    dispatch(
      workforceApi.util.updateQueryData('getNotifications', undefined, (draft) => {
        if (draft && draft.notifications) {
          const exists = draft.notifications.some(
            n => n._id === newNotif._id || (n.title === newNotif.title && n.body === newNotif.body)
          );
          if (!exists) {
            draft.notifications.unshift(newNotif);
            draft.unreadCount = (draft.unreadCount || 0) + 1;
          }
        } else {
          return { notifications: [newNotif], unreadCount: 1 };
        }
      })
    );
  }, [dispatch]);

  const dispatchAlert = useCallback((title, body, isError = false) => {
    const rawKey = (title || '') + '_' + (body || '');
    const dedupeKey = rawKey.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const now = Date.now();
    window._lastAlertLog = window._lastAlertLog || {};
    // Prevent triggering the exact same alert if fired within the last 15 seconds
    if (window._lastAlertLog[dedupeKey] && (now - window._lastAlertLog[dedupeKey] < 15000)) {
      return;
    }
    window._lastAlertLog[dedupeKey] = now;

    const toastId = dedupeKey.slice(0, 45) || 'default-alert-toast';
    const toastMsg = body ? `${title}: ${body}` : title;

    import('react-hot-toast').then(({ default: toast }) => {
      if (isError) {
        toast.error(toastMsg, { id: toastId, duration: 6000 });
      } else {
        toast.success(toastMsg, { id: toastId, duration: 6000 });
      }
    });

    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(title || 'Staffivaa Update', { body: body || '', icon: '/vite.svg', badge: '/vite.svg', vibrate: [200, 100, 200], tag: toastId, requireInteraction: true });
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then((perm) => {
            if (perm === 'granted') {
              new Notification(title || 'Staffivaa Update', { body: body || '', icon: '/vite.svg', badge: '/vite.svg', vibrate: [200, 100, 200], tag: toastId, requireInteraction: true });
            }
          });
        }
      }
    } catch (err) {
      console.error('Failed to trigger system push:', err);
    }
  }, []);

  const [scrollData, setScrollData] = useState({ y: 0, direction: 'up' })

  useEffect(() => {
    let lastY = window.scrollY
    const handleScroll = () => {
      const currentY = window.scrollY
      let direction = 'up'
      if (currentY > lastY && currentY > 50) {
        direction = 'down'
      } else if (currentY < lastY) {
        direction = 'up'
      }
      setScrollData(prev => (prev.y === currentY && prev.direction === direction ? prev : { y: currentY, direction }))
      lastY = currentY
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!user || !token) return;

    const socket = connectSocket(user, token);

    const invalidateCache = () => {
      console.log('[Socket] Invalidating Corporate and Vendor cache');
      dispatch(workforceApi.util.invalidateTags([
        'VendorDashboard', 'VendorJobs', 'Requests', 
        'CorporateDashboard', 'Projects', 'Attendance', 'Invoices',
        'VendorWallet', 'Wallet', 'Notifications'
      ]));
    };

    const refreshUser = () => {
      fetchMe().then((res) => {
        if (res?.data?.user) dispatch(setUser(res.data.user));
      }).catch(() => {});
    };

    const handleNotification = (notification) => {
      injectNotificationIntoFeed(notification);
      dispatchAlert(notification?.title || 'New Notification Received', notification?.body || notification?.message || 'You have a new alert', false);
      refreshUser();
      invalidateCache();
    };

    const handleKycUpdate = (data) => {
      const statusStr = data?.status || 'updated';
      const notifObj = data?.notification || {
        title: statusStr === 'approved' ? 'Account Verified 🎉' :
               statusStr === 'on_hold' ? 'Account On Hold ⏸️' :
               statusStr === 'suspended' ? 'Account Suspended ⚠️' :
               statusStr === 'blocked' ? 'Account Blocked 🚫' : 'Account Status Updated ⚠️',
        body: statusStr === 'approved' ? 'Congratulations! Your account verification has just been APPROVED by admin!' :
              statusStr === 'on_hold' ? 'Your account has been temporarily placed on hold by admin.' :
              statusStr === 'suspended' ? 'Your account has been suspended by admin.' :
              statusStr === 'blocked' ? 'Your account has been blocked by admin.' : 'Your account status changed to: ' + statusStr,
        type: statusStr === 'approved' ? 'KYC_APPROVED' :
              statusStr === 'on_hold' ? 'ACCOUNT_ON_HOLD' :
              statusStr === 'suspended' ? 'ACCOUNT_SUSPENDED' :
              statusStr === 'blocked' ? 'ACCOUNT_BLOCKED' : 'ACCOUNT_STATUS_UPDATE',
        createdAt: new Date().toISOString()
      };
      injectNotificationIntoFeed(notifObj);
      const isErr = (statusStr !== 'approved' && statusStr !== 'active' && statusStr !== 'updated');
      dispatchAlert(notifObj.title, notifObj.body, isErr);
      refreshUser();
      invalidateCache();
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
    socket.on('notification:new', handleNotification);
    socket.on('kyc:updated', handleKycUpdate);
    socket.on('account:status_updated', handleKycUpdate);
    socket.on('dashboard:updated', invalidateCache);

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
      socket.off('notification:new', handleNotification);
      socket.off('kyc:updated', handleKycUpdate);
      socket.off('account:status_updated', handleKycUpdate);
      socket.off('dashboard:updated', invalidateCache);
    };
  }, [user, token, dispatch]);

  // Fetch fresh user profile on initial mount
  useEffect(() => {
    if (!token) return;

    fetchMe().then((res) => {
      if (res?.data?.user) dispatch(setUser(res.data.user));
    }).catch(() => {});
  }, [token, dispatch]);

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
        console.error('Firebase not available in PanelShell:', err);
      }
    };

    syncFcmToken();

    const handleFcmMessage = (event) => {
      const payload = event.detail;
      const targetUserId = payload?.data?.targetUserId;
      if (targetUserId && user?._id && targetUserId !== user._id) {
        // This push notification was meant for a different account
        return;
      }
      
      if (payload?.notification) {
        // Audio sound removed as requested
      }

      // Also show a toast so the user definitely sees it inside the app
      if (typeof window !== 'undefined' && payload?.notification) {
        dispatchAlert(payload.notification.title || 'New Notification', payload.notification.body || '', false);
      }

      // Use service worker showNotification so it appears as native OS popup
      if (payload?.notification && Notification.permission === 'granted') {
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
  }, [user, token, navigate]);

  const title = getTitle(pathname)
  const drawerInitials = adminInitials(user)
  const notifCounts = useVendorNotificationCount(panelId === 'vendor')
  const { data: realNotifsData } = workforceApi.useGetNotificationsQuery(undefined, { skip: !user })
  const [markRead] = workforceApi.useMarkNotificationReadMutation()
  const [deleteNotif] = workforceApi.useDeleteNotificationMutation()
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false)
  const realNotifs = realNotifsData?.notifications || realNotifsData?.data?.notifications || []
  const unreadRealCount = realNotifsData?.unreadCount ?? realNotifsData?.data?.unreadCount ?? realNotifs.filter(n => !n.isRead && !n.read).length
  const displayCount = (panelId === 'vendor' ? notifCounts.total : 0) + unreadRealCount

  const hideShellHeader =
    pathname.includes('/notifications') ||
    pathname.includes('/profile') ||
    pathname.includes('/support') ||
    pathname.includes('/wallet') ||
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

    // Automatically trigger live location fetch on app load
    autoFetchLiveLocation({ enableHighAccuracy: true }).catch(() => {})

    return () => window.removeEventListener('lc-app-user-location-changed', onLoc)
  }, [])

  const { individualLocationTitle, individualLocationSubtitle } = useMemo(() => {
    const parsed = parseAppUserLocation(appLocation)
    return {
      individualLocationTitle: parsed.area,
      individualLocationSubtitle: parsed.detail,
    }
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
                  {drawerNav.map((item, index) => {
                    if (item.type === 'divider') {
                      return <div key={`divider-${index}`} className="my-2 h-px bg-slate-200/70" aria-hidden />
                    }
                    const { id, to, end, label, icon: Icon } = item;
                    return (
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
                        {Icon && <Icon className="h-[18px] w-[18px]" aria-hidden />}
                        {label}
                      </NavLink>
                    )
                  })}
                </nav>
                <div className="border-t border-slate-200/70 px-3 pt-3 pb-10">
                  <button
                    type="button"
                    onClick={() => {
                      logout()
                      navigate('/auth', { replace: true })
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200/90 bg-rose-50 py-3 text-sm font-semibold text-rose-800"
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
          <header className={`sticky top-0 z-30 transition-all duration-300 ease-in-out ${
            scrollData.y > 10
              ? 'bg-[#FFD100]/95 backdrop-blur-md shadow-[0_4px_20px_-10px_rgba(0,0,0,0.3)]'
              : 'bg-[#FFD100] shadow-sm'
          } ${
            scrollData.direction === 'down' && scrollData.y > 50
              ? '-translate-y-full opacity-0 pointer-events-none'
              : 'translate-y-0 opacity-100 pointer-events-auto'
          }`}>
            <div className="flex items-center justify-between gap-3 px-4 pb-1.5 pt-3 min-h-[56px]">
              <button
                type="button"
                onClick={() => setLocationModalOpen(true)}
                className="flex items-center gap-2 min-w-0 flex-1 text-left outline-none transition active:opacity-70 group"
              >
                <div className="flex shrink-0 items-center justify-center">
                  <MapPin className="h-[24px] w-[24px] text-slate-900" strokeWidth={2} />
                </div>
                
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={individualLocationTitle + individualLocationSubtitle}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col items-start min-w-0 w-full"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 w-full">
                      <span className="truncate min-w-0 text-[17px] font-extrabold tracking-tight text-[#111827]">
                        {individualLocationTitle}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-600 transition-transform group-hover:translate-y-0.5" strokeWidth={2.5} />
                    </div>
                    <span className="truncate min-w-0 w-full text-[10px] font-semibold tracking-wider uppercase text-slate-600">
                      {individualLocationSubtitle}
                    </span>
                  </motion.div>
                </AnimatePresence>
              </button>

              <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
                    aria-label="Menu"
                  >
                    <Menu className="h-[18px] w-[18px]" />
                  </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setNotifDropdownOpen(prev => !prev)}
                    className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
                    aria-label="Notifications"
                  >
                    <Bell className="h-[18px] w-[18px]" />
                    {displayCount > 0 && (
                      <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-white" />
                    )}
                  </button>

                  <AnimatePresence>
                    {notifDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur-xl md:w-[420px]"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2 px-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">Real-time Notifications</span>
                            {unreadRealCount > 0 && (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                                {unreadRealCount} new
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setNotifDropdownOpen(false)}
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="my-2 max-h-80 overflow-y-auto pr-1 divide-y divide-slate-100">
                          {realNotifs.length === 0 ? (
                            <div className="py-8 text-center text-sm text-slate-400">
                              No notifications right now
                            </div>
                          ) : (
                            realNotifs.map((n) => {
                              const isUnread = !n.read && !n.isRead;
                              return (
                                <div
                                  key={n._id || Math.random()}
                                  className={`flex items-start justify-between gap-3 p-2.5 transition rounded-xl ${
                                    isUnread ? 'bg-amber-50/60 font-medium' : 'hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold text-slate-900 truncate">
                                        {n.title || 'Update'}
                                      </span>
                                      {isUnread && (
                                        <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                                      )}
                                    </div>
                                    <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                                      {n.body || n.message || ''}
                                    </p>
                                    <span className="mt-1.5 block text-[10px] font-medium text-slate-400">
                                      {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : 'Just now'}
                                    </span>
                                  </div>

                                  <div className="flex shrink-0 items-center gap-1 mt-1">
                                    {isUnread && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          markRead(n._id);
                                        }}
                                        title="Mark as read (Right)"
                                        className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 hover:text-emerald-700 active:scale-95 shadow-2xs"
                                      >
                                        <Check className="h-4 w-4 stroke-[2.5]" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteNotif(n._id);
                                      }}
                                      title="Remove notification (Cross)"
                                      className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-50 text-rose-600 transition hover:bg-rose-100 hover:text-rose-700 active:scale-95 shadow-2xs"
                                    >
                                      <X className="h-4 w-4 stroke-[2.5]" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        <div className="mt-1 border-t border-slate-100 pt-2 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setNotifDropdownOpen(false);
                              navigate(`/${panelId === 'app' ? 'app/labour' : panelId}/notifications`);
                            }}
                            className="w-full rounded-xl bg-slate-50 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                          >
                            View All Notifications
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

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


