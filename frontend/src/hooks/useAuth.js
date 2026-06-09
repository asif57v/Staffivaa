import { useDispatch, useSelector } from 'react-redux'
import { clearSession, setCredentials } from '../store/slices/authSlice.js'

export function useAuth() {
  const dispatch = useDispatch()
  const { token, user, loading } = useSelector((s) => s.auth)

  return {
    token,
    user,
    loading,
    isAuthenticated: Boolean(token && user),
    applySession: (accessToken, nextUser) =>
      dispatch(setCredentials({ accessToken, user: nextUser })),
    logout: () => dispatch(clearSession()),
  }
}
