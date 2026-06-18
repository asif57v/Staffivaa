import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2, Loader2, MessageCircle } from 'lucide-react'
import { AppBottomSheetBackdrop, AppBottomSheetChrome, AppBottomSheetPanel } from '../app-ui/feedback/AppBottomSheet.jsx'
import { AppField } from '../app-ui/inputs/AppField.jsx'
import { AppTextInput } from '../app-ui/inputs/AppTextInput.jsx'
import { submitBuildMartQuote } from '../../api/buildmartApi.js'
import { ApiError } from '../../api/http.js'
import { useAuth } from '../../hooks/useAuth.js'
import { buildWhatsAppLeadUrl } from '../../api/adminBuildmartApi.js'

const INITIAL = {
  name: '',
  phone: '',
  siteLocation: '',
  quantity: '',
  deliveryDate: '',
  notes: '',
}

export function BuildMartRequestQuoteSheet({
  open,
  onClose,
  product,
  variant,
}) {
  const { user } = useAuth()
  const reduce = useReducedMotion()
  const [form, setForm] = useState(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [savedLead, setSavedLead] = useState(null)
  const [prevOpen, setPrevOpen] = useState(open)

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setForm({
        name: user?.fullName?.trim() || '',
        phone: user?.phone?.replace(/\D/g, '').slice(-10) || '',
        siteLocation: '',
        quantity: '',
        deliveryDate: '',
        notes: '',
      })
      setError('')
      setSuccess(false)
      setSavedLead(null)
    }
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!product) return
    setSubmitting(true)
    setError('')
    try {
      const lead = await submitBuildMartQuote({
        productId: product.id,
        productName: product.name,
        variantId: variant?.id,
        variantLabel: variant?.label,
        name: form.name.trim(),
        phone: form.phone.trim(),
        siteLocation: form.siteLocation.trim(),
        quantity: form.quantity.trim(),
        deliveryDate: form.deliveryDate.trim() || undefined,
        notes: form.notes.trim() || undefined,
      })
      setSavedLead(lead)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit request. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const waUrl = savedLead ? buildWhatsAppLeadUrl(savedLead) : null

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <AppBottomSheetBackdrop onClose={onClose} />
          <AppBottomSheetPanel
            titleId="bm-quote-title"
            className="max-h-[min(92dvh,40rem)] overflow-y-auto rounded-b-none sm:rounded-b-3xl"
          >
            <AppBottomSheetChrome
              onClose={onClose}
              title={
                <h2 id="bm-quote-title" className="text-lg font-extrabold text-slate-900">
                  {success ? 'Request received' : 'Request quote'}
                </h2>
              }
              subtitle={
                !success && product ? (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {product.name}
                    {variant ? ` · ${variant.label}` : ''}
                  </p>
                ) : null
              }
            />

            {success ? (
              <motion.div
                className="space-y-4 px-4 pb-6 pt-2 text-center"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-2 ring-emerald-200/80">
                  <CheckCircle2 className="h-8 w-8" aria-hidden />
                </span>
                <p className="text-sm font-semibold leading-relaxed text-slate-700">
                  Your request has been submitted. Our team will contact you shortly.
                </p>
                {waUrl ? (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-3.5 text-sm font-extrabold text-white shadow-lg transition hover:brightness-105"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden />
                    Notify on WhatsApp
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-2xl border border-slate-200 py-3 text-sm font-bold text-slate-700"
                >
                  Done
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3 px-4 pb-6">
                <AppField label="Name" required>
                  <AppTextInput value={form.name} onChange={set('name')} required autoComplete="name" />
                </AppField>
                <AppField label="Phone number" required>
                  <AppTextInput
                    value={form.phone}
                    onChange={set('phone')}
                    inputMode="numeric"
                    maxLength={10}
                    required
                    autoComplete="tel"
                  />
                </AppField>
                <AppField label="Site location" required>
                  <AppTextInput
                    value={form.siteLocation}
                    onChange={set('siteLocation')}
                    placeholder="Sector, city, landmark"
                    required
                  />
                </AppField>
                <AppField label="Product quantity" required>
                  <AppTextInput
                    value={form.quantity}
                    onChange={set('quantity')}
                    placeholder="e.g. 80 bags, 2 trucks"
                    required
                  />
                </AppField>
                <AppField label="Delivery date">
                  <AppTextInput type="date" value={form.deliveryDate} onChange={set('deliveryDate')} />
                </AppField>
                <AppField label="Additional notes">
                  <textarea
                    value={form.notes}
                    onChange={set('notes')}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-brand/0 transition focus:border-orange-300 focus:ring-2 focus:ring-orange-200/80"
                    placeholder="Grade, unloading, GST invoice…"
                  />
                </AppField>

                {error ? (
                  <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 ring-1 ring-rose-200/80">
                    {error}
                  </p>
                ) : null}

                <motion.button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl buildmart-gradient py-3.5 text-sm font-extrabold text-white buildmart-glow disabled:opacity-70"
                  whileTap={reduce ? undefined : { scale: 0.98 }}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  Submit quote request
                </motion.button>
              </form>
            )}
          </AppBottomSheetPanel>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
