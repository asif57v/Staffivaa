import { USER_ROLES } from '../constants/userRoles.js'

/** Get the specific application dashboard path for a role */
export function getRoleDashboardPath(role) {
  switch (role) {
    case USER_ROLES.ADMIN:
      return '/admin'
    case USER_ROLES.CORPORATE:
      return '/corporate'
    case USER_ROLES.CONTRACTOR:
      return '/vendor'
    case USER_ROLES.LABOUR:
    case USER_ROLES.INDIVIDUAL:
    default:
      return '/app'
  }
}

/** Post-login / root redirect target per role */
export function getRoleHomePath(role) {
  return getRoleDashboardPath(role)
}
