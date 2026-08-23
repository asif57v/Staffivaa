import { useDispatch, useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import { clearSession, setCredentials } from '../store/slices/authSlice.js'
import { baseApi } from '../store/api/baseApi.js'
import { store } from '../store/index.js'
import { clearPushSyncState, FCM_NATIVE_TOKEN_KEY, FCM_TOKEN_KEY, readNativeFcmToken, syncPushToken } from '../lib/pushSync.js'
import { normalizeRole } from '../lib/roleUtils.js'

export function useAuth() {
  const dispatch = useDispatch()
  const { token, user, loading } = useSelector((s) => s.auth)

  return {
    token,
    user,
    loading,
    isAuthenticated: Boolean(token && user),
    applySession: (accessToken, nextUser) => {
      dispatch(baseApi.util.resetApiState())
      dispatch(setCredentials({ accessToken, user: nextUser }))

      syncPushToken({
        accessToken,
        role: nextUser?.role,
        userId: nextUser?._id,
        force: true,
      }).catch((err) => console.error('Failed to sync FCM token on login:', err))
    },
    logout: async () => {
      const activeToken = token || store.getState()?.auth?.token
      const currentUser = user || store.getState()?.auth?.user
      try {
        toast.dismiss()
        let fcmToken = typeof window !== 'undefined' ? (readNativeFcmToken() || localStorage.getItem(FCM_TOKEN_KEY)) : null

        if (!fcmToken && typeof window !== 'undefined' && 'Notification' in window) {
          try {
            const { requestForToken } = await import('../lib/firebase.js')
            fcmToken = await requestForToken()
          } catch (e) {
            console.warn('Could not fetch token during logout', e)
          }
        }

        if (activeToken) {
          const { apiClient } = await import('../api/http.js')
          await apiClient.post(
            '/users/me/fcm-token/remove',
            { 
              token: fcmToken || undefined, 
              clearAll: true,
              role: normalizeRole(currentUser?.role)
            },
            { headers: { Authorization: `Bearer ${activeToken}` } },
          ).catch(err => console.error('Failed to remove FCM token from backend:', err))
        }

        if (typeof window !== 'undefined' && 'Notification' in window) {
          try {
            const { revokeFcmToken } = await import('../lib/firebase.js')
            await revokeFcmToken()
          } catch (e) {
            console.warn('Could not revoke local FCM token:', e)
          }
        }
      } catch (err) {
        console.error('Failed to remove FCM token on logout', err)
      } finally {
        if (typeof window !== 'undefined') clearPushSyncState()
        toast.dismiss()
        dispatch(baseApi.util.resetApiState())
        dispatch(clearSession())
      }
    },
  }
}
