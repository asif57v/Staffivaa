/**
 * Two-option segmented control (reference: pill segment).
 */
export function AppSegmentedControl({ left, right, value, onChange, className = '', brandAccent = false }) {
  const activeTone = brandAccent ? 'text-brand' : 'text-slate-900'
  return (
    <div
      className={`flex rounded-2xl border border-slate-200/90 bg-slate-50/90 p-1 shadow-inner ring-1 ring-black/[0.02] ${className}`}
      role="group"
    >
      <button
        type="button"
        aria-pressed={value === 'left'}
        onClick={() => onChange('left')}
        className={`min-w-0 flex-1 rounded-xl py-2.5 text-xs font-bold transition ${
          value === 'left' ? `bg-white shadow-sm ring-1 ring-slate-200/80 ${activeTone}` : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        {left}
      </button>
      <button
        type="button"
        aria-pressed={value === 'right'}
        onClick={() => onChange('right')}
        className={`min-w-0 flex-1 rounded-xl py-2.5 text-xs font-bold transition ${
          value === 'right' ? `bg-white shadow-sm ring-1 ring-slate-200/80 ${activeTone}` : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        {right}
      </button>
    </div>
  )
}
