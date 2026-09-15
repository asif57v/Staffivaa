import { useEffect, useMemo, useState, useRef } from 'react'
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
  Hammer,
  Pencil,
  Plus,
} from 'lucide-react'
import { VendorSkillsModal } from '../../../components/vendor/VendorSkillsModal.jsx'
import { fetchLabourCategoriesGrouped } from '../../../api/labourCategoriesApi.js'
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
import { BusinessKycPhotoUploadGrid } from '../../../components/business/BusinessKycPhotoUploadGrid.jsx'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { GlassPanel } from '../../../components/ui/GlassPanel.jsx'
import { dataUrlToFile, saveKycDraft, loadKycDraft, clearKycDraft } from '../../../lib/kycDraftStorage.js'
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

function profileToPhotos(p) {
  if (!p) return {}
  const res = {}
  if (p.kycFrontImageUrl) res.aadhaar_front = p.kycFrontImageUrl
  if (p.kycBackImageUrl) res.aadhaar_back = p.kycBackImageUrl
  if (p.kycPanImageUrl) res.pan = p.kycPanImageUrl
  if (p.kycSelfieUrl) res.selfie = p.kycSelfieUrl
  if (Array.isArray(p.kycPhotos)) {
    for (const ph of p.kycPhotos) {
      if (ph?.url) {
        if (ph.type === 'aadhaar_front' && !res.aadhaar_front) res.aadhaar_front = ph.url
        if (ph.type === 'aadhaar_back' && !res.aadhaar_back) res.aadhaar_back = ph.url
        if (ph.type === 'pan' && !res.pan) res.pan = ph.url
        if (ph.type === 'selfie' && !res.selfie) res.selfie = ph.url
      }
    }
  }
  if (Array.isArray(p.documents)) {
    for (const d of p.documents) {
      if (d?.url) {
        const type = (d.documentType || '').toLowerCase()
        const label = (d.label || '').toLowerCase()
        if ((type === 'aadhaar_front' || label.includes('aadhaar front') || label.includes('aadhar front')) && !res.aadhaar_front) {
          res.aadhaar_front = d.url
        } else if ((type === 'aadhaar_back' || label.includes('aadhaar back') || label.includes('aadhar back')) && !res.aadhaar_back) {
          res.aadhaar_back = d.url
        } else if ((type === 'pan' || type === 'pan_card' || label.includes('pan')) && !res.pan) {
          res.pan = d.url
        } else if ((type === 'selfie' || label.includes('selfie')) && !res.selfie) {
          res.selfie = d.url
        }
      }
    }
  }
  return res
}

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
  const [isSkillsModalOpen, setIsSkillsModalOpen] = useState(false)
  const [categoriesCatalogue, setCategoriesCatalogue] = useState([])

  useEffect(() => {
    fetchLabourCategoriesGrouped()
      .then((res) => {
        const groups = res?.data?.groups || []
        const flat = []
        for (const g of groups) {
          for (const c of g.categories || []) {
            flat.push(c)
          }
        }
        setCategoriesCatalogue(flat)
      })
      .catch(() => {})
  }, [])

  const vendorSkills = useMemo(() => {
    const directSkills = Array.isArray(user?.contractorProfile?.skills)
      ? user.contractorProfile.skills.map((s) => String(s).trim()).filter(Boolean)
      : []

    const idMap = new Map()
    for (const c of categoriesCatalogue) {
      if (c._id) idMap.set(String(c._id), c.name)
    }

    const fromCatIds = Array.isArray(user?.contractorProfile?.categoryIds)
      ? user.contractorProfile.categoryIds.map((c) => {
          if (!c) return null
          if (typeof c === 'object' && c.name) return c.name
          const id = typeof c === 'object' ? String(c._id) : String(c)
          return idMap.get(id) || null
        }).filter(Boolean)
      : []

    return Array.from(new Set([...directSkills, ...fromCatIds]))
  }, [user?.contractorProfile?.skills, user?.contractorProfile?.categoryIds, categoriesCatalogue])

  const [form, setForm] = useState(() => profileToForm(profile, user))
  const [photos, setPhotos] = useState(() => profileToPhotos(profile))
  const [draftLoaded, setDraftLoaded] = useState(false)
  const latestStateRef = useRef({ form, photos, userId: user?._id })
  const isLoadedRef = useRef(false)

  useEffect(() => {
    latestStateRef.current = { form, photos, userId: user?._id }
  }, [form, photos, user?._id])

  // Load persistent draft on mount / user change
  useEffect(() => {
    let cancelled = false
    async function initDraft() {
      if (isApproved) {
        setDraftLoaded(true)
        isLoadedRef.current = true
        return
      }
      try {
        const draft = await loadKycDraft(user?._id, 'vendor')
        if (!cancelled && draft) {
          const remotePhotos = profileToPhotos(profile)
          const mergedPhotos = {
            ...remotePhotos,
            ...(draft.photos || {}),
          }
          if (Object.keys(mergedPhotos).length > 0) {
            setPhotos(mergedPhotos)
          }
          if (draft.form && typeof draft.form === 'object') {
            setForm((prev) => ({
              ...prev,
              ...draft.form,
            }))
          }
        }
      } catch (err) {
        console.warn('[VendorProfilePage] Failed to restore draft:', err)
      } finally {
        if (!cancelled) {
          setDraftLoaded(true)
          isLoadedRef.current = true
        }
      }
    }
    initDraft()
    return () => {
      cancelled = true
    }
  }, [user?._id, isApproved])

  // Auto-save draft when form or photos change
  useEffect(() => {
    if (!draftLoaded || !isLoadedRef.current || isApproved) return
    const timer = setTimeout(() => {
      saveKycDraft({
        form,
        photos,
        userId: user?._id,
        role: 'vendor',
      })
    }, 250)
    return () => clearTimeout(timer)
  }, [form, photos, draftLoaded, user?._id, isApproved])

  // Guaranteed immediate save on exit (when vendor taps back / navigates away / closes app)
  useEffect(() => {
    const handleSaveOnExit = () => {
      if (!isLoadedRef.current || isApproved) return
      const current = latestStateRef.current
      if (current && ((current.photos && Object.keys(current.photos).length > 0) || current.form)) {
        saveKycDraft({
          ...current,
          role: 'vendor',
        })
      }
    }

    window.addEventListener('pagehide', handleSaveOnExit)
    window.addEventListener('beforeunload', handleSaveOnExit)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') handleSaveOnExit()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      handleSaveOnExit()
      window.removeEventListener('pagehide', handleSaveOnExit)
      window.removeEventListener('beforeunload', handleSaveOnExit)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isApproved])
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
    const remoteForm = profileToForm(profile, user)
    const remotePhotos = profileToPhotos(profile)
    setForm((prev) => ({
      ...remoteForm,
      ...(prev || {}),
    }))
    setPhotos((prev) => ({
      ...remotePhotos,
      ...(prev || {}),
    }))
  }, [user?._id, profile?.businessName, profile?.kycFrontImageUrl, profile?.kycPanImageUrl])

  useEffect(() => {
    const hints = VENDOR_TYPE_DOCUMENT_HINTS[form.vendorType]
    if (hints?.length && !hints.includes(docType)) {
      setDocType(hints[0])
    }
  }, [form.vendorType])

  const draftProfile = useMemo(
    () =>
      buildVendorProfileFromForm({
        ...form,
        documents,
        kycPhotos: Object.values(photos).filter(Boolean),
        kycFrontImageUrl: photos.aadhaar_front,
        kycBackImageUrl: photos.aadhaar_back,
        kycPanImageUrl: photos.pan,
        kycSelfieUrl: photos.selfie,
      }),
    [form, documents, photos],
  )
  const progress = useMemo(() => getVendorVerificationProgress(draftProfile), [draftProfile])
  const ui = getBusinessVerificationUiState({ status, submittedAt, reviewNote, isApproved })

  const workflowStep = businessWorkflowStepIndex({
    status,
    submittedAt,
    hasDetails: progress.formComplete,
    docCount: documents.length + Object.keys(photos).length,
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

  const uploadAllPhotos = async (currentPhotos) => {
    const uploadSlot = async (slotId, label, slotValue) => {
      if (!slotValue) return null
      if (typeof slotValue === 'string' && slotValue.trim() && !slotValue.startsWith('data:') && !slotValue.startsWith('blob:')) {
        return { label, url: slotValue, type: slotId }
      }
      if (typeof slotValue === 'object' && slotValue.file) {
        const uploaded = await uploadDocument(slotValue.file, UPLOAD_FOLDERS.KYC_DOCUMENTS)
        const remoteUrl = assetUrlFromUpload(uploaded)
        if (!remoteUrl) throw new Error(`Failed to upload ${label}`)
        return { label, url: remoteUrl, type: slotId }
      }
      const rawDataUrl = typeof slotValue === 'object' ? (slotValue.dataUrl || slotValue.previewUrl) : slotValue
      if (typeof rawDataUrl === 'string' && rawDataUrl.startsWith('data:')) {
        const file = dataUrlToFile(rawDataUrl, `${slotId}.jpg`, 'image/jpeg')
        if (file) {
          const uploaded = await uploadDocument(file, UPLOAD_FOLDERS.KYC_DOCUMENTS)
          const remoteUrl = assetUrlFromUpload(uploaded)
          if (!remoteUrl) throw new Error(`Failed to upload ${label}`)
          return { label, url: remoteUrl, type: slotId }
        }
      }
      if (typeof slotValue === 'object' && slotValue.previewUrl && !slotValue.previewUrl.startsWith('blob:') && !slotValue.previewUrl.startsWith('data:')) {
        return { label, url: slotValue.previewUrl, type: slotId }
      }
      return null
    }

    const [frontDoc, backDoc, panDoc, selfieDoc] = await Promise.all([
      uploadSlot('aadhaar_front', 'Aadhaar Card (Front)', currentPhotos.aadhaar_front),
      uploadSlot('aadhaar_back', 'Aadhaar Card (Back)', currentPhotos.aadhaar_back),
      uploadSlot('pan', 'Business PAN Card', currentPhotos.pan),
      uploadSlot('selfie', 'Proprietor Selfie', currentPhotos.selfie),
    ])

    const photoList = [frontDoc, backDoc, panDoc, selfieDoc].filter(Boolean)
    return {
      kycFrontImageUrl: frontDoc?.url || '',
      kycBackImageUrl: backDoc?.url || '',
      kycPanImageUrl: panDoc?.url || '',
      kycSelfieUrl: selfieDoc?.url || '',
      kycPhotos: photoList,
    }
  }

  const patchBody = (uploadedPhotoMeta = null) => ({
    ...form,
    panNumber: normalizePan(form.panNumber),
    gstNumber: normalizeGst(form.gstNumber),
    pincode: String(form.pincode || '').replace(/\D/g, '').slice(0, 6),
    contactPhone: String(form.contactPhone || '').replace(/\D/g, '').slice(-10),
    ...(uploadedPhotoMeta ? uploadedPhotoMeta : {}),
  })

  const saveDetails = async () => {
    if (!canEdit) return
    if (!form.city?.trim() || /\d/.test(form.city)) {
      setBanner({ variant: 'error', message: 'City is required and must not contain any numbers.' })
      return
    }
    if (!/^\d{6}$/.test(String(form.pincode || '').trim())) {
      setBanner({ variant: 'error', message: 'PIN code must be exactly 6 digits.' })
      return
    }
    const cleanedPan = normalizePan(form.panNumber)
    if (cleanedPan && cleanedPan.length !== 10) {
      setBanner({ variant: 'error', message: 'Business PAN must be exactly 10 characters.' })
      return
    }
    const cleanedGst = normalizeGst(form.gstNumber)
    if (cleanedGst && cleanedGst.length !== 15) {
      setBanner({ variant: 'error', message: 'GSTIN must be exactly 15 characters.' })
      return
    }
    setBanner(null)
    setBusy(true)
    try {
      const uploadedPhotos = await uploadAllPhotos(photos)
      const res = await patchVendorMe(patchBody(uploadedPhotos)).unwrap()
      refreshUser(res)
      setBanner({ variant: 'success', message: 'Business details & KYC photos saved' })
    } catch (err) {
      setBanner({ variant: 'error', message: err?.data?.message || err?.message || 'Could not save details' })
    } finally {
      setBusy(false)
    }
  }

  const saveDetailsQuiet = async () => {
    const uploadedPhotos = await uploadAllPhotos(photos)
    const res = await patchVendorMe(patchBody(uploadedPhotos)).unwrap()
    refreshUser(res)
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !canEdit) return
    setBanner(null)
    setUploading(true)
    try {
      try {
        await saveDetailsQuiet()
      } catch (_quietErr) {
        // Silent background save shouldn't block document upload
      }
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
      const uploadedPhotos = await uploadAllPhotos(photos)
      await patchVendorMe(patchBody(uploadedPhotos)).unwrap()
      const res = await submitVerification().unwrap()
      refreshUser(res)
      await clearKycDraft(user?._id, 'vendor')
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
            className={`fixed left-4 right-4 top-[max(0.75rem,env(safe-area-inset-top,12px))] z-[99999] mx-auto max-w-md rounded-2xl px-4 py-3 text-center text-sm font-semibold text-white shadow-xl backdrop-blur-md ${
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
            <input
              id="city"
              className={inputClass}
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value.replace(/[0-9]/g, '') }))}
              disabled={!canEdit}
            />
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

      {/* Workforce Trades & Capabilities Card */}
      <GlassPanel className="border-amber-200/40 bg-linear-to-br from-amber-50/60 to-white p-4 sm:p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFC107] text-slate-950 shadow-xs">
              <Hammer className="h-4.5 w-4.5" />
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 leading-tight">Workforce Trades & Capabilities</h3>
              <p className="text-xs text-slate-500">Skills selected for corporate jobs & crew allocations</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSkillsModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <Pencil className="h-3 w-3 text-amber-400" />
            <span>Update Trades</span>
          </button>
        </div>

        <div className="mt-4">
          {vendorSkills.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center">
              <p className="text-xs font-semibold text-slate-500">No workforce trades selected yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Add trades so clients and corporate projects can match with your agency.
              </p>
              <button
                type="button"
                onClick={() => setIsSkillsModalOpen(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#FFC107] hover:bg-[#e0a800] text-slate-950 px-4 py-2 text-xs font-black transition shadow-xs cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 stroke-[2.5]" /> Select Workforce Trades
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {vendorSkills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200/80 px-3 py-1.5 text-xs font-bold text-slate-800 shadow-2xs"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[#FFC107] shrink-0" />
                    {skill}
                  </span>
                ))}
              </div>
              <div className="pt-1 flex items-center justify-between text-xs text-slate-500">
                <span className="font-bold text-slate-700">{vendorSkills.length} {vendorSkills.length === 1 ? 'Trade' : 'Trades'} Registered</span>
                <button
                  type="button"
                  onClick={() => setIsSkillsModalOpen(true)}
                  className="font-extrabold text-amber-700 hover:text-amber-800 underline flex items-center gap-1 cursor-pointer"
                >
                  <Pencil className="h-3 w-3" /> Edit Trade Skills
                </button>
              </div>
            </div>
          )}
        </div>
      </GlassPanel>

      <GlassPanel className="border-slate-200/90 p-4 sm:p-5 space-y-6">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">KYC Photos & Verification Documents</p>
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

        {/* 1. Mandatory & Primary Photo Upload Grid (Aadhaar Front/Back, PAN, Selfie) */}
        <div>
          <BusinessKycPhotoUploadGrid
            variant="vendor"
            photos={photos}
            onChange={setPhotos}
            disabled={!canEdit || busy || uploading}
          />
        </div>

        {/* 2. Additional Business Certificates (GST, Trade License, MSME, etc.) */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Additional Business Certificates (Optional)</p>
            <p className="text-xs text-slate-600">
              Upload PDF or images of Shop Act, GST certificate, labour licence, or partnership deed.
            </p>
          </div>

          {suggestedLabels.length > 0 && form.vendorType ? (
            <p className="rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-950">
              <span className="font-bold">Suggested for {VENDOR_TYPE_LABELS[form.vendorType]}:</span>{' '}
              {suggestedLabels.join(' · ')}
            </p>
          ) : null}

          {canEdit ? (
            <div className="space-y-3">
              <div>
                <label className={labelClass} htmlFor="docType">
                  Certificate / Document type
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
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm font-bold text-slate-700 transition hover:border-brand/40 hover:bg-brand/5">
                <Upload className="h-5 w-5 text-brand" aria-hidden />
                {uploading ? 'Uploading…' : 'Attach additional document (PDF / Image)'}
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
        </div>

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

      <VendorSkillsModal
        isOpen={isSkillsModalOpen}
        onClose={() => setIsSkillsModalOpen(false)}
        user={user}
      />
    </motion.div>
  )
}
