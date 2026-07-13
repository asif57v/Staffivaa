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

try {
  app = initializeApp(firebaseConfig);
} catch (e) {
  console.error("Firebase app initialization failed:", e);
}

// Only initialize messaging if supported (e.g., supported in browser, secure context)
isSupported().then((supported) => {
  if (supported && app) {
    messaging = getMessaging(app);
    onMessage(messaging, (payload) => {
      console.log("Foreground message received:", payload);
      
      // Directly show toast here to guarantee it works regardless of which shell is active
      import('react-hot-toast').then(({ default: toast }) => {
        if (payload?.notification?.title) {
          toast.success(`FCM: ${payload.notification.title}`, { duration: 5000, position: 'top-center' });
        }
      });

      window.dispatchEvent(new CustomEvent('fcm-foreground-message', { detail: payload }));
    });
  } else {
    console.warn("Firebase Messaging is not supported in this environment.");
  }
}).catch(console.error);

export const requestForToken = async () => {
  try {
    if (!messaging) {
      console.warn('Firebase messaging is not initialized.');
      return null;
    }
    
    // We do not delete the old token anymore, so the browser can cache it efficiently
    // This stops the extra API calls to Firebase and makes it instant.

    const currentToken = await getToken(messaging, { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY });
    if (currentToken) {
      console.log('FCM Token:', currentToken);
      return currentToken;
    } else {
      console.log('No registration token available. Request permission to generate one.');
      return null;
    }
  } catch (err) {
    console.warn('An error occurred while retrieving token: ', err?.message || err);
    // Returning null allows the app to continue working without push notifications
    return null;
  }
};

export { messaging, app };
