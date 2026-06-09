import { motion, useReducedMotion } from 'framer-motion'
import { GlassPanel } from '../ui/GlassPanel.jsx'

export function AppEmptyState({ icon: Icon, title, subtitle }) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <GlassPanel className="relative overflow-hidden p-8 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(148,163,184,0.12),transparent_55%)]" />
        <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100/90 to-white text-slate-300 shadow-inner ring-1 ring-slate-200/80">
          <Icon className="h-7 w-7" aria-hidden />
        </div>
        <p className="relative mt-4 text-sm font-semibold text-slate-800">{title}</p>
        {subtitle ? <p className="relative mt-2 text-xs leading-relaxed text-slate-500">{subtitle}</p> : null}
      </GlassPanel>
    </motion.div>
  )
}
