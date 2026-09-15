import { useEffect, useMemo, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Autocomplete, useLoadScript } from '@react-google-maps/api'
import {
  Briefcase,
  Building2,
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
import { BusinessKycPhotoUploadGrid } from '../../../components/business/BusinessKycPhotoUploadGrid.jsx'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { GlassPanel } from '../../../components/ui/GlassPanel.jsx'
import { dataUrlToFile, saveKycDraft, loadKycDraft, clearKycDraft } from '../../../lib/kycDraftStorage.js'
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

const GMAPS_LIBRARIES = ['places']

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
        if ((type === 'aadhaar_front' || type === 'authorized_signatory_id' || label.includes('aadhaar front') || label.includes('aadhar front') || label.includes('signatory id')) && !res.aadhaar_front) {
          res.aadhaar_front = d.url
        } else if ((type === 'aadhaar_back' || label.includes('aadhaar back') || label.includes('aadhar back')) && !res.aadhaar_back) {
          res.aadhaar_back = d.url
        } else if ((type === 'pan' || type === 'pan_card' || label.includes('pan')) && !res.pan) {
          res.pan = d.url
        } else if ((type === 'selfie' || label.includes('selfie') || label.includes('representative photo')) && !res.selfie) {
          res.selfie = d.url
        }
      }
    }
  }
  return res
}

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

  const [isEditing, setIsEditing] = useState(false)
  const canEdit = (!isApproved && !inReview) || isEditing

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
        const draft = await loadKycDraft(user?._id, 'corporate')
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
        console.warn('[CorporateProfilePage] Failed to restore draft:', err)
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
        role: 'corporate',
      })
    }, 250)
    return () => clearTimeout(timer)
  }, [form, photos, draftLoaded, user?._id, isApproved])

  // Guaranteed immediate save on exit (when corporate user taps back / navigates away / closes app)
  useEffect(() => {
    const handleSaveOnExit = () => {
      if (!isLoadedRef.current || isApproved) return
      const current = latestStateRef.current
      if (current && ((current.photos && Object.keys(current.photos).length > 0) || current.form)) {
        saveKycDraft({
          ...current,
          role: 'corporate',
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
  const [docType, setDocType] = useState(CORPORATE_DOCUMENT_TYPES.COMPANY_REGISTRATION)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState(null)
  const [autocomplete, setAutocomplete] = useState(null)
  const [isFetchingLocation, setIsFetchingLocation] = useState(false)

  useEffect(() => {
    if (banner) {
      const timer = setTimeout(() => {
        setBanner(null)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [banner])

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GMAPS_LIBRARIES,
  })

  const handlePlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace()
      if (place.formatted_address) {
        setForm((f) => ({ ...f, registeredAddress: place.formatted_address }))
      }
      // Extract city, state, pincode from address_components
      const components = place.address_components || []
      const updates = {}
      for (const comp of components) {
        const types = comp.types || []
        if (types.includes('locality')) {
          updates.city = comp.long_name
        } else if (types.includes('administrative_area_level_3') && !updates.city) {
          updates.city = comp.long_name
        }
        if (types.includes('administrative_area_level_1')) {
          updates.state = comp.long_name
        }
        if (types.includes('postal_code')) {
          updates.pincode = comp.long_name
        }
      }
      if (Object.keys(updates).length > 0) {
        setForm((f) => ({ ...f, ...updates }))
      }
    }
  }

  const pickLocation = () => {
    if (!navigator.geolocation) {
      setBanner({ variant: 'error', message: 'Location is not supported by your browser.' })
      return
    }
    setIsFetchingLocation(true)
    setBanner(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        try {
          const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
          if (!apiKey) {
            setForm((f) => ({ ...f, registeredAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}` }))
            setIsFetchingLocation(false)
            return
          }
          const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`)
          const data = await res.json()
          if (data.results && data.results.length > 0) {
            const result = data.results[0]
            setForm((f) => ({ ...f, registeredAddress: result.formatted_address }))

            // Parse address_components to auto-fill city, state, pincode
            const components = result.address_components || []
            const updates = {}
            for (const comp of components) {
              const types = comp.types || []
              if (types.includes('locality')) {
                updates.city = comp.long_name
              } else if (types.includes('administrative_area_level_3') && !updates.city) {
                updates.city = comp.long_name
              }
              if (types.includes('administrative_area_level_1')) {
                updates.state = comp.long_name
              }
              if (types.includes('postal_code')) {
                updates.pincode = comp.long_name
              }
            }
            if (Object.keys(updates).length > 0) {
              setForm((f) => ({ ...f, ...updates }))
            }
            setBanner({ variant: 'success', message: 'Location fetched successfully!' })
          } else {
            setForm((f) => ({ ...f, registeredAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}` }))
            setBanner({ variant: 'success', message: 'GPS coordinates captured. Address could not be resolved.' })
          }
        } catch {
          setForm((f) => ({ ...f, registeredAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}` }))
          setBanner({ variant: 'success', message: 'GPS coordinates captured.' })
        }
        setIsFetchingLocation(false)
      },
      () => {
        setBanner({ variant: 'error', message: 'Unable to retrieve your location. Please allow location permission.' })
        setIsFetchingLocation(false)
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    )
  }

  const [patchCorporateMe] = usePatchCorporateMeMutation()
  const [addDocument] = useAddCorporateDocumentMutation()
  const [removeDocument] = useRemoveCorporateDocumentMutation()
  const [submitVerification] = useSubmitCorporateVerificationMutation()

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
  }, [user?._id, profile?.companyName, profile?.kycFrontImageUrl, profile?.kycPanImageUrl])

  const draftProfile = useMemo(
    () =>
      buildProfileFromForm({
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
      uploadSlot('aadhaar_front', 'Authorized Signatory Aadhaar (Front)', currentPhotos.aadhaar_front),
      uploadSlot('aadhaar_back', 'Authorized Signatory Aadhaar (Back)', currentPhotos.aadhaar_back),
      uploadSlot('pan', 'Company PAN Card', currentPhotos.pan),
      uploadSlot('selfie', 'Authorized Representative Live Photo', currentPhotos.selfie),
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
      setBanner({ variant: 'error', message: 'Company PAN must be exactly 10 characters.' })
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
      const res = await patchCorporateMe({
        ...form,
        panNumber: normalizePan(form.panNumber),
        gstNumber: normalizeGst(form.gstNumber),
        cinNumber: String(form.cinNumber || '').trim().toUpperCase(),
        pincode: String(form.pincode || '').replace(/\D/g, '').slice(0, 6),
        ...uploadedPhotos,
      }).unwrap()
      refreshUser(res)
      setBanner({ variant: 'success', message: 'Company details & KYC photos saved' })
      setIsEditing(false)
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
      try {
        await saveDetailsQuiet()
      } catch (_quietErr) {
        // Silent background save shouldn't block document upload
      }
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
    const uploadedPhotos = await uploadAllPhotos(photos)
    const res = await patchCorporateMe({
      ...form,
      panNumber: normalizePan(form.panNumber),
      gstNumber: normalizeGst(form.gstNumber),
      pincode: String(form.pincode || '').replace(/\D/g, '').slice(0, 6),
      ...uploadedPhotos,
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
      const uploadedPhotos = await uploadAllPhotos(photos)
      await patchCorporateMe({
        ...form,
        panNumber: normalizePan(form.panNumber),
        gstNumber: normalizeGst(form.gstNumber),
        pincode: String(form.pincode || '').replace(/\D/g, '').slice(0, 6),
        ...uploadedPhotos,
      }).unwrap()
      const res = await submitVerification().unwrap()
      refreshUser(res)
      await clearKycDraft(user?._id, 'corporate')
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
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-brand" aria-hidden />
            <p className="text-sm font-extrabold text-slate-900">Company details</p>
          </div>
          {!canEdit && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs font-bold text-brand hover:underline transition active:scale-95"
            >
              Edit details
            </button>
          )}
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
            {isLoaded ? (
              <Autocomplete
                onLoad={(auto) => setAutocomplete(auto)}
                onPlaceChanged={handlePlaceChanged}
                options={{
                  componentRestrictions: { country: 'in' },
                  fields: ['formatted_address', 'address_components'],
                }}
              >
                <input
                  id="registeredAddress"
                  type="text"
                  className={inputClass}
                  value={form.registeredAddress}
                  onChange={setField('registeredAddress')}
                  disabled={!canEdit}
                  placeholder="Street, area, landmark"
                />
              </Autocomplete>
            ) : (
              <input
                id="registeredAddress"
                type="text"
                className={inputClass}
                value={form.registeredAddress}
                onChange={setField('registeredAddress')}
                disabled={!canEdit}
                placeholder="Street, area, landmark"
              />
            )}
            {canEdit ? (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={pickLocation}
                  disabled={isFetchingLocation}
                  className="flex items-center gap-1.5 rounded-xl border border-brand/30 bg-brand/5 px-3 py-2 text-xs font-bold text-brand shadow-sm transition hover:bg-brand/10 active:scale-95 disabled:opacity-70"
                >
                  {isFetchingLocation ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Navigation className="h-3.5 w-3.5" />
                  )}
                  {isFetchingLocation ? 'Fetching location...' : '📍 Fetch live location'}
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

      <GlassPanel className="border-slate-200/90 p-4 sm:p-5 space-y-6">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">KYC Photos & Verification Documents</p>
          {!canEdit && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs font-bold text-brand hover:underline transition active:scale-95"
            >
              Edit documents
            </button>
          )}
        </div>

        {/* 1. Mandatory & Primary Photo Upload Grid (Signatory Aadhaar Front/Back, PAN, Selfie) */}
        <div>
          <BusinessKycPhotoUploadGrid
            variant="corporate"
            photos={photos}
            onChange={setPhotos}
            disabled={!canEdit || busy || uploading}
          />
        </div>

        {/* 2. Additional Corporate Documents (COI, GST Certificate, CIN, etc.) */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Additional Corporate Documents (Optional)</p>
            <p className="text-xs text-slate-600">
              Attach Certificate of Incorporation, GST Certificate, or MOA/AOA files.
            </p>
          </div>

          {canEdit ? (
            <div className="space-y-3">
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
