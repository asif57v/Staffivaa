const DRAFT_KEY = 'lc_individual_booking_draft_v1'

/** @typedef {'search' | 'category'} BookingEntryPoint */
/** @typedef {'manual' | 'smart'} BookingMatchMode */
/** @typedef {'few_hours' | 'full_day' | 'multi_day'} BookingDurationKind */

/**
 * In-session booking draft — bridges home → booking flow screens.
 * @returns {object | null}
 */
export function readBookingDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/** @param {object} draft */
export function writeBookingDraft(draft) {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, updatedAt: Date.now() }))
}

export function clearBookingDraft() {
  sessionStorage.removeItem(DRAFT_KEY)
}

/** @param {Partial<object>} patch */
export function patchBookingDraft(patch) {
  const prev = readBookingDraft() || {}
  writeBookingDraft({ ...prev, ...patch })
}

export function createEmptyDraft() {
  return {
    entryPoint: 'search',
    groupId: '',
    categoryId: '',
    groupName: '',
    categoryName: '',
    matchMode: null,
    selectedWorkers: [],
    bookingType: null,
    address: '',
    lat: null,
    lng: null,
    notes: '',
    imageNames: [],
    durationKind: 'few_hours',
    durationDays: 1,
    serviceDate: '',
    timeSlot: '',
    paymentTiming: 'after_work',
    paymentMethod: null,
  }
}

export function draftHasCategory(draft) {
  return Boolean(draft?.categoryId)
}

export function draftFlowSearchParams(draft, step) {
  const params = new URLSearchParams()
  if (step) params.set('step', step)
  if (draft?.categoryId) params.set('categoryId', String(draft.categoryId))
  if (draft?.groupId) params.set('groupId', String(draft.groupId))
  return params.toString()
}
