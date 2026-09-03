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
