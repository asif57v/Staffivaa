import { apiRequest } from './http.js'

export async function fetchAdminBuildMartLeads({ page = 1, limit = 20, status = 'all', search = '' } = {}) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))
  if (status && status !== 'all') params.set('status', status)
  if (search) params.set('search', search)

  const data = await apiRequest(`/admin/buildmart/leads?${params}`)
  return data?.data ?? data
}

export async function updateBuildMartLeadStatus(id, status) {
  const data = await apiRequest(`/admin/buildmart/leads/${id}`, { method: 'PATCH', body: { status } })
  return data?.data?.lead ?? data?.lead ?? data
}

export function buildWhatsAppLeadUrl(lead) {
  const phone = import.meta.env.VITE_BUILDMART_ADMIN_WHATSAPP?.replace(/\D/g, '')
  if (!phone) return null
  const text = [
    'BuildMart quote lead',
    `Product: ${lead.productName}`,
    lead.variantLabel ? `Variant: ${lead.variantLabel}` : null,
    `Name: ${lead.name}`,
    `Phone: ${lead.phone}`,
    `Site: ${lead.siteLocation}`,
    `Qty: ${lead.quantity}`,
    lead.deliveryDate ? `Delivery: ${lead.deliveryDate}` : null,
    lead.notes ? `Notes: ${lead.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n')
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
}
