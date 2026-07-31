import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, 
  ChevronRight, 
  ArrowLeft,
  Check,
  Building2,
  HardHat,
  Factory,
  Truck,
  Zap,
  Shield,
  Briefcase,
  Utensils,
  Stethoscope,
  Car,
  ShoppingCart,
  Monitor,
  Package,
  Plus
} from 'lucide-react'
import { fetchLabourCategoriesGrouped } from '../../api/labourCategoriesApi.js'

// Helper to map backend group names to icons
const getGroupIcon = (name) => {
  const n = name.toLowerCase()
  if (n.includes('construction')) return HardHat
  if (n.includes('manufacturing')) return Factory
  if (n.includes('logistics') || n.includes('warehouse')) return Truck
  if (n.includes('electric') || n.includes('hvac')) return Zap
  if (n.includes('security')) return Shield
  if (n.includes('housekeeping')) return Briefcase
  if (n.includes('hospitality')) return Utensils
  if (n.includes('health') || n.includes('medical')) return Stethoscope
  if (n.includes('driver') || n.includes('transport')) return Car
  if (n.includes('office') || n.includes('admin')) return Building2
  if (n.includes('retail') || n.includes('sales')) return ShoppingCart
  if (n.includes('it ') || n.includes('technical')) return Monitor
  if (n.includes('delivery')) return Package
  return Plus
}

