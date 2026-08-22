/**
 * The same React build is served as a website and loaded inside the Flutter
 * WebView wrapper. The backend stores FCM tokens in two separate buckets
 * (`fcmTokensWeb` / `fcmTokensMobile`), so every upload has to declare which
 * shell it came from — otherwise both platforms land in the same bucket.
 */

const NATIVE_FLAG_KEY = 'staffivaa_native_app'

function readPersistedNativeFlag() {
  try {
    return localStorage.getItem(NATIVE_FLAG_KEY) === '1'
  } catch {
    return false
  }
}

function persistNativeFlag() {
  try {
    localStorage.setItem(NATIVE_FLAG_KEY, '1')
  } catch {
    /* private mode / storage disabled */
  }
}

/** Globals and message channels injected by the Flutter wrapper. */
function hasNativeBridge() {
  return Boolean(
    window.__STAFFIVAA_NATIVE_APP__ ||
      window.__STAFFIVAA_NATIVE_PUSH__ ||
      window.flutter_inappwebview ||
      window.FlutterChannel ||
      window.StaffivaaNative ||
      window.webkit?.messageHandlers?.StaffivaaNative ||
      window.webkit?.messageHandlers?.FlutterChannel,
  )
}

/** Wrapper can also mark itself via the URL, e.g. `?platform=app`. */
function hasNativeUrlMarker() {
  const target = `${window.location.search}${window.location.hash}`
  return /[?&#](platform|shell|client)=(app|native|mobile|flutter)\b/i.test(target)
}

/**
 * Android WebView tags its user agent with `wv`; iOS WKWebView drops the
 * `Safari` token that mobile Safari and Chrome/Firefox on iOS always send.
 */
function isWebViewUserAgent() {
  const ua = navigator.userAgent || ''
  if (/\bwv\b|WebView|Flutter|Dart|okhttp/i.test(ua)) return true
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return !/Safari|CriOS|FxiOS|EdgiOS/i.test(ua)
  }
  return false
}

/** True only inside the Flutter app shell — a phone browser is still "web". */
export function isNativeAppShell() {
  if (typeof window === 'undefined') return false

  if (hasNativeBridge() || hasNativeUrlMarker()) {
    persistNativeFlag()
    return true
  }
  // Flutter injects its globals after the first paint, so an early sync could
  // otherwise classify the wrapper as a browser on subsequent reloads.
  if (readPersistedNativeFlag()) return true

  if (isWebViewUserAgent()) {
    persistNativeFlag()
    return true
  }
  return false
}

/** Value for the `deviceType` field of POST /users/me/fcm-token. */
export function resolvePushDeviceType() {
  return isNativeAppShell() ? 'mobile' : 'web'
}
