import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, User as UserIcon, Mail, Phone, Calendar, ShieldCheck, FileCheck, CheckCircle2 } from 'lucide-react'
import { fetchAdminUserById } from '../../api/adminUsersApi.js'
import { ApiError } from '../../api/http.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { ROLE_LABELS } from '../../constants/userRoles.js'
import { formatLastLoginDisplay } from '../../lib/formatAdminLastLogin.js'

export function AdminUserDetailsPage() {
  const { id } = useParams()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchAdminUserById(id)
      .then((data) => {
        if (!cancelled) {
          if (data) setUser(data)
          else setError('User not found')
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Could not load user details')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <p className="text-sm font-medium text-slate-600">Loading user details...</p>
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

  return (
    <div className="w-full space-y-6 pb-10">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <Link to="/admin/users" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition">
          <ArrowLeft className="h-4 w-4" /> Back to users
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-brand ring-1 ring-brand/20">
              <UserIcon className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">{user.fullName || 'Unnamed User'}</h1>
              <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-600">
                <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-700 ring-1 ring-slate-200/90">
                  {ROLE_LABELS[user.role] || user.role}
                </span>
                <span>•</span>
                <span className={`inline-flex items-center gap-1.5 ${user.isActive ? 'text-emerald-600' : 'text-slate-500'}`}>
                  <span className={`h-2 w-2 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Contact Info */}
        <div className="space-y-6 md:col-span-1">
          <GlassPanel className="p-5">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-400">Contact Information</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold text-slate-500">Phone</p>
                  <p className="font-mono text-sm font-medium text-slate-900">+91 {user.phone}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold text-slate-500">Email</p>
                  <p className="truncate text-sm font-medium text-slate-900">{user.email || '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold text-slate-500">Joined</p>
                  <p className="text-sm font-medium text-slate-900">
                    {new Date(user.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </p>
                </div>
              </div>
            </div>
          </GlassPanel>
        </div>

        {/* Profile Specifics */}
        <div className="space-y-6 md:col-span-2">
          {user.labourProfile && (
            <GlassPanel className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Labour Profile & KYC</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Status: {user.labourProfile.kycStatus}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                  <p className="text-xs font-semibold text-slate-500">Aadhaar (Masked)</p>
                  <p className="font-mono text-sm font-medium text-slate-900">{user.labourProfile.aadhaarMasked || '—'}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                  <p className="text-xs font-semibold text-slate-500">PAN (Masked)</p>
                  <p className="font-mono text-sm font-medium text-slate-900">{user.labourProfile.panMasked || '—'}</p>
                </div>
              </div>
            </GlassPanel>
          )}

          {user.corporateProfile && (
            <GlassPanel className="p-5">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-400">Corporate Details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                  <p className="text-xs font-semibold text-slate-500">Company Name</p>
                  <p className="text-sm font-bold text-slate-900">{user.corporateProfile.companyName || '—'}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                  <p className="text-xs font-semibold text-slate-500">GST Number</p>
                  <p className="font-mono text-sm font-medium text-slate-900">{user.corporateProfile.gstNumber || '—'}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 sm:col-span-2">
                  <p className="text-xs font-semibold text-slate-500">Registered Address</p>
                  <p className="text-sm font-medium text-slate-900">{user.corporateProfile.registeredAddress || '—'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {[user.corporateProfile.city, user.corporateProfile.state, user.corporateProfile.pincode].filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>
            </GlassPanel>
          )}

          {user.contractorProfile && (
            <GlassPanel className="p-5">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-400">Contractor Details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                  <p className="text-xs font-semibold text-slate-500">Business Name</p>
                  <p className="text-sm font-bold text-slate-900">{user.contractorProfile.businessName || '—'}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                  <p className="text-xs font-semibold text-slate-500">Vendor Type</p>
                  <p className="text-sm font-medium text-slate-900 capitalize">{user.contractorProfile.vendorType?.replace('_', ' ') || '—'}</p>
                </div>
              </div>
            </GlassPanel>
          )}

          <GlassPanel className="p-5">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-400">Activity Overview</h2>
            <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Last Active Session</p>
                <p className="text-xs text-slate-500">{formatLastLoginDisplay(user.lastLoginAt) || 'No active sessions recorded.'}</p>
              </div>
            </div>
            {/* Note: The booking history for a specific user requires a separate backend endpoint. */}
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <FileCheck className="h-5 w-5 text-brand" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Bookings / Requests</p>
                <p className="text-xs text-slate-500">Booking history integration is available via the unified bookings page.</p>
              </div>
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  )
}
