import { getMessaging } from 'firebase-admin/messaging';
import { User } from '../models/User.js';

/**
 * Use the stock Android "default" channel — same as the working test push and
 * accept/KYC/cancel pushes. Custom channels (high_importance_channel /
 * new_job_order) often do not exist on the device, so FCM reports "sent" while
 * the Android tray stays silent. That is why NEW_ORDER was skipped on mobile
 * while accept pushes (often shown while the app is foregrounded via Flutter
 * local notifications) still appeared.
 */
const ANDROID_CHANNEL_ID = 'default';
const FCM_BATCH_SIZE = 500;

function uniqueTokens(list = []) {
  return [...new Set((list || []).filter((t) => typeof t === 'string' && t.trim()))];
}

function publicOrigin() {
  return (
    process.env.PUBLIC_APP_URL ||
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    process.env.APP_URL ||
    ''
  ).replace(/\/$/, '');
}

function assetUrl(path) {
  const origin = publicOrigin();
  if (!origin) return path;
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

function truncate(text, max = 160) {
  const s = String(text || '');
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
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
      // Never re-introduce the broken custom job channel/sound.
      if (
        (key === 'sound' || key === 'sound_name' || key === 'soundName' || key === 'channel_id' || key === 'channelId' || key === 'android_channel_id') &&
        /new_job_order|high_importance/i.test(String(data[key]))
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

function webPushBlock(safeTitle, safeBody, stringifiedData) {
  return {
    headers: { Urgency: 'high', TTL: '86400' },
    notification: {
      title: safeTitle,
      body: safeBody,
      icon: assetUrl('/logo.png'),
      badge: assetUrl('/favicon.svg'),
      requireInteraction: true,
    },
    fcmOptions: {
      link: stringifiedData.url || '/',
    },
  };
}

/** Match the proven sendTestNotification android shape. */
function androidBlock(safeTitle, safeBody, notifType, stringifiedData = {}) {
  const jobKey = stringifiedData.assignmentId || stringifiedData.relatedId || String(Date.now())
  return {
    priority: 'high',
    ttl: 86400000,
    // Unique per job so OEM trays do not silently collapse consecutive NEW_ORDER pushes.
    collapseKey: notifType === 'NEW_ORDER' ? `new_order_${jobKey}` : String(notifType || 'general'),
    notification: {
      title: safeTitle,
      body: safeBody,
      sound: 'default',
      channelId: ANDROID_CHANNEL_ID,
      defaultSound: true,
      defaultVibrateTimings: true,
      priority: 'high',
      visibility: 'public',
      clickAction: 'FLUTTER_NOTIFICATION_CLICK',
    },
  };
}

function apnsBlock(safeTitle, safeBody) {
  return {
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
  };
}

async function sendBatches(messageFactory, tokens, userId, notifType, channel) {
  if (!tokens.length) {
    return { successCount: 0, failureCount: 0, failedTokens: [] };
  }

  console.log(
    `[NotificationService] FCM batch ${channel} user=${userId} type=${notifType} tokens=${tokens.length}`,
  );

  let successCount = 0;
  let failureCount = 0;
  const failedTokens = [];

  for (let i = 0; i < tokens.length; i += FCM_BATCH_SIZE) {
    const batch = tokens.slice(i, i + FCM_BATCH_SIZE);
    const response = await getMessaging().sendEachForMulticast(messageFactory(batch));

    successCount += response.successCount;
    failureCount += response.failureCount;

    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        console.warn(
          `[NotificationService] FCM fail ${channel} token#${idx} type=${notifType}:`,
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
      }
    });
  }

  console.log(
    `[NotificationService] FCM batch done ${channel} user=${userId} type=${notifType} ok=${successCount} fail=${failureCount}`,
  );

  return { successCount, failureCount, failedTokens };
}

/**
 * Send push to a user.
 * NEW_ORDER uses the same android "default" channel as accept/test pushes so the
 * mobile tray is not silently dropped when the Flutter app is backgrounded.
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

    if (mobileTokens.length === 0 && webTokens.length === 0) {
      console.log(`[NotificationService] No FCM tokens for user ${userId} (${user.role || 'user'})`);
      return { success: false, sentCount: 0, failedTokens: [] };
    }

    const { notifType, stringifiedData } = stringifyData(title, body, userId, recipientRole, data);
    // Tray text: keep short. Full address stays in data.locationText for the app UI.
    const safeTitle = truncate(title, 65);
    const safeBody = truncate(body, 160);

    console.log(
      `[NotificationService] Sending type=${notifType} to user=${userId} mobile=${mobileTokens.length} web=${webTokens.length} title="${safeTitle}"`,
    );

    const mobileResult = await sendBatches(
      (batch) => ({
        notification: { title: safeTitle, body: safeBody },
        data: stringifiedData,
        android: androidBlock(safeTitle, safeBody, notifType, stringifiedData),
        apns: apnsBlock(safeTitle, safeBody),
        webpush: webPushBlock(safeTitle, safeBody, stringifiedData),
        tokens: batch,
      }),
      mobileTokens,
      userId,
      notifType,
      'mobile',
    );

    const webResult = await sendBatches(
      (batch) => ({
        notification: { title: safeTitle, body: safeBody },
        data: stringifiedData,
        android: androidBlock(safeTitle, safeBody, notifType, stringifiedData),
        webpush: webPushBlock(safeTitle, safeBody, stringifiedData),
        tokens: batch,
      }),
      webTokens,
      userId,
      notifType,
      'web',
    );

    const successCount = mobileResult.successCount + webResult.successCount;
    const failedTokens = [...mobileResult.failedTokens, ...webResult.failedTokens];

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
      console.log(`[NotificationService] Removed ${failedTokens.length} stale tokens for user ${userId}`);
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
