import { apiClient } from '../api/http.js'
import { buildBookingFlowPath } from './bookingFlowNavigation.js'
import { readBookingDraft, writeBookingDraft } from './individualBookingDraft.js'

export const BANNER_ROLES = [
  { value: 'individual', label: 'User (Individual)' },
  { value: 'labour', label: 'Worker / Labour' },
  { value: 'corporate', label: 'Corporate Client' },
  { value: 'contractor', label: 'Vendor / Contractor' },
  { value: 'enterprise', label: 'Enterprise' },
]

export function trackBanner(id, action) {
  if (!id) return
  apiClient.post('/marketing/track', { type: 'BANNER', id, action }).catch(() => {})
}

/**
 * Opens whatever the admin configured on the banner, for the viewer's role.
 * SKILL_BOOKING → role's booking / hiring flow with the skill pre-selected.
 * Returns true when it navigated, false when the caller should fall back
 * (e.g. legacy `linkedGroup` handling).
 */
export function runBannerAction(banner, role, navigate) {
  const action = banner?.action
  const skill = action?.skillIds?.[0]
  const skillId = skill?._id || skill

  if (action?.type === 'SKILL_BOOKING' && skillId) {
    const presets = action.presets || {}
    if (role === 'individual') {
      const prev = readBookingDraft() || {}
      writeBookingDraft({
        ...prev,
        entryPoint: 'category',
        groupId: String(skill?.group || prev.groupId || ''),
        categoryId: String(skillId),
        categoryName: skill?.name || '',
        matchMode: 'smart',
        selectedWorkers: [],
        ...(presets.bookingType ? { bookingType: presets.bookingType } : {}),
      })
      navigate(buildBookingFlowPath(presets.bookingType ? 'details' : 'type', { categoryId: skillId }))
      return true
    }
    const qs = new URLSearchParams({ categoryId: String(skillId) })
    if (presets.quantity) qs.set('quantity', String(presets.quantity))
    if (presets.city) qs.set('city', presets.city)
    if (role === 'corporate') {
      navigate(`/corporate/requests/new?${qs}`)
      return true
    }
    if (role === 'enterprise') {
      navigate(`/enterprise/jobs/new?${qs}`)
      return true
    }
    // labour / contractor have no hiring flow — fall through to screen/url if set
  }

  if (action?.type === 'URL' && action.url) {
    if (/^https?:\/\//i.test(action.url)) window.open(action.url, '_blank', 'noopener')
    else navigate(action.url)
    return true
  }

  const screen = banner?.redirectScreen
  if (screen) {
    navigate(screen)
    return true
  }
  return false
}
