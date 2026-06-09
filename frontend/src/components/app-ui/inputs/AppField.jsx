export function AppField({ label, optional, hint, error, children, className = '' }) {
  return (
    <div className={className}>
      {label ? (
        <label className="mb-1.5 flex items-baseline gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          <span>{label}</span>
          {optional ? <span className="font-normal normal-case text-slate-400">(optional)</span> : null}
        </label>
      ) : null}
      {children}
      {hint && !error ? <p className="mt-1 text-[11px] font-medium text-slate-400">{hint}</p> : null}
      {error ? <p className="mt-1 text-[11px] font-semibold text-rose-600">{error}</p> : null}
    </div>
  )
}
