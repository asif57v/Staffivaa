import { NavLink } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { GlassPanel } from '../../ui/GlassPanel.jsx'

/**
 * Presentational bottom tab bar for `AppShell` — supports premium BuildMart tab styling.
 * @param {{ items: { id: string, to: string, end?: boolean, label: string, icon: import('lucide-react').LucideIcon, premium?: boolean }[] }} props
 */
export function AppBottomNav({ items }) {
  const reduce = useReducedMotion()

  return (
    <nav
      className="pointer-events-auto fixed bottom-0 left-1/2 z-30 flex w-full max-w-[430px] -translate-x-1/2 justify-center bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Bottom navigation"
    >
      <div className="flex h-[68px] w-full max-w-[430px] items-center justify-around px-2 overflow-visible">
        {items.map(({ id, to, end, label, icon: Icon, premium, badge }) => (
          <NavLink
            key={`${id}-${to}`}
            to={to}
            end={Boolean(end)}
            className={`flex min-w-0 flex-col items-center justify-center rounded-xl outline-none transition ${
              premium ? 'relative -mt-2.5 flex-[1.15]' : 'flex-1 py-1'
            }`}
          >
            {({ isActive }) =>
              premium ? (
                <>
                  <motion.span
                    className="relative flex items-center justify-center"
                    animate={
                      reduce
                        ? undefined
                        : isActive
                          ? { scale: [1, 1.06, 1], y: [0, -2, 0] }
                          : { scale: 1, y: 0 }
                    }
                    transition={
                      isActive
                        ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
                        : { type: 'spring', stiffness: 400, damping: 28 }
                    }
                  >
                    {isActive && !reduce ? (
                      <motion.span
                        layoutId="app-tab-premium-highlight"
                        className="absolute -inset-1 rounded-2xl buildmart-gradient buildmart-glow ring-2 ring-orange-300/40"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    ) : null}
                    {isActive && reduce ? (
                      <span className="absolute -inset-1 rounded-2xl buildmart-gradient ring-2 ring-orange-300/40" />
                    ) : null}
                    {!isActive ? (
                      <span className="absolute -inset-0.5 rounded-2xl bg-white ring-1 ring-orange-200/80 shadow-md" />
                    ) : null}
                    <span
                      className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-xl ${
                        isActive ? 'text-white' : 'text-bm-terracotta'
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px]" aria-hidden />
                    </span>
                  </motion.span>
                  <span
                    className={`mt-0.5 truncate px-0.5 text-[9px] font-black tracking-wide ${
                      isActive ? 'text-bm-terracotta' : 'text-slate-500'
                    }`}
                  >
                    {label}
                  </span>
                </>
              ) : (
                <div className={`relative flex flex-col items-center justify-center w-full py-1 px-1 text-center z-10 rounded-2xl group ${isActive ? '-mt-5' : 'opacity-50 hover:opacity-100'}`}>
                  {isActive && !reduce ? (
                    <motion.div
                      layoutId="app-tab-pill-bg"
                      className="absolute inset-0 rounded-[18px] bg-transparent border-transparent shadow-none"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  ) : null}
                  <div className="relative inline-flex items-center justify-center">
                    {isActive ? (
                      <div className="h-12 w-12 rounded-full bg-[#FFC107] text-black shadow-[0_6px_16px_rgba(255,193,7,0.4)] flex items-center justify-center mb-1 transition-transform group-active:scale-95">
                        <Icon className="h-5 w-5" aria-hidden />
                      </div>
                    ) : (
                      <div className="h-10 w-10 flex items-center justify-center mb-0.5">
                        <Icon className="h-6 w-6 text-slate-600" aria-hidden />
                      </div>
                    )}
                    {badge ? (
                      <span className={`absolute ${isActive ? '-top-1 right-0' : '-top-1 -right-1'} flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-black text-white ring-2 ring-white z-20 shadow-sm`}>
                        {badge}
                      </span>
                    ) : null}
                  </div>
                  <span
                    className={`relative z-10 truncate px-0.5 text-[10px] tracking-wide transition-colors duration-255 ${
                      isActive ? 'font-extrabold text-slate-900' : 'font-bold text-slate-600'
                    }`}
                  >
                    {label}
                  </span>
                </div>
              )
            }
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
