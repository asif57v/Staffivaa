import React, { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Search,
  Check,
  Wrench,
  Layers,
  Sparkles,
  Tag,
  Plus,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronRight,
  HardHat
} from 'lucide-react'
import { fetchLabourCategoriesGrouped } from '../../api/labourCategoriesApi.js'
import { updateUserSkillsAdmin } from '../../api/adminUsersApi.js'

export function AdminUserSkillsModal({
  isOpen,
  onClose,
  user,
  onSuccess
}) {
  const [groupedData, setGroupedData] = useState([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [customSkills, setCustomSkills] = useState([])
  const [newSkillInput, setNewSkillInput] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expandedGroups, setExpandedGroups] = useState(new Set())

  // Initialize selected categories and skills from user profile
  useEffect(() => {
    if (isOpen && user) {
      setError('')
      setReason('')
      setSearch('')
      setNewSkillInput('')

      const isContractor = user.role === 'contractor' || Boolean(user.contractorProfile)
      const profile = isContractor ? user.contractorProfile : user.labourProfile
      const catIds = (profile?.categoryIds || []).map((c) =>
        typeof c === 'object' && c._id ? String(c._id) : String(c)
      )
      setSelectedIds(new Set(catIds))

      const existingSkills = Array.isArray(profile?.skills)
        ? [...profile.skills]
        : []
      setCustomSkills(existingSkills)
    }
  }, [isOpen, user])

  // Fetch all active categories from server
  useEffect(() => {
    if (!isOpen) return
    let isMounted = true
    setLoadingGroups(true)
    fetchLabourCategoriesGrouped()
      .then((res) => {
        if (!isMounted) return
        const groups = res.data?.groups || []
        setGroupedData(groups)
        // Expand all groups by default
        setExpandedGroups(new Set(groups.map((g) => String(g._id))))
      })
      .catch((err) => {
        if (!isMounted) return
        setError(err.message || 'Failed to load skill catalogue')
      })
      .finally(() => {
        if (isMounted) setLoadingGroups(false)
      })
    return () => {
      isMounted = false
    }
  }, [isOpen])

  const toggleGroup = (groupId) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  const toggleCategory = (catId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(catId)) {
        next.delete(catId)
      } else {
        next.add(catId)
      }
      return next
    })
  }

  const handleAddCustomSkill = (e) => {
    e?.preventDefault()
    const trimmed = newSkillInput.trim()
    if (!trimmed) return
    if (!customSkills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setCustomSkills((prev) => [...prev, trimmed])
    }
    setNewSkillInput('')
  }

  const handleRemoveCustomSkill = (index) => {
    setCustomSkills((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const updatedUser = await updateUserSkillsAdmin(user._id, {
        categoryIds: Array.from(selectedIds),
        skills: customSkills,
        reason: reason.trim() || 'Admin updated worker skills & categories',
      })
      if (onSuccess) onSuccess(updatedUser)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to update skills')
    } finally {
      setSaving(false)
    }
  }

  // Filter groups and categories based on search term
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return groupedData

    return groupedData
      .map((g) => {
        const groupMatches = g.name.toLowerCase().includes(q)
        const matchingCategories = (g.categories || []).filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.subtitle && c.subtitle.toLowerCase().includes(q))
        )
        if (groupMatches) return g
        if (matchingCategories.length > 0) {
          return { ...g, categories: matchingCategories }
        }
        return null
      })
      .filter(Boolean)
  }, [groupedData, search])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18 }}
          className="flex h-[90vh] max-h-[800px] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10"
        >
          {/* HEADER */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/20">
                <HardHat className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {user?.role === 'contractor' || user?.contractorProfile
                    ? 'Manage Vendor Trades & Capabilities'
                    : 'Manage Worker Skills & Specializations'}
                </h3>
                <p className="text-xs text-slate-500">
                  {user?.role === 'contractor' || user?.contractorProfile ? 'Vendor' : 'Worker'}:{' '}
                  <span className="font-semibold text-slate-800">{user?.fullName || 'User'}</span> (ID: {user?._id})
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-200/80 hover:text-slate-700 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* SEARCH & STATS BAR */}
          <div className="border-b border-slate-100 bg-white p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search trade skills, categories, or tags..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 transition focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-brand/10 px-3 py-2 text-xs font-bold text-brand ring-1 ring-brand/20">
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                  {selectedIds.size} {selectedIds.size === 1 ? 'Category' : 'Categories'} Selected
                </span>
                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-rose-600"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* SCROLLABLE BODY */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-800">
                {error}
              </div>
            )}

            {/* CATEGORIES SECTION */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-brand" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Trade Categories & Roles Catalogue
                  </h4>
                </div>
                {loadingGroups && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading catalogue...
                  </div>
                )}
              </div>

              {loadingGroups ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                  ))}
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                  <p className="text-sm font-semibold text-slate-600">No categories match your search</p>
                  <p className="text-xs text-slate-400 mt-1">Try another keyword or clear search</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredGroups.map((group) => {
                    const isExpanded = expandedGroups.has(String(group._id))
                    const cats = group.categories || []
                    const selectedCountInGroup = cats.filter((c) =>
                      selectedIds.has(String(c._id))
                    ).length

                    return (
                      <div
                        key={group._id}
                        className="overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-50/50 shadow-xs"
                      >
                        {/* GROUP HEADER */}
                        <button
                          type="button"
                          onClick={() => toggleGroup(String(group._id))}
                          className="flex w-full items-center justify-between bg-white px-4 py-3 text-left transition hover:bg-slate-50 cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-700">
                              {group.name?.charAt(0) || '•'}
                            </span>
                            <div>
                              <p className="text-sm font-bold text-slate-900">{group.name}</p>
                              {group.description && (
                                <p className="text-xs text-slate-400 line-clamp-1">{group.description}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {selectedCountInGroup > 0 && (
                              <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">
                                {selectedCountInGroup} selected
                              </span>
                            )}
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-slate-400" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-slate-400" />
                            )}
                          </div>
                        </button>

                        {/* GROUP CATEGORIES */}
                        {isExpanded && (
                          <div className="grid gap-2.5 p-3.5 sm:grid-cols-2">
                            {cats.map((cat) => {
                              const isSelected = selectedIds.has(String(cat._id))
                              return (
                                <button
                                  key={cat._id}
                                  type="button"
                                  onClick={() => toggleCategory(String(cat._id))}
                                  className={`flex items-start gap-3 rounded-xl p-3 text-left transition cursor-pointer ${
                                    isSelected
                                      ? 'border border-brand bg-brand/10 shadow-xs ring-1 ring-brand/40'
                                      : 'border border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/80'
                                  }`}
                                >
                                  <div
                                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                                      isSelected
                                        ? 'border-brand bg-brand text-white'
                                        : 'border-slate-300 bg-white'
                                    }`}
                                  >
                                    {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-1">
                                      <p className="text-xs font-bold text-slate-900 truncate">{cat.name}</p>
                                      {cat.baseRate ? (
                                        <span className="shrink-0 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                          ₹{cat.baseRate}/d
                                        </span>
                                      ) : null}
                                    </div>
                                    {cat.subtitle && (
                                      <p className="mt-0.5 text-[11px] text-slate-500 leading-tight">
                                        {cat.subtitle}
                                      </p>
                                    )}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* CUSTOM SKILL KEYWORDS / TAGS */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-slate-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Additional Skill Keywords & Specialties
                </h4>
              </div>
              <p className="text-xs text-slate-500">
                Add specific tags or equipment skills (e.g., "Drill Machine Expert", "False Ceiling", "Welding").
              </p>

              <form onSubmit={handleAddCustomSkill} className="flex gap-2">
                <input
                  type="text"
                  value={newSkillInput}
                  onChange={(e) => setNewSkillInput(e.target.value)}
                  placeholder="Type a skill tag and press Add..."
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-brand focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand"
                />
                <button
                  type="submit"
                  disabled={!newSkillInput.trim()}
                  className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Tag
                </button>
              </form>

              {customSkills.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {customSkills.map((skill, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800 border border-slate-200"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomSkill(index)}
                        className="text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* AUDIT REASON */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Reason / Note (For Audit Timeline)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Added Plumber & Electrician skills following physical test verification"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-brand focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
          </div>

          {/* FOOTER */}
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
            <p className="text-xs text-slate-500">
              {selectedIds.size} catalogue roles · {customSkills.length} custom tags
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand/90 cursor-pointer disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {saving ? 'Saving Changes...' : 'Save Skills & Categories'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
