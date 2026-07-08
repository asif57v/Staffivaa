import { apiRequest } from './http.js'

export function fetchAdminLabourCategoryTree() {
  return apiRequest('/admin/labour-category-groups')
}

export function createAdminLabourCategory(payload) {
  return apiRequest('/admin/labour-categories', { method: 'POST', body: payload })
}

export function patchAdminLabourCategory(id, payload) {
  return apiRequest(`/admin/labour-categories/${id}`, { method: 'PATCH', body: payload })
}

export function deleteAdminLabourCategory(id) {
  return apiRequest(`/admin/labour-categories/${id}`, { method: 'DELETE' })
}
