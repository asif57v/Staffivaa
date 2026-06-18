import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Navigation, RefreshCw } from 'lucide-react'
import { Autocomplete, useLoadScript } from '@react-google-maps/api'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { useCreateCorporateProjectMutation } from '../../../store/api/workforceApi.js'

const inputClass =
  'w-full rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand/35'

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</label>
      {children}
    </div>
  )
}

export function CorporateProjectNewPage() {
  const navigate = useNavigate()
  const today = new Date().toISOString().split('T')[0]
  const [createProject, { isLoading }] = useCreateCorporateProjectMutation()
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [siteName, setSiteName] = useState('')
  const [siteAddress, setSiteAddress] = useState('')
  const [error, setError] = useState('')
  const [autocomplete, setAutocomplete] = useState(null)
  const [isFetchingLocation, setIsFetchingLocation] = useState(false)

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['places'],
  })

  const handlePlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace()
      if (place.formatted_address) {
        setSiteAddress(place.formatted_address)
      }
    }
  }

  const pickLocation = () => {
    if (!navigator.geolocation) {
      setError('Location is not supported by your browser.')
      return
    }
    setIsFetchingLocation(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        try {
          const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
          if (!apiKey) {
            setSiteAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
            setIsFetchingLocation(false)
            return
          }
          const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`)
          const data = await res.json()
          if (data.results && data.results.length > 0) {
            setSiteAddress(data.results[0].formatted_address)
          } else {
            setSiteAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
          }
        } catch {
          setSiteAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
        }
        setIsFetchingLocation(false)
      },
      () => {
        setError('Unable to retrieve your location.')
        setIsFetchingLocation(false)
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('Project name is required')
      return
    }
    if (startDate && startDate < today) {
      setError('Start date cannot be in the past.')
      return
    }
    const minEnd = startDate || today
    if (endDate && endDate < minEnd) {
      setError('End date cannot be before the start date.')
      return
    }
    try {
      const body = {
        name: name.trim(),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        notes: notes.trim() || undefined,
      }
      if (siteName.trim()) {
        body.site = { name: siteName.trim(), address: siteAddress.trim() || undefined }
      }
      const res = await createProject(body).unwrap()
      const id = res?.project?._id
      navigate(id ? `/corporate/projects/${id}` : '/corporate/projects')
    } catch (err) {
      setError(err?.data?.message || err?.message || 'Could not create project')
    }
  }

  return (
    <div className="space-y-4 pb-8">
      <Link
        to="/corporate/projects"
        className="inline-flex items-center gap-2 text-sm font-bold text-brand"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to projects
      </Link>

      <AppSurface>
        <h2 className="text-lg font-extrabold text-slate-900">New project</h2>
        <p className="mt-1 text-sm text-slate-600">Add a project and optional first site.</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <Field label="Project name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <input 
                type="date" 
                min={today} 
                className={inputClass} 
                value={startDate} 
                onChange={(e) => {
                  const val = e.target.value
                  if (val && val < today) {
                    setStartDate(today)
                  } else {
                    setStartDate(val)
                    if (endDate && val && endDate < val) {
                      setEndDate(val)
                    }
                  }
                }} 
              />
            </Field>
            <Field label="End date">
              <input 
                type="date" 
                min={startDate || today} 
                className={inputClass} 
                value={endDate} 
                onChange={(e) => {
                  const val = e.target.value
                  const minAllowed = startDate || today
                  if (val && val < minAllowed) {
                    setEndDate(minAllowed)
                  } else {
                    setEndDate(val)
                  }
                }} 
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea className={inputClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">First site (optional)</p>
            <div className="mt-3 space-y-3">
              <Field label="Site name">
                <input className={inputClass} value={siteName} onChange={(e) => setSiteName(e.target.value)} />
              </Field>
              <Field label="Address">
                {isLoaded ? (
                  <Autocomplete
                    onLoad={(auto) => setAutocomplete(auto)}
                    onPlaceChanged={handlePlaceChanged}
                    options={{
                      componentRestrictions: { country: 'in' },
                      fields: ['formatted_address']
                    }}
                  >
                    <input className={inputClass} value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} />
                  </Autocomplete>
                ) : (
                  <input className={inputClass} value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} />
                )}
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={pickLocation}
                    disabled={isFetchingLocation}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 active:scale-95 disabled:opacity-70"
                  >
                    {isFetchingLocation ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Navigation className="h-3.5 w-3.5" />
                    )}
                    {isFetchingLocation ? 'Fetching...' : 'Fetch live location'}
                  </button>
                </div>
              </Field>
            </div>
          </div>
          {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
          <AppPrimaryButton type="submit" className="w-full" loading={isLoading}>
            Create project
          </AppPrimaryButton>
        </form>
      </AppSurface>
    </div>
  )
}

