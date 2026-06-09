/**
 * Horizontal pill tabs with optional scroll-snap.
 * @param {{ id: string, label: string }[]} props.items
 * @param {string} props.value
 * @param {(id: string) => void} props.onChange
 */
export function AppPillTabs({ items, value, onChange, className = '' }) {
  return (
    <div
      className={`flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      role="tablist"
      aria-label="Tabs"
    >
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={`shrink-0 snap-start rounded-full px-4 py-2 text-xs font-bold tracking-wide transition ${
              active
                ? 'bg-slate-900 text-white shadow-md ring-1 ring-slate-900/10'
                : 'bg-white/90 text-slate-600 ring-1 ring-slate-200/90 hover:border-brand/20 hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
