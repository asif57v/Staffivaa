import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, AlertCircle, UserCheck } from 'lucide-react'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { useLinkVendorCrewMutation, useGetVendorCrewQuery } from '../../../store/api/workforceApi.js'

const inputClass =
  'w-full rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand/35'

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
  const [linkCrew, { isLoading }] = useLinkVendorCrewMutation()
  const { data: crewData } = useGetVendorCrewQuery()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')

  const [toast, setToast] = useState({ visible: false, message: '', type: 'error' })

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

    // Check if worker is already in crew
    const crew = crewData?.crew ?? []
    const alreadyAdded = crew.some((w) => w.phone === digits)
    if (alreadyAdded) {
      showToast('This worker is already in your crew!', 'already', 2000)
      return
    }

    try {
      await linkCrew({ phone: digits }).unwrap()
      showToast('Worker added to crew successfully!', 'success', 1500)
      setTimeout(() => navigate('/vendor/crew'), 1600)
    } catch (err) {
      const msg = err?.data?.message || err?.message || 'Could not link worker'
      // Also catch duplicate/already-linked errors from backend
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
        <h2 className="text-lg font-extrabold text-slate-900">Link crew member</h2>
        <p className="mt-1 text-sm text-slate-600">
          Worker must already have a Staffivaa labour account on this phone number.
        </p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Mobile number
            </label>
            <div className="relative">
              <input
                type="tel"
                className={`w-full rounded-2xl border px-4 py-3 text-sm shadow-sm outline-none focus:ring-2 pr-14 transition-colors ${
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
                  // Only allow digits, max 10
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                  setPhone(digits)
                  setError('')
                }}
                required
              />
              {/* Live counter */}
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
          {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
          <AppPrimaryButton type="submit" className="w-full" loading={isLoading} disabled={phone.length !== 10}>
            Link worker
          </AppPrimaryButton>
        </form>
      </AppSurface>
    </div>
  )
}
