/**
 * Pick labour workers to receive a NEW_ORDER offer push.
 *
 * Previous logic dropped workers without GPS whenever *any* in-radius worker existed,
 * so accept/cancel pushes (after accept) worked but initial NEW_ORDER never arrived.
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function matchWorkersForNewJobOffer(candidates, requestLat, requestLng) {
  if (!Array.isArray(candidates) || candidates.length === 0) return []
  if (requestLat == null || requestLng == null) return candidates

  const inRadius = []
  const noGps = []
  const seen = new Set()

  for (const worker of candidates) {
    const id = worker?._id?.toString?.() || String(worker?._id || '')
    if (!id || seen.has(id)) continue

    const lat = worker?.labourProfile?.locationLat
    const lng = worker?.labourProfile?.locationLng

    if (lat == null || lng == null) {
      noGps.push(worker)
      seen.add(id)
      continue
    }

    const radius = worker?.labourProfile?.workRadius || 15
    const dist = haversineKm(requestLat, requestLng, lat, lng)
    if (dist <= radius) {
      inRadius.push(worker)
      seen.add(id)
    }
  }

  const merged = [...inRadius, ...noGps]
  if (merged.length > 0) return merged

  // Nobody in radius — keep old fallback (notify all skill-matched candidates)
  return candidates
}
