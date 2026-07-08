import { apiRequest } from './http.js'

/**
 * @param {string} userId
 */
export async function fetchAdminUserById(userId) {
  const json = await apiRequest(`/users/${userId}`)
  return json.data?.user ?? null
}

/**
 * @param {string} userId
 * @param {{ decision: 'approved' | 'rejected', note?: string }} body
 */
export async function reviewLabourKycAdmin(userId, body) {
  const json = await apiRequest(`/users/${userId}/labour-kyc-review`, { method: 'PATCH', body })
  return json.data?.user ?? null
}

/**
 * @param {{ search?: string, role?: string, status?: 'all' | 'active' | 'inactive', kycStatus?: 'all' | 'pending' | 'verified' | 'failed', page?: number, limit?: number }} params
 */
export async function fetchAdminUsers(params = {}) {
  const sp = new URLSearchParams()
  if (params.search?.trim()) sp.set('search', params.search.trim())
  if (params.role) sp.set('role', params.role)
  if (params.status && params.status !== 'all') sp.set('status', params.status)
  if (params.kycStatus && params.kycStatus !== 'all') sp.set('kycStatus', params.kycStatus)
  sp.set('page', String(Math.max(1, params.page ?? 1)))
  sp.set('limit', String(Math.min(100, Math.max(1, params.limit ?? 20))))
  const json = await apiRequest(`/users?${sp.toString()}`)
  return json.data
}

export async function patchUserStatusAdmin(userId, status, reason) {
  const json = await apiRequest(`/users/${userId}/status`, {
    method: 'PATCH',
    body: { status, reason }
  })
  return json.data?.user ?? null
}

export async function addAdminNote(userId, text) {
  const json = await apiRequest(`/users/${userId}/notes`, {
    method: 'POST',
    body: { text }
  })
  return json.data?.user ?? null
}

export async function updateUserWalletAdmin(userId, action, amount, reason) {
  const json = await apiRequest(`/users/${userId}/wallet`, {
    method: 'PATCH',
    body: { action, amount, reason }
  })
  return json.data?.user ?? null
}

export async function getUserTimelineAdmin(userId) {
  const json = await apiRequest(`/users/${userId}/timeline`)
  return json.data?.logs ?? []
}
