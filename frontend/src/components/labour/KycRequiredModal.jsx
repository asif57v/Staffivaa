import { useNavigate } from 'react-router-dom'
import { ShieldAlert, ShieldCheck, ArrowRight, X, Clock, AlertTriangle, FileText } from 'lucide-react'
import { AppPrimaryButton } from '../app/AppPrimaryButton.jsx'
import { KYC_STATUS } from '../../constants/userRoles.js'

export function KycRequiredModal({
  open,
  onClose,
  kycStatus,
  kycSubmittedAt,
  title = 'Apni KYC complete karo job accept karne ke liye',
  description = 'You must complete your Aadhaar & PAN verification before accepting any job requests. Once verified, all matching jobs will be unlocked instantly.',
}) {
  const navigate = useNavigate()

  if (!open) return null

  const isPendingReview = kycStatus === KYC_STATUS.PENDING && Boolean(kycSubmittedAt)
  const isRejected = kycStatus === KYC_STATUS.FAILED || kycStatus === 'rejected'

  const handleGoToKyc = () => {
    onClose?.()
    navigate('/app/kyc')
  }

  return (
    <div
      className="fixed inset-0 z-[10060] flex items-end sm:items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kyc-modal-title"
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200/80 overflow-hidden relative transition-all">
        {/* Top Accent Strip */}
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600" />

        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="relative">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 shadow-inner">
              <ShieldAlert className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white ring-2 ring-white text-[10px] font-bold">
              !
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <h3 id="kyc-modal-title" className="mt-4 text-lg font-black text-slate-900 leading-snug">
          {title}
        </h3>

        <p className="mt-2 text-xs sm:text-sm font-medium text-slate-600 leading-relaxed">
          {description}
        </p>

        {/* Current KYC Status Pill */}
        <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Current Status</span>
            {isPendingReview ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 font-extrabold text-amber-800">
                <Clock className="h-3 w-3" /> Under Review
              </span>
            ) : isRejected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 font-extrabold text-rose-800">
                <AlertTriangle className="h-3 w-3" /> Action Required
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-0.5 font-extrabold text-slate-700">
                <FileText className="h-3 w-3" /> KYC Incomplete
              </span>
            )}
          </div>

          <p className="text-xs font-semibold text-slate-700">
            {isPendingReview
              ? 'Your documents have been submitted and are being reviewed by the admin. You can accept jobs as soon as approval is granted.'
              : isRejected
                ? 'Your previous submission was not approved. Please re-upload your Aadhaar and PAN documents.'
                : 'Upload Aadhaar front/back and PAN card photos to get verified and unlock job acceptance.'}
          </p>
        </div>

        {/* Features / Benefits */}
        <div className="mt-4 space-y-2 text-xs font-semibold text-slate-600">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Instant acceptance on direct client & company bookings</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Faster daily payouts directly to your wallet or bank</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 transition active:scale-98"
          >
            Later
          </button>
          <AppPrimaryButton
            type="button"
            onClick={handleGoToKyc}
            className="flex-1 py-3 text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-brand/20 active:scale-98"
          >
            Complete KYC Now
            <ArrowRight className="h-4 w-4" />
          </AppPrimaryButton>
        </div>
      </div>
    </div>
  )
}
