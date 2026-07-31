import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { getIO } from './socket.js';
import { sendNotificationToUser } from '../services/notificationService.js';

export const triggerNotification = async ({ userId, title, body, type, relatedId, relatedModel }) => {
  try {
    // 1. Create in MongoDB
    const notification = await Notification.create({
      userId,
      title,
      body,
      type,
      relatedId,
      relatedModel
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
            .to(`user_${uId}`)
            .to(uId)
            .emit('notification:new', notification);

          if (
            type === 'KYC_APPROVED' || 
            type === 'KYC_REJECTED' ||
            type === 'ACCOUNT_ON_HOLD' ||
            type === 'ACCOUNT_SUSPENDED' ||
            type === 'ACCOUNT_BLOCKED' ||
            type === 'ACCOUNT_REACTIVATED' ||
            type === 'ACCOUNT_STATUS_UPDATE'
          ) {
            const statusStr = 
              type === 'KYC_APPROVED' || type === 'ACCOUNT_REACTIVATED' ? 'approved' :
              type === 'ACCOUNT_ON_HOLD' ? 'on_hold' :
              type === 'ACCOUNT_SUSPENDED' ? 'suspended' :
              type === 'ACCOUNT_BLOCKED' ? 'blocked' : 'updated';

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
            type,
            relatedId,
            relatedModel
          }).catch(e => console.error('[Admin Notification Save Error]:', e.message));
        }
      }
      
      // Notify dashboard listeners
      io.emit('dashboard:updated');
    }

    // 3. Trigger FCM Push Notification
    if (userId) {
      sendNotificationToUser(userId, title, body, {
        type,
        relatedId: relatedId ? relatedId.toString() : '',
        relatedModel: relatedModel || ''
      }).catch(err => console.error('[FCM Push Error]:', err.message));
    }

    return notification;
  } catch (err) {
    console.error('[NotificationTrigger] Failed to trigger notification:', err.message);
  }
};
