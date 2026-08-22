import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported, deleteToken } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

let app;
let messaging;
let messagingReadyResolve;
const messagingReady = new Promise((resolve) => {
  messagingReadyResolve = resolve;
});

try {
  app = initializeApp(firebaseConfig);
} catch (e) {
  console.error("Firebase app initialization failed:", e);
}

function extractPushCopy(payload) {
  const data = payload?.data || {};
  const title = data.title || payload?.notification?.title || "";
  const body = data.body || data.message || payload?.notification?.body || "";
  return { title, body, data };
}

function handleForegroundPayload(payload) {
  const { title, body, data } = extractPushCopy(payload);
  console.log('[Push/Client] FOREGROUND_RX | type=' + (data?.type || 'GENERAL') + ' | title=' + String(title).slice(0, 40));
  window.dispatchEvent(new CustomEvent("fcm-foreground-message", { detail: payload }));

  if (!title) {
    console.warn('[Push/Client] FOREGROUND_SKIP | reason=no title');
    return;
  }

  import("./pushNotifications.js")
    .then(({ presentPushOnDevice }) => presentPushOnDevice(title, body, data))
    .catch((err) => console.warn('[Push/Client] PRESENT_IMPORT_FAIL |', err?.message || err));
}

isSupported()
  .then((supported) => {
    if (supported && app) {
      messaging = getMessaging(app);
      onMessage(messaging, handleForegroundPayload);
      messagingReadyResolve(messaging);
    } else {
      console.warn("Firebase Messaging is not supported in this environment.");
      messagingReadyResolve(null);
    }
  })
  .catch((err) => {
    console.error(err);
    messagingReadyResolve(null);
  });

async function getMessagingSwRegistration() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return undefined;
  try {
    const existing = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
    if (existing) return existing;
    return await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  } catch (err) {
    console.warn("FCM service worker registration failed:", err?.message || err);
    return navigator.serviceWorker.ready.catch(() => undefined);
  }
}

export const requestForToken = async () => {
  try {
    const readyMessaging = messaging || (await messagingReady);
    if (!readyMessaging) {
      console.warn("Firebase messaging is not initialized.");
      return null;
    }

    const serviceWorkerRegistration = await getMessagingSwRegistration();

    const currentToken = await getToken(readyMessaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration,
    });
    if (currentToken) {
      console.log('[Push/Client] FCM_TOKEN_OK | token=' + currentToken.slice(0, 8) + '…' + currentToken.slice(-6));
      return currentToken;
    }
    console.log('[Push/Client] FCM_TOKEN_NONE | Request permission to generate one.');
    return null;
  } catch (err) {
    console.warn("An error occurred while retrieving token: ", err?.message || err);
    return null;
  }
};

/** Invalidate this browser's FCM registration on logout */
export const revokeFcmToken = async () => {
  try {
    const readyMessaging = messaging || (await messagingReady);
    if (!readyMessaging) return;
    await deleteToken(readyMessaging);
  } catch (err) {
    console.warn("Could not revoke FCM token locally:", err?.message || err);
  }
};

export { messaging, app };
