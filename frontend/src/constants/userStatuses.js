export const ACCOUNT_STATUSES = {
  ACTIVE: 'active',
  PENDING: 'pending_verification',
  HOLD: 'on_hold',
  SUSPENDED: 'suspended',
  BLOCKED: 'blocked',
  DELETED: 'deleted',
}

export const ACCOUNT_STATUS_LABELS = {
  [ACCOUNT_STATUSES.ACTIVE]: 'Active',
  [ACCOUNT_STATUSES.PENDING]: 'Pending Verification',
  [ACCOUNT_STATUSES.HOLD]: 'On Hold',
  [ACCOUNT_STATUSES.SUSPENDED]: 'Suspended',
  [ACCOUNT_STATUSES.BLOCKED]: 'Blocked',
  [ACCOUNT_STATUSES.DELETED]: 'Deleted',
}

export const ACCOUNT_STATUS_COLORS = {
  [ACCOUNT_STATUSES.ACTIVE]: 'bg-emerald-50 text-emerald-900 ring-emerald-200/80',
  [ACCOUNT_STATUSES.PENDING]: 'bg-yellow-50 text-yellow-900 ring-yellow-200/80',
  [ACCOUNT_STATUSES.HOLD]: 'bg-orange-50 text-orange-900 ring-orange-200/80',
  [ACCOUNT_STATUSES.SUSPENDED]: 'bg-blue-50 text-blue-900 ring-blue-200/80',
  [ACCOUNT_STATUSES.BLOCKED]: 'bg-rose-50 text-rose-900 ring-rose-200/80',
  [ACCOUNT_STATUSES.DELETED]: 'bg-slate-50 text-slate-900 ring-slate-200/80',
}

export const ACCOUNT_STATUS_DOT_COLORS = {
  [ACCOUNT_STATUSES.ACTIVE]: 'bg-emerald-500',
  [ACCOUNT_STATUSES.PENDING]: 'bg-yellow-500',
  [ACCOUNT_STATUSES.HOLD]: 'bg-orange-500',
  [ACCOUNT_STATUSES.SUSPENDED]: 'bg-blue-500',
  [ACCOUNT_STATUSES.BLOCKED]: 'bg-rose-500',
  [ACCOUNT_STATUSES.DELETED]: 'bg-slate-500',
}
