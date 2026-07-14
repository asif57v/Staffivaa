import { NavLink } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * Presentational bottom tab bar for `AppShell` — supports premium BuildMart tab styling.
 * @param {{ items: { id: string, to: string, end?: boolean, label: string, icon: import('lucide-react').LucideIcon, premium?: boolean }[] }} props
 */
export function AppBottomNav({ items }) {
  const reduce = useReducedMotion()

  return (
    <nav
      className="pointer-events-auto fixed bottom-0 left-1/2 z-30 flex w-full max-w-[430px] -translate-x-1/2 justify-center bg-white border-t border-[#ECECEC] rounded-t-[20px] shadow-[0_-4px_24px_rgba(0,0,0,0.04)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Bottom navigation"
    >
      <div className="flex h-[60px] w-full max-w-[430px] items-center justify-around px-4 overflow-visible">
        {items.map(({ id, to, end, label, icon: Icon, premium, badge }) => (
          <NavLink
            key={`${id}-${to}`}
            to={to}
            end={Boolean(end)}
            className={`flex min-w-0 flex-col items-center justify-center outline-none transition-all ${
              premium ? 'relative -mt-2.5 flex-[1.15]' : 'flex-1 h-full'
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
                      isActive ? 'text-bm-terracotta' : 'text-[#98A2B3]'
                    }`}
                  >
                    {label}
                  </span>
                </>
              ) : (
                <div className="relative flex flex-col items-center justify-center w-full h-full text-center z-10 group pt-1">
                  <div className="relative flex items-center justify-center h-[32px] w-[32px]">
                    <div 
                       className={`absolute inset-0 rounded-full bg-[#FFC107] shadow-[0_2px_8px_rgba(255,193,7,0.25)] transition-all duration-[250ms] ease-in-out origin-center ${isActive ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}
                    />
                    
                    <div className={`relative z-10 flex items-center justify-center transition-transform duration-[250ms] ease-in-out ${isActive ? 'scale-[1.08]' : 'scale-100'}`}>
                      <Icon 
                        size={20} 
                        color={isActive ? "#000000" : "#98A2B3"} 
                        strokeWidth={isActive ? 1.5 : 1.5}
                        className="transition-colors duration-[250ms] ease-in-out" 
                        aria-hidden 
                      />
                    </div>

                    {badge ? (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white ring-2 ring-white z-20 shadow-sm">
                        {badge}
                      </span>
                    ) : null}
                  </div>

                  <span
                    className={`mt-1 truncate px-0.5 text-[10px] transition-colors duration-[250ms] ease-in-out ${
                      isActive ? 'font-bold text-[#000000]' : 'font-medium text-[#98A2B3]'
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
