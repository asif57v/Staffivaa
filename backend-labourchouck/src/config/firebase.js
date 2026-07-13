import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

export const initializeFirebaseAdmin = () => {
  try {
    if (getApps().length === 0) {
      let credentialConfig;
      
      // If the path is provided and ends with .json, use it. Otherwise, use the explicit variables.
      const servicePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
      if (servicePath && servicePath.endsWith('.json')) {
        credentialConfig = cert(servicePath);
      } else {
        credentialConfig = cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        });
      }

      initializeApp({
        credential: credentialConfig,
      });

      console.log("Firebase Admin SDK initialized successfully.");
    }
  } catch (err) {
    console.error("Failed to initialize Firebase Admin SDK:", err.message);
  }
};

export { getMessaging, getApps };