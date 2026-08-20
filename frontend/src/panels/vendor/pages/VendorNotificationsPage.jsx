import { useCallback, useMemo, useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft,
  Bell,
  BellRing,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
  HardHat,
  IdCard,
  MapPin,
  Sparkles,
  Timer,
  Wallet,
  X,
} from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth.js'
import { AppBadge } from '../../../components/app-ui/data-display/AppBadge.jsx'
import { AppEmptyState } from '../../../components/app/AppEmptyState.jsx'
import { GlassPanel } from '../../../components/ui/GlassPanel.jsx'
import { AppPillTabs } from '../../../components/app-ui/navigation/AppPillTabs.jsx'
import {
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
  useSendSelfTestNotificationMutation,
} from '../../../store/api/workforceApi.js'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'jobs', label: 'Job requests' },
  { id: 'updates', label: 'Updates' },
]

const TYPE_MAPPING = {
  'NEW_USER': { icon: Bell, kind: 'system', priority: 'normal', category: 'updates' },
  'NEW_LABOUR': { icon: Bell, kind: 'system', priority: 'normal', category: 'updates' },
  'NEW_VENDOR': { icon: Bell, kind: 'system', priority: 'normal', category: 'updates' },
  'NEW_CORPORATE': { icon: Bell, kind: 'system', priority: 'normal', category: 'updates' },
  'KYC_SUBMITTED': { icon: IdCard, kind: 'kyc', priority: 'normal', category: 'updates' },
  'KYC_APPROVED': { icon: IdCard, kind: 'kyc', priority: 'high', category: 'updates' },
  'KYC_REJECTED': { icon: IdCard, kind: 'kyc', priority: 'high', category: 'updates' },
  'BOOKING_CREATED': { icon: Flame, kind: 'job_request', priority: 'high', category: 'jobs' },
  'BOOKING_UPDATED': { icon: Flame, kind: 'job_request', priority: 'normal', category: 'jobs' },
  'BOOKING_CANCELLED': { icon: Flame, kind: 'job_request', priority: 'high', category: 'jobs' },
  'LABOUR_ASSIGNED': { icon: HardHat, kind: 'assignment', priority: 'high', category: 'jobs' },
  'LABOUR_CHECK_IN': { icon: Timer, kind: 'attendance', priority: 'normal', category: 'updates' },
  'LABOUR_CHECK_OUT': { icon: Timer, kind: 'attendance', priority: 'normal', category: 'updates' },
  'LABOUR_REPLACED': { icon: HardHat, kind: 'assignment', priority: 'high', category: 'jobs' },
  'PAYMENT_RECEIVED': { icon: Wallet, kind: 'earnings', priority: 'high', category: 'updates' },
  'WALLET_CREDIT': { icon: Wallet, kind: 'earnings', priority: 'high', category: 'updates' },
  'WALLET_DEBIT': { icon: Wallet, kind: 'earnings', priority: 'normal', category: 'updates' },
  'WITHDRAWAL_COMPLETED': { icon: Wallet, kind: 'earnings', priority: 'high', category: 'updates' },
  'ACCOUNT_ON_HOLD': { icon: Bell, kind: 'system', priority: 'high', category: 'updates' },
  'ACCOUNT_SUSPENDED': { icon: Bell, kind: 'system', priority: 'high', category: 'updates' },
  'ACCOUNT_BLOCKED': { icon: Bell, kind: 'system', priority: 'high', category: 'updates' },
  'ACCOUNT_REACTIVATED': { icon: CheckCircle2, kind: 'kyc', priority: 'high', category: 'updates' },
  'ACCOUNT_STATUS_UPDATE': { icon: Bell, kind: 'system', priority: 'normal', category: 'updates' },
}

const KIND_TONE = {
  job_request: 'from-amber-500/15 to-orange-50 text-amber-800 ring-amber-200/80',
  kyc: 'from-violet-500/15 to-violet-50 text-violet-800 ring-violet-200/80',
  attendance: 'from-sky-500/15 to-sky-50 text-sky-800 ring-sky-200/80',
  earnings: 'from-emerald-500/15 to-emerald-50 text-emerald-800 ring-emerald-200/80',
  assignment: 'from-brand/15 to-emerald-50 text-brand ring-brand/25',
  profile: 'from-slate-500/15 to-slate-50 text-slate-800 ring-slate-200/80',
  system: 'from-slate-500/15 to-slate-50 text-slate-700 ring-slate-200/80',
}

