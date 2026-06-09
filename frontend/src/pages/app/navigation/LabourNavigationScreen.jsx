import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { GoogleMap, useLoadScript, DirectionsRenderer, Marker } from '@react-google-maps/api'
import { ArrowLeft, Navigation, Phone, MapPin, CheckCircle2, User, Loader2, AlertCircle } from 'lucide-react'
import { useCheckInMutation } from '../../../store/api/workforceApi.js'

const libraries = ['places']

const mapContainerStyle = {
  width: '100%',
  height: '100%'
}

const defaultCenter = {
  lat: 22.7196, // Default Indore center
  lng: 75.8577
}

export function LabourNavigationScreen() {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const { state } = useLocation()
  const job = state?.job

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey,
    libraries,
  })

  const [labourPos, setLabourPos] = useState(null)
  const [customerPos, setCustomerPos] = useState(null)
  const [directions, setDirections] = useState(null)
  const [distance, setDistance] = useState('')
  const [eta, setEta] = useState('')
  const [geoError, setGeoError] = useState('')
  
  const [checkIn, { isLoading: isCheckingIn }] = useCheckInMutation()

  // Track labour's location
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser')
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLabourPos({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        })
      },
      (error) => {
        console.error('Error tracking position', error)
        setGeoError('Failed to get your location')
        // Fallback to default if no pos
        if (!labourPos) setLabourPos(defaultCenter)
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // Geocode customer location if not available
  useEffect(() => {
    if (!job || !apiKey) return

    const fetchCustomerLocation = async () => {
      try {
        const address = job.site || job.location || job.title
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`)
        const data = await res.json()
        if (data.results && data.results.length > 0) {
          setCustomerPos(data.results[0].geometry.location)
        } else {
          // Fallback to default if geocode fails
          setCustomerPos(defaultCenter)
        }
      } catch (err) {
        console.error('Geocoding error', err)
        setCustomerPos(defaultCenter)
      }
    }

    fetchCustomerLocation()
  }, [job, apiKey])

  // Fetch directions
  useEffect(() => {
    if (!isLoaded || !labourPos || !customerPos) return

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
  }, [isLoaded, labourPos, customerPos])

  const handleStartNavigation = () => {
    const destination = customerPos 
      ? `${customerPos.lat},${customerPos.lng}`
      : encodeURIComponent(job?.site || job?.location || job?.title)
    
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank')
  }

  const handleCheckIn = async () => {
    try {
      await checkIn({ assignmentId: job.id }).unwrap()
      navigate(-1) // Go back to active jobs
    } catch (err) {
      console.error('Failed to check in', err)
    }
  }

  if (loadError) {
    return <div className="flex h-screen items-center justify-center p-6 text-center text-red-500">Error loading maps</div>
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
    <div className="flex flex-col h-[100dvh] bg-slate-100 overflow-hidden relative">
      {/* Floating Header */}
      <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between">
          <button 
            onClick={() => navigate(-1)} 
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-800 shadow-lg pointer-events-auto transition active:scale-95 border border-slate-100"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>

          {eta && (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-100 px-4 py-2 pointer-events-auto text-center flex flex-col items-center min-w-[100px]">
              <span className="text-xl font-black text-emerald-600">{eta}</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{distance}</span>
            </div>
          )}
        </div>
      </div>

      {/* Map Area (70% approx, fills available space before bottom sheet) */}
      <div className="flex-1 relative pb-64 lg:pb-72">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          zoom={14}
          center={labourPos || defaultCenter}
          options={{
            disableDefaultUI: true,
            zoomControl: false,
            mapTypeControl: false,
            scaleControl: false,
            streetViewControl: false,
            rotateControl: false,
            fullscreenControl: false,
            styles: [
              {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }]
              }
            ]
          }}
        >
          {directions && (
            <DirectionsRenderer
              directions={directions}
              options={{
                suppressMarkers: true,
                polylineOptions: {
                  strokeColor: '#0f172a',
                  strokeWeight: 5,
                  strokeOpacity: 0.8,
                }
              }}
            />
          )}

          {labourPos && (
            <Marker
              position={labourPos}
              icon={{
                url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23F4CC34' stroke='%230f172a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolygon points='3 11 22 2 13 21 11 13 3 11'/%3E%3C/svg%3E",
                scaledSize: new window.google.maps.Size(32, 32),
                anchor: new window.google.maps.Point(16, 16),
              }}
            />
          )}

          {customerPos && (
            <Marker
              position={customerPos}
              icon={{
                url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2310b981' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/%3E%3Cpolyline points='9 22 9 12 15 12 15 22'/%3E%3C/svg%3E",
                scaledSize: new window.google.maps.Size(32, 32),
                anchor: new window.google.maps.Point(16, 32),
              }}
            />
          )}
        </GoogleMap>
      </div>

      {/* Fixed Bottom Sheet */}
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-20 pb-[max(1rem,env(safe-area-inset-bottom,1rem))]">
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-3" />
        
        <div className="px-5 pb-5">
          <div className="flex justify-between items-start mb-5">
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

          <div className="flex gap-3 items-start mb-6">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Destination</p>
              <p className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug">{job.site || job.location || job.title}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleStartNavigation}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-slate-900 text-white py-3.5 text-sm font-bold shadow-lg transition active:scale-95"
            >
              <Navigation className="h-4 w-4" /> Start Navigation
            </button>
            <button
              onClick={handleCheckIn}
              disabled={isCheckingIn || job.status === 'on_site'}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-brand text-slate-900 py-3.5 text-sm font-bold shadow-lg transition active:scale-95 disabled:opacity-50 disabled:shadow-none"
            >
              {isCheckingIn ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : job.status === 'on_site' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
              {job.status === 'on_site' ? 'Checked In' : 'Mark Check-In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
