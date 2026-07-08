import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ChevronRight,
  FolderTree,
  Layers,
  Plus,
  Sparkles,
  Tag,
  X,
  Edit2,
  Trash2,
} from 'lucide-react'
import {
  fetchAdminLabourCategoryTree,
  createAdminLabourCategory,
  patchAdminLabourCategory,
  deleteAdminLabourCategory,
} from '../../api/adminLabourCategoriesApi.js'
import { ApiError } from '../../api/http.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { AdminSubcategoryImageEditor } from '../../components/admin/AdminSubcategoryImageEditor.jsx'
import { getCategoryImageUrl } from '../../lib/labourCategoryDisplay.js'

function CategoryModal({ groupLabel, initialName = '', isEdit = false, onClose, onSubmit, busy, error, reduceMotion }) {
  const inputRef = useRef(null)

  const [name, setName] = useState(initialName)

  useEffect(() => {
    setName(initialName)
    const t = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(t)
  }, [initialName])

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit(name.trim())
  }

  return (
    <motion.div
        initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={() => !busy && onClose()}
      />
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        className="relative z-10 w-full max-w-md"
      >
        <GlassPanel className="overflow-hidden p-0 shadow-2xl ring-1 ring-slate-200/80">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-linear-to-br from-emerald-50/90 to-white px-5 py-4">
            <div className="min-w-0">
              <p id="add-cat-title" className="text-lg font-extrabold text-slate-900">
                {isEdit ? 'Edit subcategory' : 'Add subcategory'}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <Layers className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                <span className="truncate">Under: {groupLabel}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => !busy && onClose()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 transition hover:bg-slate-50"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="px-5 py-5">
            {error ? (
              <p className="mb-4 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-950">{error}</p>
            ) : null}
            <label htmlFor="modal-cat-name" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Subcategory name
            </label>
            <input
              ref={inputRef}
              id="modal-cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tower crane operator"
              className="w-full rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm outline-none ring-slate-200/80 focus:ring-2 focus:ring-brand/35"
            />
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              Workers pick this under the main category you selected. You can hide it anytime from the list.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => !busy && onClose()}
                className="rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <AppPrimaryButton type="submit" disabled={busy || !name.trim()} className="!w-auto min-w-[140px]">
                {busy ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create')}
              </AppPrimaryButton>
            </div>
          </form>
        </GlassPanel>
      </motion.div>
    </motion.div>
  )
}

