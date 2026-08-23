export const USER_ROLES = {
  INDIVIDUAL: 'individual',
  CORPORATE: 'corporate',
  LABOUR: 'labour',
  CONTRACTOR: 'contractor',
  ADMIN: 'admin',
  ENTERPRISE: 'enterprise',
}

/**
 * Standardizes a role string to canonical role identifier.
 * Canonical roles: 'individual', 'labour', 'corporate', 'contractor', 'enterprise', 'admin'.
 * Aliases:
 * - 'user' -> 'individual'
 * - 'worker' -> 'labour'
 * - 'vendor' -> 'contractor'
 *
 * @param {string} role
 * @returns {string} canonical role or empty string
 */
export function normalizeRole(role) {
  if (!role || typeof role !== 'string') return ''
  const r = role.toLowerCase().trim()
  if (r === 'user' || r === 'individual') return USER_ROLES.INDIVIDUAL
  if (r === 'worker' || r === 'labour') return USER_ROLES.LABOUR
  if (r === 'vendor' || r === 'contractor') return USER_ROLES.CONTRACTOR
  if (r === 'corporate') return USER_ROLES.CORPORATE
  if (r === 'enterprise') return USER_ROLES.ENTERPRISE
  if (r === 'admin') return USER_ROLES.ADMIN
  return r
}

/**
 * Strictly checks whether two role strings represent the same role.
 * Returns false if either role is missing or invalid.
 *
 * @param {string} roleA
 * @param {string} roleB
 * @returns {boolean}
 */
export function isRoleMatch(roleA, roleB) {
  const normA = normalizeRole(roleA)
  const normB = normalizeRole(roleB)
  if (!normA || !normB) return false
  return normA === normB
}

/**
 * Maps a canonical role to its primary home route.
 * @param {string} role
 * @returns {string}
 */
export function getRoleHomePath(role) {
  const r = normalizeRole(role)
  switch (r) {
    case USER_ROLES.INDIVIDUAL:
      return '/app'
    case USER_ROLES.LABOUR:
      return '/app/jobs'
    case USER_ROLES.CORPORATE:
      return '/corporate'
    case USER_ROLES.CONTRACTOR:
      return '/vendor'
    case USER_ROLES.ENTERPRISE:
      return '/enterprise'
    case USER_ROLES.ADMIN:
      return '/admin'
    default:
      return '/auth'
  }
}
