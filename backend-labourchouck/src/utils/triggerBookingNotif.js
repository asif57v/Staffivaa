import { User } from '../models/User.js'
import { triggerNotification } from './notificationTrigger.js'
import { notificationUrlFor } from './bookingNotificationCopy.js'

/**
 * Send a role-aware booking push (labour vs individual get different URLs + copy).
 * @param {{ userId: string, copy: { title: string, body: string, type: string }, relatedId?: any, relatedModel?: string, url?: string, requestId?: string, fcmExtra?: Record<string, string|number> }} args
 */
export async function triggerBookingNotif({ userId, copy, relatedId, relatedModel, url, requestId, fcmExtra = {} }) {
  if (!userId || !copy?.title || !copy?.body) return null

  const user = await User.findById(userId).select('role').lean()
  const role = user?.role || 'individual'
  const resolvedUrl =
    url ||
    notificationUrlFor({
      role,
      type: copy.type,
      requestId: requestId || (relatedModel === 'WorkforceRequest' ? relatedId : undefined),
    })

  const assignmentId =
    relatedModel === 'Assignment' && relatedId ? String(relatedId) : String(fcmExtra.assignmentId || '')

  return triggerNotification({
    userId,
    title: copy.title,
    body: copy.body,
    type: copy.type,
    relatedId,
    relatedModel,
    url: resolvedUrl,
    recipientRole: role,
    fcmExtra: {
      assignmentId,
      requestId: requestId ? String(requestId) : String(fcmExtra.requestId || ''),
      ...fcmExtra,
    },
  })
}
