import { useNavigate } from 'react-router-dom'
import { IndianRupee, Wallet, X } from 'lucide-react'
import { AppPrimaryButton } from '../app/AppPrimaryButton.jsx'

export function InsufficientWalletModal({
  open,
  minimumRequired,
  requiredAmount,
  balance,
  onClose,
  context = 'job',
}) {
  const navigate = useNavigate()

  if (!open) return null

  const isJobContext = context === 'job'
  const adminMinimum = Number(minimumRequired || 0)
  const amountNeeded = Number(requiredAmount ?? minimumRequired ?? 0)
  const showPlatformFee = adminMinimum <= 0 && amountNeeded > 0

  const title = isJobContext ? 'Recharge to receive this job' : 'Insufficient wallet balance'
  const description = showPlatformFee
    ? 'Your wallet balance is not enough to cover this job’s platform fee. Recharge now to accept.'
    : isJobContext
      ? 'Your wallet balance is below the minimum required to accept bookings. Recharge now to receive jobs.'
      : 'Recharge your wallet to continue accepting bookings.'

  const handleRecharge = () => {
    onClose?.()
    navigate('/app/wallet', { replace: true })
  }

  return (
    <div className="fixed inset-0 z-[10050] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
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

        <h3 className="mt-3 text-base font-black text-slate-900">{title}</h3>
        <p className="mt-1.5 text-sm font-medium text-slate-600 leading-relaxed">
          {description}
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
            <span className="font-semibold text-slate-500">
              {showPlatformFee ? 'Platform fee needed' : 'Minimum required'}
            </span>
            <span className="font-black text-amber-700 flex items-center">
              <IndianRupee className="h-3.5 w-3.5" />
              {amountNeeded.toLocaleString('en-IN')}
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
          <AppPrimaryButton
            type="button"
            onClick={handleRecharge}
            className="flex-1 py-3 text-sm font-black"
          >
            {isJobContext ? 'Recharge Wallet' : 'Recharge Now'}
          </AppPrimaryButton>
        </div>
      </div>
    </div>
  )
}
