import { motion, useReducedMotion } from 'framer-motion'
import { BUILDMART_CATEGORIES } from '../../data/buildmartCatalog.js'

export function BuildMartCategoryScroll({ activeId, onSelect }) {
  const reduce = useReducedMotion()

  return (
    <section aria-label="Material categories">
      <motion.div
        className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
      >
        <button
          type="button"
          onClick={() => onSelect('')}
          className={`flex shrink-0 snap-start flex-col items-center gap-1.5 rounded-2xl px-1 py-1 transition active:scale-95 ${
            !activeId ? 'opacity-100' : 'opacity-80'
          }`}
        >
          <span
            className={`flex h-14 w-14 items-center justify-center rounded-2xl text-xs font-black ring-2 transition ${
              !activeId
                ? 'buildmart-gradient text-white ring-orange-300/50 buildmart-glow scale-105'
                : 'bg-white text-slate-700 ring-slate-200/90 shadow-sm'
            }`}
          >
            All
          </span>
          <span className={`text-[10px] font-bold ${!activeId ? 'text-bm-terracotta' : 'text-slate-500'}`}>
            All
          </span>
        </button>

        {BUILDMART_CATEGORIES.map((cat, i) => {
          const Icon = cat.icon
          const active = activeId === cat.id
          return (
            <motion.button
              key={cat.id}
              type="button"
              onClick={() => onSelect(cat.id)}
              className="flex shrink-0 snap-start flex-col items-center gap-1.5 rounded-2xl px-1 py-1"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i, duration: 0.3 }}
              whileTap={reduce ? undefined : { scale: 0.94 }}
            >
              <span
                className={`flex h-14 w-14 items-center justify-center rounded-2xl ring-2 transition-all duration-300 ${
                  active
                    ? 'buildmart-gradient text-white ring-orange-300/60 buildmart-glow scale-105'
                    : `${cat.tone} shadow-sm ring-transparent`
                }`}
              >
                <Icon className="h-6 w-6" aria-hidden />
              </span>
              <span
                className={`max-w-[4.5rem] truncate text-[10px] font-bold ${
                  active ? 'text-bm-terracotta' : 'text-slate-600'
                }`}
              >
                {cat.label}
              </span>
            </motion.button>
          )
        })}
      </motion.div>
    </section>
  )
}
