import React, { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Loader2, User as UserIcon, Mail, Phone, Calendar, ShieldCheck,
  CheckCircle2, Wallet, History, Lock, ShieldAlert, FileText, AlertTriangle,
  Trash2, PauseCircle, PlayCircle, Plus, Minus, CreditCard, Clock, Check, X,
  Activity, Eye, Camera, Wrench, HardHat, Layers, Tag, Sparkles, ChevronRight
} from 'lucide-react'
import {
  fetchAdminUserById, patchUserStatusAdmin, addAdminNote,
  updateUserWalletAdmin, getUserTimelineAdmin, reviewLabourKycAdmin,
  fetchUserTransactionsAdmin
} from '../../api/adminUsersApi.js'
import { ApiError, apiRequest } from '../../api/http.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { ROLE_LABELS, USER_ROLES } from '../../constants/userRoles.js'
import { ACCOUNT_STATUS_COLORS, ACCOUNT_STATUS_LABELS, ACCOUNT_STATUSES } from '../../constants/userStatuses.js'
import { formatLastLoginDisplay } from '../../lib/formatAdminLastLogin.js'
import { AdminConfirmActionDialog } from '../../components/admin/AdminConfirmActionDialog.jsx'
import { AdminUserSkillsModal } from '../../components/admin/AdminUserSkillsModal.jsx'


function getWorkerKycDocumentSlots(labourProfile, user = null) {
  if (!labourProfile) return []
  const photos = Array.isArray(labourProfile.kycPhotos) ? labourProfile.kycPhotos : []

  const findUrl = (type, keys, labelMatches) => {
    for (const key of keys) {
      if (labourProfile[key]) return labourProfile[key]
    }
    const p = photos.find((item) => {
      if (!item?.url) return false
      if (item.type && item.type.toLowerCase() === type.toLowerCase()) return true
      const lbl = (item.label || '').toLowerCase()
      return labelMatches.some((match) => lbl.includes(match.toLowerCase()))
    })
    if (p?.url) return p.url
    if (type === 'selfie' && user?.profileImageUrl) return user.profileImageUrl
    return ''
  }

  const frontUrl = findUrl('aadhaar_front', ['kycFrontImageUrl', 'kycFrontImageDataUrl', 'frontImageUrl'], ['front', 'aadhaar front', 'aadhar front'])
  const backUrl = findUrl('aadhaar_back', ['kycBackImageUrl', 'kycBackImageDataUrl', 'backImageUrl'], ['back', 'aadhaar back', 'aadhar back'])
  const panUrl = findUrl('pan', ['kycPanImageUrl', 'panImageUrl'], ['pan', 'pancard', 'pan card'])
  const selfieUrl = findUrl('selfie', ['kycSelfieUrl', 'selfieUrl'], ['selfie', 'face', 'photo', 'worker selfie'])

  const slots = [
    { id: 'aadhaar_front', label: 'Aadhaar Card (Front)', url: frontUrl, isRequired: true },
    { id: 'aadhaar_back', label: 'Aadhaar Card (Back)', url: backUrl, isRequired: true },
    { id: 'pan', label: 'PAN Card / Certificate', url: panUrl, isRequired: true },
    { id: 'selfie', label: 'Worker Selfie / Face Photo', url: selfieUrl, isRequired: false },
  ]

  const primaryUrls = new Set([frontUrl, backUrl, panUrl, selfieUrl].filter(Boolean))
  const extras = photos
    .filter((p) => p?.url && !primaryUrls.has(p.url))
    .map((p, i) => ({
      id: `extra_${i}`,
      label: p.label || `Additional Document #${i + 1}`,
      url: p.url,
      isRequired: false,
    }))

  return [...slots, ...extras]
}

function getWorkerKycPhotos(labourProfile, user = null) {
  return getWorkerKycDocumentSlots(labourProfile, user).filter((s) => Boolean(s.url))
}

function getBusinessKycDocumentSlots(profile, user = null, role = 'contractor') {
  if (!profile) return []
  const photos = Array.isArray(profile.kycPhotos) ? profile.kycPhotos : []
  const docs = Array.isArray(profile.documents) ? profile.documents : []

  const findUrl = (type, keys, labelMatches) => {
    for (const key of keys) {
      if (profile[key]) return profile[key]
    }
    const p = photos.find((item) => {
      if (!item?.url) return false
      if (item.type && item.type.toLowerCase() === type.toLowerCase()) return true
      const lbl = (item.label || '').toLowerCase()
      return labelMatches.some((match) => lbl.includes(match.toLowerCase()))
    })
    if (p?.url) return p.url
    const d = docs.find((item) => {
      if (!item?.url) return false
      const dtype = (item.documentType || '').toLowerCase()
      if (dtype === type.toLowerCase()) return true
      const lbl = (item.label || '').toLowerCase()
      return labelMatches.some((match) => lbl.includes(match.toLowerCase()))
    })
    if (d?.url) return d.url
    if (type === 'selfie' && user?.profileImageUrl) return user.profileImageUrl
    return ''
  }

  const frontUrl = findUrl('aadhaar_front', ['kycFrontImageUrl', 'frontImageUrl'], ['front', 'aadhaar front', 'aadhar front', 'signatory id', 'proprietor id'])
  const backUrl = findUrl('aadhaar_back', ['kycBackImageUrl', 'backImageUrl'], ['back', 'aadhaar back', 'aadhar back'])
  const panUrl = findUrl('pan', ['kycPanImageUrl', 'panImageUrl'], ['pan', 'pancard', 'pan card'])
  const selfieUrl = findUrl('selfie', ['kycSelfieUrl', 'selfieUrl'], ['selfie', 'face', 'photo', 'proprietor selfie', 'representative selfie', 'signatory photo'])

  const isCorp = role === 'corporate' || role === 'enterprise'

  const slots = [
    { id: 'aadhaar_front', label: isCorp ? 'Signatory Aadhaar (Front)' : 'Aadhaar Card (Front)', url: frontUrl, isRequired: true },
    { id: 'aadhaar_back', label: isCorp ? 'Signatory Aadhaar (Back)' : 'Aadhaar Card (Back)', url: backUrl, isRequired: true },
    { id: 'pan', label: isCorp ? 'Company PAN Card' : 'Business PAN Card', url: panUrl, isRequired: true },
    { id: 'selfie', label: isCorp ? 'Signatory Live Photo' : 'Proprietor Live Photo', url: selfieUrl, isRequired: false },
  ]

  const primaryUrls = new Set([frontUrl, backUrl, panUrl, selfieUrl].filter(Boolean))
  const extraPhotos = photos
    .filter((p) => p?.url && !primaryUrls.has(p.url))
    .map((p, i) => ({
      id: `photo_extra_${i}`,
      label: p.label || `Photo Document #${i + 1}`,
      url: p.url,
      isRequired: false,
    }))
  const extraDocs = docs
    .filter((d) => d?.url && !primaryUrls.has(d.url))
    .map((d, i) => ({
      id: `doc_extra_${i}`,
      label: d.label || `Attached File #${i + 1}`,
      url: d.url,
      isRequired: false,
    }))

  return [...slots, ...extraPhotos, ...extraDocs]
}

function StatusBadge({ status, active }) {
  const accountStatus = status || (active !== false ? ACCOUNT_STATUSES.ACTIVE : ACCOUNT_STATUSES.DELETED)
  const colorClass = ACCOUNT_STATUS_COLORS[accountStatus] || ACCOUNT_STATUS_COLORS[ACCOUNT_STATUSES.ACTIVE]
  const label = ACCOUNT_STATUS_LABELS[accountStatus] || 'Active'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ring-1 ${colorClass}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  )
}

