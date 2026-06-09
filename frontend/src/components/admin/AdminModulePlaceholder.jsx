import { motion, useReducedMotion } from 'framer-motion'
import { Construction, Sparkles } from 'lucide-react'
import { GlassPanel } from '../ui/GlassPanel.jsx'

export function AdminModulePlaceholder({ title, subtitle, bullets = [] }) {
  const reduce = useReducedMotion()

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <GlassPanel className="relative overflow-hidden p-6 md:p-8">
          <div className="pointer-events-none absolute -right-16 top-0 h-48 w-48 rounded-full bg-brand/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-emerald-50/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand">
                <Sparkles className="h-3 w-3" aria-hidden />
                Module
              </span>
              <h2 className="mt-3 text-xl font-extrabold tracking-tight text-slate-900 md:text-2xl">{title}</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">{subtitle}</p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg ring-4 ring-slate-900/10">
              <Construction className="h-7 w-7" aria-hidden />
            </div>
          </div>
          {bullets.length ? (
            <ul className="relative mt-6 space-y-2 border-t border-slate-100 pt-6 text-sm text-slate-600">
              {bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                  {b}
                </li>
              ))}
            </ul>
          ) : null}
        </GlassPanel>
      </motion.div>
    </div>
  )
}
