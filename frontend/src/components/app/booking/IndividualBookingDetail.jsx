import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  CalendarClock,
  FastForward,
  IndianRupee,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { GlassPanel } from '../../ui/GlassPanel.jsx'
import { AppBadge } from '../../app-ui/data-display/AppBadge.jsx'
import { AppPrimaryButton } from '../AppPrimaryButton.jsx'
import { BookingWorkflowTimeline } from './BookingWorkflowTimeline.jsx'
import {
  bookingStatusToUi,
  formatBookingSchedule,
  formatInr,
  isDemoBooking,
  totalWorkersFromLines,
} from '../../../lib/individualBookings.js'

export function IndividualBookingDetail({ booking, onRebook, onBack, onAdvancePipeline }) {
  const reduce = useReducedMotion()
  const st = bookingStatusToUi(booking.status)
  const demo = isDemoBooking(booking)
  const workers = totalWorkersFromLines(booking.lines)

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-4"
    >
      <GlassPanel className="overflow-hidden border-slate-200/90 ring-1 ring-slate-100/90">
        <div className="bg-linear-to-br from-brand/12 via-white to-emerald-50/40 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-mono text-sm font-black text-brand">{booking.ref}</p>
              <p className="mt-1 text-[11px] font-medium text-slate-500">
                {new Date(booking.createdAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {demo ? (
                <AppBadge variant="neutral" uppercase={false} className="text-[10px]">
                  Sample
                </AppBadge>
              ) : null}
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ${st.tone}`}>
                {st.label}
              </span>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-800">
            <CalendarClock className="h-4 w-4 text-brand" aria-hidden />
            {formatBookingSchedule(booking)}
            <span className="text-slate-400">·</span>
            <span>
              {booking.durationDays || 1} day{(booking.durationDays || 1) === 1 ? '' : 's'}
            </span>
          </p>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Workers requested</p>
            <ul className="mt-2 space-y-2">
              {booking.lines.map((ln, i) => (
                <li
                  key={`${ln.categoryName}-${i}`}
                  className="flex justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-100"
                >
                  <span>
                    <span className="text-slate-500">{ln.groupName}</span>
                    <br />
                    <span className="font-semibold text-slate-900">{ln.categoryName}</span>
                  </span>
                  <span className="shrink-0 font-black tabular-nums text-brand">×{ln.quantity}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] font-semibold text-slate-600">{workers} workers total</p>
          </div>

          <p className="flex items-start gap-2 text-xs text-slate-600">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
            {booking.address}
          </p>

          {booking.notes ? (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-100">
              Note: {booking.notes}
            </p>
          ) : null}

          <div className="space-y-3 mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Platform Fee Paid</span>
              <span className="text-sm font-bold text-emerald-600">{formatInr(booking.userPlatformFee || 49)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Visiting Charge</span>
              <span className="text-sm font-bold text-slate-900">{formatInr(booking.labourCharge || booking.estimatedTotal || 0)}</span>
            </div>
            <div className="mt-2 rounded-lg bg-amber-50 p-3 text-[10px] font-medium leading-relaxed text-amber-800 ring-1 ring-amber-200/50">
              <Sparkles className="inline h-3 w-3 mr-1" />
              Staffivaa only collects platform fees. Labour charges are negotiated and paid directly between the client and the labour and are not processed by the platform.
            </div>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel className="border-slate-200/90 p-4 ring-1 ring-slate-100/90">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand" aria-hidden />
          <p className="text-sm font-extrabold text-slate-900">Booking progress</p>
        </div>
        <BookingWorkflowTimeline status={booking.status} />
        <p className="mt-4 rounded-xl bg-brand/8 px-3 py-2 text-[11px] leading-relaxed text-slate-600 ring-1 ring-brand/15">
          <Sparkles className="mb-1 inline h-3.5 w-3.5 text-brand" aria-hidden /> Labour is assigned manually by admin
          (FCFS queue). You&apos;ll get updates here as status changes.
        </p>
        {!demo && booking.status !== 'completed' && booking.status !== 'cancelled' && onAdvancePipeline ? null : null}
      </GlassPanel>

      <div className="flex flex-col gap-2 sm:flex-row">
        <AppPrimaryButton type="button" className="flex-1 py-3" onClick={() => onRebook(booking)}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          Rebook similar
        </AppPrimaryButton>
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-2xl border border-slate-200/90 bg-white py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-brand/35 hover:text-brand"
        >
          Back to list
        </button>
      </div>

      <Link
        to="/app/support"
        className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200/90 bg-white/90 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand/30 hover:text-brand"
      >
        Report an issue
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </motion.div>
  )
}
