import { apiRequest } from './http.js'

/** @param {object} payload */
export async function submitBuildMartQuote(payload) {
  const data = await apiRequest('/buildmart/quotes', { method: 'POST', body: payload })
  return data?.data?.lead ?? data?.lead ?? data
}
