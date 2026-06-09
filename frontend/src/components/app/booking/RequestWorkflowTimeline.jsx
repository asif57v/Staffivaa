import { motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import {
  CORPORATE_WORKFLOW,
  INDIVIDUAL_WORKFLOW,
  requestWorkflowStepIndex,
} from '../../../lib/workforceLabels.js'

/**
 * Client-side booking pipeline — individual or corporate steps from SOW.
 */
export function RequestWorkflowTimeline({ status, sourceType = 'individual', compact = false }) {
  const reduce = useReducedMotion()
  const steps = sourceType === 'corporate' ? CORPORATE_WORKFLOW : INDIVIDUAL_WORKFLOW
  const activeIdx = requestWorkflowStepIndex(sourceType, status)
  const cancelled = String(status).toLowerCase() === 'cancelled'

  return (
    <ol className={compact ? 'flex flex-col gap-2' : 'space-y-0'}>
      {steps.map((step, i) => {
        const done = i < activeIdx || (i === steps.length - 1 && activeIdx === steps.length - 1)
        const active = i === activeIdx && !cancelled
        const upcoming = i > activeIdx

        return (
          <motion.li
            key={step.id}
            initial={reduce ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.28, delay: i * 0.04 }}
            className={`relative flex gap-3 ${compact ? '' : 'pb-4 last:pb-0'}`}
          >
            {!compact && i < steps.length - 1 ? (
              <span
                className={`absolute left-[0.65rem] top-7 h-[calc(100%-0.5rem)] w-px ${
                  done ? 'bg-brand/50' : 'bg-slate-200'
                }`}
                aria-hidden
              />
            ) : null}
            <span
              className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-2 ${
                done
                  ? 'bg-brand text-white ring-brand/30'
                  : active
                    ? 'bg-white text-brand ring-brand shadow-md shadow-brand/20'
                    : 'bg-slate-100 text-slate-400 ring-slate-200/80'
              }`}
            >
              {done ? (
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <span className="text-[10px] font-black">{i + 1}</span>
              )}
            </span>
            <div
              className={`min-w-0 flex-1 rounded-2xl px-3 py-2 ring-1 transition ${
                active
                  ? 'bg-brand/8 ring-brand/25'
                  : done
                    ? 'bg-white ring-slate-100'
                    : 'bg-slate-50/80 ring-slate-100/90'
              }`}
            >
              <p className={`text-xs font-bold ${upcoming ? 'text-slate-500' : 'text-slate-900'}`}>{step.label}</p>
              {active ? (
                <p className="mt-0.5 text-[10px] font-medium text-brand">Current step</p>
              ) : done ? (
                <p className="mt-0.5 text-[10px] font-medium text-slate-500">Done</p>
              ) : (
                <p className="mt-0.5 text-[10px] font-medium text-slate-400">Upcoming</p>
              )}
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}
