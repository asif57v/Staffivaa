import { forwardRef } from 'react'

export const AppTextInput = forwardRef(function AppTextInput(
  { className = '', inputClassName = '', leftSlot, rightSlot, ...rest },
  ref,
) {
  return (
    <div
      className={`flex min-h-[2.75rem] items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/95 px-3 shadow-sm ring-1 ring-black/[0.02] transition focus-within:border-brand/35 focus-within:ring-2 focus-within:ring-brand/15 ${className}`}
    >
      {leftSlot ? <span className="shrink-0 text-slate-400">{leftSlot}</span> : null}
      <input
        ref={ref}
        outline="none"
        className={`min-w-0 flex-1 bg-transparent py-2.5 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 ${inputClassName}`}
        {...rest}
      />
      {rightSlot ? <span className="shrink-0 text-slate-400">{rightSlot}</span> : null}
    </div>
  )
})
