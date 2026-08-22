import { User } from '../models/User.js'
import { triggerNotification } from './notificationTrigger.js'
import { notificationUrlFor } from './bookingNotificationCopy.js'

/**
 * Send a role-aware booking push (labour vs individual get different URLs + copy).
 * @param {{ userId: string, copy: { title: string, body: string, type: string }, relatedId?: any, relatedModel?: string, url?: string, requestId?: string }} args
 */
export async function triggerBookingNotif({ userId, copy, relatedId, relatedModel, url, requestId }) {
  if (!userId || !copy?.title || !copy?.body) return null

  const user = await User.findById(userId).select('role').lean()
  const role = user?.role || 'individual'
  const resolvedRequestId =
    requestId || (relatedModel === 'WorkforceRequest' ? relatedId : undefined)
  const resolvedUrl =
    url ||
    notificationUrlFor({
      role,
      type: copy.type,
      requestId: resolvedRequestId,
      assignmentId: relatedModel === 'Assignment' ? relatedId : undefined,
    })

  const pushData = {
    requestId: resolvedRequestId ? String(resolvedRequestId) : '',
    assignmentId: relatedModel === 'Assignment' && relatedId ? String(relatedId) : '',
  }

  return triggerNotification({
    userId,
    title: copy.title,
    body: copy.body,
    type: copy.type,
    relatedId,
    relatedModel,
    url: resolvedUrl,
    recipientRole: role,
    pushData,
  })
}
