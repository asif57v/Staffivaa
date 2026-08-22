/**
 * Bridge between the web app and the Flutter wrapper.
 *
 * The React app runs inside a WebView. Android/iOS notification shade ("slider")
 * is owned by the native Flutter FCM plugin — WebView Notification / service
 * workers do not reliably appear there, especially when the app is backgrounded.
 *
 * Flutter should inject the native token after WebView load:
 *
 *   await controller.evaluateJavascript(source: '''
 *     window.__STAFFIVAA_NATIVE_PUSH__ = true;
 *     window.__STAFFIVAA_FCM_TOKEN__ = "$fcmToken";
 *     window.dispatchEvent(new CustomEvent("staffivaa-native-fcm-token", { detail: "$fcmToken" }));
 *   ''');
 *
 * And POST that same token to POST /users/me/fcm-token { deviceType: "mobile" }.
 * Create Android channel `high_importance_channel` (Importance.max) and show a
 * local notification from FirebaseMessaging.onMessage so the shade appears while
 * the app is in the foreground.
 */

function readGlobalToken() {
  if (typeof window === 'undefined') return null;
  return (
    window.__STAFFIVAA_FCM_TOKEN__ ||
    window.StaffivaaNativeFcmToken ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('staffivaa_native_fcm_token') : null) ||
    null
  );
}

export function isNativeShell() {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.__STAFFIVAA_NATIVE_PUSH__ ||
      window.flutter_inappwebview ||
      window.FlutterChannel ||
      window.StaffivaaNative ||
      window.webkit?.messageHandlers?.StaffivaaNative ||
      window.webkit?.messageHandlers?.FlutterChannel,
  );
}

export function isEmbeddedWebView() {
  if (isNativeShell()) return true;
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /\bwv\b/.test(ua) || /WebView/i.test(ua);
}

export function readNativeFcmToken() {
  const token = readGlobalToken();
  return typeof token === 'string' && token.trim() ? token.trim() : null;
}

/**
 * Ask Flutter to post a system-tray notification.
 * Matches common flutter_inappwebview / JavascriptChannel handler names.
 */
export function notifyNativeShell(title, body, data = {}) {
  if (typeof window === 'undefined' || !title) return false;

  const payload = {
    type: 'showNotification',
    title: String(title),
    body: String(body || ''),
    data: data || {},
  };
  let sent = false;

  const tryCall = (fn) => {
    try {
      fn();
      sent = true;
    } catch {
      /* handler not present */
    }
  };

  const inapp = window.flutter_inappwebview;
  if (inapp?.callHandler) {
    ;['showNotification', 'onFcmMessage', 'StaffivaaNotification'].forEach((name) => {
      tryCall(() => inapp.callHandler(name, payload));
    });
  }

  ;['StaffivaaNative', 'FlutterChannel', 'NotificationChannel'].forEach((key) => {
    const ch = window[key];
    if (ch?.postMessage) {
      tryCall(() => ch.postMessage(JSON.stringify(payload)));
    }
  });

  const handlers = window.webkit?.messageHandlers;
  if (handlers) {
    ;['StaffivaaNative', 'FlutterChannel', 'showNotification'].forEach((key) => {
      if (handlers[key]?.postMessage) {
        tryCall(() => handlers[key].postMessage(payload));
      }
    });
  }

  try {
    window.dispatchEvent(new CustomEvent('staffivaa-show-native-notification', { detail: payload }));
  } catch {
    /* ignore */
  }

  return sent;
}