export function VendorNotificationsPage() {
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tab, setTab] = useState('all')
  const [toast, setToast] = useState('')
  const [isSendingTest, setIsSendingTest] = useState(false)

  const { data: notificationsData, refetch } = useGetNotificationsQuery(undefined)
  const [markRead] = useMarkNotificationReadMutation()
  const [markAllRead] = useMarkAllNotificationsReadMutation()
  const [deleteNotif] = useDeleteNotificationMutation()
  const [sendSelfTest] = useSendSelfTestNotificationMutation()

  const handleSendTestNotification = async () => {
    try {
      setIsSendingTest(true)
      await sendSelfTest({
        title: '⚡ Live Push Alert',
        body: `FCM push notification delivered successfully via Firebase at ${new Date().toLocaleTimeString()}!`,
        type: 'SYSTEM_ALERT',
      }).unwrap()
      refetch()
      showToast('Live FCM test notification sent successfully!')
    } catch (err) {
      showToast('Failed to send test notification.')
    } finally {
      setIsSendingTest(false)
    }
  }

  useEffect(() => {
    const handleRealtimeUpdate = () => {
      refetch()
    }
    window.addEventListener('fcm-foreground-message', handleRealtimeUpdate)
    window.addEventListener('lc-notification-received', handleRealtimeUpdate)

    const interval = setInterval(handleRealtimeUpdate, 10000)

    return () => {
      window.removeEventListener('fcm-foreground-message', handleRealtimeUpdate)
      window.removeEventListener('lc-notification-received', handleRealtimeUpdate)
      clearInterval(interval)
    }
  }, [refetch])

  const feedItems = notificationsData?.notifications || notificationsData?.data?.notifications || []
  const unreadCount = notificationsData?.unreadCount ?? notificationsData?.data?.unreadCount ?? 0
  const jobCount = feedItems.filter(n => TYPE_MAPPING[n.type]?.category === 'jobs').length

  const mappedFeedItems = useMemo(() => {
    return feedItems.map(n => {
      const mapping = TYPE_MAPPING[n.type] || { icon: Bell, kind: 'system', priority: 'normal', category: 'updates' }
      return {
        ...n,
        icon: mapping.icon,
        kind: mapping.kind,
        priority: mapping.priority,
        category: mapping.category,
      }
    })
  }, [feedItems])

  const filtered = useMemo(() => {
    if (tab === 'jobs') return mappedFeedItems.filter((n) => n.category === 'jobs')
    if (tab === 'updates') return mappedFeedItems.filter((n) => n.category === 'updates')
    return mappedFeedItems
  }, [mappedFeedItems, tab])

  const showToast = useCallback((msg) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2800)
  }, [])

  const handleMarkAllRead = async () => {
    try {
      await markAllRead().unwrap()
      refetch()
      showToast('All caught up — notifications marked read.')
    } catch (err) {
      showToast('Failed to mark all as read.')
    }
  }

  const handleOpen = async (n) => {
    if (!n.isRead) {
      await markRead(n._id).unwrap()
      refetch()
    }
    
    // Simple navigation logic based on kind
    if (n.kind === 'kyc') navigate('/app/kyc')
    else if (n.kind === 'attendance') navigate('/app/attendance')
    else if (n.kind === 'earnings') navigate('/app/earnings')
    else if (n.kind === 'assignment' || n.kind === 'job_request') navigate('/app/jobs')
  }

  const handleDismiss = async (id, e) => {
    e?.stopPropagation()
    try {
      await deleteNotif(id).unwrap()
      refetch()
    } catch (err) {
      showToast('Failed to dismiss notification.')
    }
  }

  return (
    <div className="-mx-4 min-h-[70vh] pb-6">
      <div className="px-4 pt-4 pb-2 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Real-time Notifications</h1>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-600">
                  {unreadCount} new
                </span>
              )}
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs font-bold text-amber-600 hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Real-time Connected
          </div>

          <button
            type="button"
            onClick={handleSendTestNotification}
            disabled={isSendingTest}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 transition hover:bg-amber-100 active:scale-95 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            {isSendingTest ? 'Sending...' : 'Test Live Notification'}
          </button>
        </div>
      </div>

      <motion.div className="space-y-4 px-4 pt-4">
        {toast ? (
          <p className="rounded-xl border border-brand/25 bg-brand/10 px-4 py-2 text-center text-sm font-semibold text-brand">
            {toast}
          </p>
        ) : null}

        <AppPillTabs items={TABS} value={tab} onChange={setTab} />

        {filtered.length === 0 ? (
          <AppEmptyState
            icon={Bell}
            title="No notifications right now"
            subtitle={
              tab === 'jobs'
                ? 'New assignment requests will appear when admin or clients post jobs near you.'
                : 'Account updates, KYC, and system alerts show up in this tab.'
            }
          />
        ) : (
          <ul className="space-y-3">
            {filtered.map((n, i) => {
              const Icon = n.icon || Bell
              const tone = KIND_TONE[n.kind] || KIND_TONE.system

              return (
                <motion.li
                  key={n._id}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <div
                    className={`relative flex items-center justify-between gap-4 rounded-2xl border p-4 transition cursor-pointer ${
                      !n.isRead
                        ? 'border-slate-200 bg-white shadow-md shadow-slate-200/50 ring-1 ring-blue-100'
                        : 'border-slate-200/80 bg-white/90 hover:bg-white shadow-2xs'
                    }`}
                    onClick={() => handleOpen(n)}
                  >
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-900 truncate">
                          {n.title || 'Notification Update'}
                        </span>
                        {!n.isRead ? (
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500 shadow-[0_0_0_2px_rgba(59,130,246,0.15)]" />
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-600 leading-relaxed">
                        {n.body || n.message || ''}
                      </p>
                      <span className="mt-2.5 block text-[11px] font-bold text-slate-400">
                        {n.createdAt ? new Date(n.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'Just now'}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {!n.isRead && (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await markRead(n._id).unwrap();
                              refetch();
                            } catch (err) {}
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 hover:scale-105 active:scale-95 border border-emerald-200/60 shadow-xs"
                          title="Mark as read / Accept (Right)"
                          aria-label="Mark as read"
                        >
                          <Check className="h-5 w-5 stroke-[2.5]" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleDismiss(n._id, e)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-rose-600 transition hover:bg-rose-100 hover:scale-105 active:scale-95 border border-rose-200/60 shadow-xs"
                        title="Remove / Dismiss (Cross)"
                        aria-label="Dismiss"
                      >
                        <X className="h-5 w-5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                </motion.li>
              )
            })}
          </ul>
        )}
      </motion.div>
    </div>
  )
}

