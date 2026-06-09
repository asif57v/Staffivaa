export function GlassPanel({ children, className = '' }) {
  const hasBg = className.includes('bg-')
  const hasBorder = className.includes('border-')
  const hasShadow = className.includes('shadow-')
  
  const defaultBg = hasBg ? '' : 'bg-white/85 backdrop-blur-xl'
  const defaultBorder = hasBorder ? '' : 'border border-slate-200/90'
  const defaultShadow = hasShadow ? '' : 'shadow-[0_8px_40px_-12px_rgba(15,23,42,0.12)]'

  return (
    <div
      className={`rounded-3xl ${defaultBorder} ${defaultBg} ${defaultShadow} ${className}`}
    >
      {children}
    </div>
  )
}
