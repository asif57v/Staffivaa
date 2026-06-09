import { useState } from 'react'
import { FileText, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { useDispatch } from 'react-redux'
import { assetUrlFromUpload, uploadDocument } from '../../api/uploadApi.js'
import { UPLOAD_FOLDERS } from '../../constants/uploadFolders.js'
import { CORPORATE_STATUS } from '../../constants/userRoles.js'
import { useAuth } from '../../hooks/useAuth.js'
import { setUser } from '../../store/slices/authSlice.js'
import {
  BUSINESS_VERIFICATION_BENEFITS,
  BUSINESS_WORKFLOW,
  businessWorkflowStepIndex,
  getBusinessVerificationUiState,
} from '../../lib/businessVerificationFlow.js'
import { LabourKycWorkflowTimeline } from '../labour/kyc/LabourKycWorkflowTimeline.jsx'
import { AppPrimaryButton } from '../app/AppPrimaryButton.jsx'
import { AppSurface } from '../app-ui/cards/AppSurface.jsx'
import {
  useAddCorporateDocumentMutation,
  useAddVendorDocumentMutation,
  usePatchCorporateMeMutation,
  useRemoveCorporateDocumentMutation,
  useRemoveVendorDocumentMutation,
  useSubmitCorporateVerificationMutation,
  useSubmitVendorVerificationMutation,
} from '../../store/api/workforceApi.js'

const inputClass =
  'w-full rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand/35'

export function BusinessVerificationPanel({ variant = 'corporate' }) {
  const isCorporate = variant === 'corporate'
  const dispatch = useDispatch()
  const { user } = useAuth()

  const profile = isCorporate ? user?.corporateProfile : user?.contractorProfile
  const status = isCorporate ? profile?.status || CORPORATE_STATUS.PENDING : profile?.verificationStatus || 'pending'
  const submittedAt = profile?.documentsSubmittedAt
  const reviewNote = profile?.reviewNote
  const documents = profile?.documents ?? []
  const isApproved = isCorporate ? status === CORPORATE_STATUS.APPROVED : status === 'approved'
  const inReview =
    Boolean(submittedAt) && !isApproved && status !== CORPORATE_STATUS.REJECTED && status !== 'rejected'
  const canEditDocs = !isApproved && !inReview

  const [companyName, setCompanyName] = useState(profile?.companyName || '')
  const [gstNumber, setGstNumber] = useState(profile?.gstNumber || '')
  const [docLabel, setDocLabel] = useState(isCorporate ? 'GST certificate' : 'Business registration')
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const [addCorporateDocument] = useAddCorporateDocumentMutation()
  const [addVendorDocument] = useAddVendorDocumentMutation()
  const [removeCorporateDocument] = useRemoveCorporateDocumentMutation()
  const [removeVendorDocument] = useRemoveVendorDocumentMutation()
  const [submitCorporate] = useSubmitCorporateVerificationMutation()
  const [submitVendor] = useSubmitVendorVerificationMutation()
  const [patchCorporateMe] = usePatchCorporateMeMutation()

  const ui = getBusinessVerificationUiState({ status, submittedAt, reviewNote, isApproved })

  const hasDetails = isCorporate
    ? Boolean((companyName || profile?.companyName)?.trim())
    : Boolean(profile?.businessName?.trim())

  const workflowStep = businessWorkflowStepIndex({
    status,
    submittedAt,
    hasDetails,
    docCount: documents.length,
    isApproved,
  })

  const benefits = BUSINESS_VERIFICATION_BENEFITS[variant]

  const refreshUser = (res) => {
    if (res?.user) dispatch(setUser(res.user))
  }

  const saveDetails = async () => {
    if (!isCorporate) return
    setMessage('')
    setBusy(true)
    try {
      const res = await patchCorporateMe({
        companyName: companyName.trim(),
        gstNumber: gstNumber.trim(),
      }).unwrap()
      refreshUser(res)
      setMessage('Company details saved')
    } catch (err) {
      setMessage(err?.data?.message || err?.message || 'Could not save details')
    } finally {
      setBusy(false)
    }
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !canEditDocs) return
    setMessage('')
    setUploading(true)
    try {
      const uploaded = await uploadDocument(file, UPLOAD_FOLDERS.KYC_DOCUMENTS)
      const url = assetUrlFromUpload(uploaded)
      const addFn = isCorporate ? addCorporateDocument : addVendorDocument
      const res = await addFn({ label: docLabel.trim() || 'Document', url }).unwrap()
      refreshUser(res)
      setMessage('Document uploaded')
    } catch (err) {
      setMessage(err?.data?.message || err?.message || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleRemove = async (docId) => {
    if (!canEditDocs) return
    setMessage('')
    try {
      const removeFn = isCorporate ? removeCorporateDocument : removeVendorDocument
      const res = await removeFn(docId).unwrap()
      refreshUser(res)
    } catch (err) {
      setMessage(err?.data?.message || err?.message || 'Could not remove document')
    }
  }

  const handleSubmitVerification = async () => {
    setMessage('')
    setBusy(true)
    try {
      if (isCorporate) {
        await patchCorporateMe({
          companyName: companyName.trim() || profile?.companyName,
          gstNumber: gstNumber.trim(),
        }).unwrap()
      }
      const submitFn = isCorporate ? submitCorporate : submitVendor
      const res = await submitFn().unwrap()
      refreshUser(res)
      setMessage(res?.message || 'Submitted for review')
    } catch (err) {
      setMessage(err?.data?.message || err?.message || 'Submit failed')
    } finally {
      setBusy(false)
    }
  }

  const canSubmit = !isApproved && !inReview && hasDetails && documents.length > 0 && !busy && !uploading

  return (
    <div className="space-y-4 pb-8">
      <AppSurface
        tone={isCorporate ? 'brandWash' : undefined}
        className={!isCorporate ? 'border-slate-800/10 bg-slate-900 text-white' : ''}
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
              isApproved ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/15 text-white'
            }`}
          >
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">
              {isCorporate ? 'Corporate verification' : 'Vendor verification'}
            </p>
            <h2 className="mt-1 text-lg font-extrabold text-white">{ui.title}</h2>
            <p className="mt-1 text-sm text-white/85">{ui.subtitle}</p>
          </div>
        </div>
      </AppSurface>

      {!isApproved ? (
        <AppSurface>
          <p className="text-sm font-extrabold text-slate-900">Verification steps</p>
          <div className="mt-4">
            <LabourKycWorkflowTimeline activeIndex={workflowStep} tone={ui.tone} steps={BUSINESS_WORKFLOW} />
          </div>
        </AppSurface>
      ) : null}

      {ui.phase === 'rejected' && reviewNote ? (
        <AppSurface className="border-rose-200/90 bg-rose-50/60">
          <p className="text-xs font-bold uppercase text-rose-800">Admin note</p>
          <p className="mt-1 text-sm text-rose-950">{reviewNote}</p>
        </AppSurface>
      ) : null}

      {isCorporate && !isApproved && !inReview ? (
        <AppSurface>
          <p className="text-sm font-extrabold text-slate-900">Company details</p>
          <div className="mt-4 space-y-3">
            <input
              className={inputClass}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Company name *"
            />
            <input
              className={inputClass}
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value)}
              placeholder="GST number (optional)"
            />
            <AppPrimaryButton type="button" className="w-full" disabled={busy} onClick={saveDetails}>
              Save company details
            </AppPrimaryButton>
          </div>
        </AppSurface>
      ) : null}

      {!isCorporate && !isApproved ? (
        <AppSurface>
          <p className="text-sm font-extrabold text-slate-900">Business name</p>
          <p className="mt-1 text-sm text-slate-600">{profile?.businessName || user?.fullName || '—'}</p>
          <p className="mt-1 text-xs text-slate-500">Set at registration. Contact support to change.</p>
        </AppSurface>
      ) : null}

      <AppSurface>
        <p className="text-sm font-extrabold text-slate-900">Verification documents</p>
        <p className="mt-1 text-xs text-slate-500">
          {canEditDocs
            ? 'Upload company registration, GST, PAN, or contract proofs (PDF or image).'
            : inReview
              ? 'Documents are locked while admin reviews your submission.'
              : 'Your verified documents are on file.'}
        </p>

        {canEditDocs ? (
          <div className="mt-4 space-y-3">
            <input
              className={inputClass}
              value={docLabel}
              onChange={(e) => setDocLabel(e.target.value)}
              placeholder="Document label"
            />
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm font-bold text-slate-700">
              <Upload className="h-4 w-4" aria-hidden />
              {uploading ? 'Uploading…' : 'Choose file'}
              <input
                type="file"
                className="sr-only"
                accept=".pdf,image/*"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </div>
        ) : null}

        {message ? <p className="mt-3 text-xs font-semibold text-brand">{message}</p> : null}
      </AppSurface>

      {documents.length > 0 ? (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li key={doc._id || doc.url}>
              <AppSurface className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <FileText className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{doc.label}</p>
                  {doc.uploadedAt ? (
                    <p className="text-xs text-slate-500">
                      {new Date(doc.uploadedAt).toLocaleDateString('en-IN')}
                    </p>
                  ) : null}
                </div>
                {doc.url ? (
                  <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-brand">
                    View
                  </a>
                ) : null}
                {canEditDocs && doc._id ? (
                  <button
                    type="button"
                    onClick={() => handleRemove(doc._id)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700"
                    aria-label="Remove document"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </AppSurface>
            </li>
          ))}
        </ul>
      ) : (
        <AppSurface>
          <p className="text-sm text-slate-500">No documents on file yet.</p>
        </AppSurface>
      )}

      {canSubmit ? (
        <AppPrimaryButton type="button" className="w-full" disabled={!canSubmit} onClick={handleSubmitVerification}>
          Submit for verification
        </AppPrimaryButton>
      ) : null}

      {inReview ? (
        <AppSurface className="border-sky-200/80 bg-sky-50/50">
          <p className="text-sm font-bold text-sky-900">Submitted for review</p>
          <p className="mt-1 text-xs text-sky-800">
            {submittedAt
              ? `On ${new Date(submittedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`
              : ''}
          </p>
        </AppSurface>
      ) : null}

      <AppSurface>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">After approval</p>
        <ul className="mt-3 space-y-3">
          {benefits.map((b) => (
            <li key={b.title} className="text-sm">
              <p className="font-bold text-slate-900">{b.title}</p>
              <p className="text-xs text-slate-600">{b.desc}</p>
            </li>
          ))}
        </ul>
      </AppSurface>
    </div>
  )
}
