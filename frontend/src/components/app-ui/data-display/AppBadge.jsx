const variants = {
  neutral: 'bg-slate-100/90 text-slate-600 ring-slate-200/80',
  brand: 'bg-brand/10 text-brand ring-brand/20',
  amber: 'bg-amber-50/90 text-amber-950 ring-amber-200/90',
  emerald: 'bg-emerald-50/95 text-emerald-900 ring-emerald-200/80',
  rose: 'bg-rose-50/95 text-rose-900 ring-rose-200/80',
}

/**
 * Status / label chip aligned with app shell chips.
 */
export function AppBadge({ children, variant = 'neutral', className = '', uppercase = true }) {
  const uc = uppercase ? 'uppercase tracking-wide' : ''
  return (
    <span
      className={`inline-flex max-w-full truncate rounded-full px-2.5 py-0.5 text-[10px] font-semibold shadow-sm ring-1 backdrop-blur-sm ${uc} ${variants[variant] || variants.neutral} ${className}`}
    >
      {children}
    </span>
  )
}
