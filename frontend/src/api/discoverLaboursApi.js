import { apiRequest } from './http.js'

/**
 * @param {{ groupId?: string, categoryId?: string, q?: string, limit?: number }} [params]
 */
export function fetchDiscoverLabours(params = {}) {
  const q = new URLSearchParams()
  if (params.groupId) q.set('groupId', params.groupId)
  if (params.categoryId) q.set('categoryId', params.categoryId)
  if (params.q) q.set('q', params.q)
  if (params.limit != null) q.set('limit', String(params.limit))
  const s = q.toString()
  return apiRequest(`/users/discover/labours${s ? `?${s}` : ''}`)
}

export function fetchDiscoverLabour(id) {
  return apiRequest(`/users/discover/labours/${encodeURIComponent(id)}`)
}
