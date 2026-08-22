importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBIc8dsHcFe8PlzE3N8fC9bUlao4_Q_4Jo",
  authDomain: "staffivaa-e85a7.firebaseapp.com",
  projectId: "staffivaa-e85a7",
  storageBucket: "staffivaa-e85a7.firebasestorage.app",
  messagingSenderId: "344482651701",
  appId: "1:344482651701:web:7008da6739d48e0a931b7c",
  measurementId: "G-7EVWEG0LZ3"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

function readPushCopy(payload) {
  const data = payload.data || {};
  const title =
    data.title ||
    payload.notification?.title ||
    payload.webpush?.notification?.title ||
    'Staffivaa';
  const body =
    data.body ||
    data.message ||
    payload.notification?.body ||
    payload.webpush?.notification?.body ||
    '';
  return { title, body, data };
}

messaging.onBackgroundMessage(function(payload) {
  const { title, body, data } = readPushCopy(payload);
  console.log('[Push/SW] BACKGROUND_RX | type=' + (data.type || 'GENERAL') + ' | title=' + String(title).slice(0, 40));

  if (!title && !body) {
    console.warn('[Push/SW] BACKGROUND_SKIP | reason=empty title and body');
    return;
  }

  const notifType = String(data.type || '').toUpperCase();
  const isJobAlert =
    notifType === 'NEW_ORDER' ||
    notifType === 'BOOKING_CANCELLED' ||
    notifType === 'BOOKING_UPDATED' ||
    notifType === 'BOOKING_CREATED';

  const notificationOptions = {
    body: body,
    icon: '/logo.png',
    badge: '/favicon.svg',
    tag: 'staffivaa-notif-' + String(data.relatedId || data.type || title),
    renotify: true,
    requireInteraction: isJobAlert,
    data: { ...data, title, body },
  };

  // Always show from service worker — data.title/data.body are always set by backend.
  // Relying only on FCM auto-display fails for some mobile-browser payloads (NEW_ORDER etc.)
  // while SYSTEM_ALERT test appears to work.
  return self.registration.showNotification(title, notificationOptions).then(function() {
    console.log('[Push/SW] BACKGROUND_SHOWN | type=' + (data.type || 'GENERAL'));
  });
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NAVIGATE_TO_URL',
            url: targetUrl
          });
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
