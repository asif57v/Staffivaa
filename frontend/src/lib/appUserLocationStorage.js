const KEY = 'lc-app-user-location'

let autoFetchPromise = null

/**
 * Reverse geocodes latitude and longitude to human readable address and addressComponents.
 * Falls back across Google Geocoding API -> BigDataCloud API -> Nominatim API.
 */
export async function reverseGeocodeCoords(lat, lng) {
  const apiKey = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_GOOGLE_MAPS_API_KEY : null

  // 1. Try Google Maps Geocoding API if key is present
  if (apiKey) {
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`)
      const data = await res.json()
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        return {
          address: data.results[0].formatted_address,
          addressComponents: data.results[0].address_components || null,
        }
      }
    } catch (err) {
      console.warn('[Location] Google reverse geocoding error:', err)
    }
  }

  // 2. Try BigDataCloud Reverse Geocode Client (free, high-speed, CORS-friendly)
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`)
    if (res.ok) {
      const data = await res.json()
      const city = data.locality || data.city || ''
      const subLocality = data.localityInfo?.informative?.map(i => i.name).filter(Boolean).join(', ') || ''
      const principalSub = data.principalSubdivision || ''
      const country = data.countryName || 'India'

      const parts = [subLocality, city, principalSub, country].filter(Boolean)
      const fullAddress = parts.length > 0 ? parts.join(', ') : `GPS ${lat.toFixed(5)}, ${lng.toFixed(5)}`

      const mockComps = []
      if (city) mockComps.push({ long_name: city, short_name: city, types: ['locality'] })
      if (subLocality) mockComps.push({ long_name: subLocality, short_name: subLocality, types: ['sublocality', 'neighborhood'] })
      if (principalSub) mockComps.push({ long_name: principalSub, short_name: principalSub, types: ['administrative_area_level_1'] })

      return {
        address: fullAddress,
        addressComponents: mockComps.length > 0 ? mockComps : null,
      }
    }
  } catch (err) {
    console.warn('[Location] BigDataCloud geocoding failed:', err)
  }

  // 3. Try OpenStreetMap Nominatim
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`)
    if (res.ok) {
      const data = await res.json()
      if (data && data.display_name) {
        const addrObj = data.address || {}
        const areaName = addrObj.suburb || addrObj.neighbourhood || addrObj.city || addrObj.town || addrObj.village || addrObj.county || 'Current location'
        const mockComps = [
          { long_name: areaName, short_name: areaName, types: ['sublocality', 'locality'] }
        ]
        const roadOrBuilding = [addrObj.building, addrObj.road].filter(Boolean).join(', ')
        if (roadOrBuilding) {
          mockComps.push({ long_name: roadOrBuilding, short_name: roadOrBuilding, types: ['premise', 'route'] })
        }
        return {
          address: data.display_name,
          addressComponents: mockComps,
        }
      }
    }
  } catch (err) {
    console.warn('[Location] Nominatim geocoding failed:', err)
  }

  return {
    address: `GPS ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    addressComponents: null,
  }
}

/**
 * Automatically requests browser live geolocation, reverse geocodes coordinates,
 * writes to localStorage, and fires 'lc-app-user-location-changed' event.
 */
export function autoFetchLiveLocation(options = {}) {
  if (autoFetchPromise && !options.force) {
    return autoFetchPromise
  }

  autoFetchPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator?.geolocation) {
      const err = new Error('Geolocation is not supported by this browser.')
      autoFetchPromise = null
      reject(err)
      return
    }

    const geoOptions = {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeout ?? 15000,
      maximumAge: options.maximumAge ?? 60000,
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude
          const lng = pos.coords.longitude

          const { address, addressComponents } = await reverseGeocodeCoords(lat, lng)

          const locationData = {
            address,
            lat,
            lng,
            addressComponents,
            isLive: true,
            fetchedAt: Date.now(),
          }

          writeAppUserLocation(locationData)
          window.dispatchEvent(new CustomEvent('lc-app-user-location-changed', { detail: locationData }))
          autoFetchPromise = null
          resolve(locationData)
        } catch (err) {
          autoFetchPromise = null
          reject(err)
        }
      },
      (err) => {
        autoFetchPromise = null
        reject(err)
      },
      geoOptions
    )
  })

  return autoFetchPromise
}

