import { useMemo } from 'react'
import { useLoadScript } from '@react-google-maps/api'

/** Must be a stable module-level reference — never recreate per render. */
export const GOOGLE_MAPS_LIBRARIES = ['places']

/**
 * Single shared Google Maps JS loader for the whole app.
 * Prevents blank maps when navigating away and back (script already loaded).
 */
export function useGoogleMapsLoader() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || '',
    libraries: GOOGLE_MAPS_LIBRARIES,
    // Prevents "Loader must not be called again with different options"
    id: 'staffivaa-google-maps',
  })

  return useMemo(
    () => ({
      apiKey,
      isLoaded: Boolean(apiKey) && isLoaded,
      loadError: !apiKey ? new Error('Missing VITE_GOOGLE_MAPS_API_KEY') : loadError,
    }),
    [apiKey, isLoaded, loadError],
  )
}

/** Force Google Map to repaint after container size / remount changes. */
export function refreshGoogleMap(map, center) {
  if (!map || typeof window === 'undefined' || !window.google?.maps) return

  window.google.maps.event.trigger(map, 'resize')

  if (center?.lat != null && center?.lng != null) {
    map.setCenter(center)
  }
}

/** Bearing in degrees from point A → B (0 = North, clockwise). */
export function calculateMapBearing(from, to) {
  if (!from || !to) return 0
  const φ1 = (Number(from.lat) * Math.PI) / 180
  const φ2 = (Number(to.lat) * Math.PI) / 180
  const Δλ = ((Number(to.lng) - Number(from.lng)) * Math.PI) / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/**
 * Map options that allow Google Maps–style rotate / tilt gestures.
 * Vector rendering is required for two-finger rotate.
 * Optional: set VITE_GOOGLE_MAPS_MAP_ID for Cloud Map styling + rotation.
 */
export function buildRotatableMapOptions(extra = {}) {
  const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID
  const gmaps = typeof window !== 'undefined' ? window.google?.maps : null

  const options = {
    disableDefaultUI: true,
    gestureHandling: 'greedy',
    clickableIcons: false,
    isFractionalZoomEnabled: true,
    keyboardShortcuts: false,
    rotateControl: true,
    tiltControl: true,
    heading: 0,
    tilt: 0,
    ...extra,
  }

  if (mapId) {
    // Cloud map ID unlocks full vector rotate/tilt; JSON styles are not allowed with mapId
    const { styles: _styles, ...rest } = options
    return {
      ...rest,
      mapId,
      rotateControlOptions: gmaps?.ControlPosition
        ? { position: gmaps.ControlPosition.LEFT_BOTTOM }
        : undefined,
    }
  }

  if (gmaps?.RenderingType?.VECTOR) {
    options.renderingType = gmaps.RenderingType.VECTOR
  }

  if (gmaps?.ControlPosition) {
    options.rotateControlOptions = { position: gmaps.ControlPosition.LEFT_BOTTOM }
    options.tiltControlOptions = { position: gmaps.ControlPosition.LEFT_BOTTOM }
  }

  return options
}

/** Animate / set map camera heading (and optional tilt). */
export function setMapCamera(map, { heading, tilt, center, zoom } = {}) {
  if (!map) return
  try {
    if (typeof map.moveCamera === 'function') {
      const camera = {}
      if (heading != null) camera.heading = heading
      if (tilt != null) camera.tilt = tilt
      if (center) camera.center = center
      if (zoom != null) camera.zoom = zoom
      map.moveCamera(camera)
      return
    }
    if (heading != null && typeof map.setHeading === 'function') map.setHeading(heading)
    if (tilt != null && typeof map.setTilt === 'function') map.setTilt(tilt)
    if (center) map.panTo(center)
    if (zoom != null) map.setZoom(zoom)
  } catch (err) {
    console.warn('[Map camera]', err)
  }
}
