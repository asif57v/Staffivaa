import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, BellRing, Check, CheckCircle2, ChevronRight, Clock, Trash2,
  FileText, HardHat, UserCheck, ShieldCheck, Wallet, Sparkles, Filter, X, ArrowLeft
} from 'lucide-react'
import {
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
} from '../../../store/api/workforceApi.js'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'applications', label: 'Applications' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'financial', label: 'Invoices & Payouts' },
]

export function EnterpriseNotificationsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('all')

  const { data: notificationsData, isLoading } = useGetNotificationsQuery()
  const [markRead] = useMarkNotificationReadMutation()
  const [markAllRead] = useMarkAllNotificationsReadMutation()
  const [deleteNotif] = useDeleteNotificationMutation()

  const rawNotifs = notificationsData?.notifications || notificationsData?.data?.notifications || notificationsData?.data || []
  const unreadCount = notificationsData?.unreadCount ?? notificationsData?.data?.unreadCount ?? rawNotifs.filter(n => !n.isRead).length

  const filteredNotifs = useMemo(() => {
    return rawNotifs.filter((n) => {
      if (tab === 'applications') return n.type === 'NEW_JOB_APPLICATION' || n.type === 'JOINING_INVOICE_GENERATED' || n.type === 'WAITING_FOR_JOINING_PAYMENT'
      if (tab === 'attendance') return n.type === 'LABOUR_CHECK_IN' || n.type === 'LABOUR_CHECK_OUT' || n.type?.includes('ATTENDANCE')
      if (tab === 'financial') return n.type?.includes('PAYMENT') || n.type?.includes('INVOICE') || n.type?.includes('WALLET')
      return true
    })
  }, [rawNotifs, tab])

  const handleMarkAllRead = async () => {
    try {
      await markAllRead().unwrap()
      toast.success('All notifications marked as read')
    } catch (err) {
      toast.error('Failed to mark all as read')
    }
  }

  const handleItemClick = async (notif) => {
    if (!notif.isRead) {
      markRead(notif._id).catch(() => {})
    }
    if (notif.relatedModel === 'EnterpriseJoiningInvoice' || notif.type === 'JOB_SHIFT_COMPLETED' || notif.type === 'JOB_COMPLETED' || notif.type?.includes('PAYMENT')) {
      navigate('/enterprise/wallet')
    } else if (notif.relatedModel === 'EnterpriseApplication' || notif.type === 'NEW_JOB_APPLICATION') {
      navigate('/enterprise/applications')
    } else if (notif.relatedModel === 'EnterpriseJob') {
      navigate(`/enterprise/jobs/${notif.relatedId}`)
    } else {
      navigate('/enterprise/wallet')
    }
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    try {
      await deleteNotif(id).unwrap()
      toast.success('Notification dismissed')
    } catch (err) {
      toast.error('Failed to dismiss notification')
    }
  }

  return (
    <div className="px-3.5 py-4 sm:p-6 pb-28 space-y-5 max-w-5xl mx-auto min-h-screen bg-slate-50/50">
      {/* Top Title & Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/enterprise')}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-[20px] sm:text-[22px] font-extrabold text-slate-900 flex items-center gap-2">
              <Bell className="h-5 w-5 text-indigo-600" /> Notifications
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-500 text-white">
                  {unreadCount} New
                </span>
              )}
            </h1>
            <p className="text-[12.5px] font-medium text-slate-500">
              Real-time updates on candidate applications, check-ins, and invoices
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-[12px] font-bold hover:bg-indigo-100 transition-colors shrink-0"
          >
            <Check className="h-3.5 w-3.5" /> Mark All Read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-1.5 rounded-xl text-[12.5px] font-extrabold whitespace-nowrap transition-all ${
              tab === t.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 font-medium">Loading real-time notifications...</div>
      ) : filteredNotifs.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center flex flex-col items-center justify-center space-y-3 shadow-xs">
          <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center">
            <BellRing className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="text-[16px] font-extrabold text-slate-800">No Notifications</h3>
          <p className="text-[13px] text-slate-500 max-w-sm">
            When candidates apply to your jobs or workers check in, real-time alerts will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifs.map((n) => {
            const isUnread = !n.isRead
            const dateStr = n.createdAt ? new Date(n.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now'

            return (
              <motion.div
                key={n._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => handleItemClick(n)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                  isUnread
                    ? 'bg-white border-indigo-200 shadow-sm ring-1 ring-indigo-500/10'
                    : 'bg-white/80 border-slate-100 opacity-85 hover:opacity-100'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${
                    n.type === 'NEW_JOB_APPLICATION' ? 'bg-amber-100 text-amber-700' :
                    n.type === 'JOINING_INVOICE_GENERATED' ? 'bg-emerald-100 text-emerald-700' :
                    n.type?.includes('CHECK') ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {n.type === 'NEW_JOB_APPLICATION' ? <FileText className="h-5 w-5" /> :
                     n.type === 'JOINING_INVOICE_GENERATED' ? <Wallet className="h-5 w-5" /> :
                     <Bell className="h-5 w-5" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={`text-[13.5px] font-extrabold ${isUnread ? 'text-slate-900' : 'text-slate-700'}`}>
                        {n.title}
                      </h4>
                      {isUnread && (
                        <span className="h-2 w-2 rounded-full bg-indigo-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-[12.5px] font-medium text-slate-600 mt-0.5 leading-snug break-words">
                      {n.body || n.message}
                    </p>
                    <span className="text-[11px] font-semibold text-slate-400 mt-1.5 block">
                      {dateStr}
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => handleDelete(e, n._id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
                  title="Dismiss notification"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
