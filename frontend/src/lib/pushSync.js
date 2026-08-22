import { apiClient } from '../api/http.js'
import { store } from '../store/index.js'
import { requestForToken } from './firebase.js'
import { isNativeAppShell, resolvePushDeviceType } from './pushPlatform.js'

export const FCM_TOKEN_KEY = 'staffivaa_fcm_token'
export const FCM_NATIVE_TOKEN_KEY = 'staffivaa_native_fcm_token'
export const FCM_ROLE_KEY = 'staffivaa_fcm_role'
const FCM_LAST_SYNC_KEY = 'staffivaa_fcm_last_sync'

let syncInFlight = null

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

async function runSyncPushToken({ accessToken, role, userId, force = false } = {}) {
  if (typeof window === 'undefined') return null

  const resolvedUserId = userId ?? store.getState()?.auth?.user?._id ?? null
  const deviceType = resolvePushDeviceType()
  const nativeToken = readNativeFcmToken()

  if (nativeToken) {
    persistLocalToken(nativeToken, { role, native: true })
    if (shouldUpload(nativeToken, deviceType, resolvedUserId, force)) {
      await uploadToken(nativeToken, deviceType, accessToken, resolvedUserId)
    }
    return nativeToken
  }

  if (isNativeAppShell()) return null

  if (!('Notification' in window)) return null

  let permission = Notification.permission
  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }
  if (permission !== 'granted') return null

  const webToken = await requestForToken({ forceRefresh: force })
  if (!webToken) return null

  persistLocalToken(webToken, { role, native: false })
  if (shouldUpload(webToken, deviceType, resolvedUserId, force)) {
    await uploadToken(webToken, deviceType, accessToken, resolvedUserId)
  }
  return webToken
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
    localStorage.setItem(FCM_NATIVE_TOKEN_KEY, token.trim())
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
