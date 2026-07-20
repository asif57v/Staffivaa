import { useState } from 'react'
import { Navigation, MapPin, RefreshCw, Save } from 'lucide-react'
import { Autocomplete, useLoadScript } from '@react-google-maps/api'
import { useDispatch } from 'react-redux'
import toast from 'react-hot-toast'
import { useAuth } from '../../../hooks/useAuth.js'
import { setUser } from '../../../store/slices/authSlice.js'
import { apiRequest } from '../../../api/http.js'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { GlassPanel } from '../../../components/ui/GlassPanel.jsx'

export function VendorRadiusSettingsPage() {
  const dispatch = useDispatch()
  const { user } = useAuth()
  const profile = user?.contractorProfile

  const [serviceRadius, setServiceRadius] = useState(
    profile?.serviceRadius === null ? 'unlimited' : String(profile?.serviceRadius || 15)
  )
  const [currentAddress, setCurrentAddress] = useState(profile?.currentAddress || '')
  const [currentLatitude, setCurrentLatitude] = useState(profile?.currentLatitude || null)
  const [currentLongitude, setCurrentLongitude] = useState(profile?.currentLongitude || null)

  const [autocomplete, setAutocomplete] = useState(null)
  const [isFetchingLocation, setIsFetchingLocation] = useState(false)
  const [saving, setSaving] = useState(false)

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['places'],
  })

  const handlePlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace()
      if (place.formatted_address) {
        setCurrentAddress(place.formatted_address)
      }
      if (place.geometry && place.geometry.location) {
        setCurrentLatitude(place.geometry.location.lat())
        setCurrentLongitude(place.geometry.location.lng())
      }
    }
  }

  const pickLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Location is not supported by your browser')
      return
    }
    setIsFetchingLocation(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setCurrentLatitude(lat)
        setCurrentLongitude(lng)
        try {
          const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
          if (!apiKey) {
            setCurrentAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
            setIsFetchingLocation(false)
            return
          }
          const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`)
          const data = await res.json()
          if (data.results && data.results.length > 0) {
            setCurrentAddress(data.results[0].formatted_address)
          } else {
            setCurrentAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
          }
        } catch {
          setCurrentAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
        }
        setIsFetchingLocation(false)
      },
      () => {
        toast.error('Unable to retrieve location')
        setIsFetchingLocation(false)
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    )
  }

  const handleSave = async () => {
    if (!currentLatitude || !currentLongitude) {
      toast.error('Please set your location first')
      return
    }

    setSaving(true)
    try {
      const payload = {
        serviceRadius: serviceRadius === 'unlimited' ? null : Number(serviceRadius),
        currentLatitude,
        currentLongitude,
        currentAddress
      }
      const res = await apiRequest('/users/me/vendor-radius', {
        method: 'PUT',
        body: payload
      })
      if (res?.data?.user) {
        dispatch(setUser(res.data.user))
        toast.success('Radius settings updated')
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 pb-20 pt-4">
      <div className="mb-6">
        <h1 className="text-xl font-black tracking-tight text-slate-900">Service Area Settings</h1>
        <p className="text-sm font-medium text-slate-500">
          Configure where you want to receive work requests
        </p>
      </div>

      <GlassPanel className="p-4 border-slate-200">
        <h3 className="text-sm font-extrabold text-slate-900 mb-2">Base Location</h3>
        <p className="text-xs text-slate-500 mb-4">
          This is the center point for matching you with corporate requests.
        </p>

        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <MapPin className="h-4 w-4" />
            </div>
            {isLoaded ? (
              <Autocomplete onLoad={setAutocomplete} onPlaceChanged={handlePlaceChanged} options={{ componentRestrictions: { country: 'in' }, fields: ['formatted_address'] }}>
                <input
                  className="w-full bg-white rounded-xl border border-slate-200 pl-9 pr-3 py-3 text-sm font-semibold text-slate-900 outline-none shadow-sm focus:ring-2 focus:ring-brand/35 placeholder:text-slate-400"
                  placeholder="Search location..."
                  value={currentAddress}
                  onChange={(e) => setCurrentAddress(e.target.value)}
                />
              </Autocomplete>
            ) : (
              <input
                className="w-full bg-white rounded-xl border border-slate-200 pl-9 pr-3 py-3 text-sm font-semibold text-slate-900 outline-none shadow-sm focus:ring-2 focus:ring-brand/35 placeholder:text-slate-400"
                placeholder="Search location..."
                value={currentAddress}
                onChange={(e) => setCurrentAddress(e.target.value)}
              />
            )}
          </div>
          <button
            type="button"
            onClick={pickLocation}
            disabled={isFetchingLocation}
            className="shrink-0 w-[46px] rounded-xl bg-slate-900 text-[#FFC107] flex items-center justify-center disabled:opacity-70 active:scale-95 transition-transform shadow-md"
          >
            {isFetchingLocation ? <RefreshCw className="h-5 w-5 animate-spin text-white" /> : <Navigation className="h-5 w-5 fill-current" />}
          </button>
        </div>

        {currentLatitude && currentLongitude && (
          <div className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-2 rounded-lg border border-emerald-100 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Location is set
          </div>
        )}
      </GlassPanel>

      <GlassPanel className="p-4 border-slate-200">
        <h3 className="text-sm font-extrabold text-slate-900 mb-2">Service Radius</h3>
        <p className="text-xs text-slate-500 mb-4">
          How far are you willing to travel for a project?
        </p>

        <div className="space-y-3">
          {['5', '10', '15', '20', '50', '100', 'unlimited'].map((radiusOption) => (
            <div 
              key={radiusOption} 
              onClick={() => setServiceRadius(radiusOption)}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${serviceRadius === radiusOption ? 'border-brand bg-brand/5 shadow-sm' : 'border-slate-200 hover:bg-slate-50'}`}
            >
              <div className={`h-5 w-5 rounded-full border-[1.5px] flex items-center justify-center ${serviceRadius === radiusOption ? 'border-brand' : 'border-slate-300'}`}>
                {serviceRadius === radiusOption && <div className="h-2.5 w-2.5 rounded-full bg-brand" />}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-900">
                  {radiusOption === 'unlimited' ? 'Unlimited' : `${radiusOption} Kilometers`}
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  {radiusOption === 'unlimited' ? 'Receive jobs from anywhere' : `Receive jobs within ${radiusOption} KM`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>

      <AppPrimaryButton onClick={handleSave} disabled={saving} className="w-full">
        {saving ? <RefreshCw className="h-5 w-5 animate-spin mx-auto" /> : (
          <div className="flex items-center justify-center gap-2">
            <Save className="h-5 w-5" />
            <span>Save Settings</span>
          </div>
        )}
      </AppPrimaryButton>
    </div>
  )
}
