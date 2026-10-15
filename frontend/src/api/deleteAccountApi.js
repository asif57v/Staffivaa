import { apiRequest } from './http.js'

/** GET /users/me/delete-account/check -> { canDelete, reasons[] } */
export function checkDeleteMyAccount() {
  return apiRequest('/users/me/delete-account/check')
}

/** POST /users/me/delete-account — archives + anonymizes the signed-in account */
export function deleteMyAccount({ confirm, reason }) {
  return apiRequest('/users/me/delete-account', { method: 'POST', body: { confirm, reason } })
}

/** Admin: POST /users/:id/delete-account */
export function adminDeleteUserAccount(userId, { reason, force = false }) {
  return apiRequest(`/users/${userId}/delete-account`, { method: 'POST', body: { reason, force } })
}

/** Admin: archived (deleted) accounts */
export function listDeletedAccounts(params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== 'all') qs.set(k, v)
  })
  const q = qs.toString()
  return apiRequest(`/admin/deleted-accounts${q ? `?${q}` : ''}`)
}

export function getDeletedAccount(id) {
  return apiRequest(`/admin/deleted-accounts/${id}`)
}

export function getDeletedAccountRecords(id, model, page = 1, limit = 25) {
  const qs = new URLSearchParams({ model, page: String(page), limit: String(limit) })
  return apiRequest(`/admin/deleted-accounts/${id}/records?${qs}`)
}

export function getDeletedAccountKyc(id) {
  return apiRequest(`/admin/deleted-accounts/${id}/kyc`)
}
