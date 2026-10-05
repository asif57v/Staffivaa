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
  HardHat,
  IndianRupee,
  Navigation,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { assetUrlFromUpload, uploadDocument } from '../../../api/uploadApi.js'
import { UPLOAD_FOLDERS } from '../../../constants/uploadFolders.js'
import { INDIAN_STATES } from '../../../constants/corporateVerification.js'
import { LanguageSwitcher } from '../../../components/common/LanguageSwitcher.jsx'
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
  usePatchCorporateMeMutation,
  useSubmitCorporateVerificationMutation,
} from '../../../store/api/workforceApi.js'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-brand/35'
const labelClass = 'mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500'

const BENEFIT_ICONS = [Briefcase, HardHat, IndianRupee]

const GMAPS_LIBRARIES = ['places']

/** Corporate KYC is a single Aadhaar card photo, kept under the `aadhaar_front` slot. */
function profileToPhotos(p) {
  if (!p) return {}
  const photoUrl = Array.isArray(p.kycPhotos)
    ? p.kycPhotos.find((ph) => ph?.url && ph.type === 'aadhaar_front')?.url
    : undefined
  const docUrl = Array.isArray(p.documents)
    ? p.documents.find((d) => {
        if (!d?.url) return false
        const type = (d.documentType || '').toLowerCase()
        const label = (d.label || '').toLowerCase()
        return (
          type === 'aadhaar_front' ||
          type === 'authorized_signatory_id' ||
          label.includes('aadhaar front') ||
          label.includes('aadhar front') ||
          label.includes('signatory id')
        )
      })?.url
    : undefined
  const url = p.kycFrontImageUrl || photoUrl || docUrl
  return url ? { aadhaar_front: url } : {}
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
          // Older drafts may still hold Aadhaar back / PAN / selfie slots — only the Aadhaar card is kept now.
          const draftAadhaar = draft.photos?.aadhaar_front
          const mergedPhotos = {
            ...remotePhotos,
            ...(draftAadhaar ? { aadhaar_front: draftAadhaar } : {}),
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
  }, [user?._id, profile?.companyName, profile?.kycFrontImageUrl])

  const draftProfile = useMemo(
    () =>
      buildProfileFromForm({
        ...form,
        documents,
        kycPhotos: Object.values(photos).filter(Boolean),
        kycFrontImageUrl: photos.aadhaar_front,
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

    const aadhaarDoc = await uploadSlot(
      'aadhaar_front',
      'Authorized Signatory Aadhaar Card',
      currentPhotos.aadhaar_front,
    )

    return {
      kycFrontImageUrl: aadhaarDoc?.url || '',
      kycPhotos: aadhaarDoc ? [aadhaarDoc] : [],
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
              Company PAN (optional)
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

        {/* 1. Mandatory KYC photo (single Authorized Signatory Aadhaar card photo) */}
        <div>
          <BusinessKycPhotoUploadGrid
            variant="corporate"
            photos={photos}
            onChange={setPhotos}
            disabled={!canEdit || busy}
          />
        </div>
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
          disabled={!progress.readyToSubmit || busy}
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

      <LanguageSwitcher className="mt-4" />
    </div>
  )
}