function getVerificationStatusInfo(user) {
  if (!user) return null
  const role = user.role

  if (role === 'labour') {
    const kyc = user.labourProfile?.kycStatus
    if (kyc === 'verified') return { label: 'Verified', status: 'verified', color: 'bg-emerald-50 text-emerald-800 ring-emerald-200' }
    if (kyc === 'failed') return { label: 'Failed', status: 'failed', color: 'bg-rose-50 text-rose-800 ring-rose-200' }
    if (user.labourProfile?.kycSubmittedAt) return { label: 'Not Verified (Under Review)', status: 'pending', color: 'bg-sky-50 text-sky-800 ring-sky-200' }
    return { label: 'Not Verified', status: 'pending', color: 'bg-amber-50 text-amber-800 ring-amber-200' }
  }

  if (role === 'contractor') {
    const st = user.contractorProfile?.verificationStatus
    if (st === 'approved') return { label: 'Verified', status: 'verified', color: 'bg-emerald-50 text-emerald-800 ring-emerald-200' }
    if (st === 'rejected') return { label: 'Failed', status: 'failed', color: 'bg-rose-50 text-rose-800 ring-rose-200' }
    if (user.contractorProfile?.documentsSubmittedAt) return { label: 'Not Verified (Under Review)', status: 'pending', color: 'bg-sky-50 text-sky-800 ring-sky-200' }
    return { label: 'Not Verified', status: 'pending', color: 'bg-amber-50 text-amber-800 ring-amber-200' }
  }

  if (role === 'corporate') {
    const st = user.corporateProfile?.status
    if (st === 'approved') return { label: 'Verified', status: 'verified', color: 'bg-emerald-50 text-emerald-800 ring-emerald-200' }
    if (st === 'rejected') return { label: 'Failed', status: 'failed', color: 'bg-rose-50 text-rose-800 ring-rose-200' }
    if (user.corporateProfile?.documentsSubmittedAt) return { label: 'Not Verified (Under Review)', status: 'pending', color: 'bg-sky-50 text-sky-800 ring-sky-200' }
    return { label: 'Not Verified', status: 'pending', color: 'bg-amber-50 text-amber-800 ring-amber-200' }
  }

  if (role === 'enterprise') {
    const st = user.enterpriseProfile?.status
    if (st === 'approved') return { label: 'Verified', status: 'verified', color: 'bg-emerald-50 text-emerald-800 ring-emerald-200' }
    if (st === 'rejected') return { label: 'Failed', status: 'failed', color: 'bg-rose-50 text-rose-800 ring-rose-200' }
    return { label: 'Not Verified', status: 'pending', color: 'bg-amber-50 text-amber-800 ring-amber-200' }
  }

  return null
}

function KycVerificationBadge({ user }) {
  const info = getVerificationStatusInfo(user)
  if (!info) return null
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ring-1 ${info.color}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      KYC: {info.label}
    </span>
  )
}

