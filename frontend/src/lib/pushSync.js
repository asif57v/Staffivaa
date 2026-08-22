import { apiClient } from '../api/http.js'
import { store } from '../store/index.js'
import { requestForToken } from './firebase.js'
import { isNativeAppShell } from './pushPlatform.js'

export const FCM_TOKEN_KEY = 'staffivaa_fcm_token'
export const FCM_NATIVE_TOKEN_KEY = 'staffivaa_native_fcm_token'
export const FCM_ROLE_KEY = 'staffivaa_fcm_role'
const FCM_LAST_SYNC_KEY = 'staffivaa_fcm_last_sync'

let syncInFlight = null

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Globals Flutter injects into the WebView after load. */
export function readNativeFcmToken() {
  if (typeof window === 'undefined') return null
  const token =
    window.__STAFFIVAA_FCM_TOKEN__ ||
    window.StaffivaaNativeFcmToken ||
    localStorage.getItem(FCM_NATIVE_TOKEN_KEY) ||
    null
  return typeof token === 'string' && token.trim() ? token.trim() : null
}

/** Flutter often injects the token a moment after WebView login — wait briefly. */
async function waitForNativeFcmToken({ timeoutMs = 12000, intervalMs = 500 } = {}) {
  const existing = readNativeFcmToken()
  if (existing) return existing

  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    await sleep(intervalMs)
    const token = readNativeFcmToken()
    if (token) return token
  }
  return null
}

function persistLocalToken(token, { role, native } = {}) {
  localStorage.setItem(FCM_TOKEN_KEY, token)
  if (native) localStorage.setItem(FCM_NATIVE_TOKEN_KEY, token)
  if (role) localStorage.setItem(FCM_ROLE_KEY, role)
}

function readLastSync() {
  try {
    const raw = localStorage.getItem(FCM_LAST_SYNC_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function markSynced(token, deviceType, userId) {
  localStorage.setItem(
    FCM_LAST_SYNC_KEY,
    JSON.stringify({ token, deviceType, userId: userId ? String(userId) : null }),
  )
}

function resolveAuthToken(explicitToken) {
  return explicitToken || store.getState()?.auth?.token || null
}

function shouldUpload(token, deviceType, userId, force) {
  if (force) return true
  const last = readLastSync()
  if (!last) return true
  const uid = userId ? String(userId) : null
  return last.token !== token || last.deviceType !== deviceType || last.userId !== uid
}

async function uploadToken(token, deviceType, accessToken, userId) {
  const authToken = resolveAuthToken(accessToken)
  if (!authToken) {
    console.warn('[Push] Backend sync skipped — auth token not ready yet')
    return false
  }

  try {
    const res = await apiClient.post(
      '/users/me/fcm-token',
      { token, deviceType },
      { headers: { Authorization: `Bearer ${authToken}` } },
    )
    const body = res.data
    if (body?.success !== true) {
      throw new Error(body?.message || 'FCM save rejected by server')
    }

    const saved = body?.data || {}
    markSynced(token, deviceType, userId)
    console.log(
      '[Push] Token saved to backend | field=' + (saved.field || deviceType) +
      ' | userId=' + (saved.userId || userId || '?') +
      ' | webCount=' + (saved.webCount ?? '?') +
      ' | mobileCount=' + (saved.mobileCount ?? '?'),
    )
    return true
  } catch (err) {
    console.error('[Push] Backend sync failed:', err?.response?.data?.message || err?.message || err)
    return false
  }
}

async function syncNativeToken({ accessToken, role, userId, force = false } = {}) {
  let nativeToken = readNativeFcmToken()
  if (!nativeToken && isNativeAppShell()) {
    console.log('[Push] Waiting for Flutter native FCM token…')
    nativeToken = await waitForNativeFcmToken()
  }
  if (!nativeToken) return null

  // Native Flutter tokens always belong in the mobile bucket.
  const deviceType = 'mobile'
  persistLocalToken(nativeToken, { role, native: true })
  if (shouldUpload(nativeToken, deviceType, userId, force)) {
    await uploadToken(nativeToken, deviceType, accessToken, userId)
  }
  return nativeToken
}

async function syncWebToken({ accessToken, role, userId, force = false, deviceType } = {}) {
  if (!('Notification' in window)) {
    console.warn('[Push] Notification API unavailable on this device')
    return null
  }

  let permission = Notification.permission
  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }
  if (permission !== 'granted') {
    console.warn('[Push] Notification permission not granted:', permission)
    return null
  }

  const webToken = await requestForToken({ forceRefresh: force })
  if (!webToken) {
    console.warn('[Push] Firebase returned no web FCM token')
    return null
  }

  // Firebase JS tokens are always web tokens — never store them as mobile,
  // even inside a WebView fallback (native Flutter tokens use syncNativeToken).
  const resolvedDeviceType = deviceType || 'web'
  persistLocalToken(webToken, { role, native: false })
  if (shouldUpload(webToken, resolvedDeviceType, userId, force)) {
    await uploadToken(webToken, resolvedDeviceType, accessToken, userId)
  }
  return webToken
}

async function runSyncPushToken({ accessToken, role, userId, force = false } = {}) {
  if (typeof window === 'undefined') return null

  const resolvedUserId = userId ?? store.getState()?.auth?.user?._id ?? null
  const inNativeShell = isNativeAppShell()

  // Prefer Flutter native token (shows in Android/iOS shade when app is backgrounded).
  const nativeToken = await syncNativeToken({
    accessToken,
    role,
    userId: resolvedUserId,
    force,
  })
  if (nativeToken) return nativeToken

  // Flutter WebView without a native token yet: still try web FCM so the device
  // is not left with zero tokens. When Flutter injects later, listenForNativeFcmToken
  // will re-sync into fcmTokensMobile.
  if (inNativeShell) {
    console.warn('[Push] Native shell has no Flutter FCM token yet — falling back to web FCM')
  }

  return syncWebToken({
    accessToken,
    role,
    userId: resolvedUserId,
    force,
    // Phone Chrome / desktop browser / WebView fallback → always web bucket
    deviceType: 'web',
  })
}

/**
 * Register the current device's FCM token with the backend.
 * Concurrent calls share one in-flight request so Firebase is not re-registered.
 */
export async function syncPushToken(options = {}) {
  if (syncInFlight) return syncInFlight
  syncInFlight = runSyncPushToken(options).finally(() => {
    syncInFlight = null
  })
  return syncInFlight
}

/** Re-sync when Flutter injects its token after the first paint. */
export function listenForNativeFcmToken(onToken) {
  if (typeof window === 'undefined') return () => {}

  const handle = (event) => {
    const token = typeof event.detail === 'string' ? event.detail : event.detail?.token
    if (!token || typeof token !== 'string') return
    window.__STAFFIVAA_FCM_TOKEN__ = token.trim()
    window.__STAFFIVAA_NATIVE_PUSH__ = true
    window.__STAFFIVAA_NATIVE_APP__ = true
    localStorage.setItem(FCM_NATIVE_TOKEN_KEY, token.trim())
    localStorage.setItem('staffivaa_native_app', '1')
    onToken?.(token.trim())
  }

  window.addEventListener('staffivaa-native-fcm-token', handle)
  return () => window.removeEventListener('staffivaa-native-fcm-token', handle)
}

export function clearPushSyncState() {
  localStorage.removeItem(FCM_TOKEN_KEY)
  localStorage.removeItem(FCM_NATIVE_TOKEN_KEY)
  localStorage.removeItem(FCM_ROLE_KEY)
  localStorage.removeItem(FCM_LAST_SYNC_KEY)
}