export function EnterpriseJobCategorySelector({ value, onChange }) {
  const [groups, setGroups] = useState([])
  const [step, setStep] = useState(1) // 1: Main, 2: Roles, 3: Custom (optional inside step 2)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [customRole, setCustomRole] = useState('')
  const [isCustomMode, setIsCustomMode] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchLabourCategoriesGrouped()
        // Handle different possible response structures
        let data = []
        if (res.data?.groups) {
          data = res.data.groups
        } else if (Array.isArray(res.data)) {
          data = res.data
        } else if (Array.isArray(res)) {
          data = res
        }
        setGroups(data)
        
        // If a value is already selected (e.g. edit mode), try to find its group and show Step 2
        if (value.categoryId && data.length > 0) {
          for (const g of data) {
            if (g.categories?.some(c => c._id === value.categoryId)) {
              setSelectedGroup(g)
              setStep(2)
              // We could also check if value.jobTitle doesn't match any category name, meaning it's a custom role
              const matchedRole = g.categories.find(c => c._id === value.categoryId)
              if (matchedRole && value.jobTitle && matchedRole.name !== value.jobTitle) {
                setIsCustomMode(true)
                setCustomRole(value.jobTitle)
              }
              break
            }
          }
        }
      } catch (err) {
        console.error('Failed to load categories', err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, []) // Empty dependency array, value is only used on initial load

  const handleSelectGroup = (group) => {
    setSelectedGroup(group)
    setSearchQuery('')
    setIsCustomMode(false)
    setCustomRole('')
    setStep(2)
  }

  const handleSelectRole = (category) => {
    onChange({ categoryId: category._id, jobTitle: category.name })
    setIsCustomMode(false)
  }

  const handleSelectCustom = () => {
    setIsCustomMode(true)
    setCustomRole('')
    // We set a temporary categoryId (the first one in the group) just to satisfy backend constraints
    // while sending the custom job title.
    const fallbackId = selectedGroup?.categories?.[0]?._id || ''
    onChange({ categoryId: fallbackId, jobTitle: '' }) 
  }

  const handleCustomRoleChange = (e) => {
    const val = e.target.value
    setCustomRole(val)
    const fallbackId = selectedGroup?.categories?.[0]?._id || ''
    onChange({ categoryId: fallbackId, jobTitle: val })
  }

  const handleBack = () => {
    if (step === 2) {
      setStep(1)
      setSelectedGroup(null)
      onChange({ categoryId: '', jobTitle: '' }) // Clear selection when going back
    }
  }

  const filteredRoles = useMemo(() => {
    if (!selectedGroup || !selectedGroup.categories) return []
    if (!searchQuery) return selectedGroup.categories
    const q = searchQuery.toLowerCase()
    return selectedGroup.categories.filter(c => c.name.toLowerCase().includes(q))
  }, [selectedGroup, searchQuery])

  // Fake "Frequently Used" for UI preview (in a real app, this would come from user history)
  const popularRoles = useMemo(() => {
    if (!selectedGroup || !selectedGroup.categories) return []
    return selectedGroup.categories.slice(0, 3) // Just take first 3 as "popular"
  }, [selectedGroup])

  if (isLoading) {
    return <div className="animate-pulse h-40 bg-slate-100 rounded-2xl w-full"></div>
  }

  return (
    <div className="space-y-4">
      {/* Selection Header */}
      <div className="flex items-center justify-between mb-2">
        <label className="text-[12px] font-bold text-slate-700 uppercase tracking-wide">
          Job Role Selection *
        </label>
        {step === 2 && (
          <button 
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1 text-[12px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Categories
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
          >
            {groups.map((group) => {
              const Icon = getGroupIcon(group.name)
              return (
                <button
                  key={group._id}
                  type="button"
                  onClick={() => handleSelectGroup(group)}
                  className="group relative flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all active:scale-95 text-center h-28"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-2 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                    <Icon className="w-5 h-5 text-slate-500 group-hover:text-indigo-600" />
                  </div>
                  <span className="text-[12px] font-bold text-slate-700 leading-tight group-hover:text-indigo-900">
                    {group.name}
                  </span>
                </button>
              )
            })}
          </motion.div>
        )}

        {step === 2 && selectedGroup && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm"
          >
            {/* Header & Search */}
            <div className="bg-slate-50 p-4 border-b border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                    {React.createElement(getGroupIcon(selectedGroup.name), { className: "w-4 h-4 text-indigo-700" })}
                  </div>
                  <h3 className="text-[15px] font-bold text-slate-900">{selectedGroup.name} Roles</h3>
                </div>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search roles..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border-slate-200 bg-white pl-9 pr-4 py-2.5 text-[13px] font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                />
              </div>
            </div>

            <div className="p-4 bg-white max-h-[300px] overflow-y-auto">
              {!searchQuery && popularRoles.length > 0 && (
                <div className="mb-4">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 block">
                    Frequently Used
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {popularRoles.map(role => (
                      <button
                        key={`pop-${role._id}`}
                        type="button"
                        onClick={() => handleSelectRole(role)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors border ${
                          value.categoryId === role._id && !isCustomMode
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {value.categoryId === role._id && !isCustomMode && <Check className="w-3 h-3" />}
                        {role.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 block">
                {searchQuery ? 'Search Results' : 'All Roles'}
              </span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredRoles.map(role => (
                  <button
                    key={role._id}
                    type="button"
                    onClick={() => handleSelectRole(role)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                      value.categoryId === role._id && !isCustomMode
                        ? 'bg-indigo-50 border-indigo-300 shadow-sm ring-1 ring-indigo-500/20'
                        : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <span className={`text-[13px] font-bold ${value.categoryId === role._id && !isCustomMode ? 'text-indigo-900' : 'text-slate-700'}`}>
                      {role.name}
                    </span>
                    {value.categoryId === role._id && !isCustomMode && (
                      <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}

                {/* Custom Role Option */}
                <button
                  type="button"
                  onClick={handleSelectCustom}
                  className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                    isCustomMode
                      ? 'bg-amber-50 border-amber-300 shadow-sm ring-1 ring-amber-500/20'
                      : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <span className={`text-[13px] font-bold ${isCustomMode ? 'text-amber-900' : 'text-slate-700'}`}>
                    Other (Custom Role)
                  </span>
                  {isCustomMode && (
                    <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              </div>

              {filteredRoles.length === 0 && (
                <div className="text-center py-6 text-slate-500 text-[13px] font-medium">
                  No roles found matching "{searchQuery}"
                </div>
              )}

              {/* Custom Role Input */}
              <AnimatePresence>
                {isCustomMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 space-y-2">
                      <label className="text-[11px] font-bold text-amber-800 uppercase tracking-wide flex items-center gap-1">
                        Custom Job Role <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="text"
                        required
                        value={customRole}
                        onChange={handleCustomRoleChange}
                        placeholder="e.g. Solar Panel Installer"
                        className="w-full rounded-[10px] border-amber-200 bg-white px-4 py-2.5 text-[13px] font-bold text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-sm"
                      />
                      <p className="text-[10px] text-amber-700/70 font-medium">
                        Please type the exact job title you are hiring for.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
