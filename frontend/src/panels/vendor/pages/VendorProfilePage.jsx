import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Autocomplete, useLoadScript } from '@react-google-maps/api'
import {
  Briefcase,
  CheckCircle2,
  Clock,
  FileText,
  HardHat,
  IndianRupee,
  Navigation,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
} from 'lucide-react'
import { assetUrlFromUpload, uploadDocument } from '../../../api/uploadApi.js'
import { UPLOAD_FOLDERS } from '../../../constants/uploadFolders.js'
import {
  INDIAN_STATES,
  VENDOR_DOCUMENT_OPTIONS,
  VENDOR_DOCUMENT_TYPES,
  VENDOR_TYPE_DOCUMENT_HINTS,
  VENDOR_TYPE_LABELS,
  VENDOR_TYPE_OPTIONS,
} from '../../../constants/vendorVerification.js'
import { useAuth } from '../../../hooks/useAuth.js'
import { setUser } from '../../../store/slices/authSlice.js'
import {
  BUSINESS_VERIFICATION_BENEFITS,
  BUSINESS_WORKFLOW,
  businessWorkflowStepIndex,
  getBusinessVerificationUiState,
} from '../../../lib/businessVerificationFlow.js'
import {
  buildVendorProfileFromForm,
  getVendorVerificationProgress,
  normalizeGst,
  normalizePan,
} from '../../../lib/vendorVerificationChecklist.js'
import { CorporateVerificationChecklist } from '../../../components/corporate/CorporateVerificationChecklist.jsx'
import { VendorVerificationHero } from '../../../components/vendor/VendorVerificationHero.jsx'
import { LabourKycWorkflowTimeline } from '../../../components/labour/kyc/LabourKycWorkflowTimeline.jsx'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { GlassPanel } from '../../../components/ui/GlassPanel.jsx'
import {
  useAddVendorDocumentMutation,
  usePatchVendorMeMutation,
  useRemoveVendorDocumentMutation,
  useSubmitVendorVerificationMutation,
} from '../../../store/api/workforceApi.js'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-brand/35'
const labelClass = 'mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500'

const BENEFIT_ICONS = [Briefcase, Users, IndianRupee]

function profileToForm(profile, user) {
  return {
    businessName: profile?.businessName || '',
    vendorType: profile?.vendorType || '',
    gstNumber: profile?.gstNumber || '',
    panNumber: profile?.panNumber || '',
    businessAddress: profile?.businessAddress || '',
    city: profile?.city || '',
    state: profile?.state || '',
    pincode: profile?.pincode || '',
    contactPersonName: profile?.contactPersonName || user?.fullName || '',
    contactEmail: profile?.contactEmail || user?.email || '',
    contactPhone: profile?.contactPhone || user?.phone || '',
  }
}

