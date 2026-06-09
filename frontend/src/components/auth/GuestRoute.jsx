import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { getRoleHomePath } from '../../lib/roleHomePath.js'
import { AppRouteLoader } from '../app/AppRouteLoader.jsx'

/**
 * Wraps public auth pages (e.g. /auth).
 * If the user is already authenticated, redirects them to their role home.
 * Otherwise renders children as-is.
 */
export function GuestRoute({ children }) {
  const { isAuthenticated, user, loading } = useAuth()

  if (loading) return <AppRouteLoader />

  if (isAuthenticated) {
    return <Navigate to={getRoleHomePath(user?.role)} replace />
  }

  return children
}
