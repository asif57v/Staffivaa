import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Briefcase, ChevronRight, HardHat, Hammer, LayoutGrid, Loader2, PaintRoller, Sparkles, Wrench, X } from 'lucide-react'
import { AppBottomSheetBackdrop } from '../../app-ui/feedback/AppBottomSheet.jsx'
import { getCategoryImageUrl } from '../../../lib/labourCategoryDisplay.js'
import { buildBookingFlowPath } from '../../../lib/bookingFlowNavigation.js'
import { readBookingDraft, writeBookingDraft } from '../../../lib/individualBookingDraft.js'
import { getLenisInstance } from '../../../lib/lenisController.js'

const GROUP_ICONS = [HardHat, Wrench, PaintRoller, Hammer, Sparkles]

/**
 * Lightweight category picker — main group + subcategory only (no location).
 */
export function CategoryPickBottomSheet({ open, onClose, tradeGroups = [], groupsLoading = false }) {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const [groupId, setGroupId] = useState(null)
  const [categoryId, setCategoryId] = useState(null)

  // Lock background page + Lenis while bottom sheet is open
  useEffect(() => {
    if (!open) return

    const html = document.documentElement
    const body = document.body
    const scrollY = window.scrollY || window.pageYOffset || 0

    const prev = {
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyOverscroll: body.style.overscrollBehavior,
    }

    html.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    body.style.overflow = 'hidden'
    body.style.overscrollBehavior = 'none'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'

    const lenis = getLenisInstance()
    lenis?.stop?.()

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      html.style.overflow = prev.htmlOverflow
      html.style.overscrollBehavior = prev.htmlOverscroll
      body.style.overflow = prev.bodyOverflow
      body.style.position = prev.bodyPosition
      body.style.top = prev.bodyTop
      body.style.left = prev.bodyLeft
      body.style.right = prev.bodyRight
      body.style.width = prev.bodyWidth
      body.style.overscrollBehavior = prev.bodyOverscroll

      lenis?.start?.()
      window.scrollTo(0, scrollY)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  const selectedGroup = useMemo(() => {
    if (!groupId) return null
    return tradeGroups.find((g) => String(g._id) === groupId) ?? null
  }, [tradeGroups, groupId])

  useEffect(() => {
    if (!open) return
    const draft = readBookingDraft()
    queueMicrotask(() => {
      setGroupId(draft?.groupId ? String(draft.groupId) : null)
      setCategoryId(draft?.categoryId ? String(draft.categoryId) : null)
    })
  }, [open])

  const pickGroup = (gid) => {
    const next = gid == null ? null : String(gid)
    setGroupId(next)
    setCategoryId(null)
  }

  const pickCategory = (cat, parentGroup) => {
    const cid = String(cat._id)
    const active = categoryId === cid
    setCategoryId(active ? null : cid)
    if (!active) {
      const targetGid = parentGroup ? String(parentGroup._id) : String(cat.groupId || groupId || '')
      if (targetGid) setGroupId(targetGid)
    }
  }

  const continueToBooking = useCallback(() => {
    if (!categoryId) return
    let cat = null
    let group = selectedGroup
    if (group) {
      cat = (group.categories || []).find((c) => String(c._id) === categoryId)
    } else {
      for (const g of tradeGroups) {
        const found = (g.categories || []).find((c) => String(c._id) === categoryId)
        if (found) {
          cat = found
          group = g
          break
        }
      }
    }
    if (!cat || !group) return

    const prev = readBookingDraft() || {}
    writeBookingDraft({
      ...prev,
      entryPoint: 'search',
      groupId: String(group._id),
      groupName: group.name,
      categoryId,
      categoryName: cat?.name || '',
      matchMode: 'smart',
      selectedWorkers: [],
    })
    navigate(
      buildBookingFlowPath('type', {
        categoryId,
        groupId: String(group._id),
      }),
    )
    onClose?.()
  }, [categoryId, navigate, onClose, selectedGroup, tradeGroups])

  const sheet = (
    <AnimatePresence>
      {open ? (
        <div
          key="category-pick-container"
          className="fixed inset-0 z-[200] flex items-end justify-center overflow-hidden overscroll-none sm:items-center sm:p-4"
          role="presentation"
          data-lenis-prevent
          data-lenis-prevent-touch
          onTouchMove={(e) => {
            // Keep page behind locked; allow scroll only inside designated modal scroll areas
            const target = e.target
            if (!(target instanceof Element)) {
              if (e.cancelable) e.preventDefault()
              return
            }
            const inModalScroll = target.closest('[data-modal-scroll]')
            if (!inModalScroll && e.cancelable) e.preventDefault()
          }}
        >
          <AppBottomSheetBackdrop onClose={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-pick-title"
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 flex h-[85dvh] max-h-[720px] w-full max-w-md flex-col overflow-hidden rounded-t-[1.75rem] border border-slate-200/90 bg-white shadow-2xl sm:h-[80vh] sm:rounded-3xl"
            initial={reduce ? false : { y: '100%' }}
            animate={{ y: 0 }}
            exit={reduce ? undefined : { y: '100%' }}
            transition={reduce ? { duration: 0.2 } : { type: 'spring', damping: 28, stiffness: 300 }}
          >
            {/* Header — non-scrolling */}
            <div className="border-b border-slate-100 px-4 pb-3 pt-2.5 shrink-0 bg-white">
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 id="category-pick-title" className="text-base font-black tracking-tight text-slate-900">
                    What work do you need?
                  </h2>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">Pick a trade — then continue to book</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onClose?.()
                  }}
                  className="shrink-0 flex items-center justify-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition active:scale-90 cursor-pointer touch-manipulation z-20"
                  aria-label="Close"
                >
                  Close
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </div>

            {/* Scrollable Content Body — only vertical scroll container */}
            <div
              data-modal-scroll="vertical"
              data-lenis-prevent
              data-lenis-prevent-touch
              className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-3 space-y-4 [-webkit-overflow-scrolling:touch]"
            >
              {/* Main Categories Row — dedicated horizontal scroll */}
              <div className="shrink-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Main category</p>
                <div
                  data-modal-scroll="horizontal"
                  className="-mx-4 px-4 overflow-x-auto pb-2 scrollbar-none [-webkit-overflow-scrolling:touch] touch-pan-y touch-pan-x"
                >
                  <div className="flex w-max gap-2.5">
                    <button
                      type="button"
                      onClick={() => pickGroup(null)}
                      className={`flex min-w-[4.75rem] shrink-0 flex-col items-center gap-1.5 rounded-2xl border px-3 py-2.5 transition active:scale-95 cursor-pointer touch-manipulation ${
                        groupId == null
                          ? 'border-brand/60 bg-amber-50/70 ring-2 ring-brand/30 shadow-sm'
                          : 'border-slate-200/90 bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80 text-brand">
                        <LayoutGrid className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="text-center text-[10.5px] font-bold text-slate-800">All</span>
                    </button>
                    {tradeGroups.map((g, idx) => {
                      const gid = String(g._id)
                      const active = groupId === gid
                      const Icon = GROUP_ICONS[idx % GROUP_ICONS.length]
                      return (
                        <button
                          key={gid}
                          type="button"
                          onClick={() => pickGroup(gid)}
                          className={`flex min-w-[5.25rem] max-w-[6.75rem] shrink-0 flex-col items-center gap-1.5 rounded-2xl border px-2.5 py-2.5 transition active:scale-95 cursor-pointer touch-manipulation ${
                            active
                              ? 'border-brand/60 bg-amber-50/70 ring-2 ring-brand/30 shadow-sm'
                              : 'border-slate-200/90 bg-slate-50 hover:bg-slate-100'
                          }`}
                        >
                          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80 text-brand">
                            <Icon className="h-5 w-5" aria-hidden />
                          </span>
                          <span className="w-full text-center text-[10.5px] font-bold leading-tight text-slate-800 line-clamp-2">
                            {g.name}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {groupsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-brand" aria-hidden />
                </div>
              ) : null}

              {/* Subcategories */}
              {selectedGroup ? (
                <section>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Sub category · {selectedGroup.name}
                  </p>
                  {(selectedGroup.categories || []).length > 0 ? (
                    <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {(selectedGroup.categories || []).map((c) => {
                        const cid = String(c._id)
                        const active = categoryId === cid
                        const img = getCategoryImageUrl(c)
                        return (
                          <button
                            key={cid}
                            type="button"
                            onClick={() => pickCategory(c, selectedGroup)}
                            className={`overflow-hidden rounded-2xl border text-left transition active:scale-[0.98] cursor-pointer touch-manipulation ${
                              active
                                ? 'border-brand ring-2 ring-brand/30 shadow-md bg-amber-50/20'
                                : 'border-slate-200/90 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="relative aspect-[4/3] bg-slate-100">
                              <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
                              <span className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-brand shadow-sm">
                                <Briefcase className="h-3.5 w-3.5" aria-hidden />
                              </span>
                            </div>
                            <div className="bg-white px-2.5 py-2">
                              <p className="line-clamp-2 text-[11px] font-bold leading-snug text-slate-900">{c.name}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="mt-4 text-center text-xs text-slate-400 py-6">No subcategories found in this trade.</p>
                  )}
                </section>
              ) : (
                /* All categories grouped */
                <div className="space-y-5">
                  {tradeGroups.map((g) => {
                    if (!g.categories?.length) return null
                    return (
                      <section key={g._id}>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          {g.name}
                        </p>
                        <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                          {g.categories.map((c) => {
                            const cid = String(c._id)
                            const active = categoryId === cid
                            const img = getCategoryImageUrl(c)
                            return (
                              <button
                                key={cid}
                                type="button"
                                onClick={() => pickCategory(c, g)}
                                className={`overflow-hidden rounded-2xl border text-left transition active:scale-[0.98] cursor-pointer touch-manipulation ${
                                  active
                                    ? 'border-brand ring-2 ring-brand/30 shadow-md bg-amber-50/20'
                                    : 'border-slate-200/90 bg-white hover:border-slate-300'
                                }`}
                              >
                                <div className="relative aspect-[4/3] bg-slate-100">
                                  <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
                                  <span className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-brand shadow-sm">
                                    <Briefcase className="h-3.5 w-3.5" aria-hidden />
                                  </span>
                                </div>
                                <div className="bg-white px-2.5 py-2">
                                  <p className="line-clamp-2 text-[11px] font-bold leading-snug text-slate-900">{c.name}</p>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </section>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Bottom Sticky Action Bar — non-scrolling within modal flex column */}
            <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3 pb-[max(1.25rem,env(safe-area-inset-bottom,1.25rem))] shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
              <button
                type="button"
                disabled={!categoryId}
                onClick={continueToBooking}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-brand to-emerald-600 py-3.5 text-sm font-black text-white shadow-lg shadow-brand/25 transition enabled:hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer active:scale-[0.99] touch-manipulation"
              >
                Continue to book
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )

  if (typeof document === 'undefined') return null
  return createPortal(sheet, document.body)
}
