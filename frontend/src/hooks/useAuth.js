import { useDispatch, useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import { clearSession, setCredentials } from '../store/slices/authSlice.js'
import { baseApi } from '../store/api/baseApi.js'

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
    },
    logout: async () => {
      try {
        toast.dismiss()
        if (typeof window !== 'undefined' && 'Notification' in window) {
          const { requestForToken } = await import('../lib/firebase.js')
          const fcmToken = await requestForToken()
          if (fcmToken) {
            const { apiClient } = await import('../api/http.js')
            await apiClient.post('/users/me/fcm-token/remove', { token: fcmToken })
          }
        }
      } catch (err) {
        console.error('Failed to remove FCM token on logout', err)
      } finally {
        toast.dismiss()
        dispatch(baseApi.util.resetApiState())
        dispatch(clearSession())
      }
    },
  }
}
