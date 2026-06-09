import { Loader2 } from 'lucide-react'

const variants = {
  primary:
    'text-slate-900 bg-[#F4CC34] hover:brightness-[1.06] shadow-[0_12px_32px_-12px_rgba(244,204,52,0.35)] rounded-xl disabled:shadow-none',
  secondary:
    'text-white bg-[#0f172a] hover:brightness-[1.06] shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)] rounded-xl',
  ghost: 'border border-transparent bg-transparent text-[#0f172a] hover:bg-slate-50 rounded-xl',
  danger:
    'border border-rose-200/90 bg-rose-50 text-rose-800 shadow-sm hover:bg-rose-50/90 rounded-xl',
}

const sizes = {
  sm: 'px-3.5 py-2 text-xs font-semibold gap-1.5',
  md: 'px-5 py-3.5 text-sm font-semibold gap-2',
  lg: 'px-6 py-4 text-base font-semibold gap-2',
}

const focus =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

/**
 * @param {object} props
 * @param {'primary'|'secondary'|'ghost'|'danger'} [props.variant='primary']
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {boolean} [props.fullWidth=true]
 * @param {boolean} [props.loading]
 * @param {import('react').ElementType} [props.as]
 */
export function AppButton({
  as: Comp = 'button',
  variant = 'primary',
  size = 'md',
  fullWidth = true,
  loading = false,
  className = '',
  children,
  disabled,
  ...rest
}) {
  const isDisabled = disabled || loading
  const width = fullWidth ? 'inline-flex w-full' : 'inline-flex'
  const base = `${width} items-center justify-center transition duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 ${focus} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md}`

  return (
    <Comp className={`${base} ${className}`} disabled={isDisabled} {...rest}>
      {loading ? <Loader2 className="h-[1.1em] w-[1.1em] shrink-0 animate-spin" aria-hidden /> : null}
      {children}
    </Comp>
  )
}
