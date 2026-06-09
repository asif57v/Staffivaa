import { motion, useReducedMotion } from 'framer-motion'

export function BookingWorkflowTimeline({ status, compact = false }) {
  const currentStatus = String(status || '').toLowerCase()
  
  const steps = [
    { label: 'Booking Created', done: true, key: 'created' },
    { label: 'Labour Assigned', done: ['accepted', 'assigned', 'in_progress', 'on_site', 'completed'].includes(currentStatus), key: 'assigned' },
    { label: 'On The Way', done: ['accepted', 'in_progress', 'on_site', 'completed'].includes(currentStatus), key: 'on_the_way' },
    { label: 'Arrived', done: ['on_site', 'in_progress', 'completed'].includes(currentStatus), key: 'arrived' },
    { label: 'Work Started', done: ['in_progress', 'completed'].includes(currentStatus), key: 'started' },
    { label: 'Completed', done: ['completed'].includes(currentStatus), key: 'completed' },
  ]
  
  const currentStepIdx = steps.findLastIndex(s => s.done)

  return (
    <div className={`relative pl-5 ml-2 space-y-5 border-l-2 border-slate-100 ${compact ? '' : 'mt-2 mb-2'}`}>
      {steps.map((step, idx) => {
        const isActive = idx === currentStepIdx
        const isPast = idx < currentStepIdx
        const isDone = isPast || isActive

        return (
          <div key={step.key} className="relative">
            <span className={`absolute -left-[1.7rem] top-[0.15rem] flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-white ${isDone ? 'bg-brand' : 'bg-slate-200'}`} />
            <p className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${isDone ? 'text-brand' : 'text-slate-400'}`}>
              {isDone ? (isActive ? 'CURRENT STATUS' : 'COMPLETED') : 'PENDING'}
            </p>
            <p className={`text-sm font-black leading-tight ${isDone ? 'text-slate-900' : 'text-slate-400'}`}>{step.label}</p>
          </div>
        )
      })}
    </div>
  )
}
