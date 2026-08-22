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
let cachedToken = null;
let messagingReadyResolve;
const messagingReady = new Promise((resolve) => {
  messagingReadyResolve = resolve;
});

try {
  app = initializeApp(firebaseConfig);
} catch (e) {
  console.error("Firebase app initialization failed:", e);
}

isSupported()
  .then((supported) => {
    if (supported && app) {
      messaging = getMessaging(app);
      onMessage(messaging, (payload) => {
        console.log("Foreground message received:", payload);
        window.dispatchEvent(new CustomEvent('fcm-foreground-message', { detail: payload }));
      });
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

let swRegistrationPromise = null;

function getMessagingSwRegistration() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(undefined);
  }
  if (!swRegistrationPromise) {
    swRegistrationPromise = (async () => {
      try {
        const existing = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
        if (existing) return existing;
        return await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      } catch (err) {
        console.warn("FCM service worker registration failed:", err?.message || err);
        return navigator.serviceWorker.ready.catch(() => undefined);
      }
    })();
  }
  return swRegistrationPromise;
}

export const requestForToken = async ({ forceRefresh = false } = {}) => {
  try {
    if (!forceRefresh) {
      if (cachedToken) return cachedToken;
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('staffivaa_fcm_token');
        if (stored && stored.length > 20) {
          cachedToken = stored;
          return stored;
        }
      }
    }

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
      cachedToken = currentToken;
      console.log('[Push] FCM token ready:', currentToken.slice(0, 8) + '…' + currentToken.slice(-6));
      return currentToken;
    }
    console.log('[Push] No FCM token — notification permission may be missing.');
    return null;
  } catch (err) {
    console.warn("An error occurred while retrieving token: ", err?.message || err);
    return null;
  }
};

/** Invalidate this browser's FCM registration on logout */
export const revokeFcmToken = async () => {
  cachedToken = null;
  try {
    const readyMessaging = messaging || (await messagingReady);
    if (!readyMessaging) return;
    await deleteToken(readyMessaging);
  } catch (err) {
    console.warn("Could not revoke FCM token locally:", err?.message || err);
  }
};

export { messaging, app };
