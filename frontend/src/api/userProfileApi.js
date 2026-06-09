import { apiRequest } from './http.js'

/** PATCH /users/me — fullName, profileImageUrl, etc. */
export function patchCurrentUser(body) {
  return apiRequest('/users/me', { method: 'PATCH', body })
}
