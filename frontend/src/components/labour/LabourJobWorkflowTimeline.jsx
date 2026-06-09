import { motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { LABOUR_WORKFLOW, labourWorkflowStepIndex } from '../../lib/workforceLabels.js'

/**
 * Labour assignment lifecycle — offer → accept → site → attendance → complete → pay.
 */
export function LabourJobWorkflowTimeline({ status, compact = false }) {
  const reduce = useReducedMotion()
  const activeIdx = labourWorkflowStepIndex(status)
  const declined = String(status).toLowerCase() === 'declined'

  return (
    <ol className={compact ? 'flex flex-col gap-1.5' : 'space-y-0'}>
      {LABOUR_WORKFLOW.map((step, i) => {
        const done = i < activeIdx || (i >= 4 && activeIdx >= 4)
        const active = i === activeIdx && !declined
        const upcoming = i > activeIdx

        return (
          <motion.li
            key={step.id}
            initial={reduce ? false : { opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.22, delay: i * 0.03 }}
            className={`relative flex gap-2.5 ${compact ? '' : 'pb-3 last:pb-0'}`}
          >
            {!compact && i < LABOUR_WORKFLOW.length - 1 ? (
              <span
                className={`absolute left-[0.55rem] top-6 h-[calc(100%-0.35rem)] w-px ${
                  done ? 'bg-brand/45' : 'bg-slate-200'
                }`}
                aria-hidden
              />
            ) : null}
            <span
              className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-2 ${
                done
                  ? 'bg-brand text-white ring-brand/30'
                  : active
                    ? 'bg-white text-brand ring-brand shadow-sm'
                    : 'bg-slate-100 text-slate-400 ring-slate-200/80'
              }`}
            >
              {done ? (
                <CheckCircle2 className="h-3 w-3" aria-hidden />
              ) : (
                <span className="text-[9px] font-black">{i + 1}</span>
              )}
            </span>
            <div
              className={`min-w-0 flex-1 rounded-xl px-2.5 py-1.5 ring-1 ${
                active ? 'bg-brand/8 ring-brand/20' : done ? 'bg-white ring-slate-100' : 'bg-slate-50/80 ring-slate-100/90'
              }`}
            >
              <p className={`text-[11px] font-bold ${upcoming ? 'text-slate-500' : 'text-slate-900'}`}>{step.label}</p>
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}
