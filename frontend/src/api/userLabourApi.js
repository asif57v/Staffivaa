import { apiRequest } from './http.js'

export function updateMyLabourCategories(categoryIds) {
  return apiRequest('/users/me/labour-categories', { method: 'PATCH', body: { categoryIds } })
}
