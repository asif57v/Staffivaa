import mongoose from 'mongoose'
import { User } from '../models/User.js'
import { LabourCategory } from '../models/LabourCategory.js'
import { USER_ROLES } from '../constants/roles.js'

class LocationMatchingService {
  /**
   * Calculate Haversine distance between two points in kilometers
   */
  calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity

    const R = 6371 // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180)
    const dLon = (lon2 - lon1) * (Math.PI / 180)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  /**
   * Check if a single request is eligible for a given vendor based on:
   * 1. Verification status (must be approved)
   * 2. Skill match (vendor has registered category / skill matching request line)
   * 3. Location & Radius match (within corporate radius AND within vendor service radius)
   */
  isRequestMatchingVendor(request, vendor, settings = {}, categoryNamesMap = null) {
    if (!vendor || !request) return false

    // 1. Vendor status check
    if (vendor.role !== USER_ROLES.CONTRACTOR) return false
    if (vendor.isActive === false) return false
    if (vendor.contractorProfile?.verificationStatus !== 'approved') return false

    // 2. Skill / Trade Matching
    const reqLines = Array.isArray(request.lines) ? request.lines : []
    const requestedCategoryIds = reqLines
      .map((l) => {
        if (!l?.categoryId) return null
        return typeof l.categoryId === 'object' ? (l.categoryId._id?.toString() || l.categoryId.toString()) : l.categoryId.toString()
      })
      .filter(Boolean)

    if (requestedCategoryIds.length > 0) {
      const vendorCategoryIds = (vendor.contractorProfile?.categoryIds || [])
        .map((id) => {
          if (!id) return null
          return typeof id === 'object' ? (id._id?.toString() || id.toString()) : id.toString()
        })
        .filter(Boolean)

      const vendorSkills = (vendor.contractorProfile?.skills || [])
        .map((s) => String(s).toLowerCase().trim())
        .filter(Boolean)

      // Direct Category ObjectId match
      const hasIdMatch = requestedCategoryIds.some((reqId) => vendorCategoryIds.includes(reqId))

      // Smart Name / Trade match (supports root tokens, e.g. "Mason" matches "Mason (Raj Mistri)")
      let hasNameMatch = false
      if (!hasIdMatch) {
        for (const line of reqLines) {
          const rawCatName = line?.categoryId?.name || (categoryNamesMap ? categoryNamesMap.get(line?.categoryId?.toString()) : null)
          if (!rawCatName) continue
          
          const cleanCatName = rawCatName.toLowerCase().replace(/\(.*?\)/g, '').trim()

          for (const vSkill of vendorSkills) {
            const cleanVSkill = vSkill.toLowerCase().replace(/\(.*?\)/g, '').trim()
            if (
              cleanVSkill === cleanCatName ||
              cleanVSkill.includes(cleanCatName) ||
              cleanCatName.includes(cleanVSkill)
            ) {
              hasNameMatch = true
              break
            }
          }
          if (hasNameMatch) break
        }
      }

      if (!hasIdMatch && !hasNameMatch) {
        return false // Skills do not match
      }
    }

    // 3. Location & Radius Matching
    const reqLat = request.locationLat != null ? Number(request.locationLat) : request.locationPoint?.coordinates?.[1]
    const reqLng = request.locationLng != null ? Number(request.locationLng) : request.locationPoint?.coordinates?.[0]

    const vendorLat = vendor.contractorProfile?.currentLatitude != null
      ? Number(vendor.contractorProfile.currentLatitude)
      : vendor.contractorProfile?.locationPoint?.coordinates?.[1]

    const vendorLng = vendor.contractorProfile?.currentLongitude != null
      ? Number(vendor.contractorProfile.currentLongitude)
      : vendor.contractorProfile?.locationPoint?.coordinates?.[0]

    // If both Request and Vendor have GPS coordinates, calculate Haversine distance
    if (reqLat != null && reqLng != null && vendorLat != null && vendorLng != null) {
      const distanceKm = this.calculateHaversineDistance(reqLat, reqLng, vendorLat, vendorLng)

      // 3a. Corporate Search Radius Check
      const corporateSearchRadius = Number(request.vendorSearchRadius) || Number(settings?.defaultCorporateSearchRadius) || 25
      if (distanceKm > corporateSearchRadius) {
        return false
      }

      // 3b. Vendor Service Radius Check
      const vendorRadius = vendor.contractorProfile?.serviceRadius
      if (vendorRadius !== null && vendorRadius !== undefined && vendorRadius !== 'unlimited') {
        const maxVendorRadius = Number(vendorRadius) || Number(settings?.defaultVendorRadius) || 15
        if (distanceKm > maxVendorRadius) {
          return false
        }
      }
    } else {
      // If either party does not have precise GPS coordinates, check city/address overlap
      const reqLocText = (request.locationText || '').toLowerCase()
      const vendorAddress = [
        vendor.contractorProfile?.city,
        vendor.contractorProfile?.businessAddress,
        vendor.contractorProfile?.currentAddress
      ].filter(Boolean).join(' ').toLowerCase()

      if (vendorAddress && reqLocText) {
        // If cities or addresses have overlapping words (e.g. "indore")
        const words = vendorAddress.split(/[\s,]+/).filter(w => w.length > 3)
        const hasTextOverlap = words.some(w => reqLocText.includes(w))
        if (!hasTextOverlap && settings?.allowUnlimitedRadius === false) {
          return false
        }
      }
    }

    return true
  }

  /**
   * Find eligible vendors for a given corporate request based on BOTH Skills and Radii.
   * @param {Object} request - The WorkforceRequest document
   * @param {Object} settings - The SystemSettings radiusConfig object
   * @returns {Array<String>} - Array of eligible vendor User IDs
   */
  async findEligibleVendors(request, settings = {}) {
    try {
      // 1. Build category names map for requested lines
      const reqLines = Array.isArray(request.lines) ? request.lines : []
      const requestedCategoryIds = reqLines
        .map((l) => {
          if (!l?.categoryId) return null
          return typeof l.categoryId === 'object' ? (l.categoryId._id?.toString() || l.categoryId.toString()) : l.categoryId.toString()
        })
        .filter((id) => mongoose.Types.ObjectId.isValid(id))

      const categoryNamesMap = new Map()
      if (requestedCategoryIds.length > 0) {
        const categories = await LabourCategory.find({ _id: { $in: requestedCategoryIds } }, 'name').lean()
        for (const cat of categories) {
          categoryNamesMap.set(cat._id.toString(), cat.name)
        }
      }

      // 2. Fetch all active, approved vendors
      const candidateVendors = await User.find({
        role: USER_ROLES.CONTRACTOR,
        isActive: true,
        'contractorProfile.verificationStatus': 'approved',
      }).lean()

      console.log(`[LocationMatching] Evaluating ${candidateVendors.length} approved vendors for request ${request._id}`)

      // 3. Filter using combined Skill + Location rules
      const eligibleVendorIds = []
      for (const vendor of candidateVendors) {
        const isMatch = this.isRequestMatchingVendor(request, vendor, settings, categoryNamesMap)
        if (isMatch) {
          eligibleVendorIds.push(vendor._id.toString())
        }
      }

      console.log(`[LocationMatching] Matched ${eligibleVendorIds.length} eligible vendors for request ${request._id}`)
      return eligibleVendorIds
    } catch (error) {
      console.error(`[LocationMatching] Error finding eligible vendors:`, error)
      return []
    }
  }
}

export default new LocationMatchingService()
