import { apiRequest } from './http.js'

export function fetchLabourCategoriesGrouped() {
  return apiRequest('/labour-categories/grouped', { skipAuth: true })
}
