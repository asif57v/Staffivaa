/**
 * Filter chips — horizontal scroll, optional multi-select via parent.
 */
export function AppChipRow({ children, className = '' }) {
  return (
    <div
      className={`flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {children}
    </div>
  )
}

export function AppChip({ active, children, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 snap-start rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
        active
          ? 'border-brand/35 bg-brand/10 text-brand shadow-sm ring-1 ring-brand/15'
          : 'border-slate-200/90 bg-white text-slate-600 hover:border-slate-300'
      } ${className}`}
    >
      {children}
    </button>
  )
}
