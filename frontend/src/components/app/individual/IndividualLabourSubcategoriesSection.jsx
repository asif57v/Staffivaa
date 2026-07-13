import { motion, useReducedMotion } from 'framer-motion'
import { Loader2, Wrench } from 'lucide-react'
import { GlassPanel } from '../../ui/GlassPanel.jsx'

function getCategoryImage(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('ac')) return '/3d_icon_ac.png';
  if (n.includes('electric') || n.includes('plumb') || n.includes('mechanic') || n.includes('car') || n.includes('bike')) return '/3d_icon_tools.png';
  if (n.includes('mason') || n.includes('construct') || n.includes('labor') || n.includes('helper') || n.includes('glass') || n.includes('tile')) return '/3d_icon_worker.png';
  if (n.includes('paint') || n.includes('interior')) return '/3d_icon_painter.png';
  if (n.includes('jcb') || n.includes('crane') || n.includes('heavy') || n.includes('operator')) return '/3d_icon_jcb.png';
  if (n.includes('cook') || n.includes('chef')) return '/3d_icon_cook.png';
  if (n.includes('garden') || n.includes('mali')) return '/3d_icon_garden.png';
  if (n.includes('help') || n.includes('housekeep') || n.includes('clean')) return '/3d_icon_cleaning.png';
  return '/3d_icon_tools.png';
}

export function IndividualLabourSubcategoriesSection({ subcategories, loading, onSelect, onQuickBook }) {
  const reduce = useReducedMotion()

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
      className="space-y-3"
      aria-labelledby="home-subcategories-heading"
    >
      <motion.div layout className="px-0.5">
        <h3 id="home-subcategories-heading" className="text-base font-bold tracking-tight text-slate-900">
          Book by skill
        </h3>
        <p className="mt-0.5 text-[11px] font-medium text-slate-500">Tap for instant or scheduled booking</p>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#A5B4FC]">
          <Loader2 className="h-5 w-5 animate-spin text-[#0f172a]" aria-hidden />
          Loading skills…
        </div>
      ) : null}

      {!loading && subcategories.length === 0 ? (
        <GlassPanel className="border-dashed border-[#e2e8f0] bg-white p-6 text-center">
          <Wrench className="mx-auto h-8 w-8 text-[#A5B4FC]" aria-hidden />
          <p className="mt-2 text-sm font-medium text-[#3730A3]">Skills catalogue loading soon</p>
        </GlassPanel>
      ) : null}

      {!loading && subcategories.length > 0 ? (
        <div className="-mx-1 grid grid-cols-3 gap-x-2 gap-y-4 min-[380px]:grid-cols-4 md:gap-3">
          {subcategories.slice(0, 16).map((cat, idx) => {
            const imgSrc = getCategoryImage(cat.name)

            const inner = (
              <>
                <span className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200/60 transition duration-300 group-hover:scale-105`}>
                  <img src={imgSrc} alt={cat.name} className="h-full w-full object-cover" loading="lazy" />
                </span>
                <span className="line-clamp-2 mt-1 min-h-[2.25rem] w-full text-center text-[10px] font-medium leading-tight text-slate-800 break-words">
                  {cat.name}
                </span>
              </>
            )

            return (
              <motion.div
                key={String(cat._id)}
                initial={reduce ? false : { opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.28, delay: Math.min(idx * 0.02, 0.2) }}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelect?.(cat)
                    onQuickBook?.(cat)
                  }}
                  className="group flex w-full flex-col items-center gap-1.5 rounded-2xl border border-transparent bg-transparent p-1 transition active:scale-[0.98]"
                >
                  {inner}
                </button>
              </motion.div>
            )
          })}
        </div>
      ) : null}
    </motion.section>
  )
}
