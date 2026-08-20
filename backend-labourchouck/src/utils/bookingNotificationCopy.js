/**
 * Dedicated push notification copy for individual booking + labour flows.
 * Mobile clients should prefer notification.title/body, and fall back to data.title/data.body.
 */

export const NOTIF_TYPE = {
  NEW_ORDER: 'NEW_ORDER',
  BOOKING_CREATED: 'BOOKING_CREATED',
  BOOKING_UPDATED: 'BOOKING_UPDATED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  WORKER_FOUND: 'WORKER_FOUND',
  LABOUR_ASSIGNED: 'LABOUR_ASSIGNED',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  BOOKING_CONFIRMED: 'BOOKING_CONFIRMED',
  BOOKING_EXPIRED: 'BOOKING_EXPIRED',
  JOB_COMPLETED: 'JOB_COMPLETED',
  LABOUR_CHECK_IN: 'LABOUR_CHECK_IN',
  GENERAL: 'GENERAL',
}

/** Resolve deep-link by role + type */
export function notificationUrlFor({ role, type, requestId, assignmentId }) {
  const isLabour = role === 'labour'
  switch (type) {
    case NOTIF_TYPE.NEW_ORDER:
    case NOTIF_TYPE.LABOUR_ASSIGNED:
      return isLabour ? '/app/jobs' : '/app/bookings'
    case NOTIF_TYPE.WORKER_FOUND:
    case NOTIF_TYPE.BOOKING_UPDATED:
    case NOTIF_TYPE.BOOKING_CONFIRMED:
    case NOTIF_TYPE.PAYMENT_RECEIVED:
      if (requestId) return isLabour ? '/app/jobs' : `/app/booking/flow?step=active&ref=`
      return isLabour ? '/app/jobs' : '/app/bookings'
    case NOTIF_TYPE.BOOKING_CANCELLED:
    case NOTIF_TYPE.BOOKING_EXPIRED:
      return isLabour ? '/app/jobs' : '/app/bookings'
    case NOTIF_TYPE.JOB_COMPLETED:
      return isLabour ? '/app/jobs' : '/app/bookings'
    case NOTIF_TYPE.PAYMENT_FAILED:
      return '/app/wallet'
    case NOTIF_TYPE.LABOUR_CHECK_IN:
      return isLabour ? '/app' : '/app/bookings'
    default:
      return isLabour ? '/app/jobs' : '/app'
  }
}

export function bookingCreatedNotif(reference) {
  const ref = reference || 'new'
  return {
    title: 'Booking Created!',
    body: `Your job booking #${ref} has been created and sent to nearby workers.`,
    type: NOTIF_TYPE.BOOKING_CREATED,
  }
}

export function newJobOfferNotif({ customerName, categoryName, locationText }) {
  return {
    title: 'New Job Available!',
    body: `${customerName || 'A customer'} needs a ${categoryName || 'worker'} near ${locationText || 'your area'}. Tap to view.`,
    type: NOTIF_TYPE.NEW_ORDER,
  }
}

export function workerFoundNotif(workerName) {
  return {
    title: 'Worker Found!',
    body: `${workerName || 'A verified worker'} has accepted your job request. Please complete payment to confirm.`,
    type: NOTIF_TYPE.WORKER_FOUND,
  }
}

export function workerCancelledUnpaidNotif() {
  return {
    title: 'Worker Cancelled Booking',
    body: 'The worker cancelled your booking. You can book again anytime.',
    type: NOTIF_TYPE.BOOKING_CANCELLED,
  }
}

export function workerCancelledResearchNotif() {
  return {
    title: 'Finding a New Worker',
    body: 'Your assigned worker cancelled. We are searching for another nearby worker for you.',
    type: NOTIF_TYPE.BOOKING_UPDATED,
  }
}

export function customerCancelledNotif() {
  return {
    title: 'Booking Cancelled',
    body: 'The customer cancelled this booking.',
    type: NOTIF_TYPE.BOOKING_CANCELLED,
  }
}

export function customerCancelledSelfNotif(reference) {
  return {
    title: 'Booking Cancelled',
    body: `Your booking${reference ? ` #${reference}` : ''} has been cancelled successfully.`,
    type: NOTIF_TYPE.BOOKING_CANCELLED,
  }
}

