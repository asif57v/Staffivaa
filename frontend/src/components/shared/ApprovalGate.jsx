import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { AppSurface } from '../app-ui/cards/AppSurface.jsx'
import { AppPrimaryButton } from '../app/AppPrimaryButton.jsx'

export function ApprovalGate({ title, message, profileTo }) {
  return (
    <AppSurface className="border-amber-200/90 bg-amber-50/50">
      <div className="flex gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
          <ShieldAlert className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-base font-extrabold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{message}</p>
          <Link to={profileTo} className="mt-4 inline-block">
            <AppPrimaryButton type="button">Complete verification</AppPrimaryButton>
          </Link>
        </div>
      </div>
    </AppSurface>
  )
}
