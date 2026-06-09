import { Link } from 'react-router-dom'

export function ButtonLink({
  href,
  children,
  variant = 'primary',
  className = '',
  ...rest
}) {
  const base =
    'inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold transition-transform duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-[0.98]'

  const styles = {
    primary:
      'bg-[#F59E0B] text-white shadow-[0_12px_32px_-12px_rgba(245,158,11,0.35)] hover:brightness-[1.05] rounded-xl',
    secondary:
      'bg-[#0f172a] text-white shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)] hover:brightness-[1.05] rounded-xl',
    ghost: 'text-[#0f172a] bg-white hover:bg-slate-50 shadow-sm ring-1 ring-slate-200 rounded-xl',
  }

  const isInternal = href?.startsWith('/')

  if (isInternal) {
    return (
      <Link to={href} className={`${base} ${styles[variant]} ${className}`} {...rest}>
        {children}
      </Link>
    )
  }

  return (
    <a href={href} className={`${base} ${styles[variant]} ${className}`} {...rest}>
      {children}
    </a>
  )
}
