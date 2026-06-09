import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { GlassPanel } from '../ui/GlassPanel.jsx'
import { ChevronRight } from 'lucide-react'
import { getPastelStyles } from '../../lib/iconMap.jsx'

export function AppPressableLinkCard({ to, title, subtitle, icon: Icon, delay = 0, bgImage }) {
  const reduce = useReducedMotion()
  const { bg, text } = getPastelStyles(Icon)

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link to={to} className="group block outline-none">
        <GlassPanel className="relative overflow-hidden border border-[#e2e8f0] bg-white p-4 transition duration-300 hover:border-[#0f172a] hover:shadow-[0_12px_32px_-12px_rgba(79,70,229,0.15)] active:scale-[0.985]">
          <div className="pointer-events-none absolute inset-0 z-0">
            {bgImage && <img src={bgImage} alt="" className="absolute right-0 top-0 h-full w-[50%] object-cover object-left opacity-[0.25] mix-blend-multiply transition-all duration-500 ease-out group-hover:scale-105 group-hover:opacity-40 group-hover:mix-blend-normal" />}
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent" />
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#0f172a]/5 transition duration-500 group-hover:bg-[#0f172a]/10" />
          </div>
          <div className="relative z-10 flex items-start gap-3.5">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${bg} ${text} bg-white/50 backdrop-blur-sm shadow-sm ring-1 ring-white/60 transition duration-300`}>
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 pt-0.5">
              <span className="flex items-start justify-between gap-2">
                <span className="text-[15px] font-bold leading-snug text-slate-900">{title}</span>
                <ChevronRight
                  className="mt-0.5 h-5 w-5 shrink-0 text-slate-400 transition duration-300 group-hover:translate-x-0.5 group-hover:text-[#0f172a]"
                  aria-hidden
                />
              </span>
              {subtitle ? (
                <span className="mt-1 block text-xs font-medium leading-relaxed text-slate-500">{subtitle}</span>
              ) : null}
            </span>
          </div>
        </GlassPanel>
      </Link>
    </motion.div>
  )
}
