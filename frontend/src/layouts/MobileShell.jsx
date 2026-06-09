/**
 * Mobile-first shell: same max width & spacing we’ll mirror in Flutter (single-column app UI).
 * Admin routes should NOT use this wrapper — full-width dashboard later.
 * @param {boolean} [transparent] — use with `AppAmbientBackground` for premium full-bleed gradients
 */
export function MobileShell({ children, className = '', transparent = false }) {
  return (
    <div
      className={`relative min-h-dvh w-full text-slate-900 ${transparent ? 'bg-transparent' : 'bg-page'} ${className}`}
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-8 pt-6">{children}</div>
    </div>
  )
}