export function VendorProfilePage() {
  const reduce = useReducedMotion()
  const dispatch = useDispatch()
  const { user } = useAuth()
  const profile = user?.contractorProfile
  const documents = profile?.documents ?? []

  const status = profile?.verificationStatus || 'pending'
  const submittedAt = profile?.documentsSubmittedAt
  const reviewNote = profile?.reviewNote
  const isApproved = status === 'approved'
  const inReview = Boolean(submittedAt) && !isApproved && status !== 'rejected'

  const [isEditing, setIsEditing] = useState(false)
  const canEdit = (!isApproved && !inReview) || isEditing

  const [form, setForm] = useState(() => profileToForm(profile, user))
  const [docType, setDocType] = useState(VENDOR_DOCUMENT_TYPES.SHOP_ESTABLISHMENT)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState(null)
  const [autocomplete, setAutocomplete] = useState(null)
  const [isFetchingLocation, setIsFetchingLocation] = useState(false)

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['places'],
  })

  const handlePlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace()
      if (place.formatted_address) {
        setForm((f) => ({ ...f, businessAddress: place.formatted_address }))
      }
    }
  }

  const pickLocation = () => {
    if (!navigator.geolocation) {
      setBanner({ variant: 'error', message: 'Location is not supported by your browser.' })
      return
    }
    setIsFetchingLocation(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        try {
          const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
          if (!apiKey) {
            setForm((f) => ({ ...f, businessAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}` }))
            setIsFetchingLocation(false)
            return
          }
          const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`)
          const data = await res.json()
          if (data.results && data.results.length > 0) {
            setForm((f) => ({ ...f, businessAddress: data.results[0].formatted_address }))
          } else {
            setForm((f) => ({ ...f, businessAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}` }))
          }
        } catch {
          setForm((f) => ({ ...f, businessAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}` }))
        }
        setIsFetchingLocation(false)
      },
      () => {
        setBanner({ variant: 'error', message: 'Unable to retrieve your location.' })
        setIsFetchingLocation(false)
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    )
  }

  const [patchVendorMe] = usePatchVendorMeMutation()
  const [addDocument] = useAddVendorDocumentMutation()
  const [removeDocument] = useRemoveVendorDocumentMutation()
  const [submitVerification] = useSubmitVendorVerificationMutation()

  useEffect(() => {
    setForm(profileToForm(profile, user))
  }, [user?._id, profile?.businessName])

  useEffect(() => {
    const hints = VENDOR_TYPE_DOCUMENT_HINTS[form.vendorType]
    if (hints?.length && !hints.includes(docType)) {
      setDocType(hints[0])
    }
  }, [form.vendorType])

  const draftProfile = useMemo(
    () => buildVendorProfileFromForm({ ...form, documents }),
    [form, documents],
  )
  const progress = useMemo(() => getVendorVerificationProgress(draftProfile), [draftProfile])
  const ui = getBusinessVerificationUiState({ status, submittedAt, reviewNote, isApproved })

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

  const patchBody = () => ({
    ...form,
    panNumber: normalizePan(form.panNumber),
    gstNumber: normalizeGst(form.gstNumber),
    pincode: String(form.pincode || '').replace(/\D/g, '').slice(0, 6),
    contactPhone: String(form.contactPhone || '').replace(/\D/g, '').slice(-10),
  })

  const saveDetails = async () => {
    if (!canEdit) return
    setBanner(null)
    setBusy(true)
    try {
      const res = await patchVendorMe(patchBody()).unwrap()
      refreshUser(res)
      setBanner({ variant: 'success', message: 'Business details saved' })
    } catch (err) {
      setBanner({ variant: 'error', message: err?.data?.message || err?.message || 'Could not save details' })
    } finally {
      setBusy(false)
    }
  }

  const saveDetailsQuiet = async () => {
    const res = await patchVendorMe(patchBody()).unwrap()
    refreshUser(res)
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
      const option = VENDOR_DOCUMENT_OPTIONS.find((o) => o.value === docType)
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
      await patchVendorMe(patchBody()).unwrap()
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
  const docHints = VENDOR_TYPE_DOCUMENT_HINTS[form.vendorType] || []
  const suggestedLabels = docHints
    .map((t) => VENDOR_DOCUMENT_OPTIONS.find((o) => o.value === t)?.label)
    .filter(Boolean)

  return (
    <motion.div className="space-y-4 pb-10">
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

      <VendorVerificationHero
        title={ui.title}
        subtitle={ui.subtitle}
        phaseLabel={phaseLabels[ui.phase] || 'In progress'}
        tone={ui.tone}
        businessLine={
          profile?.businessName || form.businessName
            ? `${profile?.businessName || form.businessName}${
                form.vendorType ? ` · ${VENDOR_TYPE_LABELS[form.vendorType] || ''}` : ''
              }`
            : undefined
        }
      />

      {ui.phase === 'approved' ? (
        <GlassPanel className="border-emerald-200/80 bg-emerald-50/50 p-5 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" aria-hidden />
          <p className="mt-3 text-sm text-slate-600">Your vendor account is verified. Jobs and crew linking are unlocked.</p>
          <AppPrimaryButton as={Link} to="/vendor" className="mt-4 py-2.5 text-xs">
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
                . Operations will verify your business documents shortly.
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

      <GlassPanel className="border-amber-200/40 bg-linear-to-br from-amber-50/80 to-white p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardHat className="h-5 w-5 text-amber-700" aria-hidden />
            <p className="text-sm font-extrabold text-slate-900">Business details</p>
          </div>
          {!canEdit && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-lg px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-100/50 hover:bg-amber-100 transition active:scale-95"
            >
              Edit details
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-600">
          Tell us your vendor category and registered business information for contracts and settlements.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="vendorType">
              Vendor / business type *
            </label>
            <select
              id="vendorType"
              className={inputClass}
              value={form.vendorType}
              onChange={setField('vendorType')}
              disabled={!canEdit}
            >
              <option value="">Select your business type</option>
              {VENDOR_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="businessName">
              Registered business name *
            </label>
            <input
              id="businessName"
              className={inputClass}
              value={form.businessName}
              onChange={setField('businessName')}
              disabled={!canEdit}
              placeholder="As per licence or registration"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="panNumber">
              Business PAN *
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
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="businessAddress">
              Business address *
            </label>
            {isLoaded ? (
              <Autocomplete
                onLoad={(auto) => setAutocomplete(auto)}
                onPlaceChanged={handlePlaceChanged}
                options={{
                  componentRestrictions: { country: 'in' },
                  fields: ['formatted_address']
                }}
              >
                <input
                  id="businessAddress"
                  className={inputClass}
                  value={form.businessAddress}
                  onChange={setField('businessAddress')}
                  disabled={!canEdit}
                  placeholder="Office / yard / site address"
                />
              </Autocomplete>
            ) : (
              <input
                id="businessAddress"
                className={inputClass}
                value={form.businessAddress}
                onChange={setField('businessAddress')}
                disabled={!canEdit}
                placeholder="Office / yard / site address"
              />
            )}
            {canEdit ? (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={pickLocation}
                  disabled={isFetchingLocation}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 active:scale-95 disabled:opacity-70"
                >
                  {isFetchingLocation ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Navigation className="h-3.5 w-3.5" />
                  )}
                  {isFetchingLocation ? 'Fetching...' : 'Fetch live location'}
                </button>
              </div>
            ) : null}
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
            <select id="state" className={inputClass} value={form.state} onChange={setField('state')} disabled={!canEdit}>
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
          <div>
            <label className={labelClass} htmlFor="contactEmail">
              Email
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
            <label className={labelClass} htmlFor="contactPhone">
              Mobile
            </label>
            <input
              id="contactPhone"
              inputMode="numeric"
              className={inputClass}
              value={form.contactPhone}
              onChange={(e) =>
                setForm((f) => ({ ...f, contactPhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))
              }
              disabled={!canEdit}
              maxLength={10}
            />
          </div>
        </div>

        {canEdit ? (
          <AppPrimaryButton type="button" className="mt-4 w-full py-3 text-sm" disabled={busy} onClick={() => { setIsEditing(false); saveDetails(); }}>
            Save business details
          </AppPrimaryButton>
        ) : null}
      </GlassPanel>

      <GlassPanel className="border-slate-200/90 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Verification documents</p>
          {!canEdit && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 hover:bg-slate-200 transition active:scale-95"
            >
              Edit documents
            </button>
          )}
        </div>
        <p className="text-xs leading-relaxed text-slate-600">
          Select document type, then upload PDF or image. Only <strong>one document is required</strong> for verification.
        </p>
        {suggestedLabels.length > 0 && form.vendorType ? (
          <p className="mt-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-950">
            <span className="font-bold">Suggested for {VENDOR_TYPE_LABELS[form.vendorType]}:</span>{' '}
            {suggestedLabels.join(' · ')}
          </p>
        ) : null}

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
                {VENDOR_DOCUMENT_OPTIONS.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={uploadedTypes.has(opt.value) && opt.value !== VENDOR_DOCUMENT_TYPES.OTHER}
                  >
                    {opt.label}
                    {uploadedTypes.has(opt.value) && opt.value !== VENDOR_DOCUMENT_TYPES.OTHER ? ' ✓' : ''}
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

      <GlassPanel className="border-amber-200/50 bg-linear-to-br from-amber-50/80 to-white p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800/80">After approval</p>
        <ul className="mt-3 space-y-2.5">
          {BUSINESS_VERIFICATION_BENEFITS.vendor.map((b, i) => {
            const Icon = BENEFIT_ICONS[i] || ShieldCheck
            return (
              <li key={b.title} className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-800">
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
    </motion.div>
  )
}
