import { useState, useEffect } from 'react'
import {
  Search,
  History,
  Download,
  Save,
  Check,
  AlertCircle,
  IndianRupee,
  Percent,
  Layers,
  User,
  Building2,
  UserCheck,
  Briefcase,
  Clock,
  ArrowRight,
  TrendingUp,
  FileJson,
  Plus,
  Shield,
  FileText,
  Calendar,
  Sliders,
  DollarSign,
  Trash2
} from 'lucide-react'
import {
  useGetSystemPricingQuery,
  useUpdateSystemPricingMutation
} from '../../store/api/workforceApi.js'
import toast from 'react-hot-toast'

export function AdminPricingPage() {
  // Load global pricing settings and history logs
  const { data: systemData, isLoading: isLoadingConfig, isError: isErrorConfig, error: configError, refetch: refetchSystem } = useGetSystemPricingQuery()
  const [updateSystemConfig, { isLoading: isSavingConfig }] = useUpdateSystemPricingMutation()

  // Local states
  const [activeTab, setActiveTab] = useState('userBooking') // userBooking, corporate, vendor, labour, gstTaxes, settlementRules, pricingHistory
  const [searchQuery, setSearchQuery] = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [revisionReason, setRevisionReason] = useState('')

  // Local config to edit
  const [config, setConfig] = useState(null)

  // Sync state
  useEffect(() => {
    if (systemData?.pricing) {
      setConfig(JSON.parse(JSON.stringify(systemData.pricing)))
    }
  }, [systemData])

  if (isLoadingConfig || (!config && !isErrorConfig)) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent"></div>
        <span className="ml-3 text-sm text-slate-500 font-semibold">Loading Config Master...</span>
      </div>
    )
  }

  if (isErrorConfig || !config) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-full bg-red-50 p-3 text-red-500">
          <AlertCircle className="h-8 w-8" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Failed to Load Pricing Configuration</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-md">
            {configError?.data?.message || configError?.message || 'An error occurred while fetching system pricing rules.'}
          </p>
        </div>
        <button
          onClick={() => refetchSystem()}
          className="rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-yellow-500 active:scale-95"
        >
          Retry Loading
        </button>
      </div>
    )
  }

  const history = systemData?.history ?? []

  // Dynamic nested fields modifier
  const updateField = (path, val) => {
    setConfig((prev) => {
      const next = JSON.parse(JSON.stringify(prev))
      const parts = path.split('.')
      let current = next
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {}
        current = current[parts[i]]
      }
      const parsedVal = val === '' ? '' : (
        isNaN(val) || 
        path.includes('gstNumber') || 
        path.includes('settlementCycle') || 
        path.includes('corporateSettlementCycle') || 
        path.includes('labourSalaryCycle') || 
        path.includes('approvalType') || 
        path.includes('status') || 
        path.includes('type')
      ) ? val : Number(val)
      
      current[parts[parts.length - 1]] = parsedVal
      return next
    })
  }

  // Deep validation rules
  const getErrors = (cfg) => {
    const errs = {}
    if (!cfg) return errs

    const checkNeg = (val, path, label) => {
      if (val !== undefined && val !== null && val !== '') {
        if (Number(val) < 0) errs[path] = `${label} cannot be negative`
      }
    }

    const checkPct = (val, path, label) => {
      if (val !== undefined && val !== null && val !== '') {
        if (Number(val) < 0) errs[path] = `${label} cannot be negative`
        if (Number(val) > 100) errs[path] = `${label} cannot exceed 100%`
      }
    }

    // User Booking
    const ub = cfg.userBooking || {}
    if (ub.platformFee) {
      if (ub.platformFee.type === 'percentage') {
        checkPct(ub.platformFee.value, 'userBooking.platformFee.value', 'Platform Fee percentage')
      } else {
        checkNeg(ub.platformFee.value, 'userBooking.platformFee.value', 'Platform Fee value')
      }
      checkNeg(ub.platformFee.minFee, 'userBooking.platformFee.minFee', 'Min Platform Fee')
      checkNeg(ub.platformFee.maxFee, 'userBooking.platformFee.maxFee', 'Max Platform Fee')
      if (ub.platformFee.minFee !== '' && ub.platformFee.maxFee !== '' && Number(ub.platformFee.minFee) > Number(ub.platformFee.maxFee)) {
        errs['userBooking.platformFee.minFee'] = 'Minimum fee exceeds maximum fee'
      }
    }
    if (ub.gst) checkPct(ub.gst.rate, 'userBooking.gst.rate', 'User GST rate')
    if (ub.convenienceFee) checkNeg(ub.convenienceFee.amount, 'userBooking.convenienceFee.amount', 'Convenience fee')
    if (ub.cancellation) {
      checkNeg(ub.cancellation.user, 'userBooking.cancellation.user', 'User cancellation fee')
      checkNeg(ub.cancellation.labour, 'userBooking.cancellation.labour', 'Labour cancellation fee')
    }

    // Corporate
    const corp = cfg.corporate || {}
    if (corp.platformFee) {
      if (corp.platformFee.type === 'percentage') {
        checkPct(corp.platformFee.value, 'corporate.platformFee.value', 'Platform Fee percentage')
      } else {
        checkNeg(corp.platformFee.value, 'corporate.platformFee.value', 'Platform Fee value')
      }
      checkNeg(corp.platformFee.minFee, 'corporate.platformFee.minFee', 'Corporate Min Fee')
      checkNeg(corp.platformFee.maxFee, 'corporate.platformFee.maxFee', 'Corporate Max Fee')
      if (corp.platformFee.minFee !== '' && corp.platformFee.maxFee !== '' && Number(corp.platformFee.minFee) > Number(corp.platformFee.maxFee)) {
        errs['corporate.platformFee.minFee'] = 'Minimum fee exceeds maximum fee'
      }
    }
    if (corp.gst) checkPct(corp.gst.rate, 'corporate.gst.rate', 'Corporate GST rate')

    // Vendor
    const vend = cfg.vendor || {}
    checkNeg(vend.registrationFee, 'vendor.registrationFee', 'Registration fee')
    checkNeg(vend.renewalFee, 'vendor.renewalFee', 'Renewal fee')
    if (vend.platformCommission) {
      if (vend.platformCommission.type === 'percentage') {
        checkPct(vend.platformCommission.value, 'vendor.platformCommission.value', 'Commission percentage')
      } else {
        checkNeg(vend.platformCommission.value, 'vendor.platformCommission.value', 'Commission amount')
      }
    }
    checkNeg(vend.settlementProcessingFee, 'vendor.settlementProcessingFee', 'Settlement fee')
    checkNeg(vend.withdrawalFee, 'vendor.withdrawalFee', 'Withdrawal fee')
    if (vend.gst) checkPct(vend.gst.rate, 'vendor.gst.rate', 'Vendor GST rate')

    // Labour
    const lab = cfg.labour || {}
    checkNeg(lab.verificationFee, 'labour.verificationFee', 'Verification fee')
    checkNeg(lab.walletWithdrawalFee, 'labour.walletWithdrawalFee', 'Withdrawal fee')
    checkNeg(lab.walletTransferFee, 'labour.walletTransferFee', 'Wallet transfer fee')
    if (lab.platformFee) {
      if (lab.platformFee.type === 'distance') {
        const slabs = lab.platformFee.slabs || []
        if (slabs.length === 0) {
          errs['labour.platformFee.slabs'] = 'Distance slabs cannot be empty when Distance Based mode is active'
        } else {
          const sorted = [...slabs].sort((a, b) => Number(a.minDistance || 0) - Number(b.minDistance || 0))
          for (let i = 0; i < sorted.length; i++) {
            const s = sorted[i]
            const min = Number(s.minDistance || 0)
            const fee = Number(s.fee || 0)
            if (min < 0) {
              errs[`labour.platformFee.slabs.${i}.minDistance`] = 'Min distance cannot be negative'
            }
            if (fee < 0) {
              errs[`labour.platformFee.slabs.${i}.fee`] = 'Fee cannot be negative'
            }
            if (s.maxDistance !== null && s.maxDistance !== undefined && s.maxDistance !== '') {
              const max = Number(s.maxDistance)
              if (min >= max) {
                errs[`labour.platformFee.slabs.${i}.maxDistance`] = 'Max distance must be greater than min'
              }
            }
            if (i > 0) {
              const prev = sorted[i - 1]
              if (prev.maxDistance === null || prev.maxDistance === undefined || prev.maxDistance === '') {
                errs[`labour.platformFee.slabs.${i}.minDistance`] = 'Only the last slab can be unlimited'
              } else if (Number(prev.maxDistance) !== min) {
                errs[`labour.platformFee.slabs.${i}.minDistance`] = `Slabs must be continuous. Gap detected from ${prev.maxDistance} to ${min} km.`
              }
            }
          }
          const last = sorted[sorted.length - 1]
          if (last && last.maxDistance !== null && last.maxDistance !== undefined && last.maxDistance !== '') {
            errs[`labour.platformFee.slabs.${sorted.length - 1}.maxDistance`] = 'The last slab must have an unlimited end range'
          }
        }
      } else if (lab.platformFee.type === 'percentage') {
        checkPct(lab.platformFee.value, 'labour.platformFee.value', 'Labour Platform Fee percentage')
      } else {
        checkNeg(lab.platformFee.value, 'labour.platformFee.value', 'Labour Platform Fee value')
      }
    }
    if (lab.gst) checkPct(lab.gst.rate, 'labour.gst.rate', 'Labour GST rate')

    // GST Settings
    const gstS = cfg.gstSettings || {}
    checkPct(gstS.percentage, 'gstSettings.percentage', 'GST Settings rate')

    // Settlement Rules
    const sr = cfg.settlementRules || {}
    checkNeg(sr.minWithdrawal, 'settlementRules.minWithdrawal', 'Minimum withdrawal')
    checkNeg(sr.maxWithdrawal, 'settlementRules.maxWithdrawal', 'Maximum withdrawal')
    if (sr.minWithdrawal !== '' && sr.maxWithdrawal !== '' && Number(sr.minWithdrawal) > Number(sr.maxWithdrawal)) {
      errs['settlementRules.minWithdrawal'] = 'Minimum withdrawal exceeds maximum limit'
    }

    return errs
  }

  const errors = getErrors(config)
  const isValid = Object.keys(errors).length === 0

  // Calculate changed properties count
  const getPendingChangesCount = () => {
    if (!systemData?.pricing || !config) return 0
    let diffCount = 0
    const keys = ['userBooking', 'corporate', 'vendor', 'labour', 'gstSettings', 'settlementRules']
    
    const countDiffs = (objA, objB) => {
      let count = 0
      for (const k in objA) {
        if (typeof objA[k] === 'object' && objA[k] !== null && objB && objB[k]) {
          count += countDiffs(objA[k], objB[k])
        } else if (objB && String(objA[k]) !== String(objB[k])) {
          count++
        }
      }
      return count
    }

    keys.forEach(k => {
      diffCount += countDiffs(systemData.pricing[k], config[k])
    })
    return diffCount
  }

  const pendingChanges = getPendingChangesCount()

  // Export JSON Config
  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(config, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', 'staffivaa_pricing_rules.json')
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
    toast.success('Configuration rules exported successfully!')
  }

  // Save changes
  const handleSave = async () => {
    if (!isValid) {
      toast.error('Please resolve validation issues.')
      return
    }
    if (!revisionReason.trim()) {
      toast.error('Revision reason is required.')
      return
    }

    try {
      await updateSystemConfig({
        config,
        reason: revisionReason
      }).unwrap()
      toast.success('Pricing and business rules revision updated!')
      setShowSaveModal(false)
      setRevisionReason('')
      refetchSystem()
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Update failed.')
    }
  }


  // Match search filter
  const matchesSearch = (text, label = '', desc = '') => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      text.toLowerCase().includes(q) ||
      label.toLowerCase().includes(q) ||
      desc.toLowerCase().includes(q)
    )
  }

  return (
    <div className="w-full space-y-6 pb-12">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Pricing Management</h1>
          <p className="mt-1 text-sm text-slate-500 font-medium">
            Manage platform pricing, commissions, GST, settlement rules and business charges.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
          >
            <FileJson className="h-4.5 w-4.5 text-slate-500" />
            Export Rules
          </button>
          <button
            onClick={() => {
              if (!isValid) {
                const errorList = Object.values(errors)
                if (errorList.length > 0) {
                  toast.error(`Validation Error: ${errorList[0]}`)
                } else {
                  toast.error('Cannot save. Please fix validation errors.')
                }
              } else {
                setShowSaveModal(true)
              }
            }}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold shadow-sm transition active:scale-95 border ${
              isValid
                ? 'bg-yellow-400 text-slate-950 border-yellow-400 hover:bg-yellow-500'
                : 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
            }`}
          >
            <Save className="h-4.5 w-4.5" />
            Save Changes
          </button>
        </div>
      </div>

      {/* SEARCH AND PENDING RED LIGHT INDICATOR */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="relative md:col-span-2">
          <Search className="absolute top-3.5 left-4 h-4.5 w-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search pricing formulas, rates or settlement delay values..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pr-4 pl-11 text-sm font-medium outline-none shadow-sm transition focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400"
          />
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-100 p-3.5 px-5">
          <div className="flex items-center gap-2.5">
            <Shield className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Access Scope</p>
              <p className="text-sm font-extrabold text-slate-900">Super Admin Authorized Only</p>
            </div>
          </div>
          <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
        </div>
      </div>

      {/* TOP SUMMARY KPI CARDS (Single row responsive cards) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Pricing Version */}
        <div className="rounded-2xl bg-white p-5 border border-slate-100 shadow-sm text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pricing Engine</p>
          <p className="text-xl font-black text-slate-950 mt-1.5">v2.0</p>
        </div>
        {/* Active Rules */}
        <div className="rounded-2xl bg-white p-5 border border-slate-100 shadow-sm text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Rules</p>
          <p className="text-xl font-black text-slate-950 mt-1.5">18</p>
        </div>
        {/* GST rate */}
        <div className="rounded-2xl bg-white p-5 border border-slate-100 shadow-sm text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Default GST</p>
          <p className="text-xl font-black text-slate-950 mt-1.5">{config.gstSettings?.percentage || 18}%</p>
        </div>
        {/* Last Updated */}
        <div className="rounded-2xl bg-white p-5 border border-slate-100 shadow-sm text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Revision</p>
          <p className="text-xl font-black text-slate-950 mt-1.5 truncate">
            {history.length > 0 ? new Date(history[0].createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Today'}
          </p>
        </div>
        {/* Pending Changes count */}
        <div className="rounded-2xl bg-white p-5 border border-slate-100 shadow-sm text-center col-span-2 md:col-span-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Changes</p>
          <span className={`inline-flex items-center justify-center rounded-full text-xs font-black mt-2 h-6.5 px-3.5 ${
            pendingChanges > 0 ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-slate-100 text-slate-500'
          }`}>
            {pendingChanges} edits
          </span>
        </div>
      </div>

      {/* 7 TABS SELECTOR */}
      <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-none gap-1 bg-slate-50/50 p-1.5 rounded-2xl">
        {[
          { id: 'userBooking', label: 'User Booking', icon: User },
          { id: 'corporate', label: 'Corporate Projects', icon: Briefcase },
          { id: 'vendor', label: 'Vendor Settings', icon: Building2 },
          { id: 'labour', label: 'Labour Policies', icon: UserCheck },
          { id: 'gstTaxes', label: 'GST & Taxes', icon: Percent },
          { id: 'settlementRules', label: 'Settlement Rules', icon: Sliders },
          { id: 'pricingHistory', label: 'Pricing History', icon: History }
        ].map((tab) => {
          const Icon = tab.icon
          const isSelected = activeTab === tab.id
          const hasTabError = Object.keys(errors).some(k => k.startsWith(tab.id) || (tab.id === 'gstTaxes' && k.startsWith('gstSettings')))
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-bold transition-all relative ${
                isSelected
                  ? 'bg-white text-slate-950 shadow-sm border border-slate-100'
                  : 'text-slate-500 hover:bg-white/40 hover:text-slate-800'
              }`}
            >
              <Icon className={`h-4.5 w-4.5 ${isSelected ? 'text-yellow-500' : 'text-slate-400'}`} />
              {tab.label}
              {hasTabError && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* TAB CONTENT GRID LAYOUT */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN: SELECTED FORM */}
        <div className="lg:col-span-2 space-y-6">
          {/* USER BOOKING TAB */}
          {activeTab === 'userBooking' && (
            <div className="space-y-6">
              {/* platform fee */}
              {matchesSearch('platform fee type value minFee maxFee status percentage fixed', 'Platform Fee', 'Platform checkout charges') && (
                <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                  <div className="border-b border-slate-100 pb-4">
                    <h3 className="text-base font-extrabold text-slate-950">Platform Fee Structure</h3>
                    <p className="text-xs text-slate-400 uppercase mt-0.5">User Booking</p>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-bold text-slate-600 block mb-1.5">Platform Fee</label>
                      <div className="flex rounded-xl border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-yellow-400/40 focus-within:border-yellow-400 overflow-hidden shadow-sm">
                        <input
                          type="number"
                          value={config.userBooking?.platformFee?.value ?? ''}
                          onChange={(e) => updateField('userBooking.platformFee.value', e.target.value)}
                          className="flex-1 bg-transparent py-2.5 px-4 text-sm font-medium outline-none border-none"
                          placeholder="0"
                        />
                        <select
                          value={config.userBooking?.platformFee?.type || 'fixed'}
                          onChange={(e) => updateField('userBooking.platformFee.type', e.target.value)}
                          className="bg-slate-50 border-l border-slate-200 px-3 text-xs font-bold text-slate-700 outline-none cursor-pointer hover:bg-slate-100"
                        >
                          <option value="fixed">₹ Fixed</option>
                          <option value="percentage">% Percent</option>
                        </select>
                      </div>
                      {errors['userBooking.platformFee.value'] && (
                        <p className="mt-1 text-xs text-red-500 font-semibold flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {errors['userBooking.platformFee.value']}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1.5">Minimum Fee (₹)</label>
                      <input
                        type="number"
                        value={config.userBooking?.platformFee?.minFee ?? ''}
                        onChange={(e) => updateField('userBooking.platformFee.minFee', e.target.value)}
                        className="w-full rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-medium outline-none"
                      />
                      {errors['userBooking.platformFee.minFee'] && (
                        <p className="mt-1 text-xs text-red-500 font-semibold flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {errors['userBooking.platformFee.minFee']}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1.5">Maximum Fee (₹)</label>
                      <input
                        type="number"
                        value={config.userBooking?.platformFee?.maxFee ?? ''}
                        onChange={(e) => updateField('userBooking.platformFee.maxFee', e.target.value)}
                        className="w-full rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-medium outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Convenience fee & cancellations */}
              {matchesSearch('convenience fee cancellation charge user cancellation labour cancellation convenience amount enabled', 'Convenience & Cancellations', 'Transactional event policies') && (
                <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                  <div className="border-b border-slate-100 pb-4">
                    <h3 className="text-base font-extrabold text-slate-950">Event Fee Policies</h3>
                    <p className="text-xs text-slate-400 uppercase mt-0.5">User Booking</p>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1.5">Convenience Fee Payout (₹)</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => updateField('userBooking.convenienceFee.enabled', !config.userBooking?.convenienceFee?.enabled)}
                          className={`rounded-xl border px-3 py-2 text-xs font-bold uppercase transition ${
                            config.userBooking?.convenienceFee?.enabled ? 'bg-yellow-400 border-yellow-400 text-slate-950' : 'border-slate-200 text-slate-600'
                          }`}
                        >
                          {config.userBooking?.convenienceFee?.enabled ? 'ON' : 'OFF'}
                        </button>
                        <input
                          type="number"
                          disabled={!config.userBooking?.convenienceFee?.enabled}
                          value={config.userBooking?.convenienceFee?.amount ?? ''}
                          onChange={(e) => updateField('userBooking.convenienceFee.amount', e.target.value)}
                          className="flex-1 rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-medium outline-none disabled:bg-slate-50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1.5">GST Rate (%)</label>
                      <input
                        type="number"
                        value={config.userBooking?.gst?.rate ?? ''}
                        onChange={(e) => updateField('userBooking.gst.rate', e.target.value)}
                        className="w-full rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-medium outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1.5">User Cancellation Payout (₹)</label>
                      <input
                        type="number"
                        value={config.userBooking?.cancellation?.user ?? ''}
                        onChange={(e) => updateField('userBooking.cancellation.user', e.target.value)}
                        className="w-full rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-medium outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1.5">Labour Cancellation Penalty (₹)</label>
                      <input
                        type="number"
                        value={config.userBooking?.cancellation?.labour ?? ''}
                        onChange={(e) => updateField('userBooking.cancellation.labour', e.target.value)}
                        className="w-full rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-medium outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CORPORATE PROJECT TAB */}
          {activeTab === 'corporate' && (
            <div className="space-y-6">
              {/* Platform fee details */}
              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-base font-extrabold text-slate-950">Corporate Pricing Configurations</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Control billing margins on contracts and milestones.</p>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">Platform Fee</label>
                    <div className="flex rounded-xl border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-yellow-400/40 focus-within:border-yellow-400 overflow-hidden shadow-sm">
                      <input
                        type="number"
                        value={config.corporate?.platformFee?.value ?? ''}
                        onChange={(e) => updateField('corporate.platformFee.value', e.target.value)}
                        className="flex-1 bg-transparent py-2.5 px-4 text-sm font-medium outline-none border-none"
                        placeholder="0"
                      />
                      <select
                        value={config.corporate?.platformFee?.type || 'perWorkerPerDay'}
                        onChange={(e) => updateField('corporate.platformFee.type', e.target.value)}
                        className="bg-slate-50 border-l border-slate-200 px-3 text-xs font-bold text-slate-700 outline-none cursor-pointer hover:bg-slate-100"
                      >
                        <option value="perWorkerPerDay">₹ Per Worker / Day</option>
                        <option value="perWorker">₹ Per Worker</option>
                        <option value="fixed">₹ Fixed</option>
                        <option value="percentage">% Percent</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">

                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1.5">Minimum Fee (₹)</label>
                      <input
                        type="number"
                        value={config.corporate?.platformFee?.minFee ?? ''}
                        onChange={(e) => updateField('corporate.platformFee.minFee', e.target.value)}
                        className="w-full rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-medium outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1.5">Maximum Fee (₹)</label>
                      <input
                        type="number"
                        value={config.corporate?.platformFee?.maxFee ?? ''}
                        onChange={(e) => updateField('corporate.platformFee.maxFee', e.target.value)}
                        className="w-full rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-medium outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-slate-100">
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1.5">GST Rate (%)</label>
                      <input
                        type="number"
                        value={config.corporate?.gst?.rate ?? ''}
                        onChange={(e) => updateField('corporate.gst.rate', e.target.value)}
                        className="w-full rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-medium outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1.5">Auto Reminder Notifications</label>
                      <select
                        value={config.corporate?.autoReminder !== false ? 'true' : 'false'}
                        onChange={(e) => updateField('corporate.autoReminder', e.target.value === 'true')}
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3.5 text-sm font-semibold text-slate-700 outline-none"
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VENDOR TAB */}
          {activeTab === 'vendor' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-base font-extrabold text-slate-950">Vendor Pricing Policies</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Control registration fees, commissions, and transaction charges.</p>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">Registration Payout (₹)</label>
                    <input
                      type="number"
                      value={config.vendor?.registrationFee ?? ''}
                      onChange={(e) => updateField('vendor.registrationFee', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-medium outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">Renewal Payout (Annual) (₹)</label>
                    <input
                      type="number"
                      value={config.vendor?.renewalFee ?? ''}
                      onChange={(e) => updateField('vendor.renewalFee', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-medium outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">Platform Fee</label>
                    <div className="flex rounded-xl border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-yellow-400/40 focus-within:border-yellow-400 overflow-hidden shadow-sm">
                      <input
                        type="number"
                        value={config.vendor?.platformCommission?.value ?? ''}
                        onChange={(e) => updateField('vendor.platformCommission.value', e.target.value)}
                        className="flex-1 bg-transparent py-2.5 px-4 text-sm font-medium outline-none border-none"
                        placeholder="0"
                      />
                      <select
                        value={config.vendor?.platformCommission?.type || 'percentage'}
                        onChange={(e) => updateField('vendor.platformCommission.type', e.target.value)}
                        className="bg-slate-50 border-l border-slate-200 px-3 text-xs font-bold text-slate-700 outline-none cursor-pointer hover:bg-slate-100"
                      >
                        <option value="percentage">% Percent</option>
                        <option value="fixed">₹ Fixed</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">Settlement Processing Fee (₹)</label>
                    <input
                      type="number"
                      value={config.vendor?.settlementProcessingFee ?? ''}
                      onChange={(e) => updateField('vendor.settlementProcessingFee', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-medium outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">Withdrawal Fee (₹)</label>
                    <input
                      type="number"
                      value={config.vendor?.withdrawalFee ?? ''}
                      onChange={(e) => updateField('vendor.withdrawalFee', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-medium outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">GST Rate (%)</label>
                    <input
                      type="number"
                      value={config.vendor?.gst?.rate ?? ''}
                      onChange={(e) => updateField('vendor.gst.rate', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-medium outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LABOUR TAB */}
          {activeTab === 'labour' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-base font-extrabold text-slate-950">Labour Verification & Transfers</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Control worker transaction margins and KYC rates.</p>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">Verification Fee (KYC) (₹)</label>
                    <input
                      type="number"
                      value={config.labour?.verificationFee ?? ''}
                      onChange={(e) => updateField('labour.verificationFee', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-medium outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">Wallet Withdrawal Fee (₹)</label>
                    <input
                      type="number"
                      value={config.labour?.walletWithdrawalFee ?? ''}
                      onChange={(e) => updateField('labour.walletWithdrawalFee', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-medium outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">Wallet Transfer Fee (p2p) (₹)</label>
                    <input
                      type="number"
                      value={config.labour?.walletTransferFee ?? ''}
                      onChange={(e) => updateField('labour.walletTransferFee', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-medium outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">Platform Fee Mode</label>
                    <div className="flex rounded-xl border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-yellow-400/40 focus-within:border-yellow-400 overflow-hidden shadow-sm">
                      {config.labour?.platformFee?.type !== 'distance' && (
                        <input
                          type="number"
                          value={config.labour?.platformFee?.value ?? ''}
                          onChange={(e) => updateField('labour.platformFee.value', e.target.value)}
                          className="flex-1 bg-transparent py-2.5 px-4 text-sm font-medium outline-none border-none"
                          placeholder="0"
                        />
                      )}
                      {config.labour?.platformFee?.type === 'distance' && (
                        <div className="flex-1 py-2.5 px-4 text-xs font-bold text-slate-500 bg-slate-50 select-none">
                          🛣️ Managed via Distance Slab table below
                        </div>
                      )}
                      <select
                        value={config.labour?.platformFee?.type || 'fixed'}
                        onChange={(e) => updateField('labour.platformFee.type', e.target.value)}
                        className="bg-slate-50 border-l border-slate-200 px-3 text-xs font-bold text-slate-700 outline-none cursor-pointer hover:bg-slate-100"
                      >
                        <option value="fixed">₹ Fixed</option>
                        <option value="percentage">% Percent</option>
                        <option value="distance">Distance Based</option>
                      </select>
                    </div>
                    {config.labour?.platformFee?.type !== 'distance' && errors['labour.platformFee.value'] && (
                      <p className="mt-1 text-xs text-red-500 font-semibold flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors['labour.platformFee.value']}
                      </p>
                    )}
                    {config.labour?.platformFee?.type === 'distance' && errors['labour.platformFee.slabs'] && (
                      <p className="mt-1 text-xs text-red-500 font-semibold flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors['labour.platformFee.slabs']}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">GST Rate (%)</label>
                    <input
                      type="number"
                      value={config.labour?.gst?.rate ?? ''}
                      onChange={(e) => updateField('labour.gst.rate', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-medium outline-none"
                    />
                  </div>
                </div>
              </div>

              {config.labour?.platformFee?.type === 'distance' && (
                <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                  <div className="border-b border-slate-100 pb-4 flex justify-between items-center">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-950">Distance Slabs Configuration</h3>
                      <p className="text-xs text-slate-500 mt-0.5 font-semibold">Configure platform fees based on the travel distance to the site.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const slabs = [...(config.labour?.platformFee?.slabs || [])]
                        const lastSlab = slabs[slabs.length - 1]
                        const lastMax = lastSlab ? (lastSlab.maxDistance === null || lastSlab.maxDistance === undefined ? Number(lastSlab.minDistance || 0) + 5 : Number(lastSlab.maxDistance)) : 0
                        slabs.push({
                          minDistance: lastMax,
                          maxDistance: lastMax + 5,
                          fee: 10
                        })
                        updateField('labour.platformFee.slabs', slabs)
                      }}
                      className="rounded-xl bg-slate-950 text-white hover:bg-slate-900 px-4 py-2 text-xs font-bold shadow-sm transition active:scale-95 flex items-center gap-1"
                    >
                      + Add Slab
                    </button>
                  </div>

                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          <th className="py-3 px-2">From Distance</th>
                          <th className="py-3 px-2">To Distance</th>
                          <th className="py-3 px-2">Platform Fee</th>
                          <th className="py-3 px-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(config.labour?.platformFee?.slabs || []).map((slab, index) => {
                          return (
                            <tr key={index} className="group hover:bg-slate-50/50 transition">
                              <td className="py-3 px-2">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    value={slab.minDistance ?? ''}
                                    onChange={(e) => {
                                      const slabs = [...(config.labour?.platformFee?.slabs || [])]
                                      slabs[index] = { ...slabs[index], minDistance: e.target.value === '' ? '' : Number(e.target.value) }
                                      updateField('labour.platformFee.slabs', slabs)
                                    }}
                                    className={`w-24 rounded-lg border py-1.5 px-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-yellow-400 ${
                                      errors[`labour.platformFee.slabs.${index}.minDistance`] ? 'border-red-400' : 'border-slate-200'
                                    }`}
                                    placeholder="0"
                                  />
                                  <span className="text-xs font-bold text-slate-400">km</span>
                                </div>
                                {errors[`labour.platformFee.slabs.${index}.minDistance`] && (
                                  <p className="mt-1 text-[10px] text-red-500 font-semibold">{errors[`labour.platformFee.slabs.${index}.minDistance`]}</p>
                                )}
                              </td>
                              <td className="py-3 px-2">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    value={slab.maxDistance ?? ''}
                                    onChange={(e) => {
                                      const slabs = [...(config.labour?.platformFee?.slabs || [])]
                                      slabs[index] = { ...slabs[index], maxDistance: e.target.value === '' ? null : Number(e.target.value) }
                                      updateField('labour.platformFee.slabs', slabs)
                                    }}
                                    className={`w-24 rounded-lg border py-1.5 px-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-yellow-400 ${
                                      errors[`labour.platformFee.slabs.${index}.maxDistance`] ? 'border-red-400' : 'border-slate-200'
                                    }`}
                                    placeholder="Unlimited"
                                  />
                                  <span className="text-xs font-bold text-slate-400">km</span>
                                </div>
                                {errors[`labour.platformFee.slabs.${index}.maxDistance`] && (
                                  <p className="mt-1 text-[10px] text-red-500 font-semibold">{errors[`labour.platformFee.slabs.${index}.maxDistance`]}</p>
                                )}
                              </td>
                              <td className="py-3 px-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-slate-400">₹</span>
                                  <input
                                    type="number"
                                    value={slab.fee ?? ''}
                                    onChange={(e) => {
                                      const slabs = [...(config.labour?.platformFee?.slabs || [])]
                                      slabs[index] = { ...slabs[index], fee: e.target.value === '' ? '' : Number(e.target.value) }
                                      updateField('labour.platformFee.slabs', slabs)
                                    }}
                                    className={`w-24 rounded-lg border py-1.5 px-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-yellow-400 ${
                                      errors[`labour.platformFee.slabs.${index}.fee`] ? 'border-red-400' : 'border-slate-200'
                                    }`}
                                    placeholder="0"
                                  />
                                </div>
                                {errors[`labour.platformFee.slabs.${index}.fee`] && (
                                  <p className="mt-1 text-[10px] text-red-500 font-semibold">{errors[`labour.platformFee.slabs.${index}.fee`]}</p>
                                )}
                              </td>
                              <td className="py-3 px-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const slabs = (config.labour?.platformFee?.slabs || []).filter((_, i) => i !== index)
                                    updateField('labour.platformFee.slabs', slabs)
                                  }}
                                  className="rounded-lg bg-red-50 text-red-600 hover:bg-red-100 p-2 transition active:scale-95"
                                  title="Delete Slab"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GST & TAXES TAB */}
          {activeTab === 'gstTaxes' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-base font-extrabold text-slate-950">GST & Tax Rules</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Control global platform taxation parameters.</p>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">GST Invoicing ID (GSTIN)</label>
                    <input
                      type="text"
                      value={config.gstSettings?.gstNumber ?? ''}
                      onChange={(e) => updateField('gstSettings.gstNumber', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-medium outline-none"
                      placeholder="e.g. 29ABCDE1234F1Z5"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">GST Rate Percentage (%)</label>
                    <input
                      type="number"
                      value={config.gstSettings?.percentage ?? ''}
                      onChange={(e) => updateField('gstSettings.percentage', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-medium outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">GST Taxation Enabled?</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateField('gstSettings.enabled', true)}
                        className={`flex-1 rounded-xl border py-2.5 text-xs font-bold transition ${
                          config.gstSettings?.enabled === true
                            ? 'border-yellow-400 bg-yellow-50/20 text-slate-950'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => updateField('gstSettings.enabled', false)}
                        className={`flex-1 rounded-xl border py-2.5 text-xs font-bold transition ${
                          config.gstSettings?.enabled === false
                            ? 'border-yellow-400 bg-yellow-50/20 text-slate-950'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">Tax Inclusive in Base Fees?</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateField('gstSettings.taxIncluded', true)}
                        className={`flex-1 rounded-xl border py-2.5 text-xs font-bold transition ${
                          config.gstSettings?.taxIncluded === true
                            ? 'border-yellow-400 bg-yellow-50/20 text-slate-950'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => updateField('gstSettings.taxIncluded', false)}
                        className={`flex-1 rounded-xl border py-2.5 text-xs font-bold transition ${
                          config.gstSettings?.taxIncluded === false
                            ? 'border-yellow-400 bg-yellow-50/20 text-slate-950'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SETTLEMENT RULES TAB */}
          {activeTab === 'settlementRules' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-base font-extrabold text-slate-950">Settlement Rules</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Control payout delay and cycle rules across platforms.</p>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">Corporate Settlement Cycle</label>
                    <select
                      value={config.settlementRules?.corporateSettlementCycle || 'weekly'}
                      onChange={(e) => updateField('settlementRules.corporateSettlementCycle', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3.5 text-sm font-semibold text-slate-700 outline-none"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="fortnightly">Fortnightly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">Vendor Settlement Delay</label>
                    <select
                      value={config.settlementRules?.vendorSettlementDelay || 3}
                      onChange={(e) => updateField('settlementRules.vendorSettlementDelay', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3.5 text-sm font-semibold text-slate-700 outline-none"
                    >
                      <option value="3">3 Days</option>
                      <option value="5">5 Days</option>
                      <option value="7">7 Days</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">Labour Salary Cycle</label>
                    <select
                      value={config.settlementRules?.labourSalaryCycle || 'weekly'}
                      onChange={(e) => updateField('settlementRules.labourSalaryCycle', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3.5 text-sm font-semibold text-slate-700 outline-none"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="15 Days">15 Days</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">Payout Approval Type</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateField('settlementRules.approvalType', 'automatic')}
                        className={`flex-1 rounded-xl border py-2.5 text-xs font-bold transition ${
                          config.settlementRules?.approvalType === 'automatic'
                            ? 'border-yellow-400 bg-yellow-50/20 text-slate-950'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        Automatic
                      </button>
                      <button
                        type="button"
                        onClick={() => updateField('settlementRules.approvalType', 'manual')}
                        className={`flex-1 rounded-xl border py-2.5 text-xs font-bold transition ${
                          config.settlementRules?.approvalType === 'manual'
                            ? 'border-yellow-400 bg-yellow-50/20 text-slate-950'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        Manual
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">Minimum Withdrawal (₹)</label>
                    <input
                      type="number"
                      value={config.settlementRules?.minWithdrawal ?? ''}
                      onChange={(e) => updateField('settlementRules.minWithdrawal', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-medium outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">Maximum Withdrawal (₹)</label>
                    <input
                      type="number"
                      value={config.settlementRules?.maxWithdrawal ?? ''}
                      onChange={(e) => updateField('settlementRules.maxWithdrawal', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-medium outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PRICING HISTORY TAB */}
          {activeTab === 'pricingHistory' && (
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-5">
              <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
                <History className="h-5 w-5 text-yellow-500" />
                <h3 className="text-base font-extrabold text-slate-950">Pricing History Revision Logs</h3>
              </div>

              <div className="space-y-4">
                {history.length === 0 ? (
                  <p className="text-sm font-semibold text-slate-400 text-center py-6">No pricing changes recorded.</p>
                ) : (
                  history.map((h, i) => (
                    <div key={h._id || i} className="flex gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/30 text-xs">
                      <div className="flex flex-col items-center">
                        <div className="h-3.5 w-3.5 rounded-full bg-yellow-400 border-4 border-yellow-50 flex items-center justify-center"></div>
                        {i < history.length - 1 && <div className="w-0.5 grow bg-slate-200 my-1"></div>}
                      </div>

                      <div className="space-y-2 grow">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                          <span>{new Date(h.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          <span>{new Date(h.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <p className="text-slate-900 font-extrabold text-sm">“{h.reason}”</p>

                        {h.changes && h.changes.length > 0 ? (
                          <div className="grid gap-1.5 sm:grid-cols-2 bg-white p-2.5 rounded-lg border border-slate-100 font-mono text-[10px]">
                            {h.changes.map((ch, idx) => (
                              <div key={idx} className="flex items-center justify-between text-slate-600 font-bold border-b border-slate-50 pb-1 last:border-0 last:pb-0">
                                <span className="truncate max-w-[150px]">{ch.path}</span>
                                <div className="flex items-center gap-1">
                                  <span className="line-through text-red-500">{ch.oldValue ?? '0'}</span>
                                  <ArrowRight className="h-3 w-3 text-slate-400" />
                                  <span className="text-emerald-600 font-bold">{ch.newValue ?? '0'}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        <p className="text-[10px] text-slate-500 font-medium">
                          Modified by <span className="font-extrabold text-slate-700">{h.updatedBy?.fullName || 'Super Admin'}</span> ({h.updatedBy?.role || 'admin'})
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SAVE CHANGES MODAL */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl border border-slate-100">
            <h3 className="text-base font-extrabold text-slate-950">Confirm Pricing Revisions</h3>
            <p className="text-xs text-slate-500 mt-1.5 font-semibold">
              You are updating active pricing rules. Please state a reasoning statement for revision audit logging.
            </p>

            <div className="mt-4">
              <label className="text-xs font-bold text-slate-600 block mb-1.5">Revision Reason</label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Fiscal adjustment of platform fee and vendor settlement delay configurations..."
                value={revisionReason}
                onChange={(e) => setRevisionReason(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400"
              />
            </div>

            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowSaveModal(false)
                  setRevisionReason('')
                }}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingConfig || !revisionReason.trim()}
                onClick={handleSave}
                className="flex-1 rounded-xl bg-yellow-400 py-2.5 text-xs font-bold text-slate-950 shadow-sm transition hover:bg-yellow-500 active:scale-95 disabled:bg-slate-200 disabled:text-slate-400"
              >
                {isSavingConfig ? 'Saving...' : 'Apply Revision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
