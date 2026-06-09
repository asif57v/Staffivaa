import { motion, useReducedMotion } from 'framer-motion'
import { Calendar, ChevronRight, MapPin, RefreshCw } from 'lucide-react'
import { GlassPanel } from '../../ui/GlassPanel.jsx'
import {
  bookingStatusToUi,
  formatBookingSchedule,
  formatInr,
  isDemoBooking,
  totalWorkersFromLines,
} from '../../../lib/individualBookings.js'

export function IndividualBookingHistoryList({ items, isDemo, onTrack, onRebook }) {
  const reduce = useReducedMotion()

  return (
    <ul className="space-y-3">
      {items.map((h, idx) => {
        const st = bookingStatusToUi(h.status)
        const primary = (h.lines || [])[0]
        const title = primary?.categoryName || 'Labour booking'
        const workers = totalWorkersFromLines(h.lines)

        return (
          <motion.li
            key={h.id || h.ref}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.05, 0.2) }}
          >
            <button
              type="button"
              onClick={() => onTrack(h.ref)}
              className="w-full text-left transition active:scale-[0.99]"
            >
              <GlassPanel className="border-slate-200/90 p-4 ring-1 ring-slate-100/90 transition hover:border-brand/25 hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-black text-brand">{h.ref}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {new Date(h.createdAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    {isDemo && isDemoBooking(h) ? (
                      <span className="rounded-full bg-slate-200/90 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        Sample
                      </span>
                    ) : null}
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ${st.tone}`}>
                      {st.label}
                    </span>
                  </div>
                </div>

                <p className="mt-3 text-sm font-bold text-slate-900">{title}</p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                  <Calendar className="h-3.5 w-3.5 text-brand" aria-hidden />
                  {formatBookingSchedule(h)} · {workers} workers
                </p>
                <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-slate-500">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                  <span className="line-clamp-2">{h.address}</span>
                </p>
                <p className="mt-2 text-xs font-bold text-slate-800">{formatInr(h.estimatedTotal)} est.</p>

                <div className="mt-3 flex gap-2">
                  <span className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200/90 bg-white py-2 text-xs font-bold text-slate-700">
                    Track
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRebook(h)
                    }}
                    className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-brand/10 py-2 text-xs font-bold text-brand ring-1 ring-brand/20"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    Rebook
                  </button>
                </div>
              </GlassPanel>
            </button>
          </motion.li>
        )
      })}
    </ul>
  )
}