export function searchExpiredUserNotif(reference) {
  return {
    title: 'No Worker Found',
    body: `We could not find an available worker for booking${reference ? ` #${reference}` : ''} in time. Please try booking again.`,
    type: NOTIF_TYPE.BOOKING_EXPIRED,
  }
}

export function searchExpiredLabourNotif() {
  return {
    title: 'Job Offer Expired',
    body: 'A nearby job offer expired because no one accepted it in time.',
    type: NOTIF_TYPE.BOOKING_EXPIRED,
  }
}

export function feeTimeoutUserNotif() {
  return {
    title: 'Booking Cancelled',
    body: 'Booking cancelled because platform fee payment was not completed in time. If you paid, a refund request has been initiated.',
    type: NOTIF_TYPE.BOOKING_CANCELLED,
  }
}

export function feeTimeoutLabourNotif() {
  return {
    title: 'Booking Cancelled',
    body: 'Booking cancelled because platform fee payment was not completed in time. If you paid, a refund request has been initiated.',
    type: NOTIF_TYPE.BOOKING_CANCELLED,
  }
}

export function paymentFailedNotif() {
  return {
    title: 'Payment Failed',
    body: 'Your recent payment transaction failed. Please try again.',
    type: NOTIF_TYPE.PAYMENT_FAILED,
  }
}

export function paymentSuccessUserNotif() {
  return {
    title: 'Payment Successful',
    body: 'Your platform fee payment was successful. Waiting for the worker to complete their payment.',
    type: NOTIF_TYPE.PAYMENT_RECEIVED,
  }
}

export function paymentSuccessLabourNotif() {
  return {
    title: 'Payment Successful',
    body: 'Your platform fee payment was successful. Waiting for the customer to complete their payment.',
    type: NOTIF_TYPE.PAYMENT_RECEIVED,
  }
}

export function counterpartPaidUserNotif() {
  return {
    title: 'Worker Paid Platform Fee',
    body: 'The worker has paid their platform fee. Please pay yours to unlock the booking.',
    type: NOTIF_TYPE.PAYMENT_RECEIVED,
  }
}

export function counterpartPaidLabourNotif() {
  return {
    title: 'Customer Paid Platform Fee',
    body: 'The customer has paid their platform fee. Please pay yours to unlock the booking.',
    type: NOTIF_TYPE.PAYMENT_RECEIVED,
  }
}

export function bookingConfirmedUserNotif(reference) {
  return {
    title: 'Booking Confirmed!',
    body: `Both payments are done${reference ? ` for #${reference}` : ''}. Your worker is confirmed and can proceed to the site.`,
    type: NOTIF_TYPE.BOOKING_CONFIRMED,
  }
}

export function bookingConfirmedLabourNotif(reference) {
  return {
    title: 'Booking Unlocked!',
    body: `Both payments are complete${reference ? ` for #${reference}` : ''}. You can now proceed to the job site.`,
    type: NOTIF_TYPE.BOOKING_CONFIRMED,
  }
}

export function jobCompletedUserNotif(workerName) {
  return {
    title: 'Job Completed',
    body: `${workerName || 'Your worker'} has completed the job. Thank you for using Staffivaa.`,
    type: NOTIF_TYPE.JOB_COMPLETED,
  }
}

export function jobCompletedLabourNotif() {
  return {
    title: 'Job Completed',
    body: 'You have successfully completed this job. Great work!',
    type: NOTIF_TYPE.JOB_COMPLETED,
  }
}

export function labourAssignedNotif() {
  return {
    title: 'New Job Assigned',
    body: 'You have been assigned to a new job. Please check your Active jobs.',
    type: NOTIF_TYPE.LABOUR_ASSIGNED,
  }
}

export function labourReassignedNotif() {
  return {
    title: 'New Job Assigned',
    body: 'You have been reassigned to a new job. Please check your schedule.',
    type: NOTIF_TYPE.LABOUR_ASSIGNED,
  }
}

export function previousAssignmentCancelledNotif() {
  return {
    title: 'Job Cancelled',
    body: 'Your previous assignment has been cancelled.',
    type: NOTIF_TYPE.BOOKING_CANCELLED,
  }
}