export function AdminUserDetailsPage() {
  const { id } = useParams()
  const [user, setUser] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [walletTransactions, setWalletTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('overview') // overview, skills, role, wallet, timeline
  const [isSkillsModalOpen, setIsSkillsModalOpen] = useState(false)

  // Dialog State
  const [dialogConfig, setDialogConfig] = useState({ isOpen: false })
  const [zoomImage, setZoomImage] = useState(null)


  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [userData, logs, txs] = await Promise.all([
        fetchAdminUserById(id),
        getUserTimelineAdmin(id).catch(() => []),
        fetchUserTransactionsAdmin(id).catch(() => []),
      ])
      if (userData) {
        setUser(userData)
        setTimeline(logs)
        setWalletTransactions(txs)
      } else {
        setError('User not found')
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load user details')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openDialog = (config) => setDialogConfig({ isOpen: true, ...config })
  const closeDialog = () => setDialogConfig({ isOpen: false })

  const handleStatusChange = async (newStatus, reason) => {
    try {
      const updatedUser = await patchUserStatusAdmin(id, newStatus, reason)
      setUser(updatedUser)
      const logs = await getUserTimelineAdmin(id)
      setTimeline(logs)
      closeDialog()
    } catch (e) {
      alert(e.message)
    }
  }

  const handleWalletAction = async (action, amount, reason) => {
    try {
      const updatedUser = await updateUserWalletAdmin(id, action, amount, reason)
      setUser(updatedUser)
      const [logs, txs] = await Promise.all([
        getUserTimelineAdmin(id).catch(() => []),
        fetchUserTransactionsAdmin(id).catch(() => []),
      ])
      setTimeline(logs)
      setWalletTransactions(txs)
      closeDialog()
    } catch (e) {
      alert(e.message)
    }
  }

  const handleKycReview = async (decision, reason) => {
    try {
      const updatedUser = await reviewLabourKycAdmin(id, { decision, note: reason })
      setUser(updatedUser)
      const logs = await getUserTimelineAdmin(id)
      setTimeline(logs)
      closeDialog()
    } catch (e) {
      alert(e.message)
    }
  }

  const handleBusinessReview = async (targetRole, decision, reason) => {
    try {
      let endpoint
      let method = 'PATCH'
      let body = { decision, reviewNote: reason }
      if (targetRole === 'corporate') {
        endpoint = `/admin/workforce/corporates/${id}/review`
      } else if (targetRole === 'enterprise') {
        endpoint = `/admin/enterprise/companies/${id}/status`
        method = 'PUT'
        body = { status: decision, reviewNote: reason }
      } else {
        endpoint = `/admin/workforce/vendors/${id}/review`
      }
      await apiRequest(endpoint, {
        method,
        body
      })
      await loadData()
      closeDialog()
    } catch (e) {
      alert(e?.message || 'Review action failed')
    }
  }

  const handleAddNote = async (e) => {
    e.preventDefault()
    const form = e.target
    const text = form.note.value
    if (!text.trim()) return
    try {
      const updatedUser = await addAdminNote(id, text)
      setUser(updatedUser)
      const logs = await getUserTimelineAdmin(id)
      setTimeline(logs)
      form.reset()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <p className="text-sm font-medium text-slate-600">Loading enterprise profile...</p>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="w-full space-y-6">
        <Link to="/admin/users" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Back to users
        </Link>
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50 p-6 text-center">
          <p className="text-lg font-bold text-rose-900">{error || 'User not found'}</p>
        </div>
      </div>
    )
  }

  const currentStatus = user.accountStatus || (user.isActive !== false ? ACCOUNT_STATUSES.ACTIVE : ACCOUNT_STATUSES.DELETED)

  const isWorker = user.role === USER_ROLES.LABOUR || Boolean(user.labourProfile)
  const isContractor = user.role === USER_ROLES.CONTRACTOR || Boolean(user.contractorProfile)
  const hasSkillsTab = isWorker || isContractor

  const tabs = [
    { id: 'overview', label: 'Overview', icon: UserIcon },
    ...(hasSkillsTab ? [{ id: 'skills', label: isContractor ? 'Trades & Capabilities' : 'Skills & Categories', icon: Wrench }] : []),
    { id: 'role', label: 'Role Specifics', icon: ShieldCheck },
    { id: 'wallet', label: 'Wallet & Finance', icon: Wallet },
    { id: 'timeline', label: 'Activity Timeline', icon: History }
  ]

  const assignedCategories = (isContractor ? user.contractorProfile?.categoryIds : user.labourProfile?.categoryIds) || []
  const customSkillTags = (isContractor ? user.contractorProfile?.skills : user.labourProfile?.skills) || []

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-20">
      <AdminConfirmActionDialog
        {...dialogConfig}
        onClose={closeDialog}
      />

      <AdminUserSkillsModal
        isOpen={isSkillsModalOpen}
        onClose={() => setIsSkillsModalOpen(false)}
        user={user}
        onSuccess={(updated) => {
          if (updated) setUser(updated)
          loadData()
        }}
      />

      {/* HEADER SECTION */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <Link to="/admin/users" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition">
          <ArrowLeft className="h-4 w-4" /> Back to users
        </Link>
        
        <GlassPanel className="p-6 md:p-8 relative overflow-hidden">
          {/* Background decorative blob */}
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand/5 blur-3xl" />
          
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {user.profileImageUrl ? (
                <img src={user.profileImageUrl} alt="" className="h-24 w-24 rounded-2xl object-cover shadow-sm ring-1 ring-slate-200" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-brand/10 text-brand ring-1 ring-brand/20 shadow-sm">
                  <UserIcon className="h-10 w-10" />
                </div>
              )}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-black text-slate-900">{user.fullName || 'Unnamed User'}</h1>
                  <StatusBadge status={user.accountStatus} active={user.isActive !== false} />
                  <KycVerificationBadge user={user} />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-600">
                  <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-700 ring-1 ring-slate-200/90">
                    {ROLE_LABELS[user.role] || user.role}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" /> +91 {user.phone}</span>
                  {user.email && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" /> {user.email}</span>
                    </>
                  )}
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" /> Registered: {new Date(user.createdAt).toLocaleDateString()}
                  <span>|</span>
                  Last active: {formatLastLoginDisplay(user.lastLoginAt) || 'Never'}
                </div>

                {/* Worker Skills Pill Badges in Header */}
                {isWorker && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                    <span className="flex items-center gap-1 text-xs font-bold text-slate-600">
                      <Wrench className="h-3.5 w-3.5 text-brand" /> Skills:
                    </span>
                    {assignedCategories.length === 0 && customSkillTags.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">No skills assigned</span>
                    ) : (
                      <>
                        {assignedCategories.slice(0, 4).map((cat, idx) => {
                          const catName = typeof cat === 'object' && cat?.name ? cat.name : String(cat)
                          return (
                            <span
                              key={`hd-cat-${idx}`}
                              className="inline-flex items-center rounded-lg bg-brand/10 px-2.5 py-0.5 text-xs font-bold text-brand ring-1 ring-brand/20"
                            >
                              {catName}
                            </span>
                          )
                        })}
                        {assignedCategories.length > 4 && (
                          <span className="text-xs font-semibold text-slate-500">
                            +{assignedCategories.length - 4} more
                          </span>
                        )}
                        {customSkillTags.slice(0, 2).map((skill, idx) => (
                          <span
                            key={`hd-sk-${idx}`}
                            className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 border border-slate-200"
                          >
                            {skill}
                          </span>
                        ))}
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsSkillsModalOpen(true)}
                      className="ml-1 text-xs font-bold text-brand hover:underline cursor-pointer"
                    >
                      {assignedCategories.length === 0 && customSkillTags.length === 0 ? '+ Assign' : 'Edit'}
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="flex gap-4 self-start">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-right min-w-[120px]">
                <p className="text-xs font-bold uppercase text-slate-500">Wallet</p>
                <p className="mt-1 text-xl font-black text-slate-900">₹{user.walletBalance?.toLocaleString() || 0}</p>
              </div>
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* LEFT COLUMN: ACTION PANEL */}
        <div className="space-y-4 lg:col-span-1">
          <GlassPanel className="p-4 sticky top-6">
            <h3 className="mb-4 text-xs font-black uppercase tracking-wider text-slate-400">Enterprise Actions</h3>
            
            <div className="space-y-2">
              {isWorker && (
                <button
                  onClick={() => setIsSkillsModalOpen(true)}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-brand transition hover:bg-brand/10 cursor-pointer"
                >
                  <Wrench className="h-4 w-4" /> Manage Skills
                </button>
              )}

              {currentStatus !== ACCOUNT_STATUSES.ACTIVE && (
                <button
                  onClick={() => openDialog({
                    title: 'Reactivate Account',
                    description: 'This will restore the user\'s access to the platform.',
                    confirmText: 'Reactivate',
                    requireReason: true,
                    onConfirm: ({ reason }) => handleStatusChange(ACCOUNT_STATUSES.ACTIVE, reason)
                  })}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                >
                  <PlayCircle className="h-4 w-4" /> Reactivate Account
                </button>
              )}

              {currentStatus !== ACCOUNT_STATUSES.HOLD && currentStatus !== ACCOUNT_STATUSES.DELETED && (
                <button
                  onClick={() => openDialog({
                    title: 'Put Account On Hold',
                    description: 'User can login but cannot accept new jobs or make withdrawals.',
                    confirmText: 'Place on Hold',
                    requireReason: true,
                    isDestructive: true,
                    onConfirm: ({ reason }) => handleStatusChange(ACCOUNT_STATUSES.HOLD, reason)
                  })}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-orange-700 transition hover:bg-orange-50"
                >
                  <PauseCircle className="h-4 w-4" /> Put On Hold
                </button>
              )}

              {currentStatus !== ACCOUNT_STATUSES.SUSPENDED && currentStatus !== ACCOUNT_STATUSES.DELETED && (
                <button
                  onClick={() => openDialog({
                    title: 'Suspend Account',
                    description: 'User can login but everything is disabled. Support message will be shown.',
                    confirmText: 'Suspend',
                    requireReason: true,
                    isDestructive: true,
                    onConfirm: ({ reason }) => handleStatusChange(ACCOUNT_STATUSES.SUSPENDED, reason)
                  })}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                >
                  <ShieldAlert className="h-4 w-4" /> Suspend Account
                </button>
              )}

              {currentStatus !== ACCOUNT_STATUSES.BLOCKED && currentStatus !== ACCOUNT_STATUSES.DELETED && (
                <button
                  onClick={() => openDialog({
                    title: 'Block Account',
                    description: 'User will be immediately logged out and cannot login again.',
                    confirmText: 'Block',
                    requireReason: true,
                    isDestructive: true,
                    onConfirm: ({ reason }) => handleStatusChange(ACCOUNT_STATUSES.BLOCKED, reason)
                  })}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                >
                  <Lock className="h-4 w-4" /> Block Account
                </button>
              )}
              
              <hr className="my-2 border-slate-100" />

              <button
                onClick={() => setActiveTab('wallet')}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Wallet className="h-4 w-4" /> Adjust Wallet
              </button>

              {currentStatus !== ACCOUNT_STATUSES.DELETED && (
                <>
                  <hr className="my-2 border-slate-100" />
                  <button
                    onClick={() => openDialog({
                      title: 'Soft Delete Account',
                      description: 'This will hide the user from the platform but preserve their data in the database.',
                      confirmText: 'Soft Delete',
                      requireReason: true,
                      isDestructive: true,
                      onConfirm: ({ reason }) => handleStatusChange(ACCOUNT_STATUSES.DELETED, reason)
                    })}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" /> Soft Delete
                  </button>
                </>
              )}
            </div>
          </GlassPanel>
        </div>

        {/* RIGHT COLUMN: TABS & CONTENT */}
        <div className="space-y-6 lg:col-span-3">
          {/* Tabs */}
          <div className="flex overflow-x-auto rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-900/5 hide-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>


          {/* TAB CONTENT */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'overview' && (
                <div className="grid gap-6 sm:grid-cols-2">
                  <GlassPanel className="p-6">
                    <h2 className="mb-5 text-sm font-bold uppercase tracking-wide text-slate-400">System Metrics</h2>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                        <span className="text-sm font-medium text-slate-500">Account ID</span>
                        <span className="font-mono text-sm font-semibold text-slate-900">{user._id}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                        <span className="text-sm font-medium text-slate-500">Last Active</span>
                        <span className="text-sm font-semibold text-slate-900">{formatLastLoginDisplay(user.lastLoginAt) || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between pb-3">
                        <span className="text-sm font-medium text-slate-500">Device Count</span>
                        <span className="text-sm font-semibold text-slate-900">
                          {((user.fcmTokensWeb?.length || 0) + (user.fcmTokensMobile?.length || 0))} registered
                        </span>
                      </div>
                    </div>
                  </GlassPanel>

                  {hasSkillsTab && (
                    <GlassPanel className="p-6">
                      <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
                          {isContractor ? 'Workforce Trades & Capabilities' : 'Skills & Specializations'}
                        </h2>
                        <button
                          type="button"
                          onClick={() => setIsSkillsModalOpen(true)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline cursor-pointer"
                        >
                          <Wrench className="h-3.5 w-3.5" /> Manage
                        </button>
                      </div>

                      {assignedCategories.length === 0 && customSkillTags.length === 0 ? (
                        <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center p-4">
                          <HardHat className="h-6 w-6 text-slate-300" />
                          <p className="mt-1 text-xs font-semibold text-slate-600">
                            {isContractor ? 'No workforce trades assigned yet' : 'No skills assigned yet'}
                          </p>
                          <button
                            type="button"
                            onClick={() => setIsSkillsModalOpen(true)}
                            className="mt-2 text-xs font-bold text-brand underline cursor-pointer"
                          >
                            {isContractor ? '+ Assign Trades & Capabilities' : '+ Assign Skills & Roles'}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                            {assignedCategories.map((cat, idx) => {
                              const catName = typeof cat === 'object' && cat?.name ? cat.name : String(cat)
                              const groupName = typeof cat === 'object' && cat?.group?.name ? cat.group.name : null
                              return (
                                <span
                                  key={`ov-cat-${idx}`}
                                  title={groupName ? `Category: ${groupName}` : undefined}
                                  className="inline-flex items-center gap-1 rounded-lg bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand ring-1 ring-brand/20"
                                >
                                  <Check className="h-3 w-3 stroke-[3]" />
                                  {catName}
                                </span>
                              )
                            })}
                          </div>

                          {customSkillTags.length > 0 && (
                            <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                              {customSkillTags.map((skill, idx) => (
                                <span
                                  key={`ov-sk-${idx}`}
                                  className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200"
                                >
                                  <Tag className="h-3 w-3 text-slate-400" />
                                  {skill}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </GlassPanel>
                  )}

                  <GlassPanel className={`p-6 ${!hasSkillsTab ? '' : 'sm:col-span-2'}`}>
                    <h2 className="mb-5 text-sm font-bold uppercase tracking-wide text-slate-400">Platform Usage</h2>
                    <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center">
                      <Activity className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-2 text-sm font-semibold text-slate-600">No active bookings</p>
                      <p className="text-xs text-slate-400">History fetched dynamically</p>
                    </div>
                  </GlassPanel>
                </div>
              )}

              {activeTab === 'skills' && hasSkillsTab && (
                <div className="space-y-6">
                  <GlassPanel className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand ring-1 ring-brand/20">
                          <HardHat className="h-6 w-6" />
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-slate-900">
                            {isContractor ? 'Vendor Workforce Trades & Capabilities' : 'Worker Skills & Work Categories'}
                          </h2>
                          <p className="text-xs text-slate-500">
                            {isContractor
                              ? 'Assigned trade roles determine which vendor allocations and project tenders this vendor can supply.'
                              : 'Assigned trade roles determine which construction and marketplace jobs this worker receives.'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsSkillsModalOpen(true)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand/90 cursor-pointer"
                      >
                        <Wrench className="h-4 w-4" /> {isContractor ? 'Manage Workforce Trades' : 'Manage Skills & Roles'}
                      </button>
                    </div>

                    {assignedCategories.length === 0 && customSkillTags.length === 0 ? (
                      <div className="py-12 text-center space-y-3">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <Wrench className="h-7 w-7" />
                        </div>
                        <p className="text-base font-bold text-slate-800">
                          {isContractor ? 'No Trades Configured' : 'No Skills Configured'}
                        </p>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          {isContractor
                            ? 'This vendor has not registered any workforce trades yet. Assign trade skills so they can be matched with tenders and crew allocations.'
                            : 'This worker has not selected any trade skills yet. Assign skills so they can be matched to workforce allocations and client bookings.'}
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsSkillsModalOpen(true)}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 cursor-pointer"
                        >
                          {isContractor ? '+ Assign Workforce Trades Now' : '+ Assign Trade Skills Now'}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-6 pt-6">
                        {/* Active Categories Grid */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                              Assigned Trade Categories ({assignedCategories.length})
                            </h3>
                            <span className="text-xs text-slate-400">Synced with Catalogue</span>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {assignedCategories.map((cat, idx) => {
                              const isObj = typeof cat === 'object' && cat !== null
                              const name = isObj ? cat.name : String(cat)
                              const subtitle = isObj ? cat.subtitle : ''
                              const groupName = isObj && cat.group?.name ? cat.group.name : 'General Work'
                              const baseRate = isObj && cat.baseRate ? cat.baseRate : null
                              const groupKind = isObj && cat.group?.kind ? cat.group.kind : 'trade'

                              return (
                                <div
                                  key={`sk-card-${idx}`}
                                  className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition hover:border-brand/30 hover:shadow-sm"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2.5">
                                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-xs font-black text-brand">
                                        {name?.charAt(0) || '•'}
                                      </div>
                                      <div>
                                        <p className="text-sm font-bold text-slate-900">{name}</p>
                                        <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                                          {groupName}
                                        </span>
                                      </div>
                                    </div>

                                    {baseRate ? (
                                      <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                                        ₹{baseRate}/d
                                      </span>
                                    ) : null}
                                  </div>

                                  {subtitle && (
                                    <p className="mt-2.5 text-xs text-slate-500 leading-relaxed line-clamp-2">
                                      {subtitle}
                                    </p>
                                  )}

                                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px]">
                                    <span className="font-semibold text-emerald-700 flex items-center gap-1">
                                      <Check className="h-3 w-3 stroke-[3]" /> Active Match
                                    </span>
                                    <span className="capitalize text-slate-400 font-medium">
                                      {groupKind}
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Custom Keywords / Tags */}
                        {customSkillTags.length > 0 && (
                          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-5 space-y-3">
                            <div className="flex items-center gap-2">
                              <Tag className="h-4 w-4 text-slate-500" />
                              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                                Custom Skill Keywords & Specialties ({customSkillTags.length})
                              </h3>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {customSkillTags.map((skill, idx) => (
                                <span
                                  key={`csk-${idx}`}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 border border-slate-200 shadow-xs"
                                >
                                  <Sparkles className="h-3 w-3 text-amber-500" />
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </GlassPanel>
                </div>
              )}

              {activeTab === 'role' && (
                <div className="space-y-6">
                  {user.labourProfile && (
                    <GlassPanel className="p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <HardHat className="h-4 w-4 text-brand" />
                          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
                            Assigned Skills & Specializations
                          </h2>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsSkillsModalOpen(true)}
                          className="inline-flex items-center gap-1 rounded-lg bg-brand/10 px-3 py-1 text-xs font-bold text-brand transition hover:bg-brand/20 cursor-pointer"
                        >
                          <Wrench className="h-3.5 w-3.5" /> Edit Skills
                        </button>
                      </div>

                      {assignedCategories.length === 0 && customSkillTags.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">No skills or categories assigned to this worker yet.</p>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            {assignedCategories.map((cat, idx) => {
                              const name = typeof cat === 'object' && cat?.name ? cat.name : String(cat)
                              const subtitle = typeof cat === 'object' && cat?.subtitle ? `(${cat.subtitle})` : ''
                              return (
                                <span
                                  key={`role-cat-${idx}`}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand/10 px-3 py-1.5 text-xs font-bold text-brand ring-1 ring-brand/20"
                                >
                                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                                  {name} {subtitle}
                                </span>
                              )
                            })}
                          </div>
                          {customSkillTags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {customSkillTags.map((skill, idx) => (
                                <span
                                  key={`role-sk-${idx}`}
                                  className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200"
                                >
                                  <Tag className="h-3 w-3 text-slate-400" />
                                  {skill}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </GlassPanel>
                  )}

                  {user.labourProfile && (
                    <GlassPanel className="p-6 space-y-5">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Labour KYC Review</h2>
                        {(() => {
                          const kyc = user.labourProfile.kycStatus
                          if (kyc === 'verified') {
                            return (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Verified
                              </span>
                            )
                          }
                          if (kyc === 'failed') {
                            return (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-800 ring-1 ring-rose-200">
                                <X className="h-3.5 w-3.5 text-rose-600" /> Failed
                              </span>
                            )
                          }
                          return (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
                              <Clock className="h-3.5 w-3.5 text-amber-600" /> Not Verified
                            </span>
                          )
                        })()}
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Aadhaar (Full)</p>
                          <p className="mt-1 font-mono text-lg font-medium text-slate-900">{user.labourProfile.aadhaarNumber || user.labourProfile.aadhaarMasked || '—'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">PAN (Full)</p>
                          <p className="mt-1 font-mono text-lg font-medium text-slate-900">{user.labourProfile.panNumber || user.labourProfile.panMasked || '—'}</p>
                        </div>
                      </div>

                      {/* KYC Photos Grid */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            KYC Photos & Documents
                          </p>
                          {(() => {
                            const slots = getWorkerKycDocumentSlots(user.labourProfile, user)
                            const uploadedCount = slots.filter((s) => Boolean(s.url)).length
                            if (uploadedCount === 0) {
                              return (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100/80 px-2.5 py-0.5 rounded-full border border-amber-300">
                                  ⚠️ No Photos Uploaded (0/{slots.length})
                                </span>
                              )
                            }
                            return (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-300">
                                ✓ {uploadedCount} of {slots.length} Photos Uploaded
                              </span>
                            )
                          })()}
                        </div>

                        {(() => {
                          const slots = getWorkerKycDocumentSlots(user.labourProfile, user)
                          const uploadedCount = slots.filter((s) => Boolean(s.url)).length

                          return (
                            <div className="space-y-3">
                              {uploadedCount === 0 && (
                                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 space-y-1">
                                  <p className="font-bold text-amber-900 flex items-center gap-1.5">
                                    <span>⚠️ No KYC photos submitted by this worker.</span>
                                  </p>
                                  <p className="text-amber-800/90 font-medium leading-relaxed">
                                    Worker submitted Aadhaar/PAN numbers without attaching photo documents. You can review the numbers offline or approve/reject accordingly.
                                  </p>
                                </div>
                              )}

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {slots.map((slot) => (
                                  <div
                                    key={slot.id}
                                    className={`group relative overflow-hidden rounded-xl border transition ${
                                      slot.url
                                        ? 'border-emerald-200 bg-white shadow-sm'
                                        : 'border-dashed border-slate-200 bg-slate-50/70'
                                    }`}
                                  >
                                    {slot.url ? (
                                      <div className="relative aspect-4/3 w-full overflow-hidden bg-slate-900/10">
                                        <img
                                          src={slot.url}
                                          alt={slot.label}
                                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => setZoomImage({ url: slot.url, title: slot.label })}
                                          className="absolute inset-0 flex items-center justify-center bg-slate-950/40 opacity-0 transition group-hover:opacity-100 text-white font-bold text-xs gap-1.5 cursor-pointer"
                                        >
                                          <Eye className="h-4 w-4" /> View Full
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="aspect-4/3 w-full flex flex-col items-center justify-center p-2 text-center bg-slate-100/50">
                                        <Camera className="h-6 w-6 text-slate-300 mb-1" />
                                        <span className="text-[10px] font-bold text-slate-400">No image</span>
                                      </div>
                                    )}

                                    <div className="p-2.5 bg-white border-t border-slate-100 flex flex-col gap-1">
                                      <p className="text-[11px] font-bold text-slate-800 truncate" title={slot.label}>
                                        {slot.label}
                                      </p>
                                      <div className="flex items-center justify-between mt-0.5">
                                        {slot.url ? (
                                          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                            ✓ Uploaded
                                          </span>
                                        ) : (
                                          <span className="text-[9px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                            {slot.isRequired ? '❌ Not uploaded' : '— Optional'}
                                          </span>
                                        )}
                                        {slot.url ? (
                                          <button
                                            type="button"
                                            onClick={() => setZoomImage({ url: slot.url, title: slot.label })}
                                            className="text-brand hover:text-brand/80 text-[10px] font-bold shrink-0 ml-1 cursor-pointer"
                                          >
                                            Zoom
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })()}
                      </div>

                      {/* Legacy Video Display */}
                      {user.labourProfile.kycVideoUrl && (
                        <div>
                          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Recorded KYC Video (Legacy)</p>
                          <video
                            src={user.labourProfile.kycVideoUrl}
                            controls
                            playsInline
                            className="aspect-video max-w-md w-full rounded-xl border border-slate-200/90 bg-slate-950 object-contain"
                          />
                        </div>
                      )}
                      
                      {user.labourProfile.kycStatus === 'pending' && (
                        <div className="flex gap-3 pt-4 border-t border-slate-100">
                          <button
                            onClick={() => {
                              const photos = getWorkerKycPhotos(user.labourProfile, user)
                              const hasAadhaarFront = Boolean(user.labourProfile?.kycFrontImageUrl || user.labourProfile?.kycFrontImageDataUrl)
                              const hasAadhaarBack = Boolean(user.labourProfile?.kycBackImageUrl || user.labourProfile?.kycBackImageDataUrl)
                              const hasPan = Boolean(user.labourProfile?.kycPanImageUrl)
                              const hasMandatoryDocs = (hasAadhaarFront && hasAadhaarBack && hasPan) || photos.length >= 3
                              openDialog({
                                title: hasMandatoryDocs ? 'Approve KYC' : '⚠️ Missing Mandatory Documents',
                                description: hasMandatoryDocs
                                  ? 'Are you sure you want to approve this labour account? They will be able to start accepting jobs immediately.'
                                  : 'This worker has NOT submitted all mandatory KYC documents (Aadhaar Front, Back, and PAN Card). Are you sure you still want to verify and approve this account anyway?',
                                confirmText: hasMandatoryDocs ? 'Approve' : 'Yes, Verify Anyway',
                                onConfirm: () => handleKycReview('approved', '')
                              })
                            }}
                            className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 cursor-pointer"
                          >
                            Approve KYC
                          </button>
                          <button
                            onClick={() => openDialog({
                              title: 'Reject KYC',
                              description: 'Are you sure you want to reject this KYC? Please provide a reason.',
                              confirmText: 'Reject',
                              isDestructive: true,
                              requireReason: true,
                              onConfirm: ({ reason }) => handleKycReview('rejected', reason)
                            })}
                            className="flex-1 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-bold text-rose-700 shadow-sm transition hover:bg-rose-100 cursor-pointer"
                          >
                            Reject KYC
                          </button>
                        </div>
                      )}
                    </GlassPanel>
                  )}

                  {user.corporateProfile && (
                    <GlassPanel className="p-6 space-y-5">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Corporate Registration & KYC</h2>
                        {(() => {
                          const st = user.corporateProfile.status || 'pending'
                          if (st === 'approved') {
                            return (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Verified
                              </span>
                            )
                          }
                          if (st === 'rejected') {
                            return (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-800 ring-1 ring-rose-200">
                                <X className="h-3.5 w-3.5 text-rose-600" /> Failed
                              </span>
                            )
                          }
                          return (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
                              <Clock className="h-3.5 w-3.5 text-amber-600" /> Not Verified
                            </span>
                          )
                        })()}
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Company Name</p>
                          <p className="mt-1 text-base font-bold text-slate-900">{user.corporateProfile.companyName || '—'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">GST Number</p>
                          <p className="mt-1 font-mono text-base font-medium text-slate-900">{user.corporateProfile.gstNumber || '—'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">PAN Number</p>
                          <p className="mt-1 font-mono text-base font-medium text-slate-900">{user.corporateProfile.panNumber || '—'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">CIN Number</p>
                          <p className="mt-1 font-mono text-base font-medium text-slate-900">{user.corporateProfile.cinNumber || '—'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Contact Person</p>
                          <p className="mt-1 text-base font-medium text-slate-900">{user.corporateProfile.contactPersonName || '—'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Contact Email</p>
                          <p className="mt-1 text-base font-medium text-slate-900">{user.corporateProfile.contactEmail || '—'}</p>
                        </div>
                      </div>
                      {user.corporateProfile.registeredAddress && (
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Registered Address</p>
                          <p className="mt-1 text-sm text-slate-800">{user.corporateProfile.registeredAddress}, {user.corporateProfile.city}, {user.corporateProfile.state} - {user.corporateProfile.pincode}</p>
                        </div>
                      )}

                      {/* Corporate KYC Photos Grid */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            KYC Photos & Documents (Signatory Aadhaar, PAN, Selfie)
                          </p>
                          {(() => {
                            const slots = getBusinessKycDocumentSlots(user.corporateProfile, user, 'corporate')
                            const uploadedCount = slots.filter((s) => Boolean(s.url)).length
                            return (
                              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                                uploadedCount === 0
                                  ? 'text-amber-700 bg-amber-100/80 border-amber-300'
                                  : 'text-emerald-700 bg-emerald-100/80 border-emerald-300'
                              }`}>
                                {uploadedCount === 0 ? '⚠️ No Photos (0)' : `✓ ${uploadedCount} Documents / Photos`}
                              </span>
                            )
                          })()}
                        </div>

                        {(() => {
                          const slots = getBusinessKycDocumentSlots(user.corporateProfile, user, 'corporate')
                          return (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {slots.map((slot) => (
                                <div
                                  key={slot.id}
                                  className={`group relative overflow-hidden rounded-xl border transition ${
                                    slot.url ? 'border-emerald-200 bg-white shadow-sm' : 'border-dashed border-slate-200 bg-slate-50/70'
                                  }`}
                                >
                                  {slot.url ? (
                                    <div className="relative aspect-4/3 w-full overflow-hidden bg-slate-900/10">
                                      {slot.url.toLowerCase().endsWith('.pdf') ? (
                                        <div className="h-full w-full flex flex-col items-center justify-center p-2 text-center bg-slate-50">
                                          <FileText className="h-8 w-8 text-brand mb-1" />
                                          <span className="text-[10px] font-bold text-slate-600">PDF Document</span>
                                        </div>
                                      ) : (
                                        <img
                                          src={slot.url}
                                          alt={slot.label}
                                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                        />
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (slot.url.toLowerCase().endsWith('.pdf')) {
                                            window.open(slot.url, '_blank')
                                          } else {
                                            setZoomImage({ url: slot.url, title: slot.label })
                                          }
                                        }}
                                        className="absolute inset-0 flex items-center justify-center bg-slate-950/40 opacity-0 transition group-hover:opacity-100 text-white font-bold text-xs gap-1.5 cursor-pointer"
                                      >
                                        <Eye className="h-4 w-4" /> View
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="aspect-4/3 w-full flex flex-col items-center justify-center p-2 text-center bg-slate-100/50">
                                      <Camera className="h-6 w-6 text-slate-300 mb-1" />
                                      <span className="text-[10px] font-bold text-slate-400">No image</span>
                                    </div>
                                  )}

                                  <div className="p-2.5 bg-white border-t border-slate-100 flex flex-col gap-1">
                                    <p className="text-[11px] font-bold text-slate-800 truncate" title={slot.label}>
                                      {slot.label}
                                    </p>
                                    <div className="flex items-center justify-between mt-0.5">
                                      {slot.url ? (
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                          ✓ Uploaded
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                          {slot.isRequired ? '❌ Not uploaded' : '— Optional'}
                                        </span>
                                      )}
                                      {slot.url && !slot.url.toLowerCase().endsWith('.pdf') ? (
                                        <button
                                          type="button"
                                          onClick={() => setZoomImage({ url: slot.url, title: slot.label })}
                                          className="text-brand hover:text-brand/80 text-[10px] font-bold shrink-0 ml-1 cursor-pointer"
                                        >
                                          Zoom
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )
                        })()}
                      </div>

                      {user.corporateProfile.status === 'pending' && (
                        <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                          <button
                            onClick={() => openDialog({
                              title: 'Approve Corporate Account',
                              description: 'This will verify the corporate account and unlock all B2B operations.',
                              confirmText: 'Approve & Verify',
                              onConfirm: () => handleBusinessReview('corporate', 'approved')
                            })}
                            className="flex-1 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand/90 cursor-pointer"
                          >
                            Approve Verification
                          </button>
                          <button
                            onClick={() => openDialog({
                              title: 'Reject Corporate Verification',
                              description: 'Are you sure you want to reject this corporate verification? Please provide a reason.',
                              confirmText: 'Reject Verification',
                              isDestructive: true,
                              requireReason: true,
                              onConfirm: ({ reason }) => handleBusinessReview('corporate', 'rejected', reason)
                            })}
                            className="flex-1 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-bold text-rose-700 shadow-sm transition hover:bg-rose-100 cursor-pointer"
                          >
                            Reject (Mark as Failed)
                          </button>
                        </div>
                      )}
                    </GlassPanel>
                  )}

                  {user.enterpriseProfile && (
                    <GlassPanel className="p-6 space-y-5">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Enterprise Registration</h2>
                        {(() => {
                          const st = user.enterpriseProfile.status || 'pending'
                          if (st === 'approved') {
                            return (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Verified
                              </span>
                            )
                          }
                          if (st === 'rejected') {
                            return (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-800 ring-1 ring-rose-200">
                                <X className="h-3.5 w-3.5 text-rose-600" /> Failed
                              </span>
                            )
                          }
                          return (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
                              <Clock className="h-3.5 w-3.5 text-amber-600" /> Not Verified
                            </span>
                          )
                        })()}
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Company Name</p>
                          <p className="mt-1 text-base font-bold text-slate-900">{user.enterpriseProfile.companyName || '—'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Company Type</p>
                          <p className="mt-1 text-base font-medium text-slate-900">{user.enterpriseProfile.companyType || '—'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">GST Number</p>
                          <p className="mt-1 font-mono text-base font-medium text-slate-900">{user.enterpriseProfile.gstNumber || '—'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">PAN Number</p>
                          <p className="mt-1 font-mono text-base font-medium text-slate-900">{user.enterpriseProfile.panNumber || '—'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">CIN Number</p>
                          <p className="mt-1 font-mono text-base font-medium text-slate-900">{user.enterpriseProfile.cinNumber || '—'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Contact Person</p>
                          <p className="mt-1 text-base font-medium text-slate-900">{user.enterpriseProfile.contactPersonName || '—'}</p>
                        </div>
                      </div>
                      {user.enterpriseProfile.registeredAddress && (
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Registered Address</p>
                          <p className="mt-1 text-sm text-slate-800">{user.enterpriseProfile.registeredAddress}, {user.enterpriseProfile.city}, {user.enterpriseProfile.state} - {user.enterpriseProfile.pincode}</p>
                        </div>
                      )}

                      {/* Enterprise KYC Photos */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            KYC Photos & Documents
                          </p>
                        </div>
                        {(() => {
                          const slots = getBusinessKycDocumentSlots(user.enterpriseProfile, user, 'enterprise')
                          return (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {slots.map((slot) => (
                                <div
                                  key={slot.id}
                                  className={`group relative overflow-hidden rounded-xl border transition ${
                                    slot.url ? 'border-emerald-200 bg-white shadow-sm' : 'border-dashed border-slate-200 bg-slate-50/70'
                                  }`}
                                >
                                  {slot.url ? (
                                    <div className="relative aspect-4/3 w-full overflow-hidden bg-slate-900/10">
                                      {slot.url.toLowerCase().endsWith('.pdf') ? (
                                        <div className="h-full w-full flex flex-col items-center justify-center p-2 text-center bg-slate-50">
                                          <FileText className="h-8 w-8 text-brand mb-1" />
                                          <span className="text-[10px] font-bold text-slate-600">PDF Document</span>
                                        </div>
                                      ) : (
                                        <img
                                          src={slot.url}
                                          alt={slot.label}
                                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                        />
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (slot.url.toLowerCase().endsWith('.pdf')) {
                                            window.open(slot.url, '_blank')
                                          } else {
                                            setZoomImage({ url: slot.url, title: slot.label })
                                          }
                                        }}
                                        className="absolute inset-0 flex items-center justify-center bg-slate-950/40 opacity-0 transition group-hover:opacity-100 text-white font-bold text-xs gap-1.5 cursor-pointer"
                                      >
                                        <Eye className="h-4 w-4" /> View
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="aspect-4/3 w-full flex flex-col items-center justify-center p-2 text-center bg-slate-100/50">
                                      <Camera className="h-6 w-6 text-slate-300 mb-1" />
                                      <span className="text-[10px] font-bold text-slate-400">No image</span>
                                    </div>
                                  )}

                                  <div className="p-2.5 bg-white border-t border-slate-100 flex flex-col gap-1">
                                    <p className="text-[11px] font-bold text-slate-800 truncate" title={slot.label}>
                                      {slot.label}
                                    </p>
                                    <div className="flex items-center justify-between mt-0.5">
                                      {slot.url ? (
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                          ✓ Uploaded
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                          {slot.isRequired ? '❌ Not uploaded' : '— Optional'}
                                        </span>
                                      )}
                                      {slot.url && !slot.url.toLowerCase().endsWith('.pdf') ? (
                                        <button
                                          type="button"
                                          onClick={() => setZoomImage({ url: slot.url, title: slot.label })}
                                          className="text-brand hover:text-brand/80 text-[10px] font-bold shrink-0 ml-1 cursor-pointer"
                                        >
                                          Zoom
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )
                        })()}
                      </div>

                      {user.enterpriseProfile.status === 'pending' && (
                        <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                          <button
                            onClick={() => openDialog({
                              title: 'Approve Enterprise Account',
                              description: 'This will verify the enterprise account and unlock all enterprise features.',
                              confirmText: 'Approve & Verify',
                              onConfirm: () => handleBusinessReview('enterprise', 'approved')
                            })}
                            className="flex-1 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand/90 cursor-pointer"
                          >
                            Approve Verification
                          </button>
                          <button
                            onClick={() => openDialog({
                              title: 'Reject Enterprise Verification',
                              description: 'Are you sure you want to reject this enterprise verification? Please provide a reason.',
                              confirmText: 'Reject Verification',
                              isDestructive: true,
                              requireReason: true,
                              onConfirm: ({ reason }) => handleBusinessReview('enterprise', 'rejected', reason)
                            })}
                            className="flex-1 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-bold text-rose-700 shadow-sm transition hover:bg-rose-100 cursor-pointer"
                          >
                            Reject (Mark as Failed)
                          </button>
                        </div>
                      )}
                    </GlassPanel>
                  )}

                  {user.contractorProfile && (
                    <GlassPanel className="p-6 space-y-5">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Contractor / Vendor KYC Profile</h2>
                        {(() => {
                          const st = user.contractorProfile.verificationStatus || 'pending'
                          if (st === 'approved') {
                            return (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Verified
                              </span>
                            )
                          }
                          if (st === 'rejected') {
                            return (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-800 ring-1 ring-rose-200">
                                <X className="h-3.5 w-3.5 text-rose-600" /> Failed
                              </span>
                            )
                          }
                          return (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
                              <Clock className="h-3.5 w-3.5 text-amber-600" /> Not Verified
                            </span>
                          )
                        })()}
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Business Name</p>
                          <p className="mt-1 text-base font-bold text-slate-900">{user.contractorProfile.businessName || '—'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Vendor Type</p>
                          <p className="mt-1 text-base font-medium text-slate-900">{user.contractorProfile.vendorType || '—'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">GST Number</p>
                          <p className="mt-1 font-mono text-base font-medium text-slate-900">{user.contractorProfile.gstNumber || '—'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">PAN Number</p>
                          <p className="mt-1 font-mono text-base font-medium text-slate-900">{user.contractorProfile.panNumber || '—'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Contact Person</p>
                          <p className="mt-1 text-base font-medium text-slate-900">{user.contractorProfile.contactPersonName || '—'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Contact Phone / Email</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{user.contractorProfile.contactPhone ? `+91 ${user.contractorProfile.contactPhone}` : '—'} {user.contractorProfile.contactEmail ? `(${user.contractorProfile.contactEmail})` : ''}</p>
                        </div>
                      </div>
                      {user.contractorProfile.businessAddress && (
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Business Address</p>
                          <p className="mt-1 text-sm text-slate-800">{user.contractorProfile.businessAddress}, {user.contractorProfile.city}, {user.contractorProfile.state} - {user.contractorProfile.pincode}</p>
                        </div>
                      )}

                      {((user.contractorProfile.categoryIds?.length > 0) || (user.contractorProfile.skills?.length > 0)) && (
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Workforce Skills / Trades Supplied</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {user.contractorProfile.categoryIds?.map((cat) => (
                              <span
                                key={cat._id || cat.id || cat}
                                className="inline-flex items-center rounded-lg bg-amber-100 border border-amber-300 px-2.5 py-1 text-xs font-bold text-slate-900 shadow-sm"
                              >
                                {cat.name || cat}
                              </span>
                            ))}
                            {user.contractorProfile.skills?.filter((s) => !user.contractorProfile.categoryIds?.some((c) => (c.name || c) === s)).map((skill, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center rounded-lg bg-slate-200 border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-800"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Vendor KYC Photos Grid */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            KYC Photos & Documents (Proprietor Aadhaar, PAN, Selfie)
                          </p>
                          {(() => {
                            const slots = getBusinessKycDocumentSlots(user.contractorProfile, user, 'contractor')
                            const uploadedCount = slots.filter((s) => Boolean(s.url)).length
                            return (
                              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                                uploadedCount === 0
                                  ? 'text-amber-700 bg-amber-100/80 border-amber-300'
                                  : 'text-emerald-700 bg-emerald-100/80 border-emerald-300'
                              }`}>
                                {uploadedCount === 0 ? '⚠️ No Photos (0)' : `✓ ${uploadedCount} Documents / Photos`}
                              </span>
                            )
                          })()}
                        </div>

                        {(() => {
                          const slots = getBusinessKycDocumentSlots(user.contractorProfile, user, 'contractor')
                          return (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {slots.map((slot) => (
                                <div
                                  key={slot.id}
                                  className={`group relative overflow-hidden rounded-xl border transition ${
                                    slot.url ? 'border-emerald-200 bg-white shadow-sm' : 'border-dashed border-slate-200 bg-slate-50/70'
                                  }`}
                                >
                                  {slot.url ? (
                                    <div className="relative aspect-4/3 w-full overflow-hidden bg-slate-900/10">
                                      {slot.url.toLowerCase().endsWith('.pdf') ? (
                                        <div className="h-full w-full flex flex-col items-center justify-center p-2 text-center bg-slate-50">
                                          <FileText className="h-8 w-8 text-brand mb-1" />
                                          <span className="text-[10px] font-bold text-slate-600">PDF Document</span>
                                        </div>
                                      ) : (
                                        <img
                                          src={slot.url}
                                          alt={slot.label}
                                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                        />
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (slot.url.toLowerCase().endsWith('.pdf')) {
                                            window.open(slot.url, '_blank')
                                          } else {
                                            setZoomImage({ url: slot.url, title: slot.label })
                                          }
                                        }}
                                        className="absolute inset-0 flex items-center justify-center bg-slate-950/40 opacity-0 transition group-hover:opacity-100 text-white font-bold text-xs gap-1.5 cursor-pointer"
                                      >
                                        <Eye className="h-4 w-4" /> View
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="aspect-4/3 w-full flex flex-col items-center justify-center p-2 text-center bg-slate-100/50">
                                      <Camera className="h-6 w-6 text-slate-300 mb-1" />
                                      <span className="text-[10px] font-bold text-slate-400">No image</span>
                                    </div>
                                  )}

                                  <div className="p-2.5 bg-white border-t border-slate-100 flex flex-col gap-1">
                                    <p className="text-[11px] font-bold text-slate-800 truncate" title={slot.label}>
                                      {slot.label}
                                    </p>
                                    <div className="flex items-center justify-between mt-0.5">
                                      {slot.url ? (
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                          ✓ Uploaded
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                          {slot.isRequired ? '❌ Not uploaded' : '— Optional'}
                                        </span>
                                      )}
                                      {slot.url && !slot.url.toLowerCase().endsWith('.pdf') ? (
                                        <button
                                          type="button"
                                          onClick={() => setZoomImage({ url: slot.url, title: slot.label })}
                                          className="text-brand hover:text-brand/80 text-[10px] font-bold shrink-0 ml-1 cursor-pointer"
                                        >
                                          Zoom
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )
                        })()}
                      </div>

                      {user.contractorProfile.verificationStatus === 'pending' && (
                        <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                          <button
                            onClick={() => openDialog({
                              title: 'Approve Vendor Account',
                              description: 'This will verify the vendor/contractor account and allow them to take jobs on the platform.',
                              confirmText: 'Approve & Verify',
                              onConfirm: () => handleBusinessReview('contractor', 'approved')
                            })}
                            className="flex-1 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand/90 cursor-pointer"
                          >
                            Approve Verification
                          </button>
                          <button
                            onClick={() => openDialog({
                              title: 'Reject Vendor Verification',
                              description: 'Are you sure you want to reject this vendor verification? Please provide a reason.',
                              confirmText: 'Reject Verification',
                              isDestructive: true,
                              requireReason: true,
                              onConfirm: ({ reason }) => handleBusinessReview('contractor', 'rejected', reason)
                            })}
                            className="flex-1 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-bold text-rose-700 shadow-sm transition hover:bg-rose-100 cursor-pointer"
                          >
                            Reject (Mark as Failed)
                          </button>
                        </div>
                      )}
                    </GlassPanel>
                  )}

                  {!user.labourProfile && !user.corporateProfile && !user.enterpriseProfile && !user.contractorProfile && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
                      <ShieldCheck className="mx-auto h-12 w-12 text-slate-300" />
                      <p className="mt-3 text-sm font-medium text-slate-500">No specific role details available for this user type.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'wallet' && (
                <div className="space-y-6">
                  <div className="grid gap-6 sm:grid-cols-3">
                    <GlassPanel className="p-6 sm:col-span-2">
                      <h2 className="mb-5 text-sm font-bold uppercase tracking-wide text-slate-400">Wallet Management</h2>
                      
                      <div className="flex items-center justify-between rounded-2xl bg-slate-900 p-6 text-white shadow-xl">
                        <div>
                          <p className="text-sm font-medium text-slate-300">Available Balance</p>
                          <p className="mt-1 text-4xl font-black">₹{user.walletBalance?.toLocaleString() || 0}</p>
                        </div>
                        <CreditCard className="h-12 w-12 text-slate-700" />
                      </div>

                      <div className="mt-6 flex gap-3">
                        <button
                          onClick={() => openDialog({
                            title: 'Add Funds',
                            description: 'Admin adjustment to add funds to user wallet.',
                            confirmText: 'Add Funds',
                            requireReason: true,
                            onConfirm: ({ reason }) => {
                              const amt = window.prompt('Enter amount to ADD:')
                              if (amt && !isNaN(amt)) handleWalletAction('add', Number(amt), reason)
                            }
                          })}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-200"
                        >
                          <Plus className="h-4 w-4" /> Add Balance
                        </button>
                        <button
                          onClick={() => openDialog({
                            title: 'Deduct Funds',
                            description: 'Admin adjustment to deduct funds from user wallet.',
                            confirmText: 'Deduct Funds',
                            requireReason: true,
                            isDestructive: true,
                            onConfirm: ({ reason }) => {
                              const amt = window.prompt('Enter amount to DEDUCT:')
                              if (amt && !isNaN(amt)) handleWalletAction('deduct', Number(amt), reason)
                            }
                          })}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-200"
                        >
                          <Minus className="h-4 w-4" /> Deduct Balance
                        </button>
                      </div>
                    </GlassPanel>

                    <GlassPanel className="p-6 flex flex-col justify-center items-center text-center">
                      <div className={`flex h-16 w-16 items-center justify-center rounded-full ${user.isWalletFrozen ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {user.isWalletFrozen ? <Lock className="h-8 w-8" /> : <Check className="h-8 w-8" />}
                      </div>
                      <h3 className="mt-4 text-lg font-bold text-slate-900">Wallet is {user.isWalletFrozen ? 'Frozen' : 'Active'}</h3>
                      <p className="mt-1 text-xs text-slate-500 text-balance">
                        {user.isWalletFrozen ? 'User cannot make transactions.' : 'User can transact normally.'}
                      </p>
                      
                      <button
                        onClick={() => openDialog({
                          title: user.isWalletFrozen ? 'Unfreeze Wallet' : 'Freeze Wallet',
                          description: user.isWalletFrozen ? 'Allow user to transact again.' : 'Prevent user from making any transactions.',
                          confirmText: user.isWalletFrozen ? 'Unfreeze' : 'Freeze',
                          requireReason: true,
                          isDestructive: !user.isWalletFrozen,
                          onConfirm: ({ reason }) => handleWalletAction(user.isWalletFrozen ? 'unfreeze' : 'freeze', 0, reason)
                        })}
                        className={`mt-6 w-full rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition ${
                          user.isWalletFrozen 
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-rose-600 text-white hover:bg-rose-700'
                        }`}
                      >
                        {user.isWalletFrozen ? 'Unfreeze Wallet' : 'Freeze Wallet'}
                      </button>
                    </GlassPanel>
                  </div>

                  {/* Transaction History Ledger */}
                  <GlassPanel className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Wallet Transaction History</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Real-time ledger of online recharges, payouts, platform deductions, and admin adjustments</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        {walletTransactions.length} transaction{walletTransactions.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {walletTransactions.length === 0 ? (
                      <div className="py-12 text-center text-xs font-medium text-slate-400">
                        No transactions recorded yet for this user's wallet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              <th className="pb-3">Date & Time</th>
                              <th className="pb-3">Type</th>
                              <th className="pb-3">Source / Details</th>
                              <th className="pb-3">Method</th>
                              <th className="pb-3 text-right">Amount</th>
                              <th className="pb-3 text-right">Balance After</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100/80">
                            {walletTransactions.map((tx) => {
                              const isCredit = tx.type === 'Credit' || tx.type === 'Refund'
                              return (
                                <tr key={tx._id || tx.transactionId} className="hover:bg-slate-50/60 transition">
                                  <td className="py-3 font-medium text-slate-600 whitespace-nowrap">
                                    {new Date(tx.createdAt).toLocaleString()}
                                  </td>
                                  <td className="py-3">
                                    <span
                                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                        isCredit
                                          ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                                          : 'bg-rose-50 text-rose-800 ring-1 ring-rose-200'
                                      }`}
                                    >
                                      {tx.type}
                                    </span>
                                  </td>
                                  <td className="py-3 font-semibold text-slate-900">
                                    <div>{tx.source || 'Wallet Transaction'}</div>
                                    {tx.transactionId ? (
                                      <div className="text-[10px] font-mono font-normal text-slate-400 mt-0.5">
                                        Ref: {tx.transactionId}
                                      </div>
                                    ) : null}
                                  </td>
                                  <td className="py-3 uppercase text-[10px] font-semibold text-slate-500 whitespace-nowrap">
                                    {tx.paymentMethod || '—'}
                                  </td>
                                  <td
                                    className={`py-3 text-right font-black text-sm whitespace-nowrap ${
                                      isCredit ? 'text-emerald-600' : 'text-rose-600'
                                    }`}
                                  >
                                    {isCredit ? '+' : '-'}₹{tx.amount?.toLocaleString()}
                                  </td>
                                  <td className="py-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                                    ₹{tx.balanceAfter?.toLocaleString() ?? '—'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </GlassPanel>
                </div>
              )}

              {activeTab === 'timeline' && (
                <GlassPanel className="p-6">
                  <h2 className="mb-6 text-sm font-bold uppercase tracking-wide text-slate-400">Activity & Audit Timeline</h2>
                  {timeline.length === 0 ? (
                    <div className="py-10 text-center">
                      <History className="mx-auto h-10 w-10 text-slate-300" />
                      <p className="mt-3 text-sm font-medium text-slate-500">No activity recorded yet.</p>
                    </div>
                  ) : (
                    <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                      {timeline.map((log, idx) => (
                        <div key={log._id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-brand">
                            <Activity className="h-4 w-4" />
                          </div>
                          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm transition hover:shadow-md">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-brand uppercase tracking-wider">{log.module}</span>
                              <time className="text-[11px] font-medium text-slate-400">{new Date(log.createdAt).toLocaleString()}</time>
                            </div>
                            <p className="text-sm font-semibold text-slate-900">{log.action}</p>
                            {log.reason && <p className="mt-1 text-xs text-slate-500 italic">" {log.reason} "</p>}
                            {log.admin && (
                              <div className="mt-3 flex items-center gap-2 border-t border-slate-200/60 pt-3">
                                {log.admin.profileImageUrl ? (
                                  <img src={log.admin.profileImageUrl} alt="" className="h-5 w-5 rounded-full ring-1 ring-slate-200" />
                                ) : (
                                  <div className="h-5 w-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600">
                                    {log.admin.fullName?.[0]}
                                  </div>
                                )}
                                <span className="text-[11px] font-medium text-slate-600">By {log.admin.fullName}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassPanel>
              )}


            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Lightbox / Zoom Modal */}
      {zoomImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative max-h-[90vh] max-w-2xl w-full overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50">
              <p className="text-sm font-bold text-slate-900">{zoomImage.title}</p>
              <button
                type="button"
                onClick={() => setZoomImage(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-3 bg-slate-900/5 flex items-center justify-center max-h-[75vh] overflow-auto">
              <img
                src={zoomImage.url}
                alt={zoomImage.title}
                className="max-h-[70vh] w-auto rounded-xl object-contain shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
