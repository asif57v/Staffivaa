import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api'
import {
  Navigation2,
  Wifi,
  WifiOff,
  Clock,
  ShieldCheck,
  AlertCircle,
  LocateFixed,
  Maximize2,
  Minimize2,
  Compass,
  Layers,
} from 'lucide-react'
import { getSocket } from '../../../services/socket.js'
import { store } from '../../../store/index.js'
import {
  buildRotatableMapOptions,
  calculateMapBearing,
  refreshGoogleMap,
  setMapCamera,
} from '../../../hooks/useGoogleMapsLoader.js'

const mapContainerStyle = {
  width: '100%',
  height: '100%',
}

// Clean, high-contrast Rapido-style vector map theme
const rapidoMapStyles = [
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ visibility: 'off' }],
  },
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
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64748b' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#ffffff' }, { weight: 2 }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#f1f5f9' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#fef08a' }], // Subtle yellow highway tint
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#fde047' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#e0f2fe' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#94a3b8' }],
  },
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#f8fafc' }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry',
    stylers: [{ color: '#f1f5f9' }],
  },
]

const defaultMapOptionsBase = {
  maxZoom: 19,
  minZoom: 4,
  styles: rapidoMapStyles,
}

/**
 * Calculates shortest angular distance for rotation interpolation
 */
function interpolateAngle(fromAngle, toAngle, t) {
  let delta = ((toAngle - fromAngle + 540) % 360) - 180
  return (fromAngle + delta * t + 360) % 360
}

/**
 * Linear interpolation
 */
function lerp(start, end, t) {
  return start + (end - start) * t
}

