/**
 * bookingJobBridge.js
 *
 * When a homeowner/individual confirms a booking, this module writes a job
 * offer into the Labour job demo storage so it shows up as a "New assignment"
 * alert on the Labour home page for workers who have the matching skill/category.
 *
 * Since this is a frontend-only demo (no real-time backend push), we simulate
 * the real-time feed using localStorage events — the labour page is already
 * subscribed to those.
 */

import { loadJobDemoState, saveJobDemoState } from './labourJobDemoStorage.js'

const BOOKING_OFFER_PREFIX = 'booking-offer-'

function shiftWindowFromBooking(draft) {
  if (draft.bookingType === 'instant') {
    return `Today · ASAP`
  }
  if (draft.serviceDate && draft.timeSlot) {
    return `${draft.serviceDate} · ${draft.timeSlot}`
  }
  return `Today · ${new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
}

function rateLabelFromDraft(draft) {
  if (draft.durationKind === 'few_hours') return '₹450 / job'
  if (draft.durationKind === 'full_day') return '₹850 / day'
  if (draft.durationKind === 'multi_day') {
    const days = Number(draft.durationDays) || 2
    return `₹850/day · ${days} days`
  }
  return '₹850 / day'
}

/**
 * Injects a booking as a job offer into the labour jobs store.
 * Call this right after a booking is confirmed (before goStep('searching')).
 *
 * @param {{ categoryId?: string, categoryName?: string, groupName?: string, address?: string, notes?: string, bookingType?: string, serviceDate?: string, timeSlot?: string, durationKind?: string, durationDays?: number }} draft
 * @param {string} bookingRef - The booking reference string (e.g. "IND-20240601-XXXX")
 */
export function pushBookingAsLabourOffer(draft, bookingRef) {
  if (typeof window === 'undefined') return

  const offerId = `${BOOKING_OFFER_PREFIX}${bookingRef}`
  const current = loadJobDemoState()

  // Don't add duplicates
  if (current.offers.some((o) => o.id === offerId)) return

  const newOffer = {
    id: offerId,
    title: `${draft.categoryName || 'General labour'} — ${draft.groupName || 'Homeowner job'}`,
    site: draft.address || 'Location shared on accept',
    shiftWindow: shiftWindowFromBooking(draft),
    rateLabel: rateLabelFromDraft(draft),
    trade: draft.categoryName || 'General',
    urgency: draft.bookingType === 'instant' ? 'high' : 'normal',
    sourceType: 'individual',
    requestRef: bookingRef,
    notes: draft.notes || '',
    categoryId: draft.categoryId || '',
    contractorName: 'Individual homeowner',
    facilities: ['Tools provided', 'Payment on completion'],
    headcount: '1 worker needed',
    supervisor: 'Homeowner',
    supervisorPhone: '',
    createdAt: new Date().toISOString(),
  }

  const updated = {
    ...current,
    offers: [newOffer, ...current.offers],
  }

  saveJobDemoState(updated)

  // Also fire a notification to update the bell icon on the Labour home page
  try {
    const NOTIF_KEY = 'lc-labour-notifs-v1'
    const raw = localStorage.getItem(NOTIF_KEY)
    const notifs = raw ? JSON.parse(raw) : []
    const newNotif = {
      id: `notif-${offerId}`,
      kind: 'job_offer',
      jobId: offerId,
      title: '🏠 New homeowner request',
      body: `${draft.categoryName || 'Labour'} needed at ${draft.address || 'your area'}`,
      at: new Date().toISOString(),
      read: false,
    }
    localStorage.setItem(NOTIF_KEY, JSON.stringify([newNotif, ...notifs]))
    window.dispatchEvent(new CustomEvent('lc-labour-notifications'))
  } catch {
    // ignore notification errors
  }
}

/**
 * Remove a booking offer from the labour jobs store (e.g. if booking is cancelled).
 * @param {string} bookingRef
 */
export function removeBookingLabourOffer(bookingRef) {
  if (typeof window === 'undefined') return
  const offerId = `${BOOKING_OFFER_PREFIX}${bookingRef}`
  const current = loadJobDemoState()
  const updated = {
    ...current,
    offers: current.offers.filter((o) => o.id !== offerId),
  }
  saveJobDemoState(updated)
}
