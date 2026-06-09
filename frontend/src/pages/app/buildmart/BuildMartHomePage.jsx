import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Package, Search, Sparkles, TrendingUp } from 'lucide-react'
import { BuildMartHeroCarousel } from '../../../components/buildmart/BuildMartHeroCarousel.jsx'
import { BuildMartCategoryScroll } from '../../../components/buildmart/BuildMartCategoryScroll.jsx'
import { BuildMartProductCard } from '../../../components/buildmart/BuildMartProductCard.jsx'
import { AppListSkeleton } from '../../../components/app-ui/feedback/AppListSkeleton.jsx'
import { getBuildMartProductsByCategory } from '../../../data/buildmartCatalog.js'

export function BuildMartHomePage() {
  const reduce = useReducedMotion()
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryFromUrl = searchParams.get('category') || ''
  const [categoryId, setCategoryId] = useState(categoryFromUrl)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setCategoryId(categoryFromUrl)
  }, [categoryFromUrl])

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 420)
    return () => window.clearTimeout(t)
  }, [categoryId])

  const handleCategory = (id) => {
    setCategoryId(id)
    setLoading(true)
    if (id) setSearchParams({ category: id })
    else setSearchParams({})
    window.setTimeout(() => setLoading(false), 320)
  }

  const products = useMemo(() => {
    let list = getBuildMartProductsByCategory(categoryId)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.shortDescription.toLowerCase().includes(q),
      )
    }
    return list
  }, [categoryId, search])

  return (
    <div className="buildmart-gradient-soft -mx-4 min-h-[calc(100dvh-8rem)] px-4 pb-4">
      <motion.div
        className="relative -mt-2 overflow-hidden rounded-b-3xl buildmart-gradient px-4 pb-5 pt-1 text-white shadow-lg"
        initial={reduce ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.div
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl"
          animate={reduce ? undefined : { scale: [1, 1.2, 1] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <motion.div
          className="flex items-center gap-2"
          initial={reduce ? false : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30">
            <Package className="h-5 w-5" aria-hidden />
          </span>
          <motion.div
            animate={reduce ? undefined : { y: [0, -2, 0] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">Procurement</p>
            <h1 className="text-xl font-extrabold tracking-tight">BuildMart</h1>
          </motion.div>
        </motion.div>
        <p className="mt-2 text-sm font-medium text-white/88">
          Cement, steel, sand &amp; more — contractor-grade supply for your site.
        </p>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search materials, brands…"
            className="w-full rounded-2xl border-0 bg-white py-3 pl-10 pr-4 text-sm font-medium text-slate-900 shadow-lg outline-none ring-2 ring-white/0 focus:ring-orange-300/80"
          />
        </div>
      </motion.div>

      <motion.div className="mt-5 space-y-6">
        <BuildMartHeroCarousel />
        <BuildMartCategoryScroll activeId={categoryId} onSelect={handleCategory} />

        <section>
          <motion.div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold tracking-tight text-slate-900">Popular products</h2>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                Verified suppliers · quote before checkout
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-bold text-orange-900">
              <TrendingUp className="h-3 w-3" aria-hidden />
              Trending
            </span>
          </motion.div>

          {loading ? (
            <AppListSkeleton rows={3} />
          ) : products.length === 0 ? (
            <motion.div
              className="rounded-3xl border border-dashed border-orange-200 bg-white/80 p-8 text-center"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Sparkles className="mx-auto h-8 w-8 text-bm-orange" aria-hidden />
              <p className="mt-2 text-sm font-bold text-slate-800">No products match your search</p>
              <p className="mt-1 text-xs text-slate-500">Try another category or clear filters.</p>
            </motion.div>
          ) : (
            <div className="grid gap-4">
              {products.map((p, i) => (
                <BuildMartProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          )}
        </section>
      </motion.div>
    </div>
  )
}
