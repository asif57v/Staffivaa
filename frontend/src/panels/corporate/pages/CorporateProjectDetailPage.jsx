import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, Plus, Navigation, RefreshCw } from 'lucide-react'
import { Autocomplete, useLoadScript } from '@react-google-maps/api'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import {
  useAddCorporateSiteMutation,
  useGetCorporateProjectQuery,
} from '../../../store/api/workforceApi.js'

const inputClass =
  'w-full rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand/35'

export function CorporateProjectDetailPage() {
  const { id } = useParams()
  const { data, isLoading, isError } = useGetCorporateProjectQuery(id, { skip: !id })
  const [addSite, { isLoading: adding }] = useAddCorporateSiteMutation()
  const [showForm, setShowForm] = useState(false)
  const [siteName, setSiteName] = useState('')
  const [siteAddress, setSiteAddress] = useState('')
  const [siteCity, setSiteCity] = useState('')
  const [addressAutocomplete, setAddressAutocomplete] = useState(null)
  const [cityAutocomplete, setCityAutocomplete] = useState(null)
  const [error, setError] = useState('')
  const [isFetchingLocation, setIsFetchingLocation] = useState(false)

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['places'],
  })

  const handleAddressPlaceChanged = () => {
    if (addressAutocomplete !== null) {
      const place = addressAutocomplete.getPlace()
      if (place.formatted_address) {
        setSiteAddress(place.formatted_address)
      }
    }
  }

  const handleCityPlaceChanged = () => {
    if (cityAutocomplete !== null) {
      const place = cityAutocomplete.getPlace()
      if (place.formatted_address) {
        setSiteCity(place.formatted_address)
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
            // Try to extract city from address components
            const cityComponent = data.results[0].address_components.find(
              c => c.types.includes('locality') || c.types.includes('administrative_area_level_2')
            )
            if (cityComponent) {
              setSiteCity(cityComponent.long_name)
            }
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

  const project = data?.project

  const handleAddSite = async (e) => {
    e.preventDefault()
    if (!siteName.trim()) return
    await addSite({
      projectId: id,
      name: siteName.trim(),
      address: siteAddress.trim() || undefined,
      city: siteCity.trim() || undefined,
    }).unwrap()
    setSiteName('')
    setSiteAddress('')
    setSiteCity('')
    setShowForm(false)
  }

  if (isLoading) {
    return (
      <AppSurface>
        <p className="text-sm text-slate-500">Loading project…</p>
      </AppSurface>
    )
  }

  if (isError || !project) {
    return (
      <AppSurface className="border-rose-200/90">
        <p className="text-sm font-semibold text-rose-800">Project not found.</p>
        <Link to="/corporate/projects" className="mt-3 inline-block text-sm font-bold text-brand">
          Back to projects
        </Link>
      </AppSurface>
    )
  }

  const sites = project.sites ?? []

  return (
    <div className="space-y-4 pb-8">
      <Link to="/corporate/projects" className="inline-flex items-center gap-2 text-sm font-bold text-brand">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Projects
      </Link>

      <AppSurface>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Project</p>
        <h2 className="mt-1 text-lg font-extrabold text-slate-900">{project.name}</h2>
        {project.notes ? <p className="mt-2 text-sm text-slate-600">{project.notes}</p> : null}
      </AppSurface>

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-extrabold text-slate-900">Sites</h3>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-bold text-brand"
        >
          <Plus className="h-3.5 w-3.5" />
          Add site
        </button>
      </div>

      {showForm ? (
        <AppSurface>
          <form onSubmit={handleAddSite} className="space-y-3">
            <input
              className={inputClass}
              placeholder="Site name"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              required
            />
            {isLoaded ? (
              <Autocomplete
                onLoad={(auto) => setAddressAutocomplete(auto)}
                onPlaceChanged={handleAddressPlaceChanged}
                options={{
                  componentRestrictions: { country: 'in' },
                  fields: ['formatted_address', 'address_components']
                }}
              >
                <input
                  className={inputClass}
                  placeholder="Address"
                  value={siteAddress}
                  onChange={(e) => setSiteAddress(e.target.value)}
                />
              </Autocomplete>
            ) : (
              <input
                className={inputClass}
                placeholder="Address"
                value={siteAddress}
                onChange={(e) => setSiteAddress(e.target.value)}
              />
            )}
            {isLoaded ? (
              <Autocomplete
                onLoad={(auto) => setCityAutocomplete(auto)}
                onPlaceChanged={handleCityPlaceChanged}
                options={{
                  types: ['(cities)'],
                  componentRestrictions: { country: 'in' },
                  fields: ['formatted_address']
                }}
              >
                <input
                  className={inputClass}
                  placeholder="City"
                  value={siteCity}
                  onChange={(e) => setSiteCity(e.target.value)}
                />
              </Autocomplete>
            ) : (
              <input
                className={inputClass}
                placeholder="City"
                value={siteCity}
                onChange={(e) => setSiteCity(e.target.value)}
              />
            )}
            <div className="flex justify-end">
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
            {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
            <AppPrimaryButton type="submit" loading={adding} className="w-full">
              Save site
            </AppPrimaryButton>
          </form>
        </AppSurface>
      ) : null}

      <ul className="space-y-2">
        {sites.map((s) => (
          <li key={s._id}>
            <AppSurface className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <MapPin className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">{s.name}</p>
                <p className="text-xs text-slate-500">
                  {[s.address, s.city].filter(Boolean).join(' · ') || 'No address'}
                </p>
              </div>
            </AppSurface>
          </li>
        ))}
      </ul>

      {sites.length === 0 && !showForm ? (
        <AppSurface>
          <p className="text-sm text-slate-500">No sites yet. Add a site for workforce deployment.</p>
        </AppSurface>
      ) : null}
    </div>
  )
}


