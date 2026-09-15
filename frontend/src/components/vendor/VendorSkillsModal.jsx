import React, { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Search,
  Check,
  Hammer,
  Layers,
  Sparkles,
  Plus,
  Loader2,
  Wrench
} from 'lucide-react'
import { useDispatch } from 'react-redux'
import toast from 'react-hot-toast'
import { fetchLabourCategoriesGrouped } from '../../api/labourCategoriesApi.js'
import { usePatchVendorMeMutation } from '../../store/api/workforceApi.js'
import { setUser } from '../../store/slices/authSlice.js'

export function VendorSkillsModal({
  isOpen,
  onClose,
  user,
  onSuccess
}) {
  const dispatch = useDispatch()
  const [patchVendorMe, { isLoading: saving }] = usePatchVendorMeMutation()

  const [groupedData, setGroupedData] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState(new Set())
  const [customSkills, setCustomSkills] = useState([])
  const [newSkillInput, setNewSkillInput] = useState('')
  const [error, setError] = useState('')

  // Map of categoryId -> categoryName for fast lookup
  const categoryIdToName = useMemo(() => {
    const map = new Map()
    for (const group of groupedData) {
      for (const cat of group.categories || []) {
        if (cat._id) {
          map.set(String(cat._id), cat.name)
        }
      }
    }
    return map
  }, [groupedData])

  // Map of categoryName -> categoryId for reverse lookup
  const categoryNameToId = useMemo(() => {
    const map = new Map()
    for (const group of groupedData) {
      for (const cat of group.categories || []) {
        if (cat._id && cat.name) {
          map.set(cat.name.trim().toLowerCase(), String(cat._id))
        }
      }
    }
    return map
  }, [groupedData])

  // Initialize selected skills and categories from user.contractorProfile
  useEffect(() => {
    if (isOpen && user) {
      setError('')
      setSearch('')
      setNewSkillInput('')

      const profile = user.contractorProfile || {}

      // Initial category IDs
      const rawCatIds = (profile.categoryIds || []).map((c) =>
        typeof c === 'object' && c._id ? String(c._id) : String(c)
      )
      const idSet = new Set(rawCatIds.filter(Boolean))

      // Match initial skill strings to category IDs if available
      const rawSkills = Array.isArray(profile.skills) ? profile.skills : []
      const remainingCustom = []

      for (const s of rawSkills) {
        const trimmed = String(s).trim()
        if (!trimmed) continue
        const matchedId = categoryNameToId.get(trimmed.toLowerCase())
        if (matchedId) {
          idSet.add(matchedId)
        } else {
          remainingCustom.push(trimmed)
        }
      }

      setSelectedCategoryIds(idSet)
      setCustomSkills(Array.from(new Set(remainingCustom)))
    }
  }, [isOpen, user, categoryNameToId])

  // Lock body scroll when modal is open to avoid background page shifting on mobile
  useEffect(() => {
    if (!isOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen])

  // Fetch all active categories from server
  useEffect(() => {
    if (!isOpen) return
    let isMounted = true
    setLoadingCategories(true)
    fetchLabourCategoriesGrouped()
      .then((res) => {
        if (!isMounted) return
        const groups = res.data?.groups || []
        setGroupedData(groups)
      })
      .catch((err) => {
        if (!isMounted) return
        setError(err.message || 'Failed to load trade catalogue')
      })
      .finally(() => {
        if (isMounted) setLoadingCategories(false)
      })
    return () => {
      isMounted = false
    }
  }, [isOpen])

  const toggleCategory = (catId) => {
    const strId = String(catId)
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev)
      if (next.has(strId)) {
        next.delete(strId)
      } else {
        next.add(strId)
      }
      return next
    })
  }

  const handleAddCustomSkill = (e) => {
    if (e) e.preventDefault()
    const trimmed = newSkillInput.trim()
    if (!trimmed) return

    // Check if it matches an existing category
    const matchedCatId = categoryNameToId.get(trimmed.toLowerCase())
    if (matchedCatId) {
      setSelectedCategoryIds((prev) => new Set([...prev, matchedCatId]))
      setNewSkillInput('')
      return
    }

    if (!customSkills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setCustomSkills((prev) => [...prev, trimmed])
    }
    setNewSkillInput('')
  }

  const removeCustomSkill = (skillToRemove) => {
    setCustomSkills((prev) => prev.filter((s) => s !== skillToRemove))
  }

  const handleClearAll = () => {
    setSelectedCategoryIds(new Set())
    setCustomSkills([])
  }

  // Filter groups and categories based on search
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groupedData
    const q = search.toLowerCase().trim()

    return groupedData
      .map((group) => {
        const matchesGroup = group.name?.toLowerCase().includes(q)
        const matchingCategories = (group.categories || []).filter(
          (cat) =>
            cat.name?.toLowerCase().includes(q) ||
            cat.slug?.toLowerCase().includes(q) ||
            matchesGroup
        )
        return {
          ...group,
          categories: matchingCategories
        }
      })
      .filter((group) => (group.categories || []).length > 0)
  }, [groupedData, search])

  const totalSelectedCount = selectedCategoryIds.size + customSkills.length

  const handleSave = async () => {
    if (totalSelectedCount === 0) {
      setError('Please select at least one workforce trade or skill.')
      return
    }

    setError('')
    try {
      const selectedNames = Array.from(selectedCategoryIds)
        .map((id) => categoryIdToName.get(id))
        .filter(Boolean)

      const allSkillsCombined = Array.from(
        new Set([...selectedNames, ...customSkills])
      )

      const payload = {
        categoryIds: Array.from(selectedCategoryIds),
        skills: allSkillsCombined
      }

      const res = await patchVendorMe(payload).unwrap()
      const updatedUser = res?.data?.user

      if (updatedUser) {
        dispatch(setUser(updatedUser))
        onSuccess?.(updatedUser)
      }

      toast.success('Workforce trades updated successfully!')
      onClose()
    } catch (err) {
      setError(err?.data?.message || err?.message || 'Failed to update workforce trades')
    }
  }

  if (!isOpen) return null

  return createPortal(
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[99999] flex flex-col justify-end sm:justify-center items-center bg-slate-950/75 backdrop-blur-sm sm:p-4 overflow-hidden"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && !saving) {
            onClose()
          }
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 32, scale: 0.98 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="relative w-full max-w-2xl bg-white rounded-t-[28px] sm:rounded-3xl shadow-2xl border border-slate-100 flex flex-col h-[90dvh] max-h-[90dvh] sm:h-auto sm:max-h-[88dvh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile Bottom Sheet Pull Bar */}
          <div className="pt-2.5 pb-1 sm:hidden flex justify-center shrink-0">
            <span className="w-10 h-1 rounded-full bg-slate-300" />
          </div>

          {/* Header */}
          <div className="shrink-0 px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100 bg-gradient-to-r from-amber-50/60 via-white to-amber-50/20 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFC107] text-slate-950 shadow-sm shrink-0">
                <Hammer className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-[17px] font-black text-slate-900 leading-tight">
                  Update Workforce Trades & Skills
                </h3>
                <p className="text-xs font-medium text-slate-500 mt-0.5">
                  Select the trades and capabilities your crew provides for matching client requests.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-full p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search & Selected Count Bar */}
          <div className="shrink-0 p-3 sm:p-4 bg-slate-50/90 border-b border-slate-100 space-y-2.5 sm:space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search trades (e.g. Electrician, Plumber, Painter)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FFC107] focus:border-transparent transition-all shadow-2xs"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {totalSelectedCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-3 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Selected Trade Pills Preview */}
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <span className="h-2 w-2 rounded-full bg-[#FFC107]" />
                <span>{totalSelectedCount} {totalSelectedCount === 1 ? 'Trade' : 'Trades'} Selected</span>
              </span>
              <span className="text-[11px] font-medium text-slate-500">
                Tap any trade to toggle
              </span>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="shrink-0 mx-4 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <span className="text-sm">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Main Body - Categories Catalogue */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4 sm:space-y-5">
            {loadingCategories ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                <Loader2 className="h-7 w-7 animate-spin text-[#FFC107]" />
                <p className="text-xs font-bold text-slate-600">Loading workforce trade catalogue...</p>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="py-10 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6">
                <Wrench className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">No matching trades found for "{search}"</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  You can add it below as a custom specialty skill trade!
                </p>
              </div>
            ) : (
              filteredGroups.map((group) => {
                const categories = group.categories || []
                if (categories.length === 0) return null

                return (
                  <div key={group._id || group.name} className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[13px] font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-[#FFC107]" />
                        <span>{group.name || 'Workforce Trades'}</span>
                      </h4>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {categories.length} {categories.length === 1 ? 'skill' : 'skills'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {categories.map((cat) => {
                        const isSelected = selectedCategoryIds.has(String(cat._id))
                        return (
                          <button
                            key={cat._id}
                            type="button"
                            onClick={() => toggleCategory(cat._id)}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all select-none cursor-pointer active:scale-95 ${
                              isSelected
                                ? 'bg-amber-100/90 text-slate-950 border-2 border-[#FFC107] shadow-xs'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                          >
                            <span
                              className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black transition-colors ${
                                isSelected
                                  ? 'bg-[#FFC107] text-slate-950'
                                  : 'border border-slate-300 text-transparent'
                              }`}
                            >
                              <Check className="h-2.5 w-2.5 stroke-[3]" />
                            </span>
                            <span>{cat.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}

            {/* Custom Specialty Skills Section */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[13px] font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span>Custom Specialty Skills / Tags</span>
                </h4>
                <span className="text-[11px] font-medium text-slate-400">Optional</span>
              </div>

              <form onSubmit={handleAddCustomSkill} className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. CCTV Installation, Industrial Welding..."
                  value={newSkillInput}
                  onChange={(e) => setNewSkillInput(e.target.value)}
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FFC107] shadow-2xs"
                />
                <button
                  type="button"
                  onClick={handleAddCustomSkill}
                  disabled={!newSkillInput.trim()}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
              </form>

              {customSkills.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {customSkills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold shadow-2xs"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => removeCustomSkill(skill)}
                        className="ml-1 text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions - Pinned at Bottom with Safe Area */}
          <div className="shrink-0 px-4 sm:px-5 py-3 sm:py-4 bg-white border-t border-slate-100 flex items-center justify-between gap-3 shadow-[0_-4px_16px_rgba(0,0,0,0.05)] pb-[max(1rem,env(safe-area-inset-bottom,1rem))]">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 active:scale-95 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || totalSelectedCount === 0}
              className="flex-1 sm:flex-initial px-6 py-2.5 sm:py-3 rounded-xl bg-[#FFC107] hover:bg-[#e0a800] active:scale-95 disabled:opacity-50 text-slate-950 text-xs sm:text-sm font-black shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving Trades...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 stroke-[3]" />
                  <span>Save Trades ({totalSelectedCount})</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  )
}
