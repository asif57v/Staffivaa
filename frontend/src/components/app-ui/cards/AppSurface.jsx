import { GlassPanel } from '../../ui/GlassPanel.jsx'

/**
 * Standard elevated surface for app screens.
 * @param {object} props
 * @param {boolean} [props.flush] — drop default padding (you pad inside)
 * @param {'default'|'muted'|'brandWash'} [props.tone='default']
 */
export function AppSurface({ children, className = '', flush = false, tone = 'default', ...props }) {
  const toneCls =
    tone === 'brandWash'
      ? 'relative overflow-hidden shadow-[0_16px_48px_-20px_rgba(255,179,71,0.25)]'
      : tone === 'muted'
        ? 'bg-slate-50/90'
        : ''

  const pad = flush ? '' : 'p-4 sm:p-5'

  return (
    <GlassPanel className={`${toneCls} ${pad} ${className}`} {...props}>
      {tone === 'brandWash' ? (
        <>
          <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-brand/15 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute bottom-0 left-0 h-32 w-32 rounded-full bg-brand-muted/80 blur-2xl" aria-hidden />
          <div className="relative">{children}</div>
        </>
      ) : (
        children
      )}
    </GlassPanel>
  )
}
