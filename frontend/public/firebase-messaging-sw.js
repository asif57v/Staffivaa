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

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const data = payload.data || {};
  const notificationTitle = data.title || payload.notification?.title || 'Staffivaa';
  const notificationBody = data.body || data.message || payload.notification?.body || '';
  const notifType = String(data.type || '').toUpperCase();
  const isJobAlert = notifType === 'NEW_ORDER' || notifType === 'BOOKING_CREATED';

  // If FCM already attached a `notification` payload, the browser may display it
  // automatically. Still call showNotification for data-only / OEM cases so the
  // tray is never empty on mobile Chrome.
  return self.registration.showNotification(notificationTitle, {
    body: notificationBody,
    icon: '/logo.png',
    badge: '/favicon.svg',
    tag: 'staffivaa-notif-' + String(data.relatedId || data.assignmentId || data.type || notificationTitle),
    renotify: true,
    requireInteraction: isJobAlert,
    data: {
      ...data,
      title: notificationTitle,
      body: notificationBody,
    },
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
