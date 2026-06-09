export function AppListSkeleton({ rows = 4, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm"
        >
          <div className="h-4 w-2/3 max-w-[14rem] rounded-lg bg-slate-200/90" />
          <div className="mt-3 h-3 w-full max-w-[18rem] rounded bg-slate-100" />
          <div className="mt-2 h-3 w-4/5 max-w-[12rem] rounded bg-slate-100" />
        </div>
      ))}
    </div>
  )
}
