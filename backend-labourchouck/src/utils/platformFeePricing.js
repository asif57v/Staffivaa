/**
 * Live platform-fee helpers — always read from current SystemPricing (admin panel).
 * Use nullish coalescing so admin value `0` is respected (never treat 0 as missing).
 */

/**
 * @param {object|null|undefined} pricing
 * @param {{ estimatedTotalLabourCost?: number }} [opts]
 * @returns {number}
 */
export function computeUserBookingPlatformFee(pricing, opts = {}) {
  const estimatedTotalLabourCost = Number(opts.estimatedTotalLabourCost) || 0
  const pfConfig = pricing?.userBooking?.platformFee || {}

  if (pfConfig.status === 'disabled') return 0

  const type = pfConfig.type || 'fixed'
  const value = Number(pfConfig.value ?? 0)

  let fee = type === 'percentage' ? (estimatedTotalLabourCost * value) / 100 : value

  const minFee = pfConfig.minFee
  const maxFee = pfConfig.maxFee
  if (minFee !== undefined && minFee !== null && !Number.isNaN(Number(minFee)) && fee < Number(minFee)) {
    fee = Number(minFee)
  }
  if (
    maxFee !== undefined &&
    maxFee !== null &&
    !Number.isNaN(Number(maxFee)) &&
    Number(maxFee) > 0 &&
    fee > Number(maxFee)
  ) {
    fee = Number(maxFee)
  }

  return Math.max(0, Math.round(fee))
}

/**
 * @param {object|null|undefined} pricing
 * @param {{ distanceKm?: number, estimatedTotalLabourCost?: number }} [opts]
 * @returns {number}
 */
export function computeLabourPlatformFee(pricing, opts = {}) {
  const distanceKm = Number(opts.distanceKm) || 0
  const estimatedTotalLabourCost = Number(opts.estimatedTotalLabourCost) || 800
  const pf = pricing?.labour?.platformFee

  if (!pf) return 0
  if (pf.status === 'disabled') return 0

  if (pf.type === 'distance') {
    const slabs = Array.isArray(pf.slabs) ? [...pf.slabs] : []
    slabs.sort((a, b) => Number(a.minDistance || 0) - Number(b.minDistance || 0))
    for (const slab of slabs) {
      const min = Number(slab.minDistance || 0)
      const max =
        slab.maxDistance !== null && slab.maxDistance !== undefined && slab.maxDistance !== ''
          ? Number(slab.maxDistance)
          : Infinity
      if (distanceKm >= min && distanceKm < max) {
        return Math.max(0, Math.round(Number(slab.fee ?? 0)))
      }
    }
    return 0
  }

  if (pf.type === 'percentage') {
    return Math.max(0, Math.round((estimatedTotalLabourCost * Number(pf.value ?? 0)) / 100))
  }

  // fixed (default)
  return Math.max(0, Math.round(Number(pf.value ?? 0)))
}

/**
 * Estimate labour cost from request lines (for percentage fees).
 * @param {object} request
 * @param {Map<string, number>|Record<string, number>} [categoryRateMap]
 */
export function estimateRequestLabourCost(request, categoryRateMap = {}) {
  const lines = request?.lines || []
  let perDay = 0
  for (const line of lines) {
    const catId = String(line.categoryId?._id || line.categoryId || '')
    const rate = Number(categoryRateMap[catId] ?? line.categoryId?.baseRate ?? 800)
    perDay += rate * (line.quantity || 1)
  }

  let days = 1
  if (request?.startDate && request?.endDate) {
    const start = new Date(request.startDate)
    const end = new Date(request.endDate)
    const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24))
    days = Math.max(1, diffDays + 1)
  }
  return perDay * days
}
