import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { USER_ROLES } from '../../constants/userRoles.js'
import { getRoleHomePath } from '../../lib/roleHomePath.js'
import { IndividualHomeScreen } from './home/IndividualHomeScreen.jsx'
import { LabourHomeScreen } from './home/LabourHomeScreen.jsx'

export function AppHomePage() {
  const { user } = useAuth()

  const labourCategories = user?.labourProfile?.categoryIds
  const needsWorkCategories =
    user?.role === USER_ROLES.LABOUR && !(Array.isArray(labourCategories) && labourCategories.length > 0)

  if (needsWorkCategories) {
    return <Navigate to="/app/work-categories" replace />
  }

  if (user?.role === USER_ROLES.INDIVIDUAL) {
    return <IndividualHomeScreen user={user} />
  }

  if (user?.role === USER_ROLES.LABOUR) {
    return <LabourHomeScreen user={user} />
  }

  return <Navigate to={getRoleHomePath(user?.role)} replace />
}
