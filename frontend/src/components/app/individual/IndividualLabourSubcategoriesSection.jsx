import { useState, useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Loader2, Wrench, ArrowRight } from 'lucide-react'
import { GlassPanel } from '../../ui/GlassPanel.jsx'

function getCategoryImage(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('ac')) return '/3d_icon_ac.png';
  if (n.includes('electric')) return '/3d_icon_electrician.png';
  if (n.includes('plumb')) return '/3d_icon_plumber.png';
  if (n.includes('2-wheeler') || n.includes('bike')) return '/3d_icon_mechanic_2w.png';
  if (n.includes('4-wheeler') || n.includes('car')) return '/3d_icon_mechanic_4w.png';
  if (n.includes('mechanic')) return '/3d_icon_tools.png';
  if (n.includes('glass')) return '/3d_icon_glass.png';
  if (n.includes('interior') || n.includes('design')) return '/3d_icon_interior_designer.png';
  if (n.includes('cook') || n.includes('chef')) return '/3d_icon_cook.png';
  if (n.includes('mason') || n.includes('construct')) return '/3d_icon_worker.png';
  if (n.includes('paint')) return '/3d_icon_painter.png';
  if (n.includes('jcb') || n.includes('crane') || n.includes('heavy') || n.includes('operator')) return '/3d_icon_jcb.png';
  if (n.includes('garden') || n.includes('mali')) return '/3d_icon_garden.png';
  if (n.includes('housekeep') || n.includes('clean') || n.includes('office')) return '/3d_icon_cleaning.png';
  if (n.includes('general') || n.includes('labor') || n.includes('helper') || n.includes('tile')) return '/3d_icon_general_labor.png';
  return '/3d_icon_tools.png';
}

export function IndividualLabourSubcategoriesSection({ subcategories, loading, onSelect, onQuickBook, onViewAll }) {
  const reduce = useReducedMotion()

  const [cols, setCols] = useState(3)
  const [isExpanded, setIsExpanded] = useState(false)
  const gridRef = useRef(null)

  useEffect(() => {
    if (!gridRef.current) return
    
    const updateCols = () => {
      if (gridRef.current) {
        const computed = window.getComputedStyle(gridRef.current)
        const columnsStr = computed.getPropertyValue('grid-template-columns') || ''
        
        let colsCount = 3
        if (columnsStr.includes('repeat')) {
          const match = columnsStr.match(/repeat\(\s*(\d+)/)
          if (match) {
            colsCount = parseInt(match[1], 10)
          }
        } else if (columnsStr) {
          colsCount = columnsStr.split(' ').filter(Boolean).length
        }

        if (colsCount >= 3 && colsCount <= 6) {
          setCols(colsCount)
        }
      }
    }

    const observer = new ResizeObserver(updateCols)
    observer.observe(gridRef.current)
    
    updateCols()

    return () => observer.disconnect()
  }, [])

  const targetRows = isExpanded ? 6 : 3
  const maxSlots = cols * targetRows
  const needsViewAll = subcategories.length > maxSlots
  const visibleCategories = needsViewAll
    ? subcategories.slice(0, maxSlots - 1)
    : subcategories

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
      className="space-y-3"
      aria-labelledby="home-subcategories-heading"
    >
      <motion.div layout className="px-0.5">
        <h3 id="home-subcategories-heading" className="text-xl font-semibold tracking-normal text-slate-900">
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
        <div ref={gridRef} className="grid grid-cols-3 min-[480px]:grid-cols-4 md:grid-cols-5 gap-x-1.5 gap-y-1.5 md:gap-x-3 md:gap-y-2">
          {visibleCategories.map((cat, idx) => {
            const imgSrc = getCategoryImage(cat.name)

            const inner = (
              <>
                <span className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200/60 transition duration-300 group-hover:scale-105`}>
                  <img src={imgSrc} alt={cat.name} className="h-full w-full object-cover" loading="lazy" />
                </span>
                <span className="line-clamp-2 mt-1 h-[2.2rem] w-full overflow-hidden text-center text-[12px] font-semibold leading-snug text-slate-800 break-words">
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
                  className="group flex w-full flex-col items-center gap-1 rounded-2xl border border-transparent bg-transparent py-0.5 transition active:scale-[0.98]"
                >
                  {inner}
                </button>
              </motion.div>
            )
          })}

          {needsViewAll && (
            <motion.div
              key="view-all-btn"
              initial={reduce ? false : { opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.28, delay: Math.min((maxSlots - 1) * 0.02, 0.2) }}
            >
              <button
                type="button"
                onClick={() => {
                  if (!isExpanded) {
                    setIsExpanded(true)
                  } else {
                    if (onViewAll) onViewAll()
                  }
                }}
                className="group flex w-full flex-col items-center gap-1 rounded-2xl border border-transparent bg-transparent py-0.5 transition active:scale-[0.98]"
              >
                <span className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/60 transition duration-300 group-hover:scale-105">
                   <div className="h-[2.75rem] w-[2.75rem] rounded-full bg-[#FFC107] flex items-center justify-center text-white shadow-[0_2px_10px_-2px_rgba(0,0,0,0.12)]">
                      <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
                   </div>
                </span>
                <span className="line-clamp-2 mt-1 h-[2.2rem] w-full overflow-hidden text-center text-[12px] font-semibold leading-snug text-slate-800 break-words">
                  View All<br />Categories
                </span>
              </button>
            </motion.div>
          )}
        </div>
      ) : null}
    </motion.section>
  )
}
