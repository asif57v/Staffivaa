import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.js'
import { checkDeleteMyAccount, deleteMyAccount } from '../../api/deleteAccountApi.js'

/**
 * "Are you sure?" popup for deleting the signed-in account.
 * Works for every role (individual, corporate, enterprise, vendor, labour).
 */
export function DeleteAccountModal({ open, onClose }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(false)
  const [blockers, setBlockers] = useState([])
  const [confirmText, setConfirmText] = useState('')
  const [reason, setReason] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    setConfirmText('')
    setReason('')
    setBlockers([])
    setChecking(true)
    checkDeleteMyAccount()
      .then((res) => {
        if (!cancelled) setBlockers(res?.data?.reasons || [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  if (!open) return null

  const blocked = blockers.length > 0
  const canSubmit = !checking && !blocked && confirmText.trim() === 'DELETE' && !deleting

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteMyAccount({ confirm: 'DELETE', reason: reason.trim() || undefined })
      toast.success('Your account has been deleted')
      await logout()
      navigate('/auth', { replace: true })
    } catch (err) {
      const reasons = err?.errors?.reasons
      if (Array.isArray(reasons) && reasons.length) setBlockers(reasons)
      else toast.error(err?.message || 'Could not delete account')
      setDeleting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
      onClick={() => !deleting && onClose()}
    >
      <div
        className="relative w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={deleting}
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
          <AlertTriangle className="h-6 w-6" aria-hidden />
        </div>
        <h2 id="delete-account-title" className="mt-4 text-lg font-extrabold text-slate-900">
          Are you sure you want to delete your account?
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          This action cannot be undone. You will be signed out immediately and will no longer be able to use this
          account, its wallet, bookings or history.
        </p>

        {checking ? (
          <div className="mt-5 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking your account...
          </div>
        ) : blocked ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
            <p className="text-sm font-bold text-amber-900">You cannot delete your account yet</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-amber-900/90">
              {blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <div>
              <label htmlFor="delete-reason" className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Reason (optional)
              </label>
              <textarea
                id="delete-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={2}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                placeholder="Tell us why you are leaving"
              />
            </div>
            <div>
              <label htmlFor="delete-confirm" className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Type <span className="text-rose-600">DELETE</span> to confirm
              </label>
              <input
                id="delete-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold tracking-widest outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                placeholder="DELETE"
              />
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          {!blocked && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canSubmit}
              className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Yes, delete my account
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Danger-zone card with the Delete Account button — drop into any profile/settings page */
export function DeleteAccountSection({ className = '' }) {
  const [open, setOpen] = useState(false)
  return (
    <section className={`rounded-2xl border border-rose-200 bg-rose-50/60 p-4 ${className}`}>
      <h3 className="text-sm font-extrabold text-rose-900">Delete account</h3>
      <p className="mt-1 text-xs leading-relaxed text-rose-900/70">
        Permanently delete your account and sign out. This cannot be undone.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300 bg-white py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-600 hover:text-white active:scale-[0.99]"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        Delete Account
      </button>
      <DeleteAccountModal open={open} onClose={() => setOpen(false)} />
    </section>
  )
}
