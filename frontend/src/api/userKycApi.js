import { apiRequest } from './http.js'

/**
 * @param {{
 *   aadhaar?: string,
 *   pan?: string,
 *   videoUrl?: string,
 *   videoMeta?: object,
 *   photos?: Array<{ label: string, url: string, type: string }>,
 *   frontImageUrl?: string,
 *   backImageUrl?: string,
 *   selfieUrl?: string,
 *   panImageUrl?: string
 * }} payload
 */
export function submitLabourKycDocuments(payload) {
  return apiRequest('/users/me/labour/kyc/submit', { method: 'POST', body: payload })
}
