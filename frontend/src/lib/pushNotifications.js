import { apiClient } from '../api/http.js';
import {
  isEmbeddedWebView,
  isNativeShell,
  notifyNativeShell,
  readNativeFcmToken,
  resolvePushDeviceType,
} from './nativePushBridge.js';

function clientPushLog(step, details = {}) {
  const extra = Object.entries(details)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .join(' | ');
  console.log(`[Push/Client] ${step}${extra ? ` | ${extra}` : ''}`);
}

function tokenPreview(token) {
  if (!token || typeof token !== 'string') return 'none';
  const t = token.trim();
  if (t.length <= 12) return t;
  return `${t.slice(0, 8)}…${t.slice(-6)}`;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function saveToken(token, deviceType, accessToken) {
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
  await apiClient.post(
    '/users/me/fcm-token',
    { token, deviceType },
    headers ? { headers } : undefined,
  );
}

/**
 * Show a system / shade notification from a foreground FCM payload.
 * Order: Flutter native bridge → service worker → Notification constructor.
 */
export async function presentPushOnDevice(title, body, data = {}) {
  if (!title) return;

  const notifType = String(data?.type || '').toUpperCase();
  clientPushLog('PRESENT_START', { type: notifType || 'GENERAL', title: String(title).slice(0, 40) });

  if (typeof window !== 'undefined') {
    const rawKey = String(title) + '_' + String(body || '');
    const dedupeKey = rawKey.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const isJobAlert =
      notifType === 'NEW_ORDER' ||
      notifType === 'BOOKING_CANCELLED' ||
      notifType === 'BOOKING_UPDATED' ||
      notifType === 'BOOKING_CREATED' ||
      notifType === 'SYSTEM_ALERT';

    window._lastPushShown = window._lastPushShown || {};
    const now = Date.now();
    if (
      !isJobAlert &&
      window._lastPushShown[dedupeKey] &&
      now - window._lastPushShown[dedupeKey] < 8000
    ) {
      clientPushLog('PRESENT_SKIP_DEDUPE', { type: notifType });
      return;
    }
    window._lastPushShown[dedupeKey] = now;
  }

  notifyNativeShell(title, body, data);

  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const options = {
    body: body || '',
    icon: '/logo.png',
    badge: '/favicon.svg',
    tag: 'staffivaa-notif-' + String(data?.relatedId || data?.type || title),
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [200, 100, 200],
    data: data || {},
  };

  let shown = false;
  if ('serviceWorker' in navigator) {
    try {
      const registration = await withTimeout(navigator.serviceWorker.ready, 1500);
      await registration.showNotification(title, options);
      shown = true;
      clientPushLog('PRESENT_OK', { via: 'serviceWorker', type: notifType });
    } catch (err) {
      console.warn('[Push/Client] PRESENT_SW_FAIL |', err?.message || err);
    }
  }

  // Chrome blocks `new Notification()` while the tab is focused; WebView often
  // does the opposite (SW never becomes ready). Try constructor as fallback.
  if (!shown) {
    try {
      new Notification(title, options);
      clientPushLog('PRESENT_OK', { via: 'constructor', type: notifType });
    } catch (err) {
      console.warn('[Push/Client] PRESENT_CONSTRUCTOR_FAIL |', err?.message || err);
    }
  }
}

/**
 * Register native Flutter token + web FCM token with the backend.
 */
export async function syncPushToken({ accessToken, role } = {}) {
  if (typeof window === 'undefined') return null;

  clientPushLog('SYNC_START', { role: role || 'unknown' });

  const nativeToken = readNativeFcmToken();
  if (nativeToken) {
    try {
      localStorage.setItem('staffivaa_native_fcm_token', nativeToken);
      localStorage.setItem('staffivaa_fcm_token', nativeToken);
      if (role) localStorage.setItem('staffivaa_fcm_role', role);
      await saveToken(nativeToken, 'mobile', accessToken);
      clientPushLog('SYNC_NATIVE_OK', { token: tokenPreview(nativeToken), field: 'fcmTokensMobile' });
    } catch (err) {
      console.error('[Push/Client] SYNC_NATIVE_FAIL |', err);
    }
  }

  // Inside the Flutter WebView, web FCM tokens do not populate the Android
  // notification slider once the WebView is paused. Prefer the native token.
  if ((isNativeShell() || isEmbeddedWebView()) && nativeToken) {
    clientPushLog('SYNC_DONE', { source: 'native-webview', token: tokenPreview(nativeToken) });
    return nativeToken;
  }

  if (!('Notification' in window)) {
    clientPushLog('SYNC_SKIP', { reason: 'Notification API unavailable' });
    return nativeToken;
  }

  try {
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
      clientPushLog('SYNC_SKIP', { reason: 'permission denied', permission });
      return nativeToken;
    }

    const { requestForToken } = await import('./firebase.js');
    const webToken = await requestForToken();
    if (!webToken) {
      clientPushLog('SYNC_SKIP', { reason: 'no web token from Firebase' });
      return nativeToken;
    }

    localStorage.setItem('staffivaa_fcm_token', webToken);
    if (role) localStorage.setItem('staffivaa_fcm_role', role);
    const deviceType = resolvePushDeviceType();
    await saveToken(webToken, deviceType, accessToken);
    clientPushLog('SYNC_WEB_OK', {
      token: tokenPreview(webToken),
      deviceType,
      field: deviceType === 'mobile' ? 'fcmTokensMobile' : 'fcmTokensWeb',
    });
    clientPushLog('SYNC_DONE', { source: 'web', deviceType });
    return webToken;
  } catch (err) {
    console.error('[Push/Client] SYNC_FAIL |', err);
    return nativeToken;
  }
}

export function listenForNativeFcmToken(onToken) {
  if (typeof window === 'undefined') return () => {};

  const handle = (event) => {
    const token = typeof event.detail === 'string' ? event.detail : event.detail?.token;
    if (token) {
      window.__STAFFIVAA_FCM_TOKEN__ = token;
      window.__STAFFIVAA_NATIVE_PUSH__ = true;
      localStorage.setItem('staffivaa_native_fcm_token', token);
      onToken?.(token);
    }
  };

  window.addEventListener('staffivaa-native-fcm-token', handle);
  return () => window.removeEventListener('staffivaa-native-fcm-token', handle);
}
