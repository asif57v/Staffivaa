/**
 * Bridge between the React WebView app and the Flutter wrapper.
 * Android/iOS notification shade is owned by the native FCM plugin — WebView
 * service workers do not reliably appear there when the app is backgrounded.
 */

/** Ask Flutter to show a system-tray notification. */
export function notifyNativeShell(title, body, data = {}) {
  if (typeof window === 'undefined' || !title) return false

  const payload = {
    type: 'showNotification',
    title: String(title),
    body: String(body || ''),
    data: data || {},
  }
  let sent = false

  const tryCall = (fn) => {
    try {
      fn()
      sent = true
    } catch {
      /* handler not present */
    }
  }

  const inapp = window.flutter_inappwebview
  if (inapp?.callHandler) {
    ;['showNotification', 'onFcmMessage', 'StaffivaaNotification'].forEach((name) => {
      tryCall(() => inapp.callHandler(name, payload))
    })
  }

  ;['StaffivaaNative', 'FlutterChannel', 'NotificationChannel'].forEach((key) => {
    const ch = window[key]
    if (ch?.postMessage) {
      tryCall(() => ch.postMessage(JSON.stringify(payload)))
    }
  })

  const handlers = window.webkit?.messageHandlers
  if (handlers) {
    ;['StaffivaaNative', 'FlutterChannel', 'showNotification'].forEach((key) => {
      if (handlers[key]?.postMessage) {
        tryCall(() => handlers[key].postMessage(payload))
      }
    })
  }

  try {
    window.dispatchEvent(new CustomEvent('staffivaa-show-native-notification', { detail: payload }))
  } catch {
    /* ignore */
  }

  return sent
}

export function isNativeShell() {
  if (typeof window === 'undefined') return false
  return Boolean(
    window.__STAFFIVAA_NATIVE_PUSH__ ||
      window.__STAFFIVAA_NATIVE_APP__ ||
      window.flutter_inappwebview ||
      window.FlutterChannel ||
      window.StaffivaaNative ||
      window.webkit?.messageHandlers?.StaffivaaNative ||
      window.webkit?.messageHandlers?.FlutterChannel,
  )
}