export function LiveTrackingMap({
  bookingId,
  customerLocation,
  initialWorkerLocation,
  workerName,
  workerPic,
  isArrived = false,
  onEtaUpdate,
  containerClassName = '',
  bottomSheetPadding = 0,
  hideFloatingHud = false,
  hideFullscreenButton = false,
  isFullscreen: controlledFullscreen,
  onFullscreenChange,
}) {
  const [displayedWorkerPos, setDisplayedWorkerPos] = useState(initialWorkerLocation || null)
  const [displayedHeading, setDisplayedHeading] = useState(initialWorkerLocation?.heading || 0)
  const [directions, setDirections] = useState(null)
  const [eta, setEta] = useState('')
  const [distance, setDistance] = useState('')
  const [lastUpdateSecAgo, setLastUpdateSecAgo] = useState(0)
  const [isSocketConnected, setIsSocketConnected] = useState(false)
  const [isStale, setIsStale] = useState(false)
  const [hasArrivedState, setHasArrivedState] = useState(isArrived)
  const [internalFullscreen, setInternalFullscreen] = useState(false)
  const [trafficEnabled, setTrafficEnabled] = useState(false)
  const [mapHeading, setMapHeading] = useState(0)

  const isFullscreen =
    typeof controlledFullscreen === 'boolean' ? controlledFullscreen : internalFullscreen

  const setIsFullscreen = useCallback(
    (next) => {
      const value = typeof next === 'function' ? next(isFullscreen) : next
      if (onFullscreenChange) onFullscreenChange(value)
      else setInternalFullscreen(value)
    },
    [isFullscreen, onFullscreenChange],
  )

  const defaultMapOptions = useMemo(() => buildRotatableMapOptions(defaultMapOptionsBase), [])

  const mapRef = useRef(null)
  const trafficLayerRef = useRef(null)
  const initialBoundsFitRef = useRef(false)
  const animFrameRef = useRef(null)
  const animStartTimeRef = useRef(0)
  const startPosRef = useRef(displayedWorkerPos)
  const targetPosRef = useRef(displayedWorkerPos)
  const startHeadingRef = useRef(displayedHeading)
  const targetHeadingRef = useRef(displayedHeading)
  const lastPacketTimeRef = useRef(initialWorkerLocation ? Date.now() : 0)
  const lastDirectionsTimeRef = useRef(0)

  const mapCenter = useMemo(() => {
    if (customerLocation?.lat != null && customerLocation?.lng != null) {
      return { lat: customerLocation.lat, lng: customerLocation.lng }
    }
    if (displayedWorkerPos?.lat != null && displayedWorkerPos?.lng != null) {
      return { lat: displayedWorkerPos.lat, lng: displayedWorkerPos.lng }
    }
    if (initialWorkerLocation?.lat != null && initialWorkerLocation?.lng != null) {
      return { lat: initialWorkerLocation.lat, lng: initialWorkerLocation.lng }
    }
    return { lat: 22.7196, lng: 75.8577 }
  }, [customerLocation, displayedWorkerPos, initialWorkerLocation])

  // Sync initial worker location if it changes from parent
  useEffect(() => {
    if (initialWorkerLocation?.lat && initialWorkerLocation?.lng && !displayedWorkerPos) {
      setDisplayedWorkerPos({ lat: initialWorkerLocation.lat, lng: initialWorkerLocation.lng })
      setDisplayedHeading(initialWorkerLocation.heading || 0)
      startPosRef.current = { lat: initialWorkerLocation.lat, lng: initialWorkerLocation.lng }
      targetPosRef.current = { lat: initialWorkerLocation.lat, lng: initialWorkerLocation.lng }
      lastPacketTimeRef.current = Date.now()
    }
  }, [initialWorkerLocation, displayedWorkerPos])

  // Fit bounds nicely so both worker and customer are framed with bottom sheet offset
  const fitRouteBounds = useCallback(() => {
    if (!mapRef.current) return
    try {
      const bounds = new window.google.maps.LatLngBounds()
      if (displayedWorkerPos) bounds.extend(displayedWorkerPos)
      if (customerLocation) bounds.extend(customerLocation)

      const paddingBottom = (bottomSheetPadding || 180) + 40
      mapRef.current.fitBounds(bounds, {
        top: 80,
        bottom: paddingBottom,
        left: 45,
        right: 45,
      })
    } catch (err) {
      console.warn('fitBounds error', err)
    }
  }, [displayedWorkerPos, customerLocation, bottomSheetPadding])

  // Fit bounds once on load
  useEffect(() => {
    if (!mapRef.current || !displayedWorkerPos || !customerLocation || initialBoundsFitRef.current) return
    fitRouteBounds()
    initialBoundsFitRef.current = true
  }, [displayedWorkerPos, customerLocation, fitRouteBounds])

  // LERP Animation Loop using requestAnimationFrame (Silky smooth 60fps tracking glide)
  const startSmoothTransition = useCallback((newLat, newLng, newHeading) => {
    if (!startPosRef.current) {
      startPosRef.current = { lat: newLat, lng: newLng }
      targetPosRef.current = { lat: newLat, lng: newLng }
      setDisplayedWorkerPos({ lat: newLat, lng: newLng })
      setDisplayedHeading(newHeading || 0)
      return
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
    }

    startPosRef.current = targetPosRef.current || startPosRef.current
    targetPosRef.current = { lat: newLat, lng: newLng }

    startHeadingRef.current = targetHeadingRef.current || 0
    targetHeadingRef.current = newHeading != null ? newHeading : startHeadingRef.current

    const duration = 2400 // 2.4 seconds smooth glide
    animStartTimeRef.current = performance.now()

    const animate = (currentTime) => {
      const elapsed = currentTime - animStartTimeRef.current
      const progress = Math.min(elapsed / duration, 1)

      const curLat = lerp(startPosRef.current.lat, targetPosRef.current.lat, progress)
      const curLng = lerp(startPosRef.current.lng, targetPosRef.current.lng, progress)
      const curHead = interpolateAngle(startHeadingRef.current, targetHeadingRef.current, progress)

      setDisplayedWorkerPos({ lat: curLat, lng: curLng })
      setDisplayedHeading(curHead)

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate)
      } else {
        startPosRef.current = targetPosRef.current
        startHeadingRef.current = targetHeadingRef.current
      }
    }

    animFrameRef.current = requestAnimationFrame(animate)
  }, [])

  // Socket setup & real-time GPS tracking stream
  useEffect(() => {
    if (!bookingId) return

    const socket = getSocket()
    if (!socket) return

    const token = store.getState()?.auth?.token || localStorage.getItem('token')

    const joinTrackingRoom = () => {
      socket.emit('user:joinBooking', { bookingId, token })
    }

    if (socket.connected) {
      setIsSocketConnected(true)
      joinTrackingRoom()
    }

    socket.on('connect', () => {
      setIsSocketConnected(true)
      joinTrackingRoom()
    })

    socket.on('disconnect', () => {
      setIsSocketConnected(false)
    })

    socket.on('tracking:joined', (data) => {
      if (data?.lastKnownLocation?.lat && data?.lastKnownLocation?.lng) {
        lastPacketTimeRef.current = Date.now()
        startSmoothTransition(
          data.lastKnownLocation.lat,
          data.lastKnownLocation.lng,
          data.lastKnownLocation.heading || 0
        )
      }
    })

    socket.on('user:locationUpdate', (data) => {
      if (data?.lat != null && data?.lng != null) {
        lastPacketTimeRef.current = Date.now()
        setIsStale(false)
        startSmoothTransition(data.lat, data.lng, data.heading || 0)
      }
    })

    socket.on('tracking:stop', (data) => {
      setHasArrivedState(true)
      if (data?.finalLocation?.lat && data?.finalLocation?.lng) {
        startSmoothTransition(data.finalLocation.lat, data.finalLocation.lng, data.finalLocation.heading || 0)
      }
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('tracking:joined')
      socket.off('user:locationUpdate')
      socket.off('tracking:stop')
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [bookingId, startSmoothTransition])

  // Periodic Stale Update Check (every 2 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      if (!lastPacketTimeRef.current) return
      const elapsedSec = Math.floor((Date.now() - lastPacketTimeRef.current) / 1000)
      setLastUpdateSecAgo(elapsedSec)
      if (elapsedSec > 30 && !hasArrivedState) {
        setIsStale(true)
      } else {
        setIsStale(false)
      }
    }, 2000)

    return () => clearInterval(timer)
  }, [hasArrivedState])

  // Directions & ETA Calculation (Throttled every 45 seconds to save Google Maps quota)
  const fetchRouteAndEta = useCallback(() => {
    if (!window.google || !displayedWorkerPos || !customerLocation) return
    const now = Date.now()
    if (now - lastDirectionsTimeRef.current < 45000 && directions) {
      return // Throttled
    }

    lastDirectionsTimeRef.current = now
    const directionsService = new window.google.maps.DirectionsService()

    directionsService.route(
      {
        origin: displayedWorkerPos,
        destination: customerLocation,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          setDirections(result)
          if (result.routes[0]?.legs[0]) {
            const leg = result.routes[0].legs[0]
            const etaText = leg.duration?.text || ''
            const distText = leg.distance?.text || ''
            setEta(etaText)
            setDistance(distText)
            if (onEtaUpdate) {
              onEtaUpdate({ eta: etaText, distance: distText, durationSec: leg.duration?.value })
            }
          }
        }
      }
    )
  }, [displayedWorkerPos, customerLocation, directions, onEtaUpdate])

  useEffect(() => {
    fetchRouteAndEta()
  }, [displayedWorkerPos, customerLocation, fetchRouteAndEta])

  // Recenter Action: Smoothly pans to worker and zooms with bottom offset
  const handleRecenter = useCallback(() => {
    if (!mapRef.current) return
    if (displayedWorkerPos && customerLocation) {
      fitRouteBounds()
    } else if (displayedWorkerPos) {
      mapRef.current.panTo(displayedWorkerPos)
      mapRef.current.setZoom(16)
    }
  }, [displayedWorkerPos, customerLocation, fitRouteBounds])

  const handleResetNorth = useCallback(() => {
    if (!mapRef.current) return
    setMapCamera(mapRef.current, { heading: 0, tilt: 0 })
    setMapHeading(0)
  }, [])

  const handleFaceDestination = useCallback(() => {
    if (!mapRef.current || !displayedWorkerPos || !customerLocation) return
    const bearing = calculateMapBearing(displayedWorkerPos, customerLocation)
    setMapCamera(mapRef.current, {
      heading: bearing,
      tilt: 45,
      center: displayedWorkerPos,
      zoom: 15,
    })
    setMapHeading(bearing)
  }, [displayedWorkerPos, customerLocation])

  // Traffic layer toggle
  const toggleTraffic = useCallback(() => {
    if (!mapRef.current || !window.google) return
    if (trafficEnabled) {
      if (trafficLayerRef.current) trafficLayerRef.current.setMap(null)
      setTrafficEnabled(false)
    } else {
      if (!trafficLayerRef.current) {
        trafficLayerRef.current = new window.google.maps.TrafficLayer()
      }
      trafficLayerRef.current.setMap(mapRef.current)
      setTrafficEnabled(true)
    }
  }, [trafficEnabled])

  // 🚀 Authentic Rapido-Style Vehicle / Worker Marker (Vibrant Yellow circular badge with heading pointer + bike glyph)
  const workerSvgIcon = useMemo(() => {
    const rot = Math.round(displayedHeading || 0)
    return `data:image/svg+xml;utf-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
        <defs>
          <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.38"/>
          </filter>
          <linearGradient id="rapidoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FFF066" />
            <stop offset="100%" stop-color="#FFD100" />
          </linearGradient>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0F172A" />
            <stop offset="100%" stop-color="#1E293B" />
          </linearGradient>
        </defs>

        <!-- Outer Direction Arrow Pointer (Rotates with vehicle heading) -->
        <g transform="rotate(${rot} 28 28)" filter="url(#shadow)">
          <!-- Heading Triangle Pointer -->
          <polygon points="28,2 37,20 19,20" fill="#FFD100" stroke="#0F172A" stroke-width="2" stroke-linejoin="round" />
          
          <!-- Outer Rapido Glow Disc -->
          <circle cx="28" cy="28" r="22" fill="url(#rapidoGrad)" stroke="#0F172A" stroke-width="2.5" />
          
          <!-- Inner Dark Core Disc -->
          <circle cx="28" cy="28" r="16" fill="url(#ringGrad)" />
          
          <!-- Scooter / Helmet / Worker Silhouette Glyph -->
          <path d="M28 17 C25.8 17 24 18.8 24 21 C24 22.8 25.2 24.3 26.8 24.8 C24 26 22 28.5 22 31.5 L34 31.5 C34 28.5 32 26 29.2 24.8 C30.8 24.3 32 22.8 32 21 C32 18.8 30.2 17 28 17 Z" fill="#FFD100" />
          <circle cx="28" cy="21" r="2" fill="#0F172A" />
        </g>
      </svg>
    `)}`
  }, [displayedHeading])

  // 🏡 Rapido Destination / Customer Home Pin (Emerald green with crisp house badge)
  const customerSvgIcon = useMemo(() => {
    return `data:image/svg+xml;utf-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="46" height="52" viewBox="0 0 46 52">
        <defs>
          <filter id="pinShadow" x="-25%" y="-20%" width="150%" height="150%">
            <feDropShadow dx="0" dy="4" stdDeviation="3.5" flood-color="#000000" flood-opacity="0.32"/>
          </filter>
        </defs>
        <g filter="url(#pinShadow)">
          <!-- Teardrop Pin Shape -->
          <path d="M23 2 C12.5 2 4 10.5 4 21 C4 32.5 20 48 23 50 C26 48 42 32.5 42 21 C42 10.5 33.5 2 23 2 Z" fill="#059669" stroke="#FFFFFF" stroke-width="2.5" stroke-linejoin="round" />
          <!-- Inner White Disc -->
          <circle cx="23" cy="20" r="11" fill="#FFFFFF" />
          <!-- Home Icon Inside -->
          <path d="M23 13 L17 18 L17 25 C17 25.5 17.5 26 18 26 L21 26 L21 22 L25 22 L25 26 L28 26 C28.5 26 29 25.5 29 25 L29 18 Z" fill="#059669" />
        </g>
      </svg>
    `)}`
  }, [])

  return (
    <div
      className={`transition-all duration-300 select-none overflow-hidden ${
        isFullscreen && !hideFullscreenButton
          ? 'fixed inset-0 z-[100] w-full h-[100dvh] bg-slate-900'
          : containerClassName || 'relative w-full h-full bg-slate-100'
      }`}
    >
      <GoogleMap
        mapContainerStyle={{ ...mapContainerStyle, minHeight: '240px' }}
        center={mapCenter}
        zoom={displayedWorkerPos && customerLocation ? 14 : 13}
        options={defaultMapOptions}
        onLoad={(map) => {
          mapRef.current = map
          map.addListener('heading_changed', () => {
            setMapHeading(Number(map.getHeading?.() || 0))
          })
          window.requestAnimationFrame(() => {
            refreshGoogleMap(map, mapCenter)
          })
          window.setTimeout(() => {
            refreshGoogleMap(map, mapCenter)
            if (customerLocation && displayedWorkerPos) {
              fitRouteBounds()
            } else if (customerLocation) {
              map.panTo(customerLocation)
            }
          }, 180)
        }}
      >
        {/* Rapido High-Contrast Polyline: Clean Dark Slate Road Contour */}
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: true,
              preserveViewport: true, // Prevents map camera jumping unexpectedly
              polylineOptions: {
                strokeColor: '#0F172A',
                strokeWeight: 6,
                strokeOpacity: 0.9,
              },
            }}
          />
        )}

        {/* Worker Marker with live smooth LERP gliding & heading angle */}
        {displayedWorkerPos && (
          <Marker
            position={displayedWorkerPos}
            icon={{
              url: workerSvgIcon,
              scaledSize: new window.google.maps.Size(52, 52),
              anchor: new window.google.maps.Point(26, 26),
            }}
          />
        )}

        {/* Customer Location Pin */}
        {customerLocation && (
          <Marker
            position={customerLocation}
            icon={{
              url: customerSvgIcon,
              scaledSize: new window.google.maps.Size(42, 48),
              anchor: new window.google.maps.Point(21, 48),
            }}
          />
        )}
      </GoogleMap>

      {/* Floating Interactive Controls (Recenter, Face route, Compass, Traffic, Fullscreen) */}
      <div
        className="absolute right-4 z-10 flex flex-col gap-2 pointer-events-auto"
        style={{ bottom: isFullscreen && !hideFullscreenButton ? '2rem' : `${(bottomSheetPadding || 180) + 16}px` }}
      >
        <button
          type="button"
          onClick={handleFaceDestination}
          disabled={!displayedWorkerPos || !customerLocation}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-[#FFD100] shadow-xl border border-slate-700 transition active:scale-90 cursor-pointer disabled:opacity-40"
          title="Face destination"
        >
          <Navigation2 className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={handleResetNorth}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-800 shadow-xl border border-slate-200/90 hover:bg-slate-50 transition active:scale-90 cursor-pointer"
          title="Reset map to North"
        >
          <Compass
            className="h-5 w-5 text-slate-700 transition-transform duration-200"
            style={{ transform: `rotate(${-mapHeading}deg)` }}
          />
        </button>

        {/* Recenter / Frame Route Button */}
        <button
          type="button"
          onClick={handleRecenter}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-800 shadow-xl border border-slate-200/90 hover:bg-slate-50 transition active:scale-90 cursor-pointer"
          title="Recenter Route & Worker"
        >
          <LocateFixed className="h-5 w-5 text-slate-800" />
        </button>

        {/* Traffic Layer Toggle */}
        <button
          type="button"
          onClick={toggleTraffic}
          className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-xl border transition active:scale-90 cursor-pointer ${
            trafficEnabled
              ? 'bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-300'
              : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50'
          }`}
          title="Toggle Traffic Layer"
        >
          <Layers className="h-5 w-5" />
        </button>

        {/* Fullscreen Map Toggle */}
        {!hideFullscreenButton ? (
          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-xl transition active:scale-90 border cursor-pointer ${
              isFullscreen
                ? 'bg-slate-900 text-white border-slate-800 ring-2 ring-brand'
                : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50'
            }`}
            title={isFullscreen ? 'Exit Fullscreen' : 'Full Screen Map'}
          >
            {isFullscreen ? (
              <Minimize2 className="h-5 w-5 text-brand" />
            ) : (
              <Maximize2 className="h-5 w-5 text-slate-700" />
            )}
          </button>
        ) : null}
      </div>

      {/* Floating Status & ETA Top HUD (Only when not hidden by parent full UI) */}
      {!hideFloatingHud && (
        <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between pointer-events-none z-10">
          {/* Live Signal Status Pill */}
          <div className="flex items-center gap-2 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-full shadow-md border border-slate-200/80 text-xs font-bold pointer-events-auto">
            {hasArrivedState ? (
              <span className="flex items-center gap-1.5 text-emerald-600">
                <ShieldCheck className="h-3.5 w-3.5" /> Arrived at Location
              </span>
            ) : isStale ? (
              <span className="flex items-center gap-1.5 text-amber-600">
                <WifiOff className="h-3.5 w-3.5 animate-pulse" />
                Reconnecting... ({lastUpdateSecAgo}s ago)
              </span>
            ) : displayedWorkerPos ? (
              <span className="flex items-center gap-1.5 text-slate-800">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Live Tracking
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-slate-500">
                <Wifi className="h-3.5 w-3.5" /> Connecting GPS...
              </span>
            )}
          </div>

          {/* Right ETA Pill */}
          {eta && !hasArrivedState && (
            <div className="bg-slate-950/90 backdrop-blur-md text-white px-3.5 py-1.5 rounded-2xl shadow-lg border border-slate-800 text-right pointer-events-auto flex items-center gap-2">
              <div>
                <p className="text-xs font-black tracking-tight text-[#FFD100]">{eta}</p>
                {distance && <p className="text-[9px] font-semibold text-slate-300 uppercase">{distance} away</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stale Connection Notice */}
      {isStale && !hasArrivedState && (
        <div className="absolute top-16 left-3.5 right-3.5 bg-amber-500/95 backdrop-blur-md text-white text-[11px] font-bold px-3 py-2 rounded-2xl shadow-lg flex items-center justify-between pointer-events-auto z-10">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Worker GPS paused or in background. Showing last known spot.</span>
          </div>
        </div>
      )}
    </div>
  )
}
