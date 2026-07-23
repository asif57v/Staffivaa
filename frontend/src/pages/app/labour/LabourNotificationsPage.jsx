import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft,
  Bell,
  BellRing,
  Building2,
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
} from '../../../store/api/workforceApi.js'

// TABS defined dynamically inside component
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

import { ErrorBoundary } from '../../../components/ErrorBoundary.jsx'

export function LabourNotificationsPage() {
  return (
    <ErrorBoundary>
      <LabourNotificationsPageContent />
    </ErrorBoundary>
  )
}

function LabourNotificationsPageContent() {
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isLabour = user?.role === 'LABOUR'
  const [tab, setTab] = useState('all')
  const [toast, setToast] = useState('')

  const TABS = [{ id: 'all', label: 'All' }]
  if (isLabour) TABS.push({ id: 'jobs', label: 'Job requests' })
  TABS.push({ id: 'updates', label: 'Updates' })

  const { data: notificationsData, refetch } = useGetNotificationsQuery(undefined)
  const [markRead] = useMarkNotificationReadMutation()
  const [markAllRead] = useMarkAllNotificationsReadMutation()
  const [deleteNotif] = useDeleteNotificationMutation()

  const feedItems = notificationsData?.data?.notifications || []
  const unreadCount = notificationsData?.data?.unreadCount || 0
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
      <section className="relative overflow-hidden rounded-b-[2rem] bg-linear-to-br from-slate-900 via-slate-800 to-slate-950 px-4 pb-6 pt-[max(0.5rem,env(safe-area-inset-top))] text-white">
        <motion.div
          className="pointer-events-none absolute -right-8 top-0 h-40 w-40 rounded-full bg-brand/30 blur-3xl"
          animate={reduce ? undefined : { opacity: [0.3, 0.55, 0.3] }}
          transition={{ duration: 4, repeat: Infinity }}
          aria-hidden
        />
        <div className="relative flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate('/app')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10 backdrop-blur-sm transition hover:bg-white/20"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-brand-bright" aria-hidden />
              <h1 className="text-xl font-extrabold tracking-tight">Notifications</h1>
            </div>
            <p className="mt-1 text-sm text-white/75">
              {isLabour ? 'Job requests, KYC, pay & attendance alerts' : 'Stay updated with your bookings and alerts'}
            </p>
          </div>
          {unreadCount > 0 ? (
            <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-amber-400 px-2 text-xs font-black text-amber-950">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </div>

        <div className="relative mt-4 flex gap-2 w-full">
          {[
            { label: 'Unread', value: String(unreadCount) },
            ...(isLabour ? [{ label: 'Job requests', value: String(jobCount) }] : []),
            { label: 'Total', value: String(feedItems.length) },
          ].map((s) => (
            <div
              key={s.label}
              className="flex-1 rounded-xl border border-white/15 bg-white/10 px-2 py-2.5 text-center backdrop-blur-sm"
            >
              <p className="text-lg font-black tabular-nums">{s.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/70">{s.label}</p>
            </div>
          ))}
        </div>

        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="relative mt-3 w-full rounded-xl border border-white/20 bg-white/10 py-2.5 text-xs font-bold text-white transition hover:bg-white/15"
          >
            Mark all as read
          </button>
        ) : null}
      </section>

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
            title="No notifications here"
            subtitle={
              tab === 'jobs'
                ? 'New assignment requests will appear when admin or clients post jobs near you.'
                : isLabour
                  ? 'KYC, attendance, and pay updates show up in this tab.'
                  : 'Updates on your bookings and account will show up here.'
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
                  <GlassPanel
                    className={`relative overflow-hidden border-2 p-4 transition cursor-pointer ${
                      !n.isRead ? 'border-brand/30 bg-white shadow-md shadow-brand/5' : 'border-slate-200/90'
                    } ${n.priority === 'high' ? 'ring-1 ring-amber-200/60' : ''}`}
                    onClick={() => handleOpen(n)}
                  >
                    {!n.isRead ? (
                      <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-brand shadow-[0_0_0_3px_rgba(255,179,71,0.25)]" />
                    ) : null}

                    <button
                      type="button"
                      onClick={(e) => handleDismiss(n._id, e)}
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Dismiss"
                    >
                      <X className="h-4 w-4" />
                    </button>

                    <div className="flex gap-3 pr-8">
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br ring-1 ${tone}`}
                      >
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1 text-left">
                        <div className="flex flex-wrap items-center gap-2">
                          {n.priority === 'high' ? <AppBadge variant="amber">Important</AppBadge> : null}
                          {n.kind === 'job_request' ? <AppBadge variant="brand">Job</AppBadge> : null}
                          {n.isRead ? (
                            <span className="text-[10px] font-bold uppercase text-slate-400">Read</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm font-extrabold text-slate-900">{n.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">{n.body}</p>
                        
                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand underline-offset-4 hover:underline">
                          View details
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                        </span>
                      </div>
                    </div>
                  </GlassPanel>
                </motion.li>
              )
            })}
          </ul>
        )}
      </motion.div>
    </div>
  )
}

