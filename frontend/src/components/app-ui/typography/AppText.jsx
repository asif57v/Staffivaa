const styles = {
  display: 'text-3xl font-extrabold tracking-tight text-slate-900',
  title: 'text-lg font-extrabold tracking-tight text-slate-900',
  subtitle: 'text-sm font-semibold text-brand',
  body: 'text-sm font-medium leading-relaxed text-slate-600',
  caption: 'text-xs font-medium text-slate-500',
  overline: 'text-[10px] font-bold uppercase tracking-wider text-slate-400',
}

export function AppText({ as: Comp = 'p', variant = 'body', className = '', children, ...rest }) {
  return <Comp className={`${styles[variant] || styles.body} ${className}`} {...rest}>{children}</Comp>
}