export function AdminLabourCategoriesPage() {
  const reduceMotion = useReducedMotion()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [banner, setBanner] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalBusy, setModalBusy] = useState(false)
  const [modalError, setModalError] = useState('')
  const [editingCategory, setEditingCategory] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setBanner('')
    try {
      const res = await fetchAdminLabourCategoryTree()
      const list = res.data?.groups ?? []
      setGroups(list)
    } catch (e) {
      setBanner(e instanceof ApiError ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => load())
  }, [load])

  useEffect(() => {
    if (!groups.length) {
      setSelectedGroupId('')
      return
    }
    setSelectedGroupId((prev) => {
      if (prev && groups.some((g) => String(g._id) === prev)) return prev
      return String(groups[0]._id)
    })
  }, [groups])

  useEffect(() => {
    if (!modalOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [modalOpen])

  useEffect(() => {
    if (!modalOpen) return
    function onKey(e) {
      if (e.key === 'Escape' && !modalBusy) setModalOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [modalOpen, modalBusy])

  const selectedGroup = groups.find((g) => String(g._id) === selectedGroupId)
  const subcategories = selectedGroup?.categories ?? []
  const totalCategories = groups.reduce((n, g) => n + (g.categories?.length ?? 0), 0)

  async function toggleCategory(c, nextActive) {
    setBanner('')
    try {
      await patchAdminLabourCategory(c._id, { isActive: nextActive })
      await load()
    } catch (e) {
      setBanner(e instanceof ApiError ? e.message : 'Update failed')
    }
  }

  async function handleModalSubmit(name) {
    if (!name) {
      setModalError('Enter a name')
      return
    }
    setModalError('')
    setModalBusy(true)
    try {
      if (editingCategory) {
        await patchAdminLabourCategory(editingCategory._id, { name })
      } else {
        if (!selectedGroupId) {
          setModalError('No group selected')
          setModalBusy(false)
          return
        }
        await createAdminLabourCategory({
          groupId: selectedGroupId,
          name,
          sortOrder: 999,
        })
      }
      setModalOpen(false)
      setEditingCategory(null)
      await load()
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Could not save')
    } finally {
      setModalBusy(false)
    }
  }

  function openModal(category = null) {
    setModalError('')
    setEditingCategory(category)
    setModalOpen(true)
  }

  async function handleDelete(c) {
    if (!window.confirm(`Are you sure you want to delete the subcategory "${c.name}"?`)) return
    setBanner('')
    try {
      await deleteAdminLabourCategory(c._id)
      await load()
    } catch (e) {
      setBanner(e instanceof ApiError ? e.message : 'Delete failed')
    }
  }

  const groupLabel = selectedGroup ? `${selectedGroup.name} (${selectedGroup.kind})` : ''

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Skill categories</h2>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            Choose a <span className="font-semibold text-slate-800">main category</span> on the left, then manage{' '}
            <span className="font-semibold text-slate-800">subcategories</span> on the right. Only active subcategories
            appear in the worker app.
          </p>
        </div>
        {!loading ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm ring-1 ring-slate-200/80">
            <Sparkles className="h-3.5 w-3.5 text-brand" aria-hidden />
            {groups.length} main · {totalCategories} sub
          </span>
        ) : null}
      </div>

      {banner ? (
        <p className="rounded-xl border border-amber-200/80 bg-amber-50/95 px-4 py-3 text-sm font-medium text-amber-950">{banner}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(260px,300px)_1fr] lg:items-stretch">
        <GlassPanel className="flex max-h-[min(70dvh,520px)] flex-col overflow-hidden p-0 lg:max-h-[calc(100dvh-12rem)] lg:sticky lg:top-0">
          <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <FolderTree className="h-4 w-4 text-brand" aria-hidden />
              Main categories
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-200/60" />
                ))}
              </div>
            ) : (
              <ul className="space-y-1">
                {groups.map((g) => {
                  const id = String(g._id)
                  const count = g.categories?.length ?? 0
                  const active = selectedGroupId === id
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => setSelectedGroupId(id)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                          active
                            ? 'bg-linear-to-r from-brand/12 to-brand-muted/50 ring-1 ring-brand/25 shadow-sm'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${
                            active ? 'bg-white text-brand ring-brand/20' : 'bg-slate-100 text-slate-500 ring-slate-200/80'
                          }`}
                        >
                          <Layers className="h-5 w-5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-slate-900">{g.name}</span>
                          <span className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-slate-600">
                              {g.kind}
                            </span>
                            <span className="tabular-nums">{count} sub</span>
                          </span>
                        </span>
                        <ChevronRight className={`h-4 w-4 shrink-0 ${active ? 'text-brand' : 'text-slate-300'}`} aria-hidden />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </GlassPanel>

        <GlassPanel className="flex min-h-[min(60dvh,420px)] flex-col overflow-hidden p-0 lg:min-h-[calc(100dvh-12rem)]">
          {loading ? (
            <div className="flex flex-1 flex-col gap-3 p-5">
              <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200/70" />
              <div className="h-10 flex-1 animate-pulse rounded-xl bg-slate-100/80" />
            </div>
          ) : selectedGroup ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-linear-to-br from-white to-emerald-50/30 px-4 py-4 sm:px-5">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <Tag className="h-4 w-4 text-brand" aria-hidden />
                    Subcategories
                  </p>
                  <h3 className="mt-1 text-lg font-extrabold text-slate-900">{selectedGroup.name}</h3>
                  {selectedGroup.description ? (
                    <p className="mt-1 max-w-2xl text-sm text-slate-600">{selectedGroup.description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => openModal()}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-linear-to-r from-brand-bright to-brand px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_28px_-10px_rgba(255,179,71,0.45)] transition hover:brightness-105"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add subcategory
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {subcategories.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 ring-1 ring-slate-200/80">
                      <Tag className="h-8 w-8" aria-hidden />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">No subcategories yet</p>
                      <p className="mt-1 max-w-sm text-sm text-slate-500">
                        Add roles or job types workers can select under this main category.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openModal()}
                      className="inline-flex items-center gap-2 rounded-xl border border-brand/30 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-brand transition hover:bg-emerald-100/80"
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                      Add first subcategory
                    </button>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {subcategories.map((c) => (
                      <li key={c._id} className="space-y-3 px-4 py-4 sm:px-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <img
                              src={getCategoryImageUrl(c)}
                              alt=""
                              className="h-14 w-14 shrink-0 rounded-xl object-cover ring-2 ring-slate-200/90"
                            />
                            <div>
                              <p className="font-semibold text-slate-900">{c.name}</p>
                              <p className="mt-0.5 font-mono text-[11px] text-slate-400">{c.slug}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openModal(c)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-slate-200/80 hover:text-brand"
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(c)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-500 transition hover:bg-rose-100 hover:text-rose-600"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleCategory(c, !c.isActive)}
                              className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                                c.isActive
                                  ? 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80'
                                  : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200/80'
                              }`}
                            >
                              {c.isActive ? 'Active' : 'Hidden'}
                            </button>
                          </div>
                        </div>
                        <AdminSubcategoryImageEditor category={c} onUpdated={load} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-500">Select a main category.</div>
          )}

          <p className="border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-center text-[11px] text-slate-500 sm:px-5">
            Reset:{' '}
            <code className="rounded bg-slate-200/80 px-1 py-0.5 font-mono text-[10px]">npm run seed:categories</code> in API
          </p>
        </GlassPanel>
      </div>

      <AnimatePresence>
        {modalOpen ? (
          <CategoryModal
            key="category-modal"
            groupLabel={groupLabel}
            initialName={editingCategory ? editingCategory.name : ''}
            isEdit={!!editingCategory}
            onClose={() => {
              if (!modalBusy) {
                setModalOpen(false)
                setEditingCategory(null)
              }
            }}
            onSubmit={handleModalSubmit}
            busy={modalBusy}
            error={modalError}
            reduceMotion={reduceMotion}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}
