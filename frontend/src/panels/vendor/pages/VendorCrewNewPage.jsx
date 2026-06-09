import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { useLinkVendorCrewMutation } from '../../../store/api/workforceApi.js'

const inputClass =
  'w-full rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand/35'

export function VendorCrewNewPage() {
  const navigate = useNavigate()
  const [linkCrew, { isLoading }] = useLinkVendorCrewMutation()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const digits = phone.replace(/\D/g, '').slice(-10)
    if (digits.length !== 10) {
      setError('Enter a valid 10-digit mobile number')
      return
    }
    try {
      await linkCrew({ phone: digits }).unwrap()
      navigate('/vendor/crew')
    } catch (err) {
      setError(err?.data?.message || err?.message || 'Could not link worker')
    }
  }

  return (
    <div className="space-y-4 pb-8">
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
            <input
              type="tel"
              className={inputClass}
              placeholder="10-digit phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
          <AppPrimaryButton type="submit" className="w-full" loading={isLoading}>
            Link worker
          </AppPrimaryButton>
        </form>
      </AppSurface>
    </div>
  )
}
