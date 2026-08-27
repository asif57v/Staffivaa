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
} from 'lucide-react'
import { getSocket } from '../../../services/socket.js'
import { store } from '../../../store/index.js'

const mapContainerStyle = {
  width: '100%',
  height: '100%',
}

const defaultMapOptions = {
  disableDefaultUI: true,
  gestureHandling: 'greedy', // 🚀 Removes "Use ctrl + scroll to zoom" overlay and enables smooth single-finger touch on mobile
  clickableIcons: false,
  isFractionalZoomEnabled: true,
  keyboardShortcuts: false,
  maxZoom: 19,
  minZoom: 3,
  styles: [
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
  ],
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
  const [isFullscreen, setIsFullscreen] = useState(false)

  const mapRef = useRef(null)
  const initialBoundsFitRef = useRef(false)
  const animFrameRef = useRef(null)
  const animStartTimeRef = useRef(0)
  const startPosRef = useRef(displayedWorkerPos)
  const targetPosRef = useRef(displayedWorkerPos)
  const startHeadingRef = useRef(displayedHeading)
  const targetHeadingRef = useRef(displayedHeading)
  const lastPacketTimeRef = useRef(initialWorkerLocation ? Date.now() : 0)
  const lastDirectionsTimeRef = useRef(0)

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

  // Fit bounds ONCE smoothly so both worker and customer are nicely framed without jerking
  useEffect(() => {
    if (!mapRef.current || !displayedWorkerPos || !customerLocation || initialBoundsFitRef.current) return
    try {
      const bounds = new window.google.maps.LatLngBounds()
      bounds.extend(displayedWorkerPos)
      bounds.extend(customerLocation)
      mapRef.current.fitBounds(bounds, { top: 50, bottom: 50, left: 40, right: 40 })
      initialBoundsFitRef.current = true
    } catch (err) {
      console.warn('fitBounds error', err)
    }
  }, [displayedWorkerPos, customerLocation])

  // LERP Animation Loop using requestAnimationFrame
  const startSmoothTransition = useCallback((newLat, newLng, newHeading) => {
    if (!startPosRef.current) {
      startPosRef.current = { lat: newLat, lng: newLng }
      targetPosRef.current = { lat: newLat, lng: newLng }
      setDisplayedWorkerPos({ lat: newLat, lng: newLng })
      setDisplayedHeading(newHeading || 0)
      return
    }

    // Cancel existing frame
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
    }

    // Set start as current animated position
    startPosRef.current = targetPosRef.current || startPosRef.current
    targetPosRef.current = { lat: newLat, lng: newLng }

    startHeadingRef.current = targetHeadingRef.current || 0
    targetHeadingRef.current = newHeading != null ? newHeading : startHeadingRef.current

    const duration = 2800 // 2.8 seconds smooth glide
    animStartTimeRef.current = performance.now()

    const animate = (currentTime) => {
      const elapsed = currentTime - animStartTimeRef.current
      const progress = Math.min(elapsed / duration, 1)

      // Linear interpolation for position
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

  // Socket setup & room subscription
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

  // Directions & ETA Calculation (Throttled every 50 seconds to save Google Maps quota)
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
              onEtaUpdate({ eta: etaText, distance: distText })
            }
          }
        }
      }
    )
  }, [displayedWorkerPos, customerLocation, directions, onEtaUpdate])

  useEffect(() => {
    fetchRouteAndEta()
  }, [displayedWorkerPos, customerLocation, fetchRouteAndEta])

  const handleRecenter = useCallback(() => {
    if (mapRef.current && displayedWorkerPos) {
      mapRef.current.panTo(displayedWorkerPos)
      mapRef.current.setZoom(16)
    }
  }, [displayedWorkerPos])

  // Custom rotated SVG marker for the worker
  const workerSvgIcon = useMemo(() => {
    const rot = Math.round(displayedHeading || 0)
    return `data:image/svg+xml;utf-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity="0.35"/>
          </filter>
        </defs>
        <g transform="rotate(${rot} 24 24)" filter="url(#shadow)">
          <!-- Outer Pulsing Glow -->
          <circle cx="24" cy="24" r="21" fill="#FFDF20" stroke="#FFFFFF" stroke-width="2.5" />
          <!-- Inner Arrow -->
          <polygon points="24,7 34,36 24,29 14,36" fill="#0F172A" stroke="#FFFFFF" stroke-width="1.5" stroke-linejoin="round" />
        </g>
      </svg>
    `)}`
  }, [displayedHeading])

  return (
    <div
      className={`transition-all duration-300 select-none ${
        isFullscreen
          ? 'fixed inset-0 z-[100] w-full h-[100dvh] bg-slate-900'
          : 'relative w-full h-[320px] sm:h-[380px] bg-slate-100 rounded-3xl overflow-hidden shadow-inner border border-slate-200/80'
      }`}
    >
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        options={defaultMapOptions}
        onLoad={(map) => {
          mapRef.current = map
        }}
      >
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: true,
              preserveViewport: true, // 🚀 Prevents map from jerking / resetting camera on route updates
              polylineOptions: {
                strokeColor: '#0F172A',
                strokeWeight: 5,
                strokeOpacity: 0.85,
              },
            }}
          />
        )}

        {/* Worker Marker (Live animated + rotated) */}
        {displayedWorkerPos && (
          <Marker
            position={displayedWorkerPos}
            icon={{
              url: workerSvgIcon,
              scaledSize: new window.google.maps.Size(44, 44),
              anchor: new window.google.maps.Point(22, 22),
            }}
          />
        )}

        {/* Destination Customer Marker */}
        {customerLocation && (
          <Marker
            position={customerLocation}
            icon={{
              url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2310B981' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/%3E%3Cpolyline points='9 22 9 12 15 12 15 22'/%3E%3C/svg%3E",
              scaledSize: new window.google.maps.Size(36, 36),
              anchor: new window.google.maps.Point(18, 36),
            }}
          />
        )}
      </GoogleMap>

      {/* Floating Recenter Button */}
      {displayedWorkerPos && (
        <button
          type="button"
          onClick={handleRecenter}
          className={`absolute z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-800 shadow-xl border border-slate-200/80 transition active:scale-90 cursor-pointer ${
            isFullscreen ? 'bottom-6 right-6' : 'bottom-4 right-4'
          }`}
          title="Recenter to worker location"
        >
          <LocateFixed className="h-5 w-5 text-slate-700" />
        </button>
      )}

      {/* Floating Status, ETA & Fullscreen Overlay */}
      <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between pointer-events-none z-10">
        {/* Live Status Pill */}
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
              <Wifi className="h-3.5 w-3.5" /> Waiting for worker GPS...
            </span>
          )}
        </div>

        {/* Right side: ETA Bubble + Fullscreen Toggle */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {eta && !hasArrivedState && (
            <div className="bg-slate-900/90 backdrop-blur-md text-white px-3.5 py-1.5 rounded-2xl shadow-lg border border-slate-800 text-right flex items-center gap-2">
              <div>
                <p className="text-xs font-black tracking-tight text-[#FFDF20]">{eta}</p>
                {distance && <p className="text-[9px] font-semibold text-slate-300 uppercase">{distance} away</p>}
              </div>
            </div>
          )}

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className={`flex h-9 w-9 items-center justify-center rounded-full shadow-lg transition active:scale-95 border cursor-pointer ${
              isFullscreen
                ? 'bg-slate-900 text-white border-slate-800 ring-2 ring-brand'
                : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
            }`}
            title={isFullscreen ? 'Exit Fullscreen' : 'Full Screen Map'}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4 text-brand" />
            ) : (
              <Maximize2 className="h-4 w-4 text-slate-700" />
            )}
          </button>
        </div>
      </div>

      {/* Connection notice banner if stale */}
      {isStale && !hasArrivedState && (
        <div className="absolute bottom-3 left-3 right-3 bg-amber-500/95 backdrop-blur-md text-white text-[11px] font-bold px-3 py-2 rounded-2xl shadow-lg flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Worker GPS paused or backgrounded. Showing last known spot.</span>
          </div>
        </div>
      )}
    </div>
  )
}
