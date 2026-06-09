import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, HardHat, ShieldCheck } from 'lucide-react'

const TONE_BADGE = {
  emerald: 'bg-emerald-500/25 text-emerald-100 ring-emerald-400/40',
  sky: 'bg-sky-500/25 text-sky-100 ring-sky-400/40',
  rose: 'bg-rose-500/25 text-rose-100 ring-rose-400/40',
  violet: 'bg-violet-500/25 text-violet-100 ring-violet-400/40',
}

const TONE_GRADIENT = {
  emerald: 'from-emerald-900 via-slate-900 to-slate-950',
  sky: 'from-sky-900 via-slate-900 to-slate-950',
  rose: 'from-rose-900 via-slate-900 to-slate-950',
  violet: 'from-amber-900/80 via-slate-900 to-slate-950',
}

export function VendorVerificationHero({ title, subtitle, phaseLabel, tone = 'violet', businessLine }) {
  const reduce = useReducedMotion()
  const badgeClass = TONE_BADGE[tone] || TONE_BADGE.violet
  const gradient = TONE_GRADIENT[tone] || TONE_GRADIENT.violet

  return (
    <section className="relative -mx-4 px-4 pb-1">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={`relative overflow-hidden rounded-[1.65rem] border border-white/15 bg-linear-to-br ${gradient} text-white shadow-[0_22px_48px_-20px_rgba(0,0,0,0.55)]`}
      >
        <motion.div
          className="pointer-events-none absolute inset-0 bg-[url('https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=60')] bg-cover bg-center opacity-25"
          aria-hidden
        />
        <motion.div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-slate-950/88 via-slate-900/85 to-amber-950/30"
          aria-hidden
        />

        <div className="relative p-4 sm:p-5">
          <motion.div className="flex items-start gap-3">
            <Link
              to="/vendor"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10 backdrop-blur-sm transition hover:bg-white/20"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </Link>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
              <HardHat className="h-5 w-5 text-white" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">Vendor</p>
              <h1 className="text-xl font-extrabold tracking-tight">Business verification</h1>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ${badgeClass}`}
            >
              {phaseLabel}
            </span>
          </motion.div>

          <p className="mt-4 text-sm font-bold leading-snug text-white/95">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-white/70">{subtitle}</p>
          {businessLine ? <p className="mt-2 text-sm font-extrabold text-white/90">{businessLine}</p> : null}

          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/15 bg-white/8 px-3 py-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
            <p className="text-[11px] leading-relaxed text-white/75">
              Upload documents matching your vendor type. Operations reviews manually before jobs and crew linking unlock.
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
