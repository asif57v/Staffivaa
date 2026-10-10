import { triggerNotification } from './notificationTrigger.js'

/**
 * Corporate-client notification copy for the request -> quotation flow.
 * Each entry builds { title, body, type } so the same wording is used by every controller.
 */
const COPY = {
  request_submitted: (ref) => ({
    title: 'Request Submitted',
    body: `Your workforce request ${ref} was sent. Admin will review it and get back to you soon.`,
    type: 'CORPORATE_REQUEST_SUBMITTED',
  }),
  request_accepted: (ref) => ({
    title: 'Request Accepted',
    body: `Admin accepted your workforce request ${ref}. A quotation will be shared with you shortly.`,
    type: 'CORPORATE_REQUEST_ACCEPTED',
  }),
  request_rejected: (ref, note) => ({
    title: 'Request Rejected',
    body: `Admin could not accept your workforce request ${ref}.${note ? ` Reason: ${note}` : ''}`,
    type: 'CORPORATE_REQUEST_REJECTED',
  }),
  quotation_received: (ref) => ({
    title: 'Quotation Received',
    body: `Admin sent you a quotation for request ${ref}. Open it to review and respond.`,
    type: 'CORPORATE_QUOTATION_RECEIVED',
  }),
  quotation_revised: (ref) => ({
    title: 'Revised Quotation Received',
    body: `Admin sent an updated quotation for request ${ref}. Open it to review and respond.`,
    type: 'CORPORATE_QUOTATION_RECEIVED',
  }),
  quotation_accept_sent: (ref) => ({
    title: 'Quotation Accepted',
    body: `You accepted the quotation for request ${ref}. Admin will review it and confirm shortly.`,
    type: 'CORPORATE_QUOTATION_RESPONSE_SENT',
  }),
  quotation_reject_sent: (ref) => ({
    title: 'Quotation Rejected',
    body: `You rejected the quotation for request ${ref}. Admin will review your response.`,
    type: 'CORPORATE_QUOTATION_RESPONSE_SENT',
  }),
  quotation_revision_sent: (ref) => ({
    title: 'Revision Request Sent',
    body: `Your revision request for ${ref} was sent. Admin will review it and share an updated quotation.`,
    type: 'CORPORATE_QUOTATION_RESPONSE_SENT',
  }),
  quotation_admin_approved: (ref) => ({
    title: 'Quotation Approved by Admin',
    body: `Admin approved the quotation for request ${ref}. Your project can move forward.`,
    type: 'CORPORATE_QUOTATION_APPROVED',
  }),
  quotation_admin_rejected: (ref) => ({
    title: 'Quotation Rejected by Admin',
    body: `Admin rejected the quotation for request ${ref}. Please contact support or submit a new request.`,
    type: 'CORPORATE_QUOTATION_REJECTED',
  }),
}

/**
 * Notify the corporate client of a request/quotation event (in-app + socket + push).
 * Never throws: a notification failure must not break the main flow.
 * @param {{ _id: any, clientId: any, reference?: string }} request WorkforceRequest (clientId may be populated)
 * @param {keyof typeof COPY} event
 * @param {string} [note] extra detail (e.g. admin's rejection reason)
 */
export async function notifyCorporateClient(request, event, note) {
  try {
    const clientId = request?.clientId?._id || request?.clientId
    const build = COPY[event]
    if (!clientId || !build) return
    const { title, body, type } = build(request.reference || 'your request', note)
    await triggerNotification({
      userId: clientId,
      title,
      body,
      type,
      relatedId: request._id,
      relatedModel: 'WorkforceRequest',
      url: `/corporate/requests/${request._id}`,
      recipientRole: 'corporate',
    })
  } catch (err) {
    console.error('[CorporateNotification] failed:', event, err.message)
  }
}
