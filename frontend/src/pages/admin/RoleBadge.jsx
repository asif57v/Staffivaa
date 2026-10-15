import { ROLE_LABEL } from './deletedAccountShared.js'

export function RoleBadge({ role }) {
  return (
    <span className="inline-flex rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800 ring-1 ring-slate-200">
      {ROLE_LABEL[role] || role}
    </span>
  )
}
