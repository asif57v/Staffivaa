import { useCallback, useEffect, useState, useRef } from 'react'
import { useLoadScript } from '@react-google-maps/api'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, Loader2, MapPin, Navigation, X } from 'lucide-react'
import { readAppUserLocation, writeAppUserLocation } from '../../lib/appUserLocationStorage.js'

function formatCoords(lat, lng) {
  if (lat == null || lng == null) return ''
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

const libraries = ['places']

export function AppUserLocationModal({
  open,
  onClose,
  onSaved,
  title = 'Your location',
  subtitle = 'Shown on Home — used for nearby matches',
  saveLabel = 'Save location',
  requireLocation = false,
}) {
  const reduce = useReducedMotion()
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: apiKey,
    libraries,
  })

  const inputRef = useRef(null)
  const autocompleteRef = useRef(null)

  const [address, setAddress] = useState('')
  const [lat, setLat] = useState(null)
  const [lng, setLng] = useState(null)
  const [geoBusy, setGeoBusy] = useState(false)
  const [hint, setHint] = useState('')

  useEffect(() => {
    if (!open) return
    const stored = readAppUserLocation()
    queueMicrotask(() => {
      const initAddr = stored?.address ?? ''
      setAddress(initAddr)
      if (inputRef.current) inputRef.current.value = initAddr
      setLat(stored?.lat ?? null)
      setLng(stored?.lng ?? null)
      setHint('')
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open || !isLoaded || !inputRef.current || !apiKey) return

    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      fields: ['formatted_address', 'geometry'],
      componentRestrictions: { country: 'in' },
    })

    const listener = autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current.getPlace()
      if (place && place.geometry) {
        setAddress(place.formatted_address)
        setLat(place.geometry.location.lat())
        setLng(place.geometry.location.lng())
        setHint('Location selected from suggestions.')
      } else {
        setAddress(inputRef.current.value)
      }
    })

    return () => {
      if (listener) {
        window.google.maps.event.removeListener(listener)
      }
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
    }
  }, [isLoaded, apiKey, open])

  const fetchCurrent = useCallback(() => {
    if (!navigator.geolocation) {
      setHint('Location is not supported on this device.')
      return
    }
    setGeoBusy(true)
    setHint('Getting your location…')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const la = pos.coords.latitude
        const ln = pos.coords.longitude
        setLat(la)
        setLng(ln)
        
        try {
          if (!apiKey) {
             setGeoBusy(false)
             setHint('Coordinates updated. Add an address label below if you like.')
             return
          }
          const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${la},${ln}&key=${apiKey}`)
          const data = await res.json()
          if (data.results && data.results.length > 0) {
            setAddress(data.results[0].formatted_address)
            if (inputRef.current) inputRef.current.value = data.results[0].formatted_address
            setHint('Location successfully updated.')
          } else {
            setHint('Coordinates updated. Could not resolve address.')
          }
        } catch {
          setHint('Coordinates updated. Could not resolve address.')
        } finally {
          setGeoBusy(false)
        }
      },
      () => {
        setGeoBusy(false)
        setHint('Could not read GPS. Enter your area manually below.')
      },
      { enableHighAccuracy: false, timeout: 14_000, maximumAge: 60_000 },
    )
  }, [])

  const canSave = requireLocation ? Boolean(lat != null && lng != null) : true

  const save = useCallback(() => {
    const trimmed = address.trim()
    if (requireLocation && (lat == null || lng == null)) {
      setHint('Please select a location from the dropdown suggestions or fetch your current GPS location.')
      return
    }
    writeAppUserLocation({ address: trimmed, lat, lng })
    window.dispatchEvent(new CustomEvent('lc-app-user-location-changed'))
    onSaved?.()
    onClose()
  }, [address, lat, lng, onClose, onSaved, requireLocation])

  const sheet = (
    <AnimatePresence>
      {open ? (
      <motion.div
        className="fixed inset-0 z-[200] flex h-[100dvh] max-h-[100dvh] flex-col bg-white"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduce ? undefined : { opacity: 0 }}
        transition={{ duration: 0.2 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-loc-title"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-linear-to-b from-brand/10 via-emerald-50/30 to-transparent" aria-hidden />

        <header className="relative flex shrink-0 items-center gap-2 border-b border-slate-100/90 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-700 shadow-sm transition hover:border-brand/30 active:scale-[0.98]"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 id="app-loc-title" className="truncate text-lg font-black tracking-tight text-slate-900">
              {title}
            </h1>
            <p className="truncate text-xs font-medium text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <motion.div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-4">
          <section className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4 ring-1 ring-slate-100/80">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand ring-1 ring-brand/15">
                <MapPin className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Current</p>
                {address ? (
                  <>
                    <p className="text-sm font-semibold leading-snug text-slate-900">{address}</p>
                    {lat != null && lng != null ? (
                      <p className="text-[11px] font-medium text-slate-500">GPS: {formatCoords(lat, lng)}</p>
                    ) : null}
                  </>
                ) : lat != null && lng != null ? (
                  <p className="text-sm font-semibold leading-snug text-slate-900">{formatCoords(lat, lng)}</p>
                ) : (
                  <p className="text-sm font-medium text-slate-500">No location saved yet.</p>
                )}
              </div>
            </div>
          </section>

          <section className="mt-6 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Update</p>
            <button
              type="button"
              onClick={fetchCurrent}
              disabled={geoBusy}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-brand/35 bg-white py-3.5 text-sm font-bold text-brand shadow-sm transition hover:bg-brand/5 disabled:opacity-60"
            >
              {geoBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Navigation className="h-4 w-4" aria-hidden />}
              Fetch current location
            </button>
            {hint ? <p className="text-center text-[11px] font-medium text-slate-500">{hint}</p> : null}
            <label className="block space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Or enter location</span>
              <input
                ref={inputRef}
                type="text"
                defaultValue={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Area, landmark, city…"
                className="w-full rounded-2xl border border-slate-200/90 bg-white px-3 py-3 text-sm font-medium text-slate-900 shadow-inner outline-none placeholder:text-slate-400 focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
              />
            </label>
          </section>
        </motion.div>

        <div className="shrink-0 border-t border-slate-200/90 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_30px_-8px_rgba(15,23,42,0.08)]">
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="w-full rounded-2xl bg-linear-to-r from-brand to-emerald-600 py-3.5 text-sm font-black text-white shadow-lg shadow-brand/25 transition hover:brightness-[1.03] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveLabel}
          </button>
        </div>
      </motion.div>
      ) : null}
    </AnimatePresence>
  )

  if (typeof document === 'undefined') return null
  if (!open) return null
  return createPortal(sheet, document.body)
}
