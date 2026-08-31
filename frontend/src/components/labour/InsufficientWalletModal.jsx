import { Link } from 'react-router-dom'
import { IndianRupee, Wallet, X } from 'lucide-react'
import { AppPrimaryButton } from '../../app/AppPrimaryButton.jsx'

export function InsufficientWalletModal({ open, minimumRequired, balance, onClose }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <Wallet className="h-5 w-5" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h3 className="mt-3 text-base font-black text-slate-900">Insufficient wallet balance</h3>
        <p className="mt-1.5 text-sm font-medium text-slate-600 leading-relaxed">
          Recharge to accept bookings.
        </p>

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="font-semibold text-slate-500">Your balance</span>
            <span className="font-black text-slate-900 flex items-center">
              <IndianRupee className="h-3.5 w-3.5" />
              {Number(balance || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-slate-500">Minimum required</span>
            <span className="font-black text-amber-700 flex items-center">
              <IndianRupee className="h-3.5 w-3.5" />
              {Number(minimumRequired || 0).toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <Link to="/app/wallet" className="flex-1" onClick={onClose}>
            <AppPrimaryButton type="button" className="w-full py-3 text-sm font-black">
              Recharge Now
            </AppPrimaryButton>
          </Link>
        </div>
      </div>
    </div>
  )
}
