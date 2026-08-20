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
import { readAppUserLocation, parseAppUserLocation, autoFetchLiveLocation } from '../lib/appUserLocationStorage.js'
import { AppUserLocationModal } from '../components/app/AppUserLocationModal.jsx'
import { APP_HOME_LOCATION, APP_HOME_PATH, hasBookingFlowQuery } from '../lib/bookingFlowNavigation.js'
import { ErrorBoundary } from '../components/ErrorBoundary.jsx'
import { useGetLabourAssignmentsQuery, workforceApi } from '../store/api/workforceApi.js'
import { connectSocket } from '../services/socket.js'
import { fetchMe } from '../api/authApi.js'
import { setUser } from '../store/slices/authSlice.js'
import { loadJobDemoState, subscribeJobDemo } from '../lib/labourJobDemoStorage.js'
import { enterpriseApi } from '../store/api/enterpriseApi.js'
import { walletApi } from '../store/api/walletApi.js'
import { IncomingJobPopup } from '../components/labour/jobs/IncomingJobPopup.jsx'
import { ActiveBookingMiniWidget } from '../components/app/booking/ActiveBookingMiniWidget.jsx'
import { WorkerCancelledBookingModal } from '../components/app/booking/WorkerCancelledBookingModal.jsx'
import { useRespondAssignmentMutation } from '../store/api/workforceApi.js'
import {
  markLocalBookingCancelled,
  notifyWorkerCancelledBooking,
  cancelActiveLiveBookings,
  WORKER_CANCELLED_BOOKING_EVENT,
} from '../lib/individualBookings.js'

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
  const [incomingJob, setIncomingJob] = useState(null)
  const [isAcceptingPopup, setIsAcceptingPopup] = useState(false)
  const [workerCancelPopup, setWorkerCancelPopup] = useState({ open: false, message: '' })
  const workerCancelHandledRef = useRef('')
  const incomingJobRef = useRef(null)
  const dismissedAssignmentsRef = useRef(new Set())
  const globalAudioRef = useRef(null)
  const [respondAssignment] = useRespondAssignmentMutation()

  const stopGlobalRingSound = useCallback(() => {
    if (globalAudioRef.current) {
      try {
        globalAudioRef.current.pause();
        globalAudioRef.current.currentTime = 0;
      } catch (e) {}
      globalAudioRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!incomingJob) {
      stopGlobalRingSound();
    }
  }, [incomingJob, stopGlobalRingSound]);
  
  useEffect(() => {
    if (isLabour) return subscribeJobDemo(setLocalDemo)
  }, [isLabour])

  const dispatchAlert = useCallback((title, body, isError = false) => {
    const rawKey = (title || '') + '_' + (body || '');
    const dedupeKey = rawKey.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const now = Date.now();
    window._lastAlertLog = window._lastAlertLog || {};
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
      console.error('Push error:', err);
    }
  }, []);

  // --- Socket.IO Real-time Implementation ---
  useEffect(() => {
    if (!user || !token) return;

    const socket = connectSocket(user, token);

    const playNewJobRingSound = () => {
      // Ring sound removed as requested
      stopGlobalRingSound();
    };

    const invalidateCache = () => {
      console.log('[Socket] Invalidating Assignments, Requests, Notifications, and Enterprise Jobs cache');
      dispatch(workforceApi.util.invalidateTags(['Assignments', 'Requests', 'Notifications']));
      dispatch(enterpriseApi.util.invalidateTags(['EnterpriseJobs']));
    };

    socket.on('connect', () => {
      console.log('[Socket.io] Connected to server:', socket.id);
      invalidateCache();
    });

    socket.on('reconnect', () => {
      console.log('[Socket.io] Reconnected to server');
      invalidateCache();
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[AppShell] App became visible, refreshing assignments cache');
        invalidateCache();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleAssignmentAssigned = (data) => {
      console.log('[Socket] assignment_assigned event received:', data);
      
      // Handle the rich popup payload
      if (data.requestId && (data.type === 'new_order' || data.type === 'NEW_ORDER')) {
        setIncomingJob(data);
        incomingJobRef.current = data;
      }
      
      invalidateCache();
    };

    const handleAssignmentEnded = () => {
      stopGlobalRingSound();
      setIncomingJob(null);
      incomingJobRef.current = null;
      invalidateCache();
    };

    socket.on('bookingAcceptedGlobal', (data) => {
      if (incomingJobRef.current && incomingJobRef.current.requestId === data.requestId) {
        stopGlobalRingSound();
        setIncomingJob(null);
        incomingJobRef.current = null;
      }
      invalidateCache();
    });

    socket.on('assignment_created', invalidateCache);
    socket.on('assignment_assigned', handleAssignmentAssigned);
    socket.on('assignment_accepted', invalidateCache);
    socket.on('assignment_rejected', handleAssignmentEnded);
    socket.on('assignment_completed', invalidateCache);
    socket.on('assignment_cancelled', handleAssignmentEnded);

    socket.on('request_created', invalidateCache);
    socket.on('request_updated', invalidateCache);
    socket.on('request_cancelled', handleAssignmentEnded);

    const refreshAppUser = () => {
      fetchMe().then((res) => {
        if (res?.data?.user) dispatch(setUser(res.data.user));
      }).catch(() => {});
    };

    const handleNewNotif = (notification) => {
      // Ring sound is handled exclusively by assignment_assigned and incomingJob popup state.
      // Show in-app alert toast for all notifications
      dispatchAlert(notification.title || 'New Notification', notification.body || notification.message || '', false);

      // Always refresh notification list
      dispatch(workforceApi.util.invalidateTags(['Notifications']));

      // If it's a salary credit or withdrawal approval/rejection, also refresh wallet balance
      if (
        notification?.type === 'SALARY_RELEASED' ||
        notification?.type === 'WITHDRAWAL_APPROVED' ||
        notification?.type === 'WITHDRAWAL_ON_HOLD' ||
        notification?.type === 'WITHDRAWAL_REJECTED'
      ) {
        dispatch(walletApi.util.invalidateTags(['Wallet']));
      }

      // Refresh user object (balance, status etc)
      refreshAppUser();
    };

    const handleKycUpdate = (data) => {
      const statusStr = data?.status || 'updated';
      const title = data?.notification?.title || 'Account Status Update ⚠️';
      const body = data?.notification?.body || 'Your account status or verification has been updated by Admin.';
      dispatchAlert(title, body, statusStr !== 'approved' && statusStr !== 'active');
      refreshAppUser();
      invalidateCache();
    };

    socket.on('notification:new', handleNewNotif);
    socket.on('kyc:updated', handleKycUpdate);
    socket.on('dashboard:updated', invalidateCache);

    const handleWorkerFullCancel = (payload = {}) => {
      if (user?.role !== USER_ROLES.INDIVIDUAL) return
      const key = String(payload.requestId || payload.reference || '')
      if (key && workerCancelHandledRef.current === key) return
      if (key) workerCancelHandledRef.current = key

      const cleared = markLocalBookingCancelled({
        requestId: payload.requestId,
        ref: payload.reference,
        reason: payload.reason || 'labour_cancelled_unpaid',
      })
      if (!cleared) cancelActiveLiveBookings(payload.reason || 'labour_cancelled_unpaid')

      notifyWorkerCancelledBooking({
        message: payload.message || 'Worker cancelled the booking.',
        requestId: payload.requestId,
        ref: payload.reference,
      })
      invalidateCache()
    }

    const handleBookingCancelled = (payload = {}) => {
      if (user?.role !== USER_ROLES.INDIVIDUAL) return
      if (payload.reason === 'labour_cancelled_unpaid') {
        handleWorkerFullCancel(payload)
        return
      }
      // Expired / unpaid cancel / other — clear Finding labour chip, no worker popup
      markLocalBookingCancelled({
        requestId: payload.requestId,
        ref: payload.reference,
        reason: payload.cancelReason || payload.reason || 'cancelled',
      })
      cancelActiveLiveBookings(payload.cancelReason || payload.reason || 'cancelled')
      invalidateCache()
    }

    const handleLabourCancelled = (payload = {}) => {
      if (user?.role !== USER_ROLES.INDIVIDUAL) return
      if (payload.fullCancel === true || payload.reason === 'labour_cancelled_unpaid') {
        handleWorkerFullCancel(payload)
        return
      }
      // Paid re-search path — keep booking alive; tracking screen handles UX
      invalidateCache()
    }

    const handleBookingExpired = (payload = {}) => {
      if (user?.role !== USER_ROLES.INDIVIDUAL) return
      markLocalBookingCancelled({
        requestId: payload.requestId,
        ref: payload.reference,
        reason: 'search_expired',
      })
      cancelActiveLiveBookings('search_expired')
      invalidateCache()
    }

    socket.on('booking_cancelled', handleBookingCancelled)
    socket.on('bookingCancelledByLabour', handleLabourCancelled)
    socket.on('bookingExpired', handleBookingExpired)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopGlobalRingSound();
      socket.off('connect');
      socket.off('reconnect');
      socket.off('assignment_created', invalidateCache);
      socket.off('assignment_assigned', handleAssignmentAssigned);
      socket.off('assignment_accepted', invalidateCache);
      socket.off('assignment_rejected', handleAssignmentEnded);
      socket.off('assignment_completed', invalidateCache);
      socket.off('assignment_cancelled', handleAssignmentEnded);

      socket.off('request_created', invalidateCache);
      socket.off('request_updated', invalidateCache);
      socket.off('request_cancelled', handleAssignmentEnded);
      socket.off('notification:new', handleNewNotif);
      socket.off('kyc:updated', handleKycUpdate);
      socket.off('dashboard:updated', invalidateCache);
      socket.off('bookingAcceptedGlobal');
      socket.off('booking_cancelled', handleBookingCancelled);
      socket.off('bookingCancelledByLabour', handleLabourCancelled);
      socket.off('bookingExpired', handleBookingExpired);
    };
  }, [user, token, dispatch]);
  // ------------------------------------------

  // --- Auto-resync pending job offer card from API data (handles background kill / app restart) ---
  useEffect(() => {
    if (!isLabour || !apiData?.assignments) return

    const pendingOffer = apiData.assignments.find((a) => {
      if (a.status !== 'offered') return false
      if (dismissedAssignmentsRef.current.has(String(a._id))) return false

      const req = a.requestId
      if (!req || typeof req !== 'object') return false
      if (req.status === 'CANCELLED') return false

      if (req.expiresAt && new Date(req.expiresAt) <= new Date()) return false

      const validOfferStatuses = ['SEARCHING', 'ALLOCATING', 'ASSIGNED', 'CONFIRMED', 'PENDING_REVIEW']
      if (!validOfferStatuses.includes(req.status)) return false

      return true
    })

    if (pendingOffer) {
      const req = pendingOffer.requestId
      const expiresAt = req?.expiresAt ? new Date(req.expiresAt).getTime() : null
      const remainingSeconds = expiresAt ? Math.max(5, Math.floor((expiresAt - Date.now()) / 1000)) : 90

      const popupJob = {
        assignmentId: pendingOffer._id,
        type: 'new_order',
        requestId: req?._id || req,
        clientName: req?.clientId?.fullName || req?.clientId?.companyName || 'Customer',
        locationText: req?.locationText || req?.siteId?.address || '',
        categoryName: pendingOffer.categoryId?.name || req?.lines?.[0]?.categoryId?.name || 'Worker',
        perDayRate: pendingOffer.perDayRate || 800,
        startDate: req?.startDate,
        shiftStart: req?.shiftStart || '',
        shiftEnd: req?.shiftEnd || '',
        timeoutSeconds: remainingSeconds,
      }

      if (!incomingJobRef.current || incomingJobRef.current.assignmentId !== pendingOffer._id) {
        console.log('[AppShell] Resyncing active job offer card from API data:', popupJob)
        setIncomingJob(popupJob)
        incomingJobRef.current = popupJob
      }
    } else {
      if (incomingJobRef.current && incomingJobRef.current.assignmentId) {
        const stillInOffers = apiData.assignments.some(
          (a) => String(a._id) === String(incomingJobRef.current.assignmentId) && a.status === 'offered'
        )
        if (!stillInOffers) {
          console.log('[AppShell] Pending offer no longer valid or taken. Clearing popup.')
          setIncomingJob(null)
          incomingJobRef.current = null
        }
      }
    }
  }, [isLabour, apiData])

  useEffect(() => {
    if (user?.role !== USER_ROLES.INDIVIDUAL) return undefined
    const onWorkerCancelled = (event) => {
      const message = event?.detail?.message || 'Worker cancelled the booking.'
      setWorkerCancelPopup({ open: true, message })
    }
    window.addEventListener(WORKER_CANCELLED_BOOKING_EVENT, onWorkerCancelled)
    return () => window.removeEventListener(WORKER_CANCELLED_BOOKING_EVENT, onWorkerCancelled)
  }, [user?.role])

  // --- Incoming Job Popup Handlers ---
  const handlePopupAccept = useCallback(async () => {
    stopGlobalRingSound();
    if (!incomingJob?.assignmentId) return;
    setIsAcceptingPopup(true);
    try {
      const loc = readAppUserLocation();
      if (!loc?.lat || !loc?.lng) {
        dispatchAlert('Location Required', 'Please update your Work Area with a valid GPS location first.', true);
        setIsAcceptingPopup(false);
        return;
      }
      const res = await respondAssignment({
        id: incomingJob.assignmentId,
        action: 'accept',
        labourLat: loc?.lat,
        labourLng: loc?.lng
      }).unwrap();
      
      setIncomingJob(null);
      incomingJobRef.current = null;
      
      if (res.request && res.request.status === 'platform_fee_pending') {
        dispatchAlert('Booking Accepted!', 'Please pay the platform fee in your active jobs tab.');
      } else {
        dispatchAlert('Job accepted!', 'Head to Active tab to view details.');
      }
      // Navigate to the Jobs tab active section
      navigate('/app/jobs');
    } catch (e) {
      console.error('Popup accept error:', e);
      dispatchAlert('Failed to accept', e?.data?.message || e?.message || 'Please try from Offers tab.', true);
    } finally {
      setIsAcceptingPopup(false);
    }
  }, [incomingJob, respondAssignment, navigate, dispatchAlert, stopGlobalRingSound]);

  const handlePopupDecline = useCallback(async () => {
    stopGlobalRingSound();
    if (!incomingJob?.assignmentId) {
      setIncomingJob(null);
      incomingJobRef.current = null;
      return;
    }
    dismissedAssignmentsRef.current.add(String(incomingJob.assignmentId));
    try {
      await respondAssignment({ id: incomingJob.assignmentId, action: 'decline' }).unwrap();
    } catch (e) {
      console.error('Popup decline error:', e);
    }
    setIncomingJob(null);
    incomingJobRef.current = null;
  }, [incomingJob, respondAssignment, stopGlobalRingSound]);

  const handlePopupTimeout = useCallback(() => {
    stopGlobalRingSound();
    if (incomingJob?.assignmentId) {
      dismissedAssignmentsRef.current.add(String(incomingJob.assignmentId));
    }
    setIncomingJob(null);
    incomingJobRef.current = null;
    dispatchAlert('Missed Opportunity', 'Job request timed out.', true);
  }, [incomingJob, dispatchAlert, stopGlobalRingSound]);
  // ------------------------------------------

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
            localStorage.setItem('staffivaa_fcm_token', fcmToken);
            const { apiClient } = await import('../api/http.js');
            // Claim this device token for the currently logged-in account (worker or user)
            await apiClient.post('/users/me/fcm-token', { token: fcmToken, deviceType: 'web' })
              .catch(err => console.error('Failed to sync FCM token:', err));
          }
        }
      } catch (err) {
        console.error('Firebase not available in AppShell:', err);
      }
    };

    syncFcmToken();
    // Re-claim token when returning to the app (important if customer + worker share one device)
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncFcmToken();
    };
    window.addEventListener('focus', syncFcmToken);
    document.addEventListener('visibilitychange', onVisible);

    const handleFcmMessage = (event) => {
      const payload = event.detail;
      const targetUserId = payload?.data?.targetUserId
        ? String(payload.data.targetUserId)
        : '';
      const currentUserId = user?._id ? String(user._id) : '';
      // Only drop pushes clearly meant for another account (same device / shared SW)
      if (targetUserId && currentUserId && targetUserId !== currentUserId) {
        return;
      }

      const displayTitle =
        payload?.data?.title ||
        payload?.notification?.title ||
        'New Notification';
      const displayBody =
        payload?.data?.body ||
        payload?.data?.message ||
        payload?.notification?.body ||
        '';

      if (payload?.notification || payload?.data?.title) {
        // Ring only for real new-job offers (not every push that mentions a job)
        const pushType = String(payload?.data?.type || '').toUpperCase()
        if (pushType === 'NEW_ORDER' || payload?.data?.sound === 'new_job_order') {
          playNewJobRingSound();
        }

        if (Notification.permission === 'granted') {
          // Also show a toast so the user definitely sees it inside the app
          if (typeof window !== 'undefined') {
            dispatchAlert(displayTitle, displayBody, false);
          }

          // Refresh wallet cache if salary/withdrawal push notification
          const notifType = payload?.data?.type;
          if (
            notifType === 'SALARY_RELEASED' ||
            notifType === 'WITHDRAWAL_APPROVED' ||
            notifType === 'WITHDRAWAL_ON_HOLD' ||
            notifType === 'WITHDRAWAL_REJECTED'
          ) {
            dispatch(walletApi.util.invalidateTags(['Wallet']));
            refreshAppUser();
          }

          // Also always refresh notification bell count
          dispatch(workforceApi.util.invalidateTags(['Notifications']));
        
          // Use service worker showNotification so it appears as native OS popup
          // even when the app tab is currently focused (Chrome blocks new Notification() in foreground)
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((registration) => {
              registration.showNotification(displayTitle, {
                body: displayBody,
                icon: '/logo.png',
                badge: '/favicon.svg',
                requireInteraction: true,
                tag: 'staffivaa-notif-' + Date.now(),
                data: payload.data || {},
              });
            }).catch((err) => console.warn('Foreground showNotification error:', err));
          }
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
      window.removeEventListener('focus', syncFcmToken);
      document.removeEventListener('visibilitychange', onVisible);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, [user, token]);
  // ---------------------------

  const { data: notifData } = workforceApi.useGetNotificationsQuery(undefined, { skip: !user })
  const notifList = useMemo(() => {
    return notifData?.data?.notifications || notifData?.notifications || []
  }, [notifData])

  const { unreadEnterpriseNotifsCount, unreadRegularJobNotifsCount } = useMemo(() => {
    let enterpriseCount = 0
    let regularJobCount = 0

    notifList.forEach((n) => {
      if (n.isRead) return
      const isEnterprise =
        n.type === 'ENTERPRISE_JOB_ALERT' ||
        n.type?.startsWith('ENTERPRISE_') ||
        n.type?.startsWith('INTERVIEW_') ||
        n.type === 'WAITING_FOR_JOINING_PAYMENT' ||
        n.type === 'JOINING_CONFIRMED' ||
        n.type === 'NEW_JOB_APPLICATION' ||
        n.relatedModel?.startsWith('Enterprise')

      if (isEnterprise) {
        enterpriseCount++
      } else {
        const isRegularJobNotif =
          n.type === 'BOOKING_CREATED' ||
          n.type === 'BOOKING_UPDATED' ||
          n.type === 'BOOKING_CANCELLED' ||
          n.type === 'LABOUR_ASSIGNED' ||
          n.type === 'LABOUR_REPLACED' ||
          n.type === 'OFFER_SENT' ||
          n.type === 'NEW_ORDER' ||
          n.relatedModel === 'Assignment' ||
          n.relatedModel === 'Booking' ||
          n.relatedModel === 'LabourAssignment' ||
          n.relatedModel === 'JobOrder'

        if (isRegularJobNotif) {
          regularJobCount++
        }
      }
    })

    return {
      unreadEnterpriseNotifsCount: enterpriseCount,
      unreadRegularJobNotifsCount: regularJobCount,
    }
  }, [notifList])

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
      if (item.id === 'jobs') {
        return { ...item, badge: pendingJobsCount > 0 ? pendingJobsCount : undefined }
      }
      if (item.id === 'enterprise') {
        return { ...item, badge: unreadEnterpriseNotifsCount > 0 ? unreadEnterpriseNotifsCount : undefined }
      }
      return item
    })
  }, [bottomNav, isLabour, pendingJobsCount, unreadEnterpriseNotifsCount])

  const normalizedPath = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname
  const isIndividualAppHome = user?.role === USER_ROLES.INDIVIDUAL && normalizedPath === '/app'
  const isLabourAppHome = user?.role === USER_ROLES.LABOUR && normalizedPath === '/app'
  const isNotificationsPage = normalizedPath === '/app/notifications'
  const isLabourJobs = user?.role === USER_ROLES.LABOUR && normalizedPath === '/app/jobs'
  const isLabourEarnings = user?.role === USER_ROLES.LABOUR && normalizedPath === '/app/earnings'
  const isLabourAttendance = user?.role === USER_ROLES.LABOUR && normalizedPath === '/app/attendance'
  const isLabourKyc = user?.role === USER_ROLES.LABOUR && normalizedPath === '/app/kyc'
  const isLabourEnterpriseJobs = user?.role === USER_ROLES.LABOUR && normalizedPath === '/app/enterprise-jobs'
  const isLabourEnterpriseJobDetail = user?.role === USER_ROLES.LABOUR && normalizedPath.startsWith('/app/enterprise-jobs/')
  const isLabourMyApplications = user?.role === USER_ROLES.LABOUR && normalizedPath === '/app/my-applications'
  const hideBottomNav =
    normalizedPath.startsWith('/app/booking/flow') ||
    normalizedPath.startsWith('/app/navigation') ||
    isLabourEnterpriseJobDetail ||
    normalizedPath.includes('/interview')
  const hideShellHeader =
    normalizedPath.startsWith('/app/booking/flow') ||
    normalizedPath === '/app/bookings' ||
    normalizedPath === '/app/support' ||
    normalizedPath === '/app/profile' ||
    normalizedPath === '/app/wallet' ||
    normalizedPath.startsWith('/app/navigation') ||
    isLabourAppHome ||
    isLabourJobs ||
    isLabourEarnings ||
    isLabourAttendance ||
    isLabourKyc ||
    isLabourEnterpriseJobs ||
    isLabourEnterpriseJobDetail ||
    isLabourMyApplications ||
    isNotificationsPage ||
    hideBuildMartShellHeader(normalizedPath)
  const onBuildMart = isBuildMartRoute(normalizedPath)
  const title = getAppShellTitle(normalizedPath)
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

    // Automatically trigger live location fetch on app load
    autoFetchLiveLocation({ enableHighAccuracy: true }).catch(() => {})

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
    const parsed = parseAppUserLocation(appLocation)
    return {
      individualLocationTitle: parsed.area,
      individualLocationSubtitle: parsed.detail,
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
                              {Icon && <Icon className="h-[18px] w-[18px]" aria-hidden />}
                            </span>
                            <span className="min-w-0 flex-1 leading-snug">{label}</span>
                          </>
                        )}
                      </NavLink>
                    )
                  })}
                </nav>
                <div className="border-t border-slate-200/70 bg-linear-to-t from-slate-50/50 to-white px-3 pt-3 pb-10">
                  <button
                    type="button"
                    onClick={async () => {
                      await logout()
                      navigate('/auth', { replace: true })
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200/90 bg-rose-50 py-3 text-sm font-semibold text-rose-800 shadow-sm transition hover:bg-rose-50/90"
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
        {isIndividualAppHome || isLabourAppHome || isNotificationsPage ? (
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
              className={`flex items-center justify-between gap-3 px-4 pb-1.5 pt-2 transition-all duration-300 min-h-[56px] ${
                solidIndividualHeader
                  ? 'bg-[#FFD100]/95 shadow-md backdrop-blur-md'
                  : 'bg-[#FFD100] shadow-sm'
              }`}
            >
              {/* Location — takes remaining space */}
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

              {/* Right action icons — fixed, never shrink */}
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  to="/app/notifications"
                  className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
                  aria-label="Notifications"
                >
                  <Bell className="h-[18px] w-[18px]" />
                  <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-white" />
                </Link>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
                  aria-label="Open menu"
                >
                  <Menu className="h-[20px] w-[20px]" />
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
          className={`relative z-10 flex-1 px-4 ${
            hideBottomNav ? 'pb-8' : 'pb-24'
          } ${
            hideShellHeader
              ? isLabourAppHome || isNotificationsPage
                ? 'pt-0'
                : 'pt-[max(0.5rem,env(safe-area-inset-top,0px))]'
              : isIndividualAppHome
                ? 'pt-2'
                : 'pt-4'
          }`}
        >
          <ErrorBoundary>
            <AppPageTransition />
          </ErrorBoundary>
        </main>
      </div>

      {!hideBottomNav ? <AppBottomNav items={finalBottomNav} /> : null}

      {/* Swiggy-style live booking chip — individual only, hidden on booking flow */}
      {user?.role === USER_ROLES.INDIVIDUAL && !hideBottomNav ? <ActiveBookingMiniWidget /> : null}

      {isIndividualAppHome ? (
        <AppUserLocationModal
          open={locationModalOpen}
          onClose={() => setLocationModalOpen(false)}
          onSaved={() => setAppLocation(readAppUserLocation())}
        />
      ) : null}

      {/* Rapido-style Incoming Job Popup (Global for Workers) */}
      {incomingJob && isLabour && (
        <IncomingJobPopup
          job={incomingJob}
          onAccept={handlePopupAccept}
          onDecline={handlePopupDecline}
          onTimeout={handlePopupTimeout}
          isAccepting={isAcceptingPopup}
        />
      )}

      {user?.role === USER_ROLES.INDIVIDUAL ? (
        <WorkerCancelledBookingModal
          open={workerCancelPopup.open}
          message={workerCancelPopup.message}
          onClose={() => setWorkerCancelPopup({ open: false, message: '' })}
        />
      ) : null}
    </div>
  )
}
