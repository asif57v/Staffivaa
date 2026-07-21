import { getMessaging } from 'firebase-admin/messaging';
import { User } from '../models/User.js';

/**
 * Send a push notification to a specific user.
 * 
 * @param {string} userId - The MongoDB ObjectId of the user.
 * @param {string} title - The notification title.
 * @param {string} body - The notification body/message.
 * @param {Object} [data] - Optional payload data (must be an object of strings).
 * @returns {Promise<{success: boolean, sentCount: number, failedTokens: string[]}>}
 */
export const sendNotificationToUser = async (userId, title, body, data = {}) => {
  try {
    const user = await User.findById(userId).select('fcmTokensWeb fcmTokensMobile');
    if (!user) {
      return { success: false, sentCount: 0, failedTokens: [] };
    }

    const tokens = [
      ...(user.fcmTokensWeb || []),
      ...(user.fcmTokensMobile || [])
    ];

    if (tokens.length === 0) {
      console.log(`[NotificationService] No FCM tokens for user ${userId}`);
      return { success: false, sentCount: 0, failedTokens: [] };
    }

    const message = {
      notification: {
        title,
        body
      },
      data: {
        ...data,
        targetUserId: userId.toString(),
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      android: {
        priority: 'high',
        notification: { sound: 'default' }
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: { aps: { sound: 'default' } }
      },
      webpush: {
        headers: { Urgency: 'high' }
      },
      tokens: tokens
    };

    const response = await getMessaging().sendEachForMulticast(message);
    
    // Check for failed tokens to clean them up from DB
    const failedTokens = [];
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            failedTokens.push(tokens[idx]);
          }
        }
      });

      if (failedTokens.length > 0) {
        // Remove stale/invalid tokens from all arrays
        await User.updateOne(
          { _id: userId },
          {
            $pull: {
              fcmTokensWeb: { $in: failedTokens },
              fcmTokensMobile: { $in: failedTokens }
            }
          }
        );
        console.log(`[NotificationService] Removed ${failedTokens.length} stale FCM tokens for user ${userId}`);
      }
    }

    return { 
      success: response.successCount > 0, 
      sentCount: response.successCount, 
      failedTokens 
    };

  } catch (error) {
    console.error(`[NotificationService] Failed to send to user ${userId}:`, error.message);
    return { success: false, sentCount: 0, failedTokens: [] };
  }
};

/**
 * Send a push notification to multiple users.
 * 
 * @param {string[]} userIds - Array of MongoDB ObjectIds.
 * @param {string} title - Notification title.
 * @param {string} body - Notification body.
 * @param {Object} [data] - Optional data.
 */
export const sendNotificationToUsers = async (userIds, title, body, data = {}) => {
  try {
    const users = await User.find({ _id: { $in: userIds } }).select('_id fcmTokensWeb fcmTokensMobile');
    
    const results = await Promise.all(
      users.map(u => {
        const hasTokens = 
          (u.fcmTokensWeb && u.fcmTokensWeb.length > 0) ||
          (u.fcmTokensMobile && u.fcmTokensMobile.length > 0);
        if (hasTokens) {
           return sendNotificationToUser(u._id, title, body, data);
        }
        return Promise.resolve({ success: false, sentCount: 0 });
      })
    );

    return results;
  } catch (error) {
    console.error(`[NotificationService] Failed to multicast:`, error.message);
    return [];
  }
};
