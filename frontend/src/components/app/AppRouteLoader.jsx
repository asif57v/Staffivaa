import { motion, useReducedMotion } from 'framer-motion'

function ShimmerBar({ className }) {
  return (
    <div
      className={`animate-app-shimmer rounded-xl bg-gradient-to-r from-slate-100/70 via-white to-slate-100/70 bg-[length:200%_100%] ring-1 ring-slate-200/50 ${className}`}
      aria-hidden
    />
  )
}

export function AppRouteLoader() {
  const reduce = useReducedMotion()

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-white text-slate-600">
      <motion.div
        className="relative w-full max-w-sm space-y-5 px-6"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        role="status"
        aria-live="polite"
        aria-label="Loading"
      >
        <div className="flex items-center gap-3">
          <motion.div
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-brand-bright to-brand shadow-[0_8px_24px_-8px_rgba(28,175,98,0.35)] ring-1 ring-brand/30"
            animate={reduce ? undefined : { scale: [1, 1.03, 1] }}
            transition={reduce ? undefined : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <span className="text-lg font-black tracking-tight text-white drop-shadow-sm">ST</span>
          </motion.div>
          <div className="min-w-0 flex-1 space-y-2">
            <ShimmerBar className="h-3.5 w-28" />
            <ShimmerBar className="h-2.5 w-40 opacity-80" />
          </div>
        </div>
        <ShimmerBar className="h-36 w-full rounded-3xl" />
        <div className="grid grid-cols-2 gap-3">
          <ShimmerBar className="h-14 w-full rounded-2xl" />
          <ShimmerBar className="h-14 w-full rounded-2xl" />
        </div>
        <p className="text-center text-xs font-medium text-slate-400">Preparing your workspace…</p>
      </motion.div>
    </div>
  )
}
