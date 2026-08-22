import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { getIO } from './socket.js';
import { sendNotificationToUser } from '../services/notificationService.js';

function normalizeNotifType(type) {
  if (!type) return 'GENERAL'
  if (type === 'new_order') return 'NEW_ORDER'
  return String(type)
}

/**
 * Create in-app notification + socket + FCM with dedicated title/body/type.
 * @param {{ userId?: string, title: string, body: string, type?: string, relatedId?: any, relatedModel?: string, url?: string, recipientRole?: string }} args
 */
export const triggerNotification = async ({ userId, title, body, type, relatedId, relatedModel, url, recipientRole, fcmExtra = {} }) => {
  try {
    const resolvedType = normalizeNotifType(type)
    let resolvedRole = recipientRole || ''

    if (userId && !resolvedRole) {
      const roleUser = await User.findById(userId).select('role').lean()
      resolvedRole = roleUser?.role || ''
    }

    const resolvedUrl =
      url ||
      (resolvedType === 'NEW_ORDER' || resolvedType === 'LABOUR_ASSIGNED'
        ? resolvedRole === 'labour' ? '/app/jobs' : '/app/bookings'
        : undefined)

    // 1. Create in MongoDB
    const notification = await Notification.create({
      userId,
      title,
      body,
      type: resolvedType,
      relatedId,
      relatedModel,
    });

    // 2. Broadcast via Socket.IO
    let io;
    try {
      io = getIO();
    } catch (e) {
      // Socket not initialized yet in scripts / checks
    }

    if (io) {
      if (userId) {
        const user = await User.findById(userId).select('role');
        if (user) {
          const uId = String(userId);
          const uRole = user.role;
          io.to(`${uRole}_${uId}`)
            .to(`vendor_${uId}`)
            .to(`vendor-${uId}`)
            .to(`contractor_${uId}`)
            .to(`contractor-${uId}`)
            .to(`corporate_${uId}`)
            .to(`corporate-${uId}`)
            .to(`enterprise_${uId}`)
            .to(`enterprise-${uId}`)
            .to(`labour_${uId}`)
            .to(`labour-${uId}`)
            .to(`individual_${uId}`)
            .to(`user_${uId}`)
            .to(uId)
            .emit('notification:new', notification);

          if (
            resolvedType === 'KYC_APPROVED' ||
            resolvedType === 'KYC_REJECTED' ||
            resolvedType === 'ACCOUNT_ON_HOLD' ||
            resolvedType === 'ACCOUNT_SUSPENDED' ||
            resolvedType === 'ACCOUNT_BLOCKED' ||
            resolvedType === 'ACCOUNT_REACTIVATED' ||
            resolvedType === 'ACCOUNT_STATUS_UPDATE'
          ) {
            const statusStr =
              resolvedType === 'KYC_APPROVED' || resolvedType === 'ACCOUNT_REACTIVATED'
                ? 'approved'
                : resolvedType === 'ACCOUNT_ON_HOLD'
                  ? 'on_hold'
                  : resolvedType === 'ACCOUNT_SUSPENDED'
                    ? 'suspended'
                    : resolvedType === 'ACCOUNT_BLOCKED'
                      ? 'blocked'
                      : 'updated';

            io.to(`${uRole}_${uId}`)
              .to(`vendor_${uId}`)
              .to(`vendor-${uId}`)
              .to(`contractor_${uId}`)
              .to(`contractor-${uId}`)
              .to(`corporate_${uId}`)
              .to(`corporate-${uId}`)
              .to(`user_${uId}`)
              .to(uId)
              .emit('kyc:updated', { status: statusStr, notification });

            io.to(`${uRole}_${uId}`)
              .to(`vendor_${uId}`)
              .to(`vendor-${uId}`)
              .to(`contractor_${uId}`)
              .to(`contractor-${uId}`)
              .to(`corporate_${uId}`)
              .to(`corporate-${uId}`)
              .to(`user_${uId}`)
              .to(uId)
              .emit('account:status_updated', { status: statusStr, notification });
          }
        }
      } else {
        // Send to all admins and persist notification for admin users
        io.to('admin').emit('notification:new', notification);
        const adminUsers = await User.find({ role: 'admin' }).select('_id');
        for (const admin of adminUsers) {
          Notification.create({
            userId: admin._id,
            title,
            body,
            type: resolvedType,
            relatedId,
            relatedModel,
          }).catch((e) => console.error('[Admin Notification Save Error]:', e.message));

          sendNotificationToUser(admin._id, title, body, {
            type: resolvedType,
            relatedId: relatedId ? relatedId.toString() : '',
            relatedModel: relatedModel || '',
            url: resolvedUrl || '/admin',
          }).catch((err) => console.error('[Admin FCM Push Error]:', err.message));
        }
      }

      // Notify dashboard listeners
      io.emit('dashboard:updated');
    }

    // 3. Trigger FCM Push Notification (for specific user) — await so NEW_ORDER isn't dropped mid-request
    if (userId) {
      try {
        await sendNotificationToUser(userId, title, body, {
          type: resolvedType,
          relatedId: relatedId ? relatedId.toString() : '',
          relatedModel: relatedModel || '',
          url: resolvedUrl || '',
          recipientRole: resolvedRole || '',
          ...fcmExtra,
        });
      } catch (err) {
        console.error('[FCM Push Error]:', err.message);
      }
    }

    return notification;
  } catch (err) {
    console.error('[NotificationTrigger] Failed to trigger notification:', err.message);
    // Still attempt FCM so mobile gets the dedicated message even if DB write fails
    if (userId && title && body) {
      try {
        await sendNotificationToUser(userId, title, body, {
          type: normalizeNotifType(type),
          relatedId: relatedId ? String(relatedId) : '',
          relatedModel: relatedModel || '',
          url: url || '',
          recipientRole: recipientRole || '',
          ...fcmExtra,
        });
      } catch (fcmErr) {
        console.error('[NotificationTrigger] FCM fallback also failed:', fcmErr.message);
      }
    }
  }
};
