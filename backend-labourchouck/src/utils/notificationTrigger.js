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
          io.to(`${user.role}_${userId}`).emit('notification:new', notification);
        }
      } else {
        // Send to all admins
        io.to('admin').emit('notification:new', notification);
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
