import { apiRequest } from './http.js'

export async function createSupportTicket(subject, message) {
  const json = await apiRequest('/support-tickets', {
    method: 'POST',
    body: { subject, message, priority: 'medium', category: 'general' }
  })
  return json
}
