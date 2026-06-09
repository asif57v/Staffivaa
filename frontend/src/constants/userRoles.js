/** Keep in sync with backend `src/constants/roles.js` for Flutter parity */
export const USER_ROLES = {
  INDIVIDUAL: 'individual',
  CORPORATE: 'corporate',
  LABOUR: 'labour',
  CONTRACTOR: 'contractor',
  ADMIN: 'admin',
}

/** Same as backend `ROLE_LIST` */
export const ROLE_LIST = Object.values(USER_ROLES)

export const REGISTERABLE_ROLES = [
  USER_ROLES.INDIVIDUAL,
  USER_ROLES.CORPORATE,
  USER_ROLES.LABOUR,
  USER_ROLES.CONTRACTOR,
]

/** Mobile-first app roles — keep in sync with backend `src/constants/roles.js` (`APP_ROLES`) */
export const APP_ROLES = [
  USER_ROLES.INDIVIDUAL,
  USER_ROLES.CORPORATE,
  USER_ROLES.LABOUR,
  USER_ROLES.CONTRACTOR,
]

export const ROLE_LABELS = {
  [USER_ROLES.INDIVIDUAL]: 'Homeowner / Individual',
  [USER_ROLES.CORPORATE]: 'Corporate client',
  [USER_ROLES.LABOUR]: 'Labour / Worker',
  [USER_ROLES.CONTRACTOR]: 'Contractor / Vendor',
  [USER_ROLES.ADMIN]: 'Administrator',
}

/** Mirror backend `CORPORATE_STATUS` / `KYC_STATUS` for UI badges */
export const CORPORATE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}

export const KYC_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  FAILED: 'failed',
}
