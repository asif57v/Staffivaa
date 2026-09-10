import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock,
  HardHat,
  IndianRupee,
  RefreshCw,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react'
import { uploadDocument, assetUrlFromUpload } from '../../api/uploadApi.js'
import { submitLabourKycDocuments } from '../../api/userKycApi.js'
import { ApiError } from '../../api/http.js'
import { KYC_STATUS } from '../../constants/userRoles.js'
import { useAuth } from '../../hooks/useAuth.js'
import { setUser } from '../../store/slices/authSlice.js'
import { UPLOAD_FOLDERS } from '../../constants/uploadFolders.js'
import {
  getKycUiState,
  hasKycDetailsOnFile,
  KYC_BENEFITS,
  KYC_WORKFLOW,
  KYC_WORKFLOW_RESUBMIT,
  kycWorkflowStepIndex,
} from '../../lib/labourKycFlow.js'
import { saveKycDraft, loadKycDraft, clearKycDraft } from '../../lib/kycDraftStorage.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { LabourKycHero } from '../../components/labour/kyc/LabourKycHero.jsx'
import { LabourKycWorkflowTimeline } from '../../components/labour/kyc/LabourKycWorkflowTimeline.jsx'
import { LabourKycPhotoUploadGrid } from '../../components/labour/kyc/LabourKycPhotoUploadGrid.jsx'

function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '').slice(0, 12)
}

function normalizePan(s) {
  return String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10)
}

const BENEFIT_ICONS = [HardHat, ShieldCheck, IndianRupee]

