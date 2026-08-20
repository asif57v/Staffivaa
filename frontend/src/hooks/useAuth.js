import { useDispatch, useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import { clearSession, setCredentials } from '../store/slices/authSlice.js'
import { baseApi } from '../store/api/baseApi.js'
import { store } from '../store/index.js'

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

      if (typeof window !== 'undefined' && 'Notification' in window) {
        import('../lib/firebase.js').then(({ requestForToken }) => {
          requestForToken().then((fcmToken) => {
            if (fcmToken) {
              localStorage.setItem('staffivaa_fcm_token', fcmToken);
              import('../api/http.js').then(({ apiClient }) => {
                apiClient.post('/users/me/fcm-token', { token: fcmToken, deviceType: 'web' }, {
                  headers: { Authorization: `Bearer ${accessToken}` }
                }).catch(err => console.error('Failed to sync FCM token on login:', err));
              });
            }
          }).catch(err => console.error('Failed to request token on login:', err));
        }).catch(err => console.error('Failed to load firebase lib on login:', err));
      }
    },
    logout: async () => {
      const activeToken = token || store.getState()?.auth?.token
      try {
        toast.dismiss()
        let fcmToken = typeof window !== 'undefined' ? localStorage.getItem('staffivaa_fcm_token') : null

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
            { token: fcmToken || undefined, clearAll: true },
            { headers: { Authorization: `Bearer ${activeToken}` } }
          ).catch(err => console.error('Failed to remove FCM token from backend:', err))
        }
      } catch (err) {
        console.error('Failed to remove FCM token on logout', err)
      } finally {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('staffivaa_fcm_token')
        }
        toast.dismiss()
        dispatch(baseApi.util.resetApiState())
        dispatch(clearSession())
      }
    },
  }
}
