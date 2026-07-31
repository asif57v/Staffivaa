import React, { useState, useEffect, useRef } from 'react'
import { Autocomplete, useLoadScript } from '@react-google-maps/api'
import { MapPin, Navigation, Loader2, Search, Check } from 'lucide-react'
import toast from 'react-hot-toast'

const MAPS_LIBRARIES = ['places']

const POPULAR_HUBS = [
  { name: 'Mumbai, Maharashtra', lat: 19.076, lng: 72.8777 },
  { name: 'Delhi NCR, New Delhi', lat: 28.6139, lng: 77.209 },
  { name: 'Bengaluru, Karnataka', lat: 12.9716, lng: 77.5946 },
  { name: 'Pune, Maharashtra', lat: 18.5204, lng: 73.8567 },
  { name: 'Ahmedabad, Gujarat', lat: 23.0225, lng: 72.5714 },
  { name: 'Hyderabad, Telangana', lat: 17.385, lng: 78.4867 },
  { name: 'Kolkata, West Bengal', lat: 22.5726, lng: 88.3639 },
  { name: 'Chennai, Tamil Nadu', lat: 13.0827, lng: 80.2707 },
  { name: 'Surat, Gujarat', lat: 21.1702, lng: 72.8311 },
  { name: 'Jaipur, Rajasthan', lat: 26.9124, lng: 75.7873 },
  { name: 'Lucknow, Uttar Pradesh', lat: 26.8467, lng: 80.9462 },
  { name: 'Noida, Uttar Pradesh', lat: 28.5355, lng: 77.391 },
  { name: 'Gurugram, Haryana', lat: 28.4595, lng: 77.0266 },
]

export function LocationAutocompleteInput({
  value = '',
  onChange,
  placeholder = 'e.g. Warehouse A, Mumbai',
  required = false,
  className = '',
  name = 'locationText',
}) {
  const [autocomplete, setAutocomplete] = useState(null)
  const [isFetchingLocation, setIsFetchingLocation] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false)
  const containerRef = useRef(null)

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: apiKey || '',
    libraries: MAPS_LIBRARIES,
  })

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Search suggestions using matching hubs + OpenStreetMap Nominatim
  useEffect(() => {
    if (!value || value.trim().length < 2) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }

    const query = value.trim().toLowerCase()
    
    // 1. Filter local popular hubs
    const localMatches = POPULAR_HUBS.filter(hub =>
      hub.name.toLowerCase().includes(query)
    ).map(hub => ({
      display: hub.name,
      lat: hub.lat,
      lng: hub.lng,
      source: 'preset'
    }))

    setSuggestions(localMatches)
    setShowDropdown(localMatches.length > 0)

    // 2. Fetch live suggestions from Nominatim API with debounce
    const timer = setTimeout(async () => {
      try {
        setIsSearchingSuggestions(true)
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=5`
        )
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          const apiMatches = data.map(item => ({
            display: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            source: 'api'
          }))

          // Merge without duplicates
          const combined = [...localMatches]
          apiMatches.forEach(item => {
            if (!combined.some(c => c.display.toLowerCase() === item.display.toLowerCase())) {
              combined.push(item)
            }
          })
          setSuggestions(combined)
          setShowDropdown(combined.length > 0)
        }
      } catch (err) {
        console.error('Location search error:', err)
      } finally {
        setIsSearchingSuggestions(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [value])

  const handlePlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace()
      const address = place.formatted_address || place.name || ''
      let geoPoint = null

      if (place.geometry && place.geometry.location) {
        geoPoint = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        }
      }

      if (address && onChange) {
        onChange(address, geoPoint)
      }
      setShowDropdown(false)
    }
  }

  const handleSelectSuggestion = (suggestion) => {
    if (onChange) {
      onChange(suggestion.display, { lat: suggestion.lat, lng: suggestion.lng })
    }
    setShowDropdown(false)
  }

  const pickLiveLocation = (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser')
      return
    }

    setIsFetchingLocation(true)

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        let formattedAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`

        try {
          if (apiKey) {
            const res = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
            )
            const data = await res.json()
            if (data.results && data.results.length > 0) {
              formattedAddress = data.results[0].formatted_address
            }
          }
          toast.success('Live location updated')
        } catch (err) {
          console.error('Reverse geocoding error:', err)
          toast.success('Coordinates captured')
        } finally {
          setIsFetchingLocation(false)
          if (onChange) {
            onChange(formattedAddress, { lat, lng })
          }
          setShowDropdown(false)
        }
      },
      (error) => {
        console.error('Geolocation error:', error)
        setIsFetchingLocation(false)
        if (error.code === error.PERMISSION_DENIED) {
          toast.error('Location permission denied')
        } else {
          toast.error('Unable to fetch live location')
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const inputElement = (
    <input
      type="text"
      name={name}
      required={required}
      value={value}
      onChange={(e) => onChange && onChange(e.target.value, null)}
      onFocus={() => {
        if (suggestions.length > 0) setShowDropdown(true)
      }}
      placeholder={placeholder}
      className={`w-full rounded-[10px] border border-slate-200 bg-slate-50 pl-9 pr-24 sm:pr-28 py-3 text-[13px] sm:text-[14px] font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 ${className}`}
    />
  )

  return (
    <div ref={containerRef} className="relative w-full space-y-2">
      <div className="relative w-full">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10">
          <MapPin className="w-4 h-4 text-indigo-500" />
        </div>

        {isLoaded ? (
          <Autocomplete
            onLoad={setAutocomplete}
            onPlaceChanged={handlePlaceChanged}
            options={{ fields: ['formatted_address', 'geometry', 'name'] }}
          >
            {inputElement}
          </Autocomplete>
        ) : (
          inputElement
        )}

        <button
          type="button"
          onClick={pickLiveLocation}
          disabled={isFetchingLocation}
          title="Use my current live location"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1 px-2 py-1.5 sm:px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 active:scale-95 text-[11px] sm:text-[12px] font-bold rounded-[8px] border border-indigo-200/60 transition disabled:opacity-50 cursor-pointer shrink-0"
        >
          {isFetchingLocation ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 shrink-0" />
          ) : (
            <Navigation className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          )}
          <span className="whitespace-nowrap">{isFetchingLocation ? 'Locating...' : 'Live Location'}</span>
        </button>

        {/* Real-time Location Suggestions Dropdown */}
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1">
            <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              <span>Location Suggestions ({suggestions.length})</span>
              {isSearchingSuggestions && <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />}
            </div>
            {suggestions.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSuggestion(item)}
                className="w-full text-left px-3.5 py-2.5 hover:bg-indigo-50/70 border-b border-slate-100 last:border-0 flex items-start gap-2.5 transition cursor-pointer group"
              >
                <MapPin className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                <div>
                  <p className="text-[13px] font-bold text-slate-800 leading-snug group-hover:text-indigo-900">
                    {item.display}
                  </p>
                  <p className="text-[10px] font-medium text-slate-400">
                    {item.source === 'preset' ? 'Popular Workforce Hub' : 'Verified Location'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Popular City Chips */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide mr-1">Popular:</span>
        {POPULAR_HUBS.slice(0, 5).map((hub) => (
          <button
            key={hub.name}
            type="button"
            onClick={() => handleSelectSuggestion({ display: hub.name, lat: hub.lat, lng: hub.lng })}
            className={`text-[11px] font-bold px-2 py-0.5 rounded-md border transition cursor-pointer ${
              value === hub.name
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-slate-100/80 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border-slate-200/60'
            }`}
          >
            {hub.name.split(',')[0]}
          </button>
        ))}
      </div>
    </div>
  )
}

