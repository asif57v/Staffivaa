import { motion, useReducedMotion } from 'framer-motion'
import { formatBuildMartPrice } from '../../data/buildmartCatalog.js'

export function BuildMartVariantPicker({ variants, selectedId, onSelect }) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      className="flex flex-wrap gap-2"
      role="listbox"
      aria-label="Product variants"
      layout
    >
      {variants.map((v) => {
        const active = selectedId === v.id
        return (
          <motion.button
            key={v.id}
            type="button"
            role="option"
            aria-selected={active}
            onClick={() => onSelect(v.id)}
            className={`relative overflow-hidden rounded-2xl border px-4 py-3 text-left transition ${
              active
                ? 'border-orange-400 bg-gradient-to-br from-orange-50 to-amber-50 shadow-md ring-2 ring-orange-300/50'
                : 'border-slate-200/90 bg-white hover:border-orange-200'
            }`}
            whileTap={reduce ? undefined : { scale: 0.97 }}
            layout
          >
            {active && !reduce ? (
              <motion.span
                layoutId="bm-variant-glow"
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-orange-400/10 to-transparent"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            ) : null}
            <span className="relative block text-sm font-extrabold text-slate-900">{v.label}</span>
            <span className="relative mt-0.5 block text-xs font-bold text-bm-terracotta">
              {formatBuildMartPrice(v.retailPrice, v.unit)}
            </span>
          </motion.button>
        )
      })}
    </motion.div>
  )
}
