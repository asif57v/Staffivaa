import { motion, useReducedMotion } from 'framer-motion'

const LABELS = ['Type', 'Details', 'Review', 'Done']

export function BookingStepProgress({ step, total = 5 }) {
  const reduce = useReducedMotion()

  return (
    <div className="flex items-center gap-1.5 px-0.5" aria-label={`Step ${step + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const done = i < step
        const active = i === step
        return (
          <motion.div
            key={LABELS[i] || i}
            className="flex min-w-0 flex-1 flex-col items-center gap-1"
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <span
              className={`h-1.5 w-full rounded-full transition ${
                done ? 'bg-brand' : active ? 'bg-brand/60' : 'bg-slate-200'
              }`}
            />
            <span
              className={`truncate text-[9px] font-bold uppercase tracking-wide ${
                active ? 'text-brand' : done ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              {LABELS[i]}
            </span>
          </motion.div>
        )
      })}
    </div>
  )
}
