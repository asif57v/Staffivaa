import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  HardHat,
  IndianRupee,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react'
import { assetUrlFromUpload, uploadDocument } from '../../../api/uploadApi.js'
import { UPLOAD_FOLDERS } from '../../../constants/uploadFolders.js'
import {
  CORPORATE_DOCUMENT_OPTIONS,
  CORPORATE_DOCUMENT_TYPES,
  INDIAN_STATES,
} from '../../../constants/corporateVerification.js'
import { CORPORATE_STATUS } from '../../../constants/userRoles.js'
import { useAuth } from '../../../hooks/useAuth.js'
import { setUser } from '../../../store/slices/authSlice.js'
import {
  BUSINESS_VERIFICATION_BENEFITS,
  BUSINESS_WORKFLOW,
  businessWorkflowStepIndex,
  getBusinessVerificationUiState,
} from '../../../lib/businessVerificationFlow.js'
import {
  buildProfileFromForm,
  getCorporateVerificationProgress,
  normalizeGst,
  normalizePan,
} from '../../../lib/corporateVerificationChecklist.js'
import { CorporateVerificationChecklist } from '../../../components/corporate/CorporateVerificationChecklist.jsx'
import { CorporateVerificationHero } from '../../../components/corporate/CorporateVerificationHero.jsx'
import { LabourKycWorkflowTimeline } from '../../../components/labour/kyc/LabourKycWorkflowTimeline.jsx'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { GlassPanel } from '../../../components/ui/GlassPanel.jsx'
import {
  useAddCorporateDocumentMutation,
  usePatchCorporateMeMutation,
  useRemoveCorporateDocumentMutation,
  useSubmitCorporateVerificationMutation,
} from '../../../store/api/workforceApi.js'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-brand/35'
const labelClass = 'mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500'

const BENEFIT_ICONS = [Briefcase, HardHat, IndianRupee]

function profileToForm(profile, user) {
  return {
    companyName: profile?.companyName || '',
    gstNumber: profile?.gstNumber || '',
    panNumber: profile?.panNumber || '',
    cinNumber: profile?.cinNumber || '',
    registeredAddress: profile?.registeredAddress || '',
    city: profile?.city || '',
    state: profile?.state || '',
    pincode: profile?.pincode || '',
    contactPersonName: profile?.contactPersonName || user?.fullName || '',
    contactEmail: profile?.contactEmail || user?.email || '',
    website: profile?.website || '',
  }
}

