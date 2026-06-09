import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { getRoleHomePath } from '../../lib/roleHomePath.js'
import { AppRouteLoader } from '../app/AppRouteLoader.jsx'

/**
 * Handles the root "/" route.
 * - Still loading  → spinner
 * - Not logged in  → redirect to /auth (login/signup)
 * - Logged in      → redirect to the user's role home (Landing Page for most roles)
 */
export function AuthRootRoute() {
  const { isAuthenticated, user, loading } = useAuth()

  if (loading) return <AppRouteLoader />

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  return <Navigate to={getRoleHomePath(user?.role)} replace />
}
