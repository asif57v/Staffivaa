import { getMessaging } from 'firebase-admin/messaging';
import { User } from '../models/User.js';

/**
 * Send a push notification to a specific user.
 *
 * Mobile clients (Flutter/Android/iOS) often read `data.title` / `data.body` / `data.type`
 * when building the tray notification — so we always mirror title/body into `data`
 * and NEVER force type=NEW_ORDER (that caused every activity to look like a new job).
 *
 * @param {string} userId - The MongoDB ObjectId of the user.
 * @param {string} title - The notification title.
 * @param {string} body - The notification body/message.
 * @param {Object} [data] - Optional payload data (must be an object of strings).
 * @returns {Promise<{success: boolean, sentCount: number, failedTokens: string[]}>}
 */
export const sendNotificationToUser = async (userId, title, body, data = {}) => {
  try {
    if (!userId || !title || !body) {
      return { success: false, sentCount: 0, failedTokens: [] };
    }

    const user = await User.findById(userId).select('fcmTokensWeb fcmTokensMobile role');
    if (!user) {
      return { success: false, sentCount: 0, failedTokens: [] };
    }

    const recipientRole = String(data?.recipientRole || user.role || '');

    const tokens = [
      ...(user.fcmTokensWeb || []),
      ...(user.fcmTokensMobile || [])
    ];

    if (tokens.length === 0) {
      console.log(`[NotificationService] No FCM tokens found in DB for user ${userId} (${user.role || 'user'})`);
      return { success: false, sentCount: 0, failedTokens: [] };
    }

    const notifType = String(data?.type || 'GENERAL').toUpperCase() === 'NEW_ORDER' || data?.type === 'new_order'
      ? 'NEW_ORDER'
      : String(data?.type || 'GENERAL');

    const isNewOrder = notifType === 'NEW_ORDER' || notifType === 'new_order';
    const soundName = data.sound || (isNewOrder ? 'new_job_order' : 'default');
    const rawSoundName = String(soundName).replace(/\.(mp3|wav|caf|ogg)$/i, '');
    const channelId = isNewOrder ? 'new_job_order' : 'default';

    console.log(
      `[NotificationService] Dispatching FCM push to user ${userId} (${user.role || 'user'}) ` +
        `with ${tokens.length} token(s). type=${notifType} Title: "${title}"`
    );

    // Ensure all data values are strings for Firebase Admin SDK multicast
    const stringifiedData = {
      type: notifType,
      title: String(title),
      body: String(body),
      message: String(body),
      recipientRole,
      role: recipientRole,
      sound: rawSoundName,
      sound_name: rawSoundName,
      soundName: rawSoundName,
      channel_id: channelId,
      channelId,
      targetUserId: userId.toString(),
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    };

    if (data && typeof data === 'object') {
      Object.keys(data).forEach((key) => {
        if (data[key] !== undefined && data[key] !== null && key !== 'type') {
          stringifiedData[key] = typeof data[key] === 'string' ? data[key] : String(data[key]);
        }
      });
    }
    // Always keep the resolved type (do not let caller overwrite with empty)
    stringifiedData.type = notifType;
    stringifiedData.title = String(title);
    stringifiedData.body = String(body);
    stringifiedData.message = String(body);

    const message = {
      notification: {
        title: String(title),
        body: String(body),
      },
      data: stringifiedData,
      android: {
        priority: 'high',
        notification: {
          title: String(title),
          body: String(body),
          sound: isNewOrder ? 'new_job_order' : 'default',
          channelId,
          defaultSound: !isNewOrder,
          defaultVibrateTimings: true,
          priority: 'max',
          visibility: 'public',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: {
          aps: {
            alert: {
              title: String(title),
              body: String(body),
            },
            sound: isNewOrder ? 'new_job_order.caf' : 'default',
            'content-available': 1,
          },
        },
      },
      webpush: {
        headers: { Urgency: 'high' },
        notification: {
          title: String(title),
          body: String(body),
        },
      },
      tokens,
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
        await User.updateOne(
          { _id: userId },
          {
            $pull: {
              fcmTokensWeb: { $in: failedTokens },
              fcmTokensMobile: { $in: failedTokens },
            },
          }
        );
        console.log(`[NotificationService] Removed ${failedTokens.length} stale FCM tokens for user ${userId}`);
      }
    }

    return {
      success: response.successCount > 0,
      sentCount: response.successCount,
      failedTokens,
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
      users.map((u) => {
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
