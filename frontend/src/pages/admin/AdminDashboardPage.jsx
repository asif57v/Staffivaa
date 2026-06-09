import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowUpRight,
  BarChart3,
  ClipboardList,
  Layers,
  Shield,
  Users,
} from 'lucide-react'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { ADMIN_NAV_SECTIONS } from '../../config/adminNavigation.js'

const QUICK_STATS = [
  { label: 'Active bookings', value: '—', hint: 'Live soon', icon: ClipboardList, tone: 'from-brand/20 to-emerald-50' },
  { label: 'Workers on roster', value: '—', hint: 'KYC pipeline', icon: Users, tone: 'from-sky-500/15 to-slate-50' },
  { label: 'Corporate accounts', value: '—', hint: 'Approvals', icon: Shield, tone: 'from-violet-500/15 to-slate-50' },
  { label: 'Skill categories', value: 'Live', hint: 'Manage tree', icon: Layers, tone: 'from-amber-500/15 to-amber-50/50' },
]

export function AdminDashboardPage() {
  const reduce = useReducedMotion()

  const flatLinks = ADMIN_NAV_SECTIONS.flatMap((s) =>
    s.items.filter((i) => i.to !== '/admin').map((i) => ({ ...i, section: s.title })),
  ).slice(0, 6)

  return (
    <div className="w-full space-y-8 pb-8">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">Control centre</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
          Super panel for Staffivaa — users, workforce, bookings, allocation, attendance, billing, and analytics per
          your Work Scope. Use the sidebar to jump into each module.
        </p>
      </motion.div>

      <div className="grid gap-6 grid-cols-4 w-full">
        {QUICK_STATS.map((s, i) => (
          <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 * i }}
          >
            <GlassPanel className={`relative h-full overflow-hidden p-5 bg-linear-to-br ${s.tone}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
                  <p className="mt-2 text-2xl font-black tabular-nums text-slate-900">{s.value}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">{s.hint}</p>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/80 text-slate-700 shadow-sm ring-1 ring-slate-200/80">
                  <s.icon className="h-5 w-5" aria-hidden />
                </span>
              </div>
            </GlassPanel>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 grid-cols-3 w-full">
        <GlassPanel className="p-8 col-span-2 shadow-sm border border-slate-200/60">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-slate-900">Shortcuts</h2>
            <BarChart3 className="h-5 w-5 text-slate-300" aria-hidden />
          </div>
          <ul className="mt-4 divide-y divide-slate-100">
            {flatLinks.map(({ to, label, icon: Icon, section }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="group flex items-center justify-between gap-3 py-3.5 transition hover:bg-slate-50/80"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-brand ring-1 ring-brand/15">
                      <Icon className="h-[18px] w-[18px]" aria-hidden />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">{label}</span>
                      {section ? <span className="text-xs text-slate-500">{section}</span> : null}
                    </span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand" />
                </Link>
              </li>
            ))}
          </ul>
        </GlassPanel>

        <GlassPanel className="h-fit p-6 shadow-sm border border-slate-200/60 col-span-1">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Today</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Operational queues (corporate approvals, KYC, FCFS bookings) will surface here as APIs go live.
          </p>
          <Link
            to="/admin/bookings"
            className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand hover:underline"
          >
            Open bookings
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </GlassPanel>
      </div>
    </div>
  )
}