export function CorporateProfilePage() {
  const reduce = useReducedMotion()
  const dispatch = useDispatch()
  const { user } = useAuth()
  const profile = user?.corporateProfile
  const documents = profile?.documents ?? []

  const status = profile?.status || CORPORATE_STATUS.PENDING
  const submittedAt = profile?.documentsSubmittedAt
  const reviewNote = profile?.reviewNote
  const isApproved = status === CORPORATE_STATUS.APPROVED
  const inReview = Boolean(submittedAt) && !isApproved && status !== CORPORATE_STATUS.REJECTED
  const canEdit = !isApproved && !inReview

  const [form, setForm] = useState(() => profileToForm(profile, user))
  const [docType, setDocType] = useState(CORPORATE_DOCUMENT_TYPES.COMPANY_REGISTRATION)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState(null)

  const [patchCorporateMe] = usePatchCorporateMeMutation()
  const [addDocument] = useAddCorporateDocumentMutation()
  const [removeDocument] = useRemoveCorporateDocumentMutation()
  const [submitVerification] = useSubmitCorporateVerificationMutation()

  useEffect(() => {
    setForm(profileToForm(profile, user))
  }, [user?._id, profile?.companyName])

  const draftProfile = useMemo(
    () => buildProfileFromForm({ ...form, documents }),
    [form, documents],
  )
  const progress = useMemo(() => getCorporateVerificationProgress(draftProfile), [draftProfile])
  const ui = getBusinessVerificationUiState({
    status,
    submittedAt,
    reviewNote,
    isApproved,
  })

  const workflowStep = businessWorkflowStepIndex({
    status,
    submittedAt,
    hasDetails: progress.formComplete,
    docCount: documents.length,
    isApproved,
  })

  const phaseLabels = {
    approved: 'Verified',
    review: 'In review',
    rejected: 'Action needed',
    submit: 'In progress',
  }

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const refreshUser = (res) => {
    if (res?.user) dispatch(setUser(res.user))
  }

  const saveDetails = async () => {
    if (!canEdit) return
    setBanner(null)
    setBusy(true)
    try {
      const res = await patchCorporateMe({
        ...form,
        panNumber: normalizePan(form.panNumber),
        gstNumber: normalizeGst(form.gstNumber),
        cinNumber: String(form.cinNumber || '').trim().toUpperCase(),
        pincode: String(form.pincode || '').replace(/\D/g, '').slice(0, 6),
      }).unwrap()
      refreshUser(res)
      setBanner({ variant: 'success', message: 'Company details saved' })
    } catch (err) {
      setBanner({ variant: 'error', message: err?.data?.message || err?.message || 'Could not save details' })
    } finally {
      setBusy(false)
    }
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !canEdit) return
    setBanner(null)
    setUploading(true)
    try {
      await saveDetailsQuiet()
      const uploaded = await uploadDocument(file, UPLOAD_FOLDERS.KYC_DOCUMENTS)
      const url = assetUrlFromUpload(uploaded)
      const option = CORPORATE_DOCUMENT_OPTIONS.find((o) => o.value === docType)
      const res = await addDocument({
        documentType: docType,
        label: option?.label || 'Document',
        url,
      }).unwrap()
      refreshUser(res)
      setBanner({ variant: 'success', message: `${option?.label || 'Document'} uploaded` })
    } catch (err) {
      setBanner({
        variant: 'error',
        message: err?.data?.message || err?.message || 'Upload failed',
      })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const saveDetailsQuiet = async () => {
    const res = await patchCorporateMe({
      ...form,
      panNumber: normalizePan(form.panNumber),
      gstNumber: normalizeGst(form.gstNumber),
      pincode: String(form.pincode || '').replace(/\D/g, '').slice(0, 6),
    }).unwrap()
    refreshUser(res)
  }

  const handleRemove = async (docId) => {
    if (!canEdit) return
    try {
      const res = await removeDocument(docId).unwrap()
      refreshUser(res)
    } catch (err) {
      setBanner({ variant: 'error', message: err?.data?.message || 'Could not remove document' })
    }
  }

  const handleSubmit = async () => {
    setBanner(null)
    if (!progress.readyToSubmit) {
      setBanner({
        variant: 'error',
        message: 'Complete all required checklist items before submitting.',
      })
      return
    }
    setBusy(true)
    try {
      await patchCorporateMe({
        ...form,
        panNumber: normalizePan(form.panNumber),
        gstNumber: normalizeGst(form.gstNumber),
        pincode: String(form.pincode || '').replace(/\D/g, '').slice(0, 6),
      }).unwrap()
      const res = await submitVerification().unwrap()
      refreshUser(res)
      setBanner({
        variant: 'success',
        message: res?.message || 'Submitted for admin review',
      })
    } catch (err) {
      setBanner({
        variant: 'error',
        message: err?.data?.message || err?.message || 'Submit failed',
      })
    } finally {
      setBusy(false)
    }
  }

  const uploadedTypes = new Set(documents.map((d) => d.documentType).filter(Boolean))

  return (
    <div className="space-y-4 pb-10">
      <AnimatePresence>
        {banner ? (
          <motion.p
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0 }}
            className={`fixed left-4 right-4 top-[max(4.5rem,env(safe-area-inset-top))] z-120 mx-auto max-w-md rounded-2xl px-4 py-3 text-center text-sm font-semibold text-white shadow-xl ${
              banner.variant === 'success'
                ? 'border border-emerald-300/40 bg-emerald-900/95'
                : 'border border-rose-300/40 bg-rose-900/95'
            }`}
            role="status"
          >
            {banner.message}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <CorporateVerificationHero
        title={ui.title}
        subtitle={ui.subtitle}
        phaseLabel={phaseLabels[ui.phase] || 'In progress'}
        tone={ui.tone}
        companyLine={profile?.companyName || form.companyName || undefined}
      />

      {ui.phase === 'approved' ? (
        <GlassPanel className="border-emerald-200/80 bg-emerald-50/50 p-5 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" aria-hidden />
          <p className="mt-3 text-sm text-slate-600">Your corporate account is verified. Bulk workforce is unlocked.</p>
          <AppPrimaryButton as={Link} to="/corporate" className="mt-4 py-2.5 text-xs">
            Go to dashboard
          </AppPrimaryButton>
        </GlassPanel>
      ) : null}

      {ui.phase === 'review' ? (
        <GlassPanel className="border-sky-200/80 bg-sky-50/50 p-4">
          <div className="flex gap-3">
            <Clock className="h-10 w-10 shrink-0 text-sky-600" aria-hidden />
            <div>
              <p className="text-sm font-extrabold text-sky-950">Submitted for review</p>
              <p className="mt-1 text-xs text-sky-900/90">
                {submittedAt
                  ? new Date(submittedAt).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : '—'}
                . Operations will verify your company documents shortly.
              </p>
            </div>
          </div>
        </GlassPanel>
      ) : null}

      {ui.phase === 'rejected' && reviewNote ? (
        <GlassPanel className="border-rose-200/80 bg-rose-50/50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-800">Admin note</p>
          <p className="mt-1 text-sm leading-relaxed text-rose-950">{reviewNote}</p>
        </GlassPanel>
      ) : null}

      <GlassPanel className="border-slate-200/90 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Verification journey</p>
        <div className="mt-3">
          <LabourKycWorkflowTimeline activeIndex={workflowStep} tone={ui.tone} steps={BUSINESS_WORKFLOW} />
        </div>
      </GlassPanel>

      <GlassPanel className="border-brand/20 bg-linear-to-br from-brand/5 to-white p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-brand" aria-hidden />
          <p className="text-sm font-extrabold text-slate-900">Company details</p>
        </div>
        <p className="mt-1 text-xs text-slate-600">Legal entity information for contracts, GST invoices, and site agreements.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="companyName">
              Legal company name *
            </label>
            <input
              id="companyName"
              className={inputClass}
              value={form.companyName}
              onChange={setField('companyName')}
              disabled={!canEdit}
              placeholder="As per registration certificate"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="panNumber">
              Company PAN *
            </label>
            <input
              id="panNumber"
              className={`${inputClass} font-mono uppercase`}
              value={form.panNumber}
              onChange={(e) => setForm((f) => ({ ...f, panNumber: normalizePan(e.target.value) }))}
              disabled={!canEdit}
              placeholder="ABCDE1234F"
              maxLength={10}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="gstNumber">
              GSTIN (optional)
            </label>
            <input
              id="gstNumber"
              className={`${inputClass} font-mono uppercase`}
              value={form.gstNumber}
              onChange={(e) => setForm((f) => ({ ...f, gstNumber: normalizeGst(e.target.value) }))}
              disabled={!canEdit}
              placeholder="22AAAAA0000A1Z5"
              maxLength={15}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="cinNumber">
              CIN / LLPIN (optional)
            </label>
            <input
              id="cinNumber"
              className={inputClass}
              value={form.cinNumber}
              onChange={setField('cinNumber')}
              disabled={!canEdit}
              placeholder="U12345MH2020PTC123456"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="contactPersonName">
              Contact person
            </label>
            <input
              id="contactPersonName"
              className={inputClass}
              value={form.contactPersonName}
              onChange={setField('contactPersonName')}
              disabled={!canEdit}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="registeredAddress">
              Registered office address *
            </label>
            <textarea
              id="registeredAddress"
              rows={2}
              className={inputClass}
              value={form.registeredAddress}
              onChange={setField('registeredAddress')}
              disabled={!canEdit}
              placeholder="Street, area, landmark"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="city">
              City *
            </label>
            <input id="city" className={inputClass} value={form.city} onChange={setField('city')} disabled={!canEdit} />
          </div>
          <div>
            <label className={labelClass} htmlFor="state">
              State *
            </label>
            <select
              id="state"
              className={inputClass}
              value={form.state}
              onChange={setField('state')}
              disabled={!canEdit}
            >
              <option value="">Select state</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="pincode">
              PIN code *
            </label>
            <input
              id="pincode"
              inputMode="numeric"
              className={inputClass}
              value={form.pincode}
              onChange={(e) =>
                setForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))
              }
              disabled={!canEdit}
              placeholder="110001"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="contactEmail">
              Billing email
            </label>
            <input
              id="contactEmail"
              type="email"
              className={inputClass}
              value={form.contactEmail}
              onChange={setField('contactEmail')}
              disabled={!canEdit}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="website">
              Website (optional)
            </label>
            <input
              id="website"
              className={inputClass}
              value={form.website}
              onChange={setField('website')}
              disabled={!canEdit}
              placeholder="https://"
            />
          </div>
        </div>

        {canEdit ? (
          <AppPrimaryButton type="button" className="mt-4 w-full py-3 text-sm" disabled={busy} onClick={saveDetails}>
            Save company details
          </AppPrimaryButton>
        ) : null}
      </GlassPanel>

      <GlassPanel className="border-slate-200/90 p-4 sm:p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Verification documents</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Select document type, then upload PDF or image. Only <strong>one document is required</strong> for
          verification; you may add more if you like.
        </p>

        {canEdit ? (
          <div className="mt-4 space-y-3">
            <div>
              <label className={labelClass} htmlFor="docType">
                Document type
              </label>
              <select
                id="docType"
                className={inputClass}
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
              >
                {CORPORATE_DOCUMENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={uploadedTypes.has(opt.value) && opt.value !== CORPORATE_DOCUMENT_TYPES.OTHER}>
                    {opt.label}
                    {uploadedTypes.has(opt.value) && opt.value !== CORPORATE_DOCUMENT_TYPES.OTHER ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm font-bold text-slate-700 transition hover:border-brand/40 hover:bg-brand/5">
              <Upload className="h-5 w-5 text-brand" aria-hidden />
              {uploading ? 'Uploading…' : 'Choose file to upload'}
              <input
                type="file"
                className="sr-only"
                accept=".pdf,image/*"
                onChange={handleUpload}
                disabled={uploading || busy}
              />
            </label>
          </div>
        ) : null}

        {documents.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {documents.map((doc) => (
              <li
                key={doc._id || doc.url}
                className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-3"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
                  <FileText className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">{doc.label}</p>
                  {doc.uploadedAt ? (
                    <p className="text-[11px] text-slate-500">
                      {new Date(doc.uploadedAt).toLocaleDateString('en-IN')}
                    </p>
                  ) : null}
                </div>
                {doc.url ? (
                  <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-brand">
                    View
                  </a>
                ) : null}
                {canEdit && doc._id ? (
                  <button
                    type="button"
                    onClick={() => handleRemove(doc._id)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          No documents uploaded yet.
        </p>
      )}
      </GlassPanel>

      <GlassPanel className="border-slate-200/90 p-4">
        <CorporateVerificationChecklist
          checklist={progress.checklist}
          requiredDone={progress.requiredDone}
          requiredTotal={progress.requiredTotal}
        />
        {!progress.readyToSubmit && canEdit ? (
          <p className="mt-3 text-center text-xs font-medium text-slate-500">
            Complete all required items above to enable submission.
          </p>
        ) : null}
      </GlassPanel>

      {canEdit ? (
        <AppPrimaryButton
          type="button"
          className="w-full py-3.5 text-sm"
          disabled={!progress.readyToSubmit || busy || uploading}
          onClick={handleSubmit}
        >
          {busy ? (
            <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <ShieldCheck className="h-4 w-4" aria-hidden />
          )}
          Submit for admin review
        </AppPrimaryButton>
      ) : null}

      {!canEdit && !isApproved ? null : !progress.readyToSubmit && canEdit ? (
        <p className="text-center text-xs font-medium text-slate-500">
          Complete the checklist above to enable submission.
        </p>
      ) : null}

      <GlassPanel className="border-violet-200/50 bg-linear-to-br from-violet-50/80 to-white p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-800/80">After approval</p>
        <ul className="mt-3 space-y-2.5">
          {BUSINESS_VERIFICATION_BENEFITS.corporate.map((b, i) => {
            const Icon = BENEFIT_ICONS[i] || ShieldCheck
            return (
              <li key={b.title} className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">{b.title}</p>
                  <p className="text-xs text-slate-600">{b.desc}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </GlassPanel>
    </div>
  )
}