export function AppKycPage() {
  const reduce = useReducedMotion()
  const dispatch = useDispatch()
  const { user } = useAuth()

  const [aadhaar, setAadhaar] = useState('')
  const [pan, setPan] = useState('')
  const [photos, setPhotos] = useState({})
  const [busy, setBusy] = useState(false)
  const [busyText, setBusyText] = useState('')
  const [banner, setBanner] = useState(null)
  const [draftLoaded, setDraftLoaded] = useState(false)

  useEffect(() => {
    if (!banner) return
    const timer = setTimeout(() => setBanner(null), 5000)
    return () => clearTimeout(timer)
  }, [banner])

  const profile = user?.labourProfile
  const kyc = profile?.kycStatus || KYC_STATUS.PENDING
  const submittedAt = profile?.kycSubmittedAt
  const reviewNote = profile?.kycReviewNote
  const ui = getKycUiState(profile)
  const isResubmit = ui.phase === 'failed' && hasKycDetailsOnFile(profile)

  const aadhaarDigits = digitsOnly(aadhaar).length
  const normalizedPan = normalizePan(pan)
  const panValid = normalizedPan.length === 10
  const detailsReady = isResubmit || (aadhaarDigits === 12 && panValid)

  const hasValidSlot = (slotValue) => {
    if (!slotValue) return false
    if (typeof slotValue === 'string') return Boolean(slotValue.trim())
    if (typeof slotValue === 'object') return Boolean(slotValue.file || slotValue.previewUrl)
    return false
  }

  const hasMandatoryPhotos =
    hasValidSlot(photos.aadhaar_front) &&
    hasValidSlot(photos.aadhaar_back) &&
    hasValidSlot(photos.pan)

  const canSubmit = (isResubmit ? detailsReady : (detailsReady && hasMandatoryPhotos)) && !busy
  const workflowStep = kycWorkflowStepIndex({
    kycStatus: kyc,
    submittedAt,
    aadhaarDigits,
    panValid,
    detailsOnFile: isResubmit,
  })

  const phaseLabels = {
    verified: 'Verified',
    review: 'In review',
    failed: 'Action needed',
    submit: 'Not submitted',
  }

  // Keep latest form state in a ref so unmount/pagehide handlers always have newest values
  const latestStateRef = useRef({ aadhaar: '', pan: '', photos: {}, userId: user?._id })
  const isLoadedRef = useRef(false)

  useEffect(() => {
    latestStateRef.current = { aadhaar, pan, photos, userId: user?._id }
  }, [aadhaar, pan, photos, user?._id])

  // Load persistent draft on mount / user change
  useEffect(() => {
    let cancelled = false
    async function initDraft() {
      if (ui.phase === 'verified') {
        setDraftLoaded(true)
        isLoadedRef.current = true
        return
      }
      try {
        const draft = await loadKycDraft(user?._id)
        if (!cancelled && draft) {
          const hasDraftText = Boolean(draft.aadhaar || draft.pan)
          const hasDraftPhotos = draft.photos && Object.keys(draft.photos).length > 0

          if (draft.aadhaar) setAadhaar(digitsOnly(draft.aadhaar))
          if (draft.pan) setPan(normalizePan(draft.pan))
          if (hasDraftPhotos) {
            setPhotos(draft.photos)
          }

          if (hasDraftText || hasDraftPhotos) {
            latestStateRef.current = {
              aadhaar: digitsOnly(draft.aadhaar || ''),
              pan: normalizePan(draft.pan || ''),
              photos: draft.photos || {},
              userId: user?._id,
            }
          }
        }
      } catch (err) {
        console.warn('[AppKycPage] Failed to restore draft:', err)
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
  }, [user?._id, ui.phase])

  // Auto-save draft when fields or photos change (after initial draft load)
  useEffect(() => {
    if (!draftLoaded || !isLoadedRef.current || ui.phase === 'verified') return
    const timer = setTimeout(() => {
      saveKycDraft({
        aadhaar,
        pan,
        photos,
        userId: user?._id,
      })
    }, 200)
    return () => clearTimeout(timer)
  }, [aadhaar, pan, photos, draftLoaded, user?._id, ui.phase])

  // Guaranteed immediate save on unmount (when worker taps back / navigates away / closes app)
  useEffect(() => {
    const handleSaveOnExit = () => {
      if (!isLoadedRef.current || ui.phase === 'verified') return
      const current = latestStateRef.current
      if (current && (current.aadhaar || current.pan || (current.photos && Object.keys(current.photos).length > 0))) {
        saveKycDraft(current)
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
  }, [ui.phase])

  const handleSubmit = async () => {
    setBanner(null)
    const d = digitsOnly(aadhaar)
    if (!isResubmit) {
      if (d.length !== 12) {
        setBanner({ variant: 'error', message: 'Enter all 12 Aadhaar digits.' })
        return
      }
      if (!panValid) {
        setBanner({ variant: 'error', message: 'Enter a valid 10-character PAN number.' })
        return
      }
      if (!hasValidSlot(photos.aadhaar_front)) {
        setBanner({ variant: 'error', message: 'Please upload Aadhaar Card (Front side photo).' })
        return
      }
      if (!hasValidSlot(photos.aadhaar_back)) {
        setBanner({ variant: 'error', message: 'Please upload Aadhaar Card (Back side photo).' })
        return
      }
      if (!hasValidSlot(photos.pan)) {
        setBanner({ variant: 'error', message: 'Please upload PAN Card photo.' })
        return
      }
    } else if ((d.length > 0 && d.length !== 12) || (normalizedPan.length > 0 && !panValid)) {
      setBanner({ variant: 'error', message: 'Update Aadhaar and PAN only if you want to change them.' })
      return
    }

    setBusy(true)
    setBusyText('Uploading documents to secure storage...')
    try {
      // Parallel upload of any staged local files
      const uploadSlot = async (slotId, label, slotValue) => {
        if (!slotValue) return null
        if (typeof slotValue === 'string' && slotValue.trim()) {
          return { label, url: slotValue, type: slotId }
        }
        if (typeof slotValue === 'object' && slotValue.file) {
          const uploaded = await uploadDocument(slotValue.file, UPLOAD_FOLDERS.KYC_DOCUMENTS)
          const remoteUrl = assetUrlFromUpload(uploaded)
          if (!remoteUrl) throw new Error(`Failed to upload ${label}`)
          return { label, url: remoteUrl, type: slotId }
        }
        if (typeof slotValue === 'object' && slotValue.previewUrl && !slotValue.previewUrl.startsWith('blob:')) {
          return { label, url: slotValue.previewUrl, type: slotId }
        }
        return null
      }

      const [frontDoc, backDoc, panDoc, selfieDoc] = await Promise.all([
        uploadSlot('aadhaar_front', 'Aadhaar Card (Front)', photos.aadhaar_front),
        uploadSlot('aadhaar_back', 'Aadhaar Card (Back)', photos.aadhaar_back),
        uploadSlot('pan', 'PAN Card', photos.pan),
        uploadSlot('selfie', 'Worker Selfie', photos.selfie),
      ])

      const photoList = [frontDoc, backDoc, panDoc, selfieDoc].filter(Boolean)

      const payload = {
        photos: photoList,
        frontImageUrl: frontDoc?.url || '',
        backImageUrl: backDoc?.url || '',
        panImageUrl: panDoc?.url || '',
        selfieUrl: selfieDoc?.url || '',
      }
      if (!isResubmit || d.length === 12) payload.aadhaar = d
      if (!isResubmit || panValid) payload.pan = normalizedPan

      setBusyText('Submitting KYC details for verification...')
      const res = await submitLabourKycDocuments(payload)
      if (res.data?.user) dispatch(setUser(res.data.user))
      setBanner({ variant: 'success', message: res.message || 'Submitted for admin review.' })
      await clearKycDraft(user?._id)
      setPhotos({})
      if (!isResubmit) {
        setAadhaar('')
        setPan('')
      }
    } catch (e) {
      const msg = e instanceof ApiError
        ? (Array.isArray(e.errors) && e.errors.length > 0
            ? e.errors.map((err) => err.message).filter(Boolean).join(', ') || e.message
            : e.message)
        : (e?.message || 'KYC submission failed. Try again.')
      setBanner({
        variant: 'error',
        message: msg,
      })
    } finally {
      setBusy(false)
      setBusyText('')
    }
  }

  const showForm = ui.phase === 'submit' || ui.phase === 'failed' || ui.phase === 'review'
  const compactForm = ui.phase === 'review'

  return (
    <div className="space-y-4 pb-8">
      <AnimatePresence>
        {banner ? (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed left-4 right-4 top-3 z-[200] mx-auto max-w-md rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-3 ${
              banner.variant === 'success'
                ? 'bg-emerald-900/95 text-white border border-emerald-400/50 backdrop-blur-md'
                : 'bg-rose-900/95 text-white border border-rose-400/50 backdrop-blur-md'
            }`}
            role="status"
          >
            <div className="flex-1 min-w-0">
              <span className="text-xs sm:text-sm font-bold leading-snug block">{banner.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition shrink-0"
              aria-label="Close message"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <LabourKycHero
        title={ui.title}
        subtitle={ui.subtitle}
        phaseLabel={phaseLabels[ui.phase]}
        tone={ui.tone}
        maskedAadhaar={
          ui.phase === 'verified' || ui.phase === 'review' || ui.phase === 'failed' ? profile?.aadhaarMasked : null
        }
        maskedPan={ui.phase === 'verified' || ui.phase === 'review' || ui.phase === 'failed' ? profile?.panMasked : null}
      />

      {ui.phase === 'verified' ? (
        <GlassPanel className="border-emerald-200/80 bg-emerald-50/50 p-5 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" aria-hidden />
          <p className="mt-3 text-sm text-slate-600">You are cleared to accept jobs and check in on site.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <AppPrimaryButton as={Link} to="/app/jobs" className="py-2.5 text-xs">
              <Briefcase className="h-3.5 w-3.5" aria-hidden />
              My jobs
            </AppPrimaryButton>
            <Link
              to="/app/profile"
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800"
            >
              Profile
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </GlassPanel>
      ) : null}

      {ui.phase === 'review' && !banner ? (
        <GlassPanel className="border-sky-200/80 bg-sky-50/50 p-4">
          <div className="flex gap-3">
            <Clock className="h-10 w-10 shrink-0 text-sky-600" aria-hidden />
            <div>
              <p className="text-sm font-extrabold text-sky-950">Submitted for review</p>
              <p className="mt-1 text-xs leading-relaxed text-sky-900/90">
                {submittedAt
                  ? new Date(submittedAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : '—'}
                . Usually reviewed within 1–2 business days (demo).
              </p>
            </div>
          </div>
        </GlassPanel>
      ) : null}

      {ui.phase === 'failed' && reviewNote ? (
        <GlassPanel className="border-rose-200/80 bg-rose-50/50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-800">Admin note</p>
          <p className="mt-1 text-sm leading-relaxed text-rose-950">{reviewNote}</p>
        </GlassPanel>
      ) : null}

      <GlassPanel className="border-slate-200/90 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Verification journey</p>
        <div className="mt-3">
          <LabourKycWorkflowTimeline
            activeIndex={workflowStep}
            tone={ui.tone}
            steps={isResubmit ? KYC_WORKFLOW_RESUBMIT : KYC_WORKFLOW}
          />
        </div>
      </GlassPanel>

      <GlassPanel className="border-violet-200/50 bg-linear-to-br from-violet-50/80 to-white p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-800/80">Why verify?</p>
        <ul className="mt-3 space-y-2.5">
          {KYC_BENEFITS.map((b, i) => {
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

      {showForm ? (
        <GlassPanel className="border-slate-200/90 p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {compactForm ? 'Update documents & photos' : 'Submit KYC documents & photos'}
          </p>
          {compactForm ? (
            <p className="mt-1 text-xs text-slate-600">Upload clearer photos before admin reviews your profile.</p>
          ) : isResubmit ? (
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Your previous Aadhaar and PAN numbers are saved. Upload new clear photos of your documents and selfie, then submit again.
            </p>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Please upload clear photos: Aadhaar front, Aadhaar back, and PAN card are mandatory. Worker selfie is optional.
            </p>
          )}

          {isResubmit ? (
            <div className="mt-4 rounded-xl border border-slate-200/90 bg-slate-50 px-3 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Saved details</p>
              <p className="mt-1 font-mono text-sm text-slate-800">Aadhaar {profile.aadhaarMasked}</p>
              <p className="font-mono text-sm text-slate-800">PAN {profile.panMasked}</p>
              <p className="mt-2 text-[11px] text-slate-500">Only updated photos are required for resubmission.</p>
            </div>
          ) : null}

          {!isResubmit ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500" htmlFor="aadhaar">
                Aadhaar number
              </label>
              <input
                id="aadhaar"
                inputMode="numeric"
                autoComplete="off"
                maxLength={12}
                placeholder="XXXX XXXX XXXX"
                value={aadhaar}
                onChange={(e) => {
                  const val = digitsOnly(e.target.value)
                  setAadhaar(val)
                  if (val.length === 12) {
                    const panInput = document.getElementById('pan')
                    if (panInput && !pan) {
                      panInput.focus()
                    } else {
                      e.target.blur()
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const panInput = document.getElementById('pan')
                    if (panInput && !pan) {
                      panInput.focus()
                    } else {
                      e.currentTarget.blur()
                    }
                  }
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-mono text-lg font-semibold tracking-[0.2em] text-slate-900 outline-none focus:ring-2 focus:ring-violet-400/40"
              />
              <p className="mt-1 text-right text-xs font-bold text-slate-400">{aadhaarDigits}/12</p>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500" htmlFor="pan">
                PAN number
              </label>
              <input
                id="pan"
                autoComplete="off"
                maxLength={10}
                placeholder="ABCDE1234F"
                value={pan}
                onChange={(e) => {
                  const val = normalizePan(e.target.value)
                  setPan(val)
                  if (val.length === 10) {
                    e.target.blur()
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur()
                  }
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-mono text-lg font-semibold uppercase tracking-[0.18em] text-slate-900 outline-none focus:ring-2 focus:ring-violet-400/40"
              />
              <p className={`mt-1 text-right text-xs font-bold ${pan && !panValid ? 'text-rose-500' : 'text-slate-400'}`}>
                {normalizedPan.length}/10
              </p>
            </div>
          </div>
          ) : null}

          <div className="mt-5">
            <LabourKycPhotoUploadGrid
              photos={photos}
              onChange={setPhotos}
              disabled={busy}
            />
          </div>

          <AppPrimaryButton
            type="button"
            className="mt-5 w-full py-3.5 text-sm flex items-center justify-center gap-2"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {busy ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>{busyText || 'Processing...'}</span>
              </>
            ) : compactForm || isResubmit ? (
              <>
                <RefreshCw className="h-4 w-4" aria-hidden />
                <span>Submit again</span>
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" aria-hidden />
                <span>Submit for admin review</span>
              </>
            )}
          </AppPrimaryButton>
        </GlassPanel>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Link
          to="/app/work-categories"
          className="flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-100 transition hover:border-brand/30"
        >
          <Wrench className="h-5 w-5 text-brand" aria-hidden />
          <span className="text-xs font-bold text-slate-900">Update skills</span>
        </Link>
        <Link
          to="/app/profile"
          className="flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-100 transition hover:border-brand/30"
        >
          <ArrowRight className="h-5 w-5 text-slate-400" aria-hidden />
          <span className="text-xs font-bold text-slate-900">Profile</span>
        </Link>
      </div>
    </div>
  )
}
