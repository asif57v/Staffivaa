const KEY = 'lc-app-user-location'

/**
 * @returns {{ address: string, lat: number | null, lng: number | null } | null}
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
    return { address, lat, lng, addressComponents }
  } catch {
    return null
  }
}

/** @param {{ address?: string, lat?: number | null, lng?: number | null }} loc */
export function writeAppUserLocation(loc) {
  const address = typeof loc.address === 'string' ? loc.address.trim() : ''
  const lat = loc.lat != null && Number.isFinite(Number(loc.lat)) ? Number(loc.lat) : null
  const lng = loc.lng != null && Number.isFinite(Number(loc.lng)) ? Number(loc.lng) : null
  const addressComponents = Array.isArray(loc.addressComponents) ? loc.addressComponents : null
  if (!address && lat == null && lng == null) {
    localStorage.removeItem(KEY)
    return
  }
  localStorage.setItem(KEY, JSON.stringify({ address, lat, lng, addressComponents, updatedAt: Date.now() }))
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
  if (!loc) return { area: 'Your location', detail: 'Tap to set address or use GPS' }
  const addr = loc.address?.trim()
  const lat = loc.lat
  const lng = loc.lng
  
  if (loc.addressComponents && loc.addressComponents.length > 0) {
    const comps = loc.addressComponents
    
    const getComp = (types) => {
      if (!Array.isArray(types)) types = [types]
      for (const t of types) {
        const found = comps.find(c => c.types.includes(t))
        if (found) return found.long_name
      }
      return null
    }

    const area = getComp(['sublocality', 'neighborhood', 'locality']) || getComp('administrative_area_level_2') || 'Current Area'
    
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
