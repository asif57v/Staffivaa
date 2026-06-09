import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'

/**
 * Restricts a route to specific `user.role` values (matches backend User.role enum).
 */
export function RoleRoute({ allow, children }) {
  const { user } = useAuth()
  if (!allow?.length || !user?.role || !allow.includes(user.role)) {
    return <Navigate to="/app" replace />
  }
  return children
}
