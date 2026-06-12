import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Calendar, MapPin, RefreshCw, Eye, MoreVertical, CalendarClock } from 'lucide-react'
import {
  bookingStatusToUi,
  formatBookingSchedule,
  formatInr,
  totalWorkersFromLines,
} from '../../../lib/individualBookings.js'

function getThumbnail(bookingLine) {
  const name = String(bookingLine?.categoryName || '').toLowerCase()
  const slug = String(bookingLine?.categoryId || '').toLowerCase()
  
  if (slug === 'ac-technician' || name.includes('ac')) {
    return 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=400&q=70'
  }
  if (slug === 'cook-chef' || name.includes('cook') || name.includes('chef')) {
    return 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400&q=70'
  }
  if (slug === 'gardener-mali' || name.includes('garden') || name.includes('mali')) {
    return 'https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?w=400&q=70'
  }
  if (slug === 'glass-installer' || name.includes('glass')) {
    return 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=400&q=70'
  }
  
  if (name.includes('plumb')) return '/service_plumber.png'
  if (name.includes('electric')) return '/service_electrician.png'
  if (name.includes('carpent')) return '/service_carpenter.png'
  if (name.includes('paint')) return '/service_painter.png'
  if (name.includes('mason') || name.includes('mistri')) return '/service_mason.png'
  if (name.includes('weld')) return '/service_welder.png'
  if (name.includes('tile')) return '/service_tile.png'
  if (name.includes('heavy') || name.includes('load') || name.includes('jcb') || name.includes('crane')) return '/service_heavy.png'
  if (name.includes('help') || name.includes('clean')) return '/service_helper.png'
  
  return '/home_service_hero.png'
}

function getStatusBadge(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'searching' || s === 'pending_review') {
    return {
      label: 'Finding Labour',
      tone: 'bg-[#FFFDF5] text-[#D6A11E] border border-[#FDF2C2]',
      dot: 'bg-[#F4C542]',
      border: 'border-l-4 border-l-[#F4C542]',
    }
  }
  if (s === 'in_progress' || s === 'on_site') {
    return {
      label: 'In Progress',
      tone: 'bg-[#F4FDF7] text-[#1D9455] border border-[#C6F3D7]',
      dot: 'bg-[#10B981]',
      border: 'border-l-4 border-l-[#10B981]',
    }
  }
  if (s === 'assigned' || s === 'confirmed' || s === 'accepted') {
    return {
      label: 'Assigned',
      tone: 'bg-[#F4F9FD] text-[#2B76D9] border border-[#C6E1F7]',
      dot: 'bg-[#3B82F6]',
      border: 'border-l-4 border-l-[#3B82F6]',
    }
  }
  if (s === 'completed') {
    return {
      label: 'Completed',
      tone: 'bg-[#F9F5FF] text-[#6D28D9] border border-[#E9D5FF]',
      dot: 'bg-[#8B5CF6]',
      border: 'border-l-4 border-l-[#8B5CF6]',
    }
  }
  return {
    label: 'Cancelled',
    tone: 'bg-slate-50 text-slate-500 border border-slate-200',
    dot: 'bg-slate-400',
    border: 'border-l-4 border-l-slate-300',
  }
}

export function IndividualBookingHistoryList({ items, isDemo, onTrack, onRebook }) {
  const reduce = useReducedMotion()
  const navigate = useNavigate()

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-20 h-20 bg-[#FFFBEB] rounded-full flex items-center justify-center text-[#F4C542] mb-4 shadow-inner">
          <CalendarClock className="h-10 w-10 animate-pulse" />
        </div>
        <h3 className="text-base font-black text-slate-900">No bookings yet</h3>
        <p className="text-xs font-semibold text-slate-500 mt-1 max-w-[240px] leading-relaxed">
          Book verified workers in just a few taps.
        </p>
        <button
          type="button"
          onClick={() => navigate('/app')}
          className="mt-6 rounded-full bg-gradient-to-r from-brand-bright to-brand hover:opacity-95 text-slate-950 font-extrabold text-xs px-6 py-3 transition active:scale-95 shadow-md shadow-brand/20 border-0"
        >
          Book Your First Worker
        </button>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {items.map((h, idx) => {
        const badge = getStatusBadge(h.status)
        const primary = (h.lines || [])[0]
        const title = primary?.categoryName || 'Labour booking'
        const workers = totalWorkersFromLines(h.lines)
        const thumbnail = getThumbnail(primary)

        return (
          <motion.li
            key={h.id || h.ref}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.05, 0.2) }}
          >
            <div className={`bg-white rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden ${badge.border} flex flex-col p-4 gap-3 relative`}>
              
              <div className="flex gap-3 items-start w-full">
                
                <img
                  src={thumbnail}
                  alt={title}
                  className="w-20 h-20 rounded-2xl object-cover shrink-0 border border-slate-100"
                />

                <div className="flex-1 min-w-0 space-y-1">
                  
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[9px] font-bold text-slate-400">{h.ref}</span>
                    <div className="flex items-center gap-1">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold select-none ${badge.tone}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                        {badge.label}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        className="text-slate-400 hover:text-slate-700 p-1 -mr-1"
                        aria-label="More options"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-black text-slate-900 leading-snug truncate">{title}</h3>
                  
                  <div className="flex items-start gap-1 text-[11px] font-semibold text-slate-500">
                    <MapPin className="h-3 w-3 shrink-0 text-slate-400 mt-0.5" />
                    <span className="truncate">{h.address}</span>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{formatBookingSchedule(h)} · {workers} Worker{workers > 1 ? 's' : ''}</span>
                  </div>

                  <div className="text-xs font-black text-slate-900 pt-0.5">
                    {formatInr(h.estimatedTotal)} <span className="text-[10px] font-bold text-slate-400">est.</span>
                  </div>

                </div>

              </div>

              <div className="h-px bg-slate-100/80 -mx-4 my-0.5" />

              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={() => onTrack(h.ref)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-bright to-brand hover:opacity-95 active:scale-[0.97] transition-all py-2 text-xs font-extrabold text-slate-950 shadow-xs border-0"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Track</span>
                </button>
                
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRebook(h);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-brand hover:bg-slate-50 active:scale-[0.97] transition-all py-2 text-xs font-extrabold text-[#7A5C00] shadow-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Rebook</span>
                </button>
              </div>

            </div>
          </motion.li>
        )
      })}
    </ul>
  )
}