/**
 * @returns {{ address: string, lat: number | null, lng: number | null, addressComponents?: any[] } | null}
 */
export function readAppUserLocation() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const j = JSON.parse(raw)
    const address = typeof j.address === 'string' ? j.address.trim() : ''
    const lat = typeof j.lat === 'number' && Number.isFinite(j.lat) ? j.lat : null
    const lng = typeof j.lng === 'number' && Number.isFinite(j.lng) ? j.lng : null
    const addressComponents = Array.isArray(j.addressComponents) ? j.addressComponents : null
    if (!address && lat == null && lng == null) return null
    return { address, lat, lng, addressComponents, isLive: Boolean(j.isLive) }
  } catch {
    return null
  }
}

/** @param {{ address?: string, lat?: number | null, lng?: number | null, addressComponents?: any[], isLive?: boolean }} loc */
export function writeAppUserLocation(loc) {
  const address = typeof loc.address === 'string' ? loc.address.trim() : ''
  const lat = loc.lat != null && Number.isFinite(Number(loc.lat)) ? Number(loc.lat) : null
  const lng = loc.lng != null && Number.isFinite(Number(loc.lng)) ? Number(loc.lng) : null
  const addressComponents = Array.isArray(loc.addressComponents) ? loc.addressComponents : null
  const isLive = Boolean(loc.isLive)
  if (!address && lat == null && lng == null) {
    localStorage.removeItem(KEY)
    return
  }
  localStorage.setItem(KEY, JSON.stringify({ address, lat, lng, addressComponents, isLive, updatedAt: Date.now() }))
}

export function clearAppUserLocation() {
  localStorage.removeItem(KEY)
}

/** True when user saved an address label or GPS coordinates. */
export function hasAppUserLocation(loc) {
  if (!loc) return false
  if (loc.address?.trim()) return true
  return loc.lat != null && loc.lng != null && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)
}

/** Display string for headers and cards. */
export function formatAppUserLocationLabel(loc) {
  if (!loc) return ''
  const addr = loc.address?.trim()
  if (addr) return addr
  if (loc.lat != null && loc.lng != null) {
    return `GPS ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`
  }
  return ''
}

export function parseAppUserLocation(loc) {
  if (!loc) return { area: 'Fetching live location…', detail: 'Tap to set address or use GPS' }
  const addr = loc.address?.trim()
  const lat = loc.lat
  const lng = loc.lng

  if (loc.addressComponents && loc.addressComponents.length > 0) {
    const comps = loc.addressComponents

    const getComp = (types) => {
      if (!Array.isArray(types)) types = [types]
      for (const t of types) {
        const found = comps.find(c => c.types && c.types.some(type => types.includes(type)))
        if (found) return found.long_name
      }
      return null
    }

    const area = getComp(['sublocality', 'neighborhood', 'locality', 'administrative_area_level_2']) || 'Current Area'

    const premise = getComp(['premise', 'subpremise', 'building', 'point_of_interest'])
    const streetNum = getComp('street_number')
    const route = getComp('route')

    let detailParts = []
    if (premise) detailParts.push(premise)
    if (streetNum) detailParts.push(streetNum)
    if (route) detailParts.push(route)

    let detail = detailParts.join(', ')
    if (!detail && addr) {
      detail = addr
    }

    return { area, detail: detail || (lat != null && lng != null ? `GPS ${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'Current Area') }
  }

  if (addr) {
    const parts = addr.split(',').map(s => s.trim())
    if (parts.length > 2) {
      const area = parts[parts.length - 3] || parts[parts.length - 2]
      return { area, detail: addr }
    }
    return { area: parts[0] || 'Current location', detail: addr }
  }

  if (lat != null && lng != null) {
    return { area: 'Current location', detail: `GPS ${lat.toFixed(5)}, ${lng.toFixed(5)}` }
  }

  return { area: 'Your location', detail: 'Tap to set address or use GPS' }
}

