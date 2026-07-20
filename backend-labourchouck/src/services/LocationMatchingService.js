import mongoose from 'mongoose'
import { User } from '../models/User.js'
import { USER_ROLES } from '../constants/roles.js'

class LocationMatchingService {
  /**
   * Calculate Haversine distance between two points in kilometers
   */
  calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Find eligible vendors for a given corporate request based on radii.
   * Both Corporate Search Radius and Vendor Service Radius must be satisfied.
   * @param {Object} request - The WorkforceRequest document
   * @param {Object} settings - The SystemSettings radiusConfig object
   * @returns {Array<String>} - Array of eligible vendor User IDs
   */
  async findEligibleVendors(request, settings) {
    if (!request.locationLat || !request.locationLng) {
      console.warn(`[LocationMatching] Request ${request._id} has no location. Returning empty list.`);
      return [];
    }

    // Determine the Corporate Search Radius
    let corporateSearchRadius = request.vendorSearchRadius;
    if (corporateSearchRadius === undefined || corporateSearchRadius === null) {
      // Use default if not specified
      corporateSearchRadius = settings?.defaultCorporateSearchRadius || 25;
    }

    const maxDistanceMeters = corporateSearchRadius * 1000; // Convert km to meters

    // Step 1: Query MongoDB using $geoNear to find vendors within the Corporate's search radius.
    // We only want vendors who have a location set.
    
    // We will aggregate because $geoNear must be the first stage.
    const pipeline = [
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [request.locationLng, request.locationLat] },
          distanceField: 'calculatedDistanceMeters',
          maxDistance: maxDistanceMeters,
          spherical: true,
          query: {
            role: USER_ROLES.VENDOR,
            isActive: true,
            accountStatus: 'active'
          }
        }
      }
    ];

    try {
      const nearbyVendors = await User.aggregate(pipeline);

      const eligibleVendorIds = [];

      // Step 2: Filter the nearby vendors to ensure the request is also within the Vendor's own Service Radius
      for (const vendor of nearbyVendors) {
        const vendorRadius = vendor.contractorProfile?.serviceRadius;
        
        // If vendorRadius is null or undefined and allowUnlimitedRadius is true, we consider it unlimited.
        if (vendorRadius === null || vendorRadius === undefined) {
          if (settings?.allowUnlimitedRadius !== false) {
             eligibleVendorIds.push(vendor._id.toString());
             continue;
          } else {
             // If unlimited is not allowed, we use a default
             const defaultRad = settings?.defaultVendorRadius || 15;
             if ((vendor.calculatedDistanceMeters / 1000) <= defaultRad) {
               eligibleVendorIds.push(vendor._id.toString());
             }
             continue;
          }
        }

        // Compare calculated distance against Vendor's specified service radius
        if ((vendor.calculatedDistanceMeters / 1000) <= vendorRadius) {
          eligibleVendorIds.push(vendor._id.toString());
        }
      }

      return eligibleVendorIds;
    } catch (error) {
      console.error(`[LocationMatching] Error finding eligible vendors:`, error);
      // Fallback: return empty array if Geo query fails (e.g. index not built)
      return [];
    }
  }
}

export default new LocationMatchingService();
