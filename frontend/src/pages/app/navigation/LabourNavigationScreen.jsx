import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { GoogleMap, DirectionsRenderer, Marker } from '@react-google-maps/api'
import { useCheckInMutation } from '../../../store/api/workforceApi.js'
import { useWorkerLocationEmitter } from '../../../hooks/useWorkerLocationEmitter.js'
import {
  buildRotatableMapOptions,
  calculateMapBearing,
  refreshGoogleMap,
  setMapCamera,
  useGoogleMapsLoader,
} from '../../../hooks/useGoogleMapsLoader.js'
import {
  ArrowLeft,
  Navigation,
  Phone,
  MapPin,
  CheckCircle2,
  User,
  Loader2,
  AlertCircle,
  LocateFixed,
  Maximize2,
  Minimize2,
  ChevronUp,
  Compass,
  Navigation2,
} from 'lucide-react'

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  minHeight: '240px',
}

const defaultCenter = {
  lat: 22.7196, // Default Indore center
  lng: 75.8577,
}

const baseMapStyle = [
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
]

export function LabourNavigationScreen() {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const { state } = useLocation()
  const job = state?.job

  const { apiKey, isLoaded, loadError } = useGoogleMapsLoader()

  const [customerPos, setCustomerPos] = useState(null)
  const [directions, setDirections] = useState(null)
  const [distance, setDistance] = useState('')
  const [eta, setEta] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [mapHeading, setMapHeading] = useState(0)
  // Force a fresh GoogleMap instance each visit — fixes blank tiles after navigating away.
  const [mapInstanceKey] = useState(() => `nav-map-${Date.now()}`)

  const mapRef = useRef(null)
  const initialBoundsFitRef = useRef(false)
  const lastDirectionsTimeRef = useRef(0)

  const mapOptions = useMemo(
    () =>
      buildRotatableMapOptions({
        maxZoom: 19,
        minZoom: 3,
        styles: baseMapStyle,
      }),
    [isLoaded],
  )

  const [checkIn, { isLoading: isCheckingIn }] = useCheckInMutation()

  // Tracking rooms use WorkforceRequest id — not assignment id from the URL.
  const targetBookingId = job?.requestId || bookingId || job?.id

  // Live Location Emitter Hook
  const isTrackingActive = job?.status !== 'on_site' && job?.status !== 'completed'
  const {
    currentPosition: labourPos,
    heading,
    speed,
    isEmitting,
    gpsError,
    permissionDenied,
    lastEmittedAt,
    isSimulating,
    simulationStep,
    simulationTotalSteps,
    startSimulation,
    stopSimulation,
  } = useWorkerLocationEmitter({
    bookingId: targetBookingId,
    isActive: isTrackingActive,
  })

  const mapCenter = useMemo(() => {
    if (labourPos?.lat != null && labourPos?.lng != null) return labourPos
    if (customerPos?.lat != null && customerPos?.lng != null) return customerPos
    if (job?.locationLat != null && job?.locationLng != null) {
      return { lat: Number(job.locationLat), lng: Number(job.locationLng) }
    }
    return defaultCenter
  }, [labourPos, customerPos, job?.locationLat, job?.locationLng])

  // Geocode customer location if not available as coordinates
  useEffect(() => {
    if (!job || !apiKey) return

    if (job.locationLat != null && job.locationLng != null) {
      setCustomerPos({ lat: job.locationLat, lng: job.locationLng })
      return
    }

    const fetchCustomerLocation = async () => {
      try {
        const address = job.site || job.location || job.title
        if (!address) {
          setCustomerPos(defaultCenter)
          return
        }
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
        )
        const data = await res.json()
        if (data.results && data.results.length > 0) {
          setCustomerPos(data.results[0].geometry.location)
        } else {
          setCustomerPos(defaultCenter)
        }
      } catch (err) {
        console.error('Geocoding error', err)
        setCustomerPos(defaultCenter)
      }
    }

    fetchCustomerLocation()
  }, [job, apiKey])

  // Fit bounds ONCE smoothly so both worker and customer are nicely framed without jerking
  useEffect(() => {
    if (!mapRef.current || !labourPos || !customerPos || initialBoundsFitRef.current) return
    try {
      const bounds = new window.google.maps.LatLngBounds()
      bounds.extend(labourPos)
      bounds.extend(customerPos)
      mapRef.current.fitBounds(bounds, { top: 100, bottom: 280, left: 50, right: 50 })
      initialBoundsFitRef.current = true
    } catch (err) {
      console.warn('fitBounds error', err)
    }
  }, [labourPos, customerPos])

  // Fetch directions and route polyline (Throttled every 45s to avoid resetting the viewport on every tick)
  useEffect(() => {
    if (!isLoaded || !labourPos || !customerPos) return

    const now = Date.now()
    if (directions && now - lastDirectionsTimeRef.current < 45000) {
      return // Throttled
    }
    lastDirectionsTimeRef.current = now

    const directionsService = new window.google.maps.DirectionsService()
    directionsService.route(
      {
        origin: labourPos,
        destination: customerPos,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          setDirections(result)
          if (result.routes[0]?.legs[0]) {
            const leg = result.routes[0].legs[0]
            setDistance(leg.distance.text)
            setEta(leg.duration.text)
          }
        }
      }
    )
  }, [isLoaded, labourPos, customerPos, directions])

  const distanceToDestinationMeters = useMemo(() => {
    if (!labourPos || !customerPos) return null
    const lat1 = labourPos.lat
    const lon1 = labourPos.lng
    const lat2 = customerPos.lat
    const lon2 = customerPos.lng
    const R = 6371e3
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }, [labourPos, customerPos])

  const isWithinGeofence = distanceToDestinationMeters == null || distanceToDestinationMeters <= 400

  const handleStartNavigation = () => {
    const destination = customerPos
      ? `${customerPos.lat},${customerPos.lng}`
      : encodeURIComponent(job?.site || job?.location || job?.title)

    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank')
  }

  const handleCheckIn = async () => {
    if (distanceToDestinationMeters != null && distanceToDestinationMeters > 400) {
      const distStr =
        distanceToDestinationMeters >= 1000
          ? `${(distanceToDestinationMeters / 1000).toFixed(1)} km`
          : `${Math.round(distanceToDestinationMeters)} meters`
      alert(`⚠️ You are currently ${distStr} away from the destination.\n\nPlease reach within 400 meters of the customer location to mark check-in.`)
      return
    }

    try {
      await checkIn({
        assignmentId: job.id,
        lat: labourPos?.lat,
        lng: labourPos?.lng,
      }).unwrap()
      navigate('/app/jobs?tab=active', { replace: true })
    } catch (err) {
      console.error('Failed to check in', err)
      alert(err?.data?.message || 'Failed to mark check-in')
    }
  }

  const handleRecenter = useCallback(() => {
    if (mapRef.current && labourPos) {
      refreshGoogleMap(mapRef.current, labourPos)
      mapRef.current.panTo(labourPos)
      mapRef.current.setZoom(16)
    }
  }, [labourPos])

  const handleResetNorth = useCallback(() => {
    if (!mapRef.current) return
    setMapCamera(mapRef.current, { heading: 0, tilt: 0 })
    setMapHeading(0)
  }, [])

  const handleFaceDestination = useCallback(() => {
    if (!mapRef.current || !labourPos || !customerPos) return
    const bearing = calculateMapBearing(labourPos, customerPos)
    setMapCamera(mapRef.current, {
      heading: bearing,
      tilt: 45,
      center: labourPos,
      zoom: 16,
    })
    setMapHeading(bearing)
  }, [labourPos, customerPos])

  // After remount / fullscreen toggle, force map tiles to repaint
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return
    const t = window.setTimeout(() => {
      refreshGoogleMap(mapRef.current, mapCenter)
    }, 120)
    return () => window.clearTimeout(t)
  }, [isLoaded, isFullscreen, mapCenter, mapInstanceKey])

  // SVG Marker with rotation matching heading
  const workerMarkerSvg = useMemo(() => {
    const rot = Math.round(heading || 0)
    return `data:image/svg+xml;utf-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
        <defs>
          <filter id="navShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.4"/>
          </filter>
        </defs>
        <g transform="rotate(${rot} 22 22)" filter="url(#navShadow)">
          <circle cx="22" cy="22" r="19" fill="#FFD100" stroke="#0F172A" stroke-width="2.5" />
          <polygon points="22,6 31,33 22,27 13,33" fill="#0F172A" />
        </g>
      </svg>
    `)}`
  }, [heading])

  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center p-6 text-center text-red-500">
        Error loading maps. Please check internet connection.
      </div>
    )
  }

  if (!isLoaded || !job) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
          <p className="text-sm font-bold text-slate-500">Initializing Navigation...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-100 overflow-hidden relative select-none">
      {/* Floating Header */}
      <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => navigate(-1)}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-800 shadow-lg transition active:scale-95 border border-slate-100 cursor-pointer"
              title="Go Back"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>

            {/* Top Fullscreen Map Toggle Button */}
            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className={`flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all active:scale-95 border cursor-pointer ${
                isFullscreen
                  ? 'bg-slate-900 text-white border-slate-800 ring-2 ring-brand'
                  : 'bg-white text-slate-800 border-slate-100 hover:bg-slate-50'
              }`}
              title={isFullscreen ? 'Minimize Fullscreen' : 'Full Screen Map'}
            >
              {isFullscreen ? (
                <Minimize2 className="h-5 w-5 text-brand" />
              ) : (
                <Maximize2 className="h-5 w-5 text-slate-700" />
              )}
            </button>
          </div>

          <div className="flex flex-col items-end gap-2 pointer-events-auto">
            {eta && (
              <div className="bg-white rounded-2xl shadow-lg border border-slate-100 px-4 py-2 text-center flex flex-col items-center min-w-[100px]">
                <span className="text-xl font-black text-emerald-600">{eta}</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{distance}</span>
              </div>
            )}

            {/* Live Streaming Badge */}
            {isEmitting && (
              <div className="flex items-center gap-1.5 rounded-full bg-slate-900/85 backdrop-blur-md px-3 py-1 text-[10px] font-bold text-white shadow-md">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Live Location Active</span>
                {speed > 0 && <span className="opacity-75">({speed} km/h)</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* GPS Error Alert Prompt */}
      {gpsError && (
        <div className="absolute top-20 left-4 right-4 z-20 pointer-events-auto">
          <div className="rounded-2xl bg-rose-500 text-white p-3.5 shadow-xl flex items-start gap-3 border border-rose-400">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold">{permissionDenied ? 'GPS Permission Needed' : 'Location Notice'}</p>
              <p className="opacity-90 mt-0.5">{gpsError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Floating map camera controls */}
      <div
        className={`absolute right-4 z-20 flex flex-col gap-2 transition-all duration-300 ${
          isFullscreen ? 'bottom-16' : 'bottom-[290px]'
        }`}
      >
        <button
          type="button"
          onClick={handleFaceDestination}
          disabled={!labourPos || !customerPos}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-[#FFD100] shadow-xl border border-slate-700 transition active:scale-90 cursor-pointer disabled:opacity-40"
          title="Face destination (like Google Maps navigation)"
        >
          <Navigation2 className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={handleResetNorth}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-800 shadow-xl border border-slate-200/80 transition active:scale-90 cursor-pointer"
          title="Reset map to North"
        >
          <Compass
            className="h-6 w-6 text-slate-700 transition-transform duration-200"
            style={{ transform: `rotate(${-mapHeading}deg)` }}
          />
        </button>
        <button
          type="button"
          onClick={handleRecenter}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-800 shadow-xl border border-slate-200/80 transition active:scale-90 cursor-pointer"
          title="Recenter to my location"
        >
          <LocateFixed className="h-6 w-6 text-slate-700" />
        </button>
      </div>

      {/* Map Area (Expands to full height in fullscreen mode) */}
      <div className={`flex-1 relative min-h-[240px] bg-slate-100 transition-all duration-300 ${isFullscreen ? 'pb-0' : 'pb-64 lg:pb-72'}`}>
        <GoogleMap
          key={mapInstanceKey}
          mapContainerStyle={mapContainerStyle}
          center={mapCenter}
          zoom={14}
          options={mapOptions}
          onLoad={(map) => {
            mapRef.current = map
            const headingListener = map.addListener('heading_changed', () => {
              setMapHeading(Number(map.getHeading?.() || 0))
            })
            // Deferred resize fixes blank grey map when returning to this screen
            window.requestAnimationFrame(() => {
              refreshGoogleMap(map, mapCenter)
            })
            window.setTimeout(() => {
              refreshGoogleMap(map, mapCenter)
              if (labourPos && customerPos && !initialBoundsFitRef.current) {
                try {
                  const bounds = new window.google.maps.LatLngBounds()
                  bounds.extend(labourPos)
                  bounds.extend(customerPos)
                  map.fitBounds(bounds, { top: 100, bottom: 280, left: 50, right: 50 })
                  initialBoundsFitRef.current = true
                } catch {
                  /* ignore */
                }
              }
            }, 180)
            map.__staffivaaHeadingListener = headingListener
          }}
          onUnmount={(map) => {
            try {
              map?.__staffivaaHeadingListener?.remove?.()
            } catch {
              /* ignore */
            }
            mapRef.current = null
          }}
        >
          {directions && (
            <DirectionsRenderer
              directions={directions}
              options={{
                suppressMarkers: true,
                preserveViewport: true, // 🚀 Prevents map from jerking / resetting camera on route updates
                polylineOptions: {
                  strokeColor: '#0f172a',
                  strokeWeight: 5,
                  strokeOpacity: 0.85,
                },
              }}
            />
          )}

          {labourPos && (
            <Marker
              position={labourPos}
              icon={{
                url: workerMarkerSvg,
                scaledSize: new window.google.maps.Size(44, 44),
                anchor: new window.google.maps.Point(22, 22),
              }}
            />
          )}

          {customerPos && (
            <Marker
              position={customerPos}
              icon={{
                url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2310b981' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/%3E%3Cpolyline points='9 22 9 12 15 12 15 22'/%3E%3C/svg%3E",
                scaledSize: new window.google.maps.Size(34, 34),
                anchor: new window.google.maps.Point(17, 34),
              }}
            />
          )}
        </GoogleMap>
      </div>

      {/* Fixed Bottom Sheet with smooth slide transition */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] z-20 transition-transform duration-300 ease-in-out pb-[max(1rem,env(safe-area-inset-bottom,1rem))] ${
          isFullscreen ? 'translate-y-[calc(100%-3.25rem)]' : 'translate-y-0'
        }`}
      >
        {/* Drag / Click Handle to Toggle Fullscreen */}
        <button
          type="button"
          onClick={() => setIsFullscreen((prev) => !prev)}
          className="w-full flex flex-col items-center justify-center pt-2.5 pb-2 cursor-pointer select-none bg-white rounded-t-3xl hover:bg-slate-50 transition"
          title={isFullscreen ? 'Tap to expand job details' : 'Tap to minimize to full screen'}
        >
          <div className="w-12 h-1.5 bg-slate-300 rounded-full mb-1" />
          {isFullscreen && (
            <span className="text-[11px] font-extrabold text-slate-600 flex items-center gap-1.5 tracking-tight py-0.5">
              <ChevronUp className="h-3.5 w-3.5 text-brand animate-bounce" />
              <span>{job.contractor || 'Customer'} • Tap to Expand Details</span>
            </span>
          )}
        </button>

        <div className="px-5 pb-5">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">{job.contractor || 'Customer'}</h2>
              <p className="text-sm font-bold text-brand">{job.trade || 'Service Category'}</p>
            </div>
            {job.supervisorPhone && (
              <a
                href={`tel:${job.supervisorPhone}`}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-800 transition active:scale-95 shrink-0 border border-slate-200"
              >
                <Phone className="h-5 w-5 fill-slate-800" />
              </a>
            )}
          </div>

          <div className="flex gap-3 items-start mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Destination</p>
              <p className="text-xs font-semibold text-slate-800 line-clamp-2 leading-snug">
                {job.site || job.location || job.title}
              </p>
            </div>
          </div>

          {/* Developer Test Simulator Bar */}
          <div className="mb-4">
            {isSimulating ? (
              <div className="rounded-2xl bg-amber-500 text-white p-3 shadow-md flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-black">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </span>
                    Simulating Movement ({simulationStep}/{simulationTotalSteps})
                  </div>
                  <p className="text-[10px] opacity-90 mt-0.5">Emitting live coordinates every 3s...</p>
                </div>
                <button
                  type="button"
                  onClick={stopSimulation}
                  className="rounded-xl bg-white px-3 py-1.5 text-xs font-black text-amber-600 shadow-sm transition active:scale-95 cursor-pointer"
                >
                  Stop Test
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const origin = labourPos || defaultCenter
                  const dest = customerPos || { lat: defaultCenter.lat + 0.04, lng: defaultCenter.lng + 0.04 }
                  startSimulation(origin, dest, 20, 3000)
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold border border-slate-200 transition active:scale-95 cursor-pointer"
              >
                <span>🚗</span> Simulate Worker Route (Live Test)
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleStartNavigation}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-slate-900 text-white py-3.5 text-sm font-bold shadow-lg transition active:scale-95 cursor-pointer"
            >
              <Navigation className="h-4 w-4" /> Start Navigation
            </button>
            <button
              onClick={handleCheckIn}
              disabled={isCheckingIn || job.status === 'on_site'}
              className={`flex-1 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold shadow-lg transition active:scale-95 disabled:opacity-50 disabled:shadow-none cursor-pointer ${
                job.status === 'on_site'
                  ? 'bg-emerald-500 text-white'
                  : isWithinGeofence
                  ? 'bg-[#FFD100] text-slate-900 ring-2 ring-amber-400 ring-offset-2 animate-pulse'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {isCheckingIn ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : job.status === 'on_site' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <MapPin className={`h-4 w-4 ${isWithinGeofence ? 'text-slate-900' : 'text-slate-500'}`} />
              )}
              {job.status === 'on_site'
                ? 'Checked In'
                : isWithinGeofence
                ? 'Mark Check-In (Ready)'
                : 'Mark Check-In'}
            </button>
          </div>

          {/* Geofence Distance Subtext */}
          {job.status !== 'on_site' && distanceToDestinationMeters != null && (
            <p className={`text-center text-[10px] font-bold mt-2.5 ${isWithinGeofence ? 'text-emerald-600' : 'text-slate-400'}`}>
              {isWithinGeofence
                ? '✅ You have reached within 400m of customer site. Tap Mark Check-In.'
                : `📍 Within 400m required for arrival (Current distance: ${
                    distanceToDestinationMeters >= 1000
                      ? `${(distanceToDestinationMeters / 1000).toFixed(1)} km`
                      : `${Math.round(distanceToDestinationMeters)}m`
                  })`}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
