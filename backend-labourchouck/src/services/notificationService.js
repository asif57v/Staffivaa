import { getMessaging } from 'firebase-admin/messaging';
import { User } from '../models/User.js';

const ANDROID_CHANNEL_ID = 'high_importance_channel';
const FCM_BATCH_SIZE = 500;

function uniqueTokens(list = []) {
  return [...new Set((list || []).filter((t) => typeof t === 'string' && t.trim()))];
}

function stringifyData(title, body, userId, recipientRole, data = {}) {
  const notifType =
    String(data?.type || 'GENERAL').toUpperCase() === 'NEW_ORDER' || data?.type === 'new_order'
      ? 'NEW_ORDER'
      : String(data?.type || 'GENERAL');

  const stringifiedData = {
    type: notifType,
    title: String(title),
    body: String(body),
    message: String(body),
    recipientRole: String(recipientRole || ''),
    role: String(recipientRole || ''),
    sound: 'default',
    sound_name: 'default',
    soundName: 'default',
    channel_id: ANDROID_CHANNEL_ID,
    channelId: ANDROID_CHANNEL_ID,
    android_channel_id: ANDROID_CHANNEL_ID,
    targetUserId: userId.toString(),
    click_action: 'FLUTTER_NOTIFICATION_CLICK',
  };

  if (data && typeof data === 'object') {
    Object.keys(data).forEach((key) => {
      if (data[key] === undefined || data[key] === null || key === 'type') return;
      // Never let callers force a missing custom sound/channel (silent tray on Android).
      if (
        (key === 'sound' || key === 'sound_name' || key === 'soundName' || key === 'channel_id' || key === 'channelId') &&
        String(data[key]).includes('new_job_order')
      ) {
        return;
      }
      stringifiedData[key] = typeof data[key] === 'string' ? data[key] : String(data[key]);
    });
  }

  stringifiedData.type = notifType;
  stringifiedData.title = String(title);
  stringifiedData.body = String(body);
  stringifiedData.message = String(body);
  stringifiedData.sound = 'default';
  stringifiedData.sound_name = 'default';
  stringifiedData.soundName = 'default';
  stringifiedData.channel_id = ANDROID_CHANNEL_ID;
  stringifiedData.channelId = ANDROID_CHANNEL_ID;
  stringifiedData.android_channel_id = ANDROID_CHANNEL_ID;

  return { notifType, stringifiedData };
}

async function sendBatches(messageFactory, tokens, userId, notifType) {
  if (!tokens.length) {
    return { successCount: 0, failureCount: 0, failedTokens: [] };
  }

  let successCount = 0;
  let failureCount = 0;
  const failedTokens = [];

  for (let i = 0; i < tokens.length; i += FCM_BATCH_SIZE) {
    const batch = tokens.slice(i, i + FCM_BATCH_SIZE);
    const response = await getMessaging().sendEachForMulticast(messageFactory(batch));

    successCount += response.successCount;
    failureCount += response.failureCount;

    response.responses.forEach((resp, idx) => {
      if (resp.success) return;
      console.warn(
        `[NotificationService] FCM fail user=${userId} type=${notifType} token#${i + idx}:`,
        resp.error?.code,
        resp.error?.message,
      );
      const errorCode = resp.error?.code;
      if (
        errorCode === 'messaging/invalid-registration-token' ||
        errorCode === 'messaging/registration-token-not-registered'
      ) {
        failedTokens.push(batch[idx]);
      }
    });
  }

  return { successCount, failureCount, failedTokens };
}

/**
 * Send a push notification to a specific user.
 *
 * Mobile (Flutter) and web tokens MUST be sent as separate messages:
 * - Android/iOS need a `notification` payload so the OS tray (slider) shows when the app is
 *   backgrounded/killed. Data-only messages are dropped on many OEM devices.
 * - Web needs `webpush.notification`. Mixing both in one multicast makes WebView/Chrome
 *   swallow or duplicate the tray entry.
 *
 * Flutter foreground display still reads `data.title` / `data.body` / `data.type`.
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
    const mobileTokens = uniqueTokens(user.fcmTokensMobile);
    const mobileSet = new Set(mobileTokens);
    const webTokens = uniqueTokens(user.fcmTokensWeb).filter((t) => !mobileSet.has(t));
    const tokens = [...mobileTokens, ...webTokens];

    if (tokens.length === 0) {
      console.log(`[NotificationService] No FCM tokens found in DB for user ${userId} (${user.role || 'user'})`);
      return { success: false, sentCount: 0, failedTokens: [] };
    }

    const { notifType, stringifiedData } = stringifyData(title, body, userId, recipientRole, data);
    const safeTitle = String(title);
    const safeBody = String(body);

    console.log(
      `[NotificationService] Dispatching FCM push to user ${userId} (${user.role || 'user'}) ` +
        `mobile=${mobileTokens.length} web=${webTokens.length} type=${notifType} Title: "${safeTitle}"`,
    );

    // fcmTokensMobile: Flutter native + mobile browser (phone Chrome/Safari).
    // Include webpush so mobile-browser web FCM tokens still receive tray notifications.
    const mobileResult = await sendBatches(
      (batch) => ({
        notification: { title: safeTitle, body: safeBody },
        data: stringifiedData,
        android: {
          priority: 'high',
          ttl: 86400000,
          notification: {
            title: safeTitle,
            body: safeBody,
            sound: 'default',
            defaultSound: true,
            defaultVibrateTimings: true,
            priority: 'high',
            visibility: 'public',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          headers: {
            'apns-priority': '10',
            'apns-push-type': 'alert',
          },
          payload: {
            aps: {
              alert: { title: safeTitle, body: safeBody },
              sound: 'default',
              'content-available': 1,
              'mutable-content': 1,
            },
          },
        },
        webpush: {
          headers: { Urgency: 'high', TTL: '86400' },
          notification: {
            title: safeTitle,
            body: safeBody,
            icon: '/logo.png',
            badge: '/favicon.svg',
            requireInteraction: true,
          },
          fcmOptions: {
            link: stringifiedData.url || '/',
          },
        },
        tokens: batch,
      }),
      mobileTokens,
      userId,
      notifType,
    );

    // Desktop browser / laptop only
    const webResult = await sendBatches(
      (batch) => ({
        data: stringifiedData,
        webpush: {
          headers: { Urgency: 'high', TTL: '86400' },
          notification: {
            title: safeTitle,
            body: safeBody,
            icon: '/logo.png',
            badge: '/favicon.svg',
            requireInteraction: true,
          },
          fcmOptions: {
            link: stringifiedData.url || '/',
          },
        },
        tokens: batch,
      }),
      webTokens,
      userId,
      notifType,
    );

    const successCount = mobileResult.successCount + webResult.successCount;
    const failureCount = mobileResult.failureCount + webResult.failureCount;
    const failedTokens = [...mobileResult.failedTokens, ...webResult.failedTokens];

    console.log(
      `[NotificationService] FCM result user=${userId} type=${notifType} ` +
        `success=${successCount} fail=${failureCount}`,
    );

    if (failedTokens.length > 0) {
      await User.updateOne(
        { _id: userId },
        {
          $pull: {
            fcmTokensWeb: { $in: failedTokens },
            fcmTokensMobile: { $in: failedTokens },
          },
        },
      );
      console.log(`[NotificationService] Removed ${failedTokens.length} stale FCM tokens for user ${userId}`);
    }

    return {
      success: successCount > 0,
      sentCount: successCount,
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
      }),
    );

    return results;
  } catch (error) {
    console.error(`[NotificationService] Failed to multicast:`, error.message);
    return [];
  }
};
