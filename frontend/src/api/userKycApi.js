import { apiRequest } from './http.js'

/**
 * @param {{ aadhaar?: string, pan?: string, videoUrl: string, videoMeta?: object }} payload
 */
export function submitLabourKycDocuments(payload) {
  return apiRequest('/users/me/labour/kyc/submit', { method: 'POST', body: payload })
}
