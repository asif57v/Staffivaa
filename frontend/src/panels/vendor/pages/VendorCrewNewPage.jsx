import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, AlertCircle, UserCheck, UserPlus, Sparkles } from 'lucide-react'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { useAddVendorWorkerMutation, useGetVendorCrewQuery } from '../../../store/api/workforceApi.js'
import { fetchLabourCategoriesGrouped } from '../../../api/labourCategoriesApi.js'

function Toast({ message, type, visible }) {
  const bg = type === 'already' ? 'bg-amber-500' : type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
  const Icon = type === 'already' ? UserCheck : type === 'success' ? CheckCircle2 : AlertCircle

  return (
    <div
      className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-2xl px-5 py-3 text-white text-sm font-bold shadow-xl transition-all duration-300 max-w-[90vw] ${bg} ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

export function VendorCrewNewPage() {
  const navigate = useNavigate()
  const [addWorker, { isLoading }] = useAddVendorWorkerMutation()
  const { data: crewData } = useGetVendorCrewQuery()
  
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [error, setError] = useState('')

  const [toast, setToast] = useState({ visible: false, message: '', type: 'error' })

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const json = await fetchLabourCategoriesGrouped()
        if (!active) return
        const payload = json?.data ?? json
        const flat = []
        for (const group of payload?.groups ?? []) {
          for (const c of group.categories ?? []) {
            flat.push({ id: c._id || c.id, name: c.name, group: group.name })
          }
        }
        setCategories(flat)
        if (flat.length > 0) {
          setCategoryId(flat[0].id)
        }
      } catch (err) {
        console.error('Failed to load categories:', err)
      } finally {
        if (active) setLoadingCategories(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const showToast = (message, type = 'error', duration = 2000) => {
    setToast({ visible: true, message, type })
    setTimeout(() => {
      setToast((t) => ({ ...t, visible: false }))
    }, duration)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const digits = phone.replace(/\D/g, '').slice(-10)
    if (digits.length !== 10) {
      setError('Enter a valid 10-digit mobile number')
      return
    }

    if (!fullName.trim()) {
      setError('Enter worker full name')
      return
    }

    // Check if worker is already in crew
    const crew = crewData?.crew ?? []
    const alreadyAdded = crew.some((w) => w.phone === digits)
    if (alreadyAdded) {
      showToast('This worker is already in your crew!', 'already', 2000)
      return
    }

    try {
      await addWorker({
        fullName: fullName.trim(),
        phone: digits,
        categoryId: categoryId || undefined,
      }).unwrap()

      showToast('Worker added to crew successfully!', 'success', 1500)
      setTimeout(() => navigate('/vendor/crew'), 1600)
    } catch (err) {
      const msg = err?.data?.message || err?.message || 'Could not add worker'
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('linked')) {
        showToast('This worker is already in your crew!', 'already', 2000)
      } else {
        showToast(msg, 'error', 2500)
      }
    }
  }

  return (
    <div className="space-y-4 pb-8">
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />

      <Link to="/vendor/crew" className="inline-flex items-center gap-2 text-sm font-bold text-brand">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to crew
      </Link>

      <AppSurface>
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
            <UserPlus className="h-5 w-5 text-slate-900" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Add Crew Member</h2>
            <p className="text-xs text-slate-500">
              Add new external workers or link existing workers to your crew
            </p>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-900">
          <Sparkles className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <span>
            External workers will be created and added to your crew immediately without requiring prior app registration.
          </span>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-600">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              className="w-full rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand/35 transition"
              placeholder="e.g. Ramesh Kumar"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value)
                setError('')
              }}
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-600">
              Mobile Number <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-xs font-bold text-slate-400">
                +91
              </div>
              <input
                type="tel"
                className={`w-full rounded-2xl border pl-14 pr-14 py-3 text-sm shadow-sm outline-none focus:ring-2 transition-colors font-mono tracking-wide ${
                  phone.length > 0 && phone.length < 10
                    ? 'border-rose-400 focus:ring-rose-300/40 bg-rose-50/30'
                    : phone.length === 10
                    ? 'border-emerald-400 focus:ring-emerald-300/40 bg-emerald-50/30'
                    : 'border-slate-200/90 focus:ring-brand/35 bg-white'
                }`}
                placeholder="10-digit mobile number"
                value={phone}
                maxLength={10}
                inputMode="numeric"
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                  setPhone(digits)
                  setError('')
                }}
                required
              />
              <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold tabular-nums ${
                phone.length === 10 ? 'text-emerald-500' : phone.length > 0 ? 'text-rose-500' : 'text-slate-300'
              }`}>
                {phone.length}/10
              </span>
            </div>
            {phone.length > 0 && phone.length < 10 && (
              <p className="mt-1.5 text-xs font-semibold text-rose-600">
                ⚠ Enter all 10 digits ({10 - phone.length} remaining)
              </p>
            )}
            {phone.length === 10 && (
              <p className="mt-1.5 text-xs font-semibold text-emerald-600">
                ✓ Valid 10-digit number
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-600">
              Skill / Trade
            </label>
            {loadingCategories ? (
              <p className="text-xs text-slate-400 py-2">Loading skills…</p>
            ) : (
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand/35 transition"
              >
                <option value="">Select primary skill</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.group ? `(${c.group})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}

          <AppPrimaryButton 
            type="submit" 
            className="w-full bg-slate-900 text-white hover:bg-slate-800" 
            loading={isLoading} 
            disabled={phone.length !== 10 || !fullName.trim()}
          >
            Add Worker to Crew
          </AppPrimaryButton>
        </form>
      </AppSurface>
    </div>
  )
}
