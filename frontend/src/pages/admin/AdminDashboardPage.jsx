import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowUpRight,
  ClipboardList,
  Layers,
  Shield,
  Users,
  HardHat,
  BadgeIndianRupee,
  Activity,
  AlertCircle,
  Clock,
  RefreshCw,
} from 'lucide-react'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { ADMIN_NAV_SECTIONS } from '../../config/adminNavigation.js'
import {
  useGetAdminDashboardStatsQuery,
  useGetAdminDashboardAnalyticsQuery
} from '../../store/api/workforceApi.js'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts'

export function AdminDashboardPage() {
  const reduce = useReducedMotion()

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats
  } = useGetAdminDashboardStatsQuery()

  const {
    data: analytics,
    isLoading: analyticsLoading,
    isError: analyticsError,
    refetch: refetchAnalytics
  } = useGetAdminDashboardAnalyticsQuery()

  const flatLinks = ADMIN_NAV_SECTIONS.flatMap((s) =>
    s.items.filter((i) => i.to !== '/admin').map((i) => ({ ...i, section: s.title })),
  ).slice(0, 6)

  if (statsLoading || analyticsLoading) {
    return (
      <div className="w-full space-y-8 pb-8 animate-pulse">
        <div>
          <div className="h-8 w-48 bg-slate-200 rounded-lg"></div>
          <div className="h-4 w-96 bg-slate-200 rounded-lg mt-3"></div>
        </div>
        <div className="grid gap-6 grid-cols-4 w-full">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-200 rounded-2xl"></div>
          ))}
        </div>
        <div className="grid gap-6 grid-cols-3 w-full">
          <div className="h-80 bg-slate-200 rounded-2xl col-span-2"></div>
          <div className="h-80 bg-slate-200 rounded-2xl col-span-1"></div>
        </div>
      </div>
    )
  }

  if (statsError || analyticsError) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center p-6">
        <AlertCircle className="h-12 w-12 text-rose-500 mb-4" />
        <h3 className="text-lg font-bold text-slate-900">Failed to load statistics</h3>
        <p className="text-slate-600 text-sm mt-1 max-w-sm">
          There was an error communicating with the server. Please check your connection and try again.
        </p>
        <button
          onClick={() => {
            refetchStats()
            refetchAnalytics()
          }}
          className="mt-4 flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-brand-dark transition"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    )
  }

  const cards = [
    { label: 'Monthly Revenue', value: `₹${stats.monthlyRevenue.toLocaleString()}`, hint: 'Wallet Credits', icon: BadgeIndianRupee, tone: 'from-brand/20 to-emerald-50' },
    { label: 'Active Workforce', value: stats.activeWorkforce, hint: 'Workers on-site', icon: HardHat, tone: 'from-sky-500/15 to-slate-50' },
    { label: 'Pending KYC Review', value: stats.pendingKyc, hint: 'KYC Action required', icon: Shield, tone: 'from-violet-500/15 to-slate-50' },
    { label: 'Daily Revenue', value: `₹${stats.dailyRevenue.toLocaleString()}`, hint: "Today's payments", icon: Activity, tone: 'from-amber-500/15 to-amber-50/50' },
  ]

  const growthData = analytics?.userGrowth || []
  const revenueData = analytics?.revenueTrend || []
  const attendanceData = analytics?.attendanceStats || []

  return (
    <div className="w-full space-y-8 pb-8">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">Control centre</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
          Super panel for Staffivaa — live MongoDB-driven insights, time records, settlements, and live activities updates.
        </p>
      </motion.div>

      <div className="grid gap-6 grid-cols-4 w-full">
        {cards.map((s, i) => (
          <motion.div
            key={s.label}
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

      {/* Analytics Charts */}
      <div className="grid gap-6 grid-cols-2 w-full">
        <GlassPanel className="p-6 border border-slate-200/60 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-4">Revenue Trend (Last 6 Months)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1CAF62" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#1CAF62" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <RechartsTooltip />
                <Area type="monotone" dataKey="revenue" stroke="#1CAF62" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>

        <GlassPanel className="p-6 border border-slate-200/60 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-4">Roster Registrations Growth</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <RechartsTooltip />
                <Legend verticalAlign="top" height={36} iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="labour" stackId="a" fill="#1CAF62" name="Labour" />
                <Bar dataKey="vendor" stackId="a" fill="#38bdf8" name="Vendors" />
                <Bar dataKey="corporate" stackId="a" fill="#8b5cf6" name="Corporates" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>
      </div>

      {attendanceData.length > 0 && (
        <GlassPanel className="p-6 border border-slate-200/60 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-4">Attendance Stats (Last 30 Days)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickFormatter={(tick) => tick.slice(5)} />
                <YAxis stroke="#64748b" fontSize={11} />
                <RechartsTooltip />
                <Legend verticalAlign="top" height={36} iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="present" fill="#1CAF62" name="Present" />
                <Bar dataKey="absent" fill="#ef4444" name="Absent" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>
      )}

      <div className="grid gap-6 grid-cols-3 w-full">
        <GlassPanel className="p-8 col-span-2 shadow-sm border border-slate-200/60">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-slate-900">Shortcuts</h2>
            <Activity className="h-5 w-5 text-slate-300" aria-hidden />
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
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Operations Overview</h2>
          <div className="mt-4 space-y-4 text-sm text-slate-700">
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="font-medium text-slate-500">Total Bookings</span>
              <span className="font-bold text-slate-900">{stats.totalBookings}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="font-medium text-slate-500">Pending Bookings</span>
              <span className="font-bold text-slate-900">{stats.pendingRequests}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="font-medium text-slate-500">Open Tickets</span>
              <span className="font-bold text-slate-900">{stats.supportTickets}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-slate-500">Today's Checkins</span>
              <span className="font-bold text-slate-900">{stats.todayCheckIns}</span>
            </div>
          </div>
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
