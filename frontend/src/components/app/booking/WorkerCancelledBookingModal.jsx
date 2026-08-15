import { AppModal } from '../../app-ui/feedback/AppModal.jsx'
import { AppPrimaryButton } from '../AppPrimaryButton.jsx'
import { AlertCircle } from 'lucide-react'

/**
 * Popup shown when labour cancels an unpaid booking on the user side.
 */
export function WorkerCancelledBookingModal({ open, message, onClose }) {
  return (
    <AppModal
      open={open}
      title="Worker cancelled booking"
      description="Your live booking was closed because the worker cancelled."
      onClose={onClose}
      footer={
        <AppPrimaryButton type="button" className="w-full" onClick={onClose}>
          OK
        </AppPrimaryButton>
      }
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
          <AlertCircle className="h-5 w-5" aria-hidden />
        </span>
        <p className="text-sm font-medium leading-relaxed text-slate-700">
          {message || 'Worker cancelled the booking.'}
        </p>
      </div>
    </AppModal>
  )
}
