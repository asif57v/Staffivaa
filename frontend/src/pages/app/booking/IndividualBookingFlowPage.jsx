import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Autocomplete, useLoadScript } from '@react-google-maps/api'
import { motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ImagePlus,
  IndianRupee,
  Loader2,
  MapPin,
  MapPinned,
  MessageCircle,
  Navigation,
  Phone,
  Zap,
} from 'lucide-react'
import { io } from 'socket.io-client'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { AppButton } from '../../../components/app-ui/buttons/AppButton.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { AppTextInput } from '../../../components/app-ui/inputs/AppTextInput.jsx'
import { GlassPanel } from '../../../components/ui/GlassPanel.jsx'
import { BookingFindingScreen } from '../../../components/app/booking/BookingFindingScreen.jsx'
import { BookingLiveTrackingScreen } from '../../../components/app/booking/BookingLiveTrackingScreen.jsx'
import { BookingTypeSheet } from '../../../components/app/booking/BookingTypeSheet.jsx'
import { BookingStepProgress } from '../../../components/app/booking/BookingStepProgress.jsx'
import {
  BOOKING_JOB_TIMELINE,
  PAYMENT_METHODS,
  bookingPayloadFromDraft,
  createIndividualBookingRecord,
  durationKindLabel,
  durationKindToDays,
  estimateIndividualBooking,
  findBookingByRef,
  formatInr,
  loadIndividualBookings,
  saveIndividualBookings,
  todayISODate,
} from '../../../lib/individualBookings.js'
import {
  clearBookingDraft,
  patchBookingDraft,
  readBookingDraft,
  writeBookingDraft,
} from '../../../lib/individualBookingDraft.js'
import { readAppUserLocation, writeAppUserLocation } from '../../../lib/appUserLocationStorage.js'
import { useCreateRequestMutation, useGetPublicSystemPricingQuery } from '../../../store/api/workforceApi.js'
import { enrichDiscoverLabourUi } from '../../../lib/discoverLabourDummyUi.js'
import { store } from '../../../store/index.js'
import {
  APP_HOME_LOCATION,
  BOOKING_FLOW_PATH,
  buildBookingFlowPath,
} from '../../../lib/bookingFlowNavigation.js'

const TIME_SLOTS = ['9:00 AM – 12:00 PM', '12:00 PM – 3:00 PM', '3:00 PM – 6:00 PM', '6:00 PM – 9:00 PM']
const GOOGLE_MAPS_LIBRARIES = ['places']

function FlowHeader({ title, subtitle, onBack }) {
  return (
    <motion.div layout className="-mx-4 px-4 pb-2">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onBack}
          className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-800 shadow-sm transition hover:border-brand/35 hover:text-brand"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand">Booking</p>
          <h1 className="text-xl font-black tracking-tight text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-1 text-xs text-slate-600">{subtitle}</p> : null}
        </div>
      </div>
    </motion.div>
  )
}

function FieldLabel({ children, optional }) {
  return (
    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
      {children}
      {optional ? <span className="ml-1 font-normal normal-case text-slate-400">(optional)</span> : null}
    </label>
  )
}

export function IndividualBookingFlowPage() {
  const navigate = useNavigate()
  const [createRequest] = useCreateRequestMutation()
  const { data: pricingData } = useGetPublicSystemPricingQuery()
  const location = useLocation()
  const reduce = useReducedMotion()
  const [searchParams] = useSearchParams()
  const step = searchParams.get('step') || 'type'
  const refParam = searchParams.get('ref')?.trim() || ''
  const categoryIdParam = searchParams.get('categoryId')?.trim() || ''
  const groupIdParam = searchParams.get('groupId')?.trim() || ''

  const [draft, setDraft] = useState(() => readBookingDraft() || {})
  const [formError, setFormError] = useState('')
  const [typeSheetOpen, setTypeSheetOpen] = useState(false)
  const [activeBooking, setActiveBooking] = useState(null)
  const [noMatch, setNoMatch] = useState(false)
  const [imageFiles, setImageFiles] = useState([])
  const [isLocating, setIsLocating] = useState(false)
  const [autocomplete, setAutocomplete] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  })

  const syncDraft = useCallback((patch) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      writeBookingDraft(next)
      return next
    })
  }, [])

  const flowQuery = useCallback(
    () => ({
      categoryId: draft.categoryId || categoryIdParam,
      groupId: draft.groupId || groupIdParam,
      ref: activeBooking?.ref || refParam || draft?.lastRef || undefined,
    }),
    [categoryIdParam, draft.categoryId, draft.groupId, groupIdParam, refParam, activeBooking?.ref, draft?.lastRef],
  )

  const goStep = useCallback(
    (nextStep) => {
      navigate(buildBookingFlowPath(nextStep, flowQuery()), { replace: true })
    },
    [flowQuery, navigate],
  )

  const leaveFlow = useCallback(() => {
    navigate(APP_HOME_LOCATION, { replace: true })
  }, [navigate])

  useEffect(() => {
    const stored = readBookingDraft()
    if (stored) queueMicrotask(() => setDraft(stored))
  }, [])

  // ── Raw fetch polling — detects when a labour accepts the booking ──
  useEffect(() => {
    if (step !== 'searching') return

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1'
    let cancelled = false

    const transitionToActive = (workerInfo) => {
      if (cancelled) return
      const worker = workerInfo ? {
        id: workerInfo._id || workerInfo.id,
        displayName: workerInfo.fullName || workerInfo.displayName || workerInfo.name || 'Verified Worker',
        photoUrl: workerInfo.profileImageUrl || workerInfo.photoUrl || null,
        phone: workerInfo.phone || '+91 98••• •••42',
      } : null

      const updated = {
        ...(activeBooking || {}),
        status: 'accepted',
        assignedWorker: worker,
        jobTimelineStep: 'accepted',
        etaMinutes: 22,
      }
      setActiveBooking(updated)
      const stored = loadIndividualBookings().map((b) => (b.id === updated.id ? updated : b))
      saveIndividualBookings(stored)
      goStep('active')
      setNoMatch(false)
    }

    const pollSpecificRequest = async (requestId) => {
      try {
        const token = store.getState().auth.token
        const res = await fetch(`${baseUrl}/workforce/requests/${requestId}`, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        })
        if (!res.ok) { console.warn('[Homeowner] Poll fetch failed:', res.status); return }
        const json = await res.json()
        const { request, assignments } = json?.data || json || {}
        const acceptedAssignment = assignments?.find(a => ['accepted', 'on_site', 'in_progress', 'completed'].includes(a.status))
        console.log('[Homeowner] Poll specific request:', requestId, 'status:', request?.status, 'acceptedAssignment:', !!acceptedAssignment)

        if (acceptedAssignment) {
          console.log('[Homeowner] ACCEPTED! Transitioning to live tracking')
          transitionToActive(acceptedAssignment.labourId || acceptedAssignment)
        }
      } catch (err) { console.error('[Homeowner] Poll error:', err) }
    }

    const pollAllRequests = async () => {
      try {
        const token = store.getState().auth.token
        const res = await fetch(`${baseUrl}/workforce/requests`, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        })
        if (!res.ok) { console.warn('[Homeowner] Poll all requests failed:', res.status); return }
        const json = await res.json()
        const requests = json?.data?.requests || json?.requests || []
        console.log('[Homeowner] Poll all requests, count:', requests.length)

        // Find the most recent request that isn't cancelled/completed
        if (!activeBooking?.requestId) return

        const activeReq = requests.find(
          r => r._id === activeBooking.requestId
        )




        if (!activeReq) return
        if (!activeReq) return

        // Now fetch that specific request to get its assignments
        const detailRes = await fetch(`${baseUrl}/workforce/requests/${activeReq._id}`, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        })
        if (!detailRes.ok) return
        const detailJson = await detailRes.json()
        const { assignments } = detailJson?.data || detailJson || {}
        const acceptedAssignment = assignments?.find(a => ['accepted', 'on_site', 'in_progress', 'completed'].includes(a.status))
        console.log('[Homeowner] Poll fallback: request', activeReq._id, 'acceptedAssignment:', !!acceptedAssignment)

        if (acceptedAssignment) {
          // Also save the requestId on activeBooking for future use
          if (activeBooking && !activeBooking.requestId) {
            activeBooking.requestId = activeReq._id
          }
          transitionToActive(acceptedAssignment?.labourId)
        }
      } catch (err) { console.error('[Homeowner] Poll all error:', err) }
    }

    const poll = () => {
      if (activeBooking?.requestId) {
        pollSpecificRequest(activeBooking.requestId)
      } else {
        console.log('[Homeowner] No requestId — falling back to pollAllRequests')
        pollAllRequests()
      }
    }

    // Initial fetch to check status on load
    poll()

    // Socket.io for instant updates
    let socket = null
    try {
      const socketUrl = baseUrl.replace('/api/v1', '')
      socket = io(socketUrl, { 
        withCredentials: true,
        transports: ['websocket', 'polling']
      })
      
      socket.on('connect', () => {
        console.log('[Socket.io] Connected:', socket.id)
        if (activeBooking?.requestId) {
          socket.emit('join_request', activeBooking.requestId)
        }
      })

      socket.on('disconnect', (reason) => {
        console.log('[Socket.io] Disconnected:', reason)
      })

      socket.on('connect_error', (err) => {
        console.error('[Socket.io] Connection Error:', err.message)
      })

      socket.on('reconnect', (attempt) => {
        console.log('[Socket.io] Reconnected on attempt:', attempt)
      })

      socket.on('bookingAccepted', (data) => {
        console.log('[Homeowner] bookingAccepted socket event received:', data)
        const workerInfo = data.labourId ? {
          _id: data.labourId,
          fullName: data.labourName,
          phone: data.labourPhone
        } : null
        transitionToActive(workerInfo)
      })
    } catch (err) {
      console.error('Socket init error:', err)
    }

    return () => {
      cancelled = true
      if (socket) {
        socket.off('connect')
        socket.off('disconnect')
        socket.off('connect_error')
        socket.off('reconnect')
        socket.off('bookingAccepted')
        if (activeBooking?.requestId) socket.emit('leave_request', activeBooking.requestId)
        socket.disconnect()
      }
    }
  }, [step, activeBooking, goStep])

  useEffect(() => {
    if (!refParam || activeBooking) return
    const found = findBookingByRef(loadIndividualBookings(), refParam)
    if (found) queueMicrotask(() => setActiveBooking(found))
  }, [refParam, activeBooking])

  useEffect(() => {
    if (location.pathname !== BOOKING_FLOW_PATH) return
    if (refParam) return
    if (!draft.categoryId && !categoryIdParam && !['type'].includes(step)) {
      leaveFlow()
    }
  }, [categoryIdParam, draft.categoryId, leaveFlow, location.pathname, refParam, step])

  useEffect(() => {
    if (location.pathname !== BOOKING_FLOW_PATH) return
    if (step !== 'type' || !draft.bookingType) return
    if (draft.entryPoint !== 'category') return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      goStep('details')
    })
    return () => {
      cancelled = true
    }
  }, [draft.bookingType, draft.entryPoint, goStep, location.pathname, step])

  const estimate = useMemo(() => {
    const lines = [
      {
        quantity: Math.max(1, (draft.selectedWorkers || []).length || 1),
      },
    ]
    const days = durationKindToDays(draft.durationKind, draft.durationDays)
    return estimateIndividualBooking({ lines, durationDays: days }, pricingData?.pricing)
  }, [draft.durationDays, draft.durationKind, draft.selectedWorkers, pricingData])

  const pickLocation = () => {
    if (!navigator.geolocation) {
      setFormError('Location is not supported by your browser.')
      return
    }
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        syncDraft({ lat, lng })
        try {
          const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
          if (!apiKey) {
            syncDraft({ address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` })
            setIsLocating(false)
            return
          }
          const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`)
          const data = await res.json()
          if (data.results && data.results.length > 0) {
            syncDraft({ address: data.results[0].formatted_address })
          } else {
            syncDraft({ address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` })
          }
        } catch {
          syncDraft({ address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` })
        } finally {
          setIsLocating(false)
        }
      },
      () => {
        setFormError('Unable to retrieve your location.')
        setIsLocating(false)
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    )
  }

  const handlePlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace()
      if (place.formatted_address) {
        syncDraft({ 
          address: place.formatted_address,
          lat: place.geometry?.location?.lat(),
          lng: place.geometry?.location?.lng()
        })
      }
    }
  }

  const applySavedAddress = () => {
    const saved = readAppUserLocation()
    if (saved?.address) syncDraft({ address: saved.address, lat: saved.lat, lng: saved.lng })
  }

  const validateDetails = () => {
    if (!draft.address?.trim()) {
      setFormError('Add your work location to continue.')
      return false
    }
    if (draft.bookingType === 'scheduled') {
      if (!draft.serviceDate) {
        setFormError('Choose a date for scheduled booking.')
        return false
      }
      if (draft.serviceDate < todayISODate()) {
        setFormError('Date cannot be in the past.')
        return false
      }
      if (!draft.timeSlot) {
        setFormError('Pick a time slot.')
        return false
      }
    }
    if (draft.matchMode === 'manual' && !(draft.selectedWorkers || []).length) {
      setFormError('Select at least one worker from the list first.')
      return false
    }
    setFormError('')
    return true
  }

  const confirmBooking = async () => {
    if (isGenerating) return
    setIsGenerating(true)
    setTimeout(() => setIsGenerating(false), 3000)

    if (!validateDetails()) return
    writeAppUserLocation({ address: draft.address.trim(), lat: draft.lat, lng: draft.lng })
    const payload = bookingPayloadFromDraft({
      ...draft,
      imageNames: imageFiles.map((f) => f.name),
    })
    const record = createIndividualBookingRecord(payload, pricingData?.pricing)
    record.assignedWorker = null
    record.status = 'searching'
    record.jobTimelineStep = 'searching'
    record.etaMinutes = null


    const stored = loadIndividualBookings()
    saveIndividualBookings([record, ...stored])

    let apiRequestId = null
    try {
      const res = await createRequest({
        lines: [{ categoryId: draft.categoryId, quantity: draft.workers || 1 }],
        startDate: draft.bookingType === 'scheduled' && draft.serviceDate ? draft.serviceDate : new Date().toISOString().slice(0, 10),
        locationText: draft.address.trim(),
        locationLat: draft.lat,
        locationLng: draft.lng,
        notes: payload.notes,
        bookingType: draft.bookingType,
        scheduleType: 'daily',
      }).unwrap()
      console.log('[Homeowner] createRequest response:', res)
      if (res?.request?._id) {
        apiRequestId = res.request._id
        record.requestId = apiRequestId
        saveIndividualBookings([record, ...stored])
        console.log('[Homeowner] requestId saved:', apiRequestId)
      } else {
        console.error('[Homeowner] createRequest response missing request._id:', res)
        setFormError('Failed to parse backend response. Missing request ID.')
        return
      }
    } catch (err) {
      console.error('[Homeowner] createRequest FAILED:', err)
      setFormError(err?.data?.message || err?.message || 'Backend API failed. Are you logged in as a homeowner?')
      return
    }

    console.log('[Homeowner] Setting activeBooking with requestId:', record.requestId, 'record:', record)
    setActiveBooking(record)
    patchBookingDraft({ lastRef: record.ref })

    navigate(buildBookingFlowPath('searching', {
      categoryId: draft.categoryId || categoryIdParam,
      groupId: draft.groupId || groupIdParam,
      ref: record.ref,
    }), { replace: true })
  }

  const simulateAccept = useCallback(() => {
    if (!activeBooking) return
    const worker =
      draft.matchMode === 'smart'
        ? {
          id: 'smart-match',
          displayName: 'Matched worker',
          photoUrl: enrichDiscoverLabourUi({ id: 'smart', displayName: 'Raju S.' }).photoUrl,
          phone: '+91 98••• •••42',
        }
        : (draft.selectedWorkers || [])[0] || null

    const updated = {
      ...activeBooking,
      status: 'accepted',
      assignedWorker: worker,
      jobTimelineStep: 'accepted',
      etaMinutes: 2
    }
    setActiveBooking(updated)
    const stored = loadIndividualBookings().map((b) => (b.id === updated.id ? updated : b))
    saveIndividualBookings(stored)
    goStep('active')
    setNoMatch(false)
  }, [activeBooking, draft.matchMode, draft.selectedWorkers, goStep])

  const handleFindingComplete = () => {
    // If a real API request exists, we wait for the polling logic to transition the page
    if (activeBooking && activeBooking.requestId) return
    simulateAccept()
  }

  const handleNoMatch = () => {
    setNoMatch(true)
  }

  const wizardIndex = step === 'type' ? 0 : step === 'details' ? 1 : step === 'summary' ? 2 : 3

  if (step === 'searching' && !noMatch) {
    return (
      <div className="pb-8">
        <FlowHeader title="Matching labour" subtitle="Hang tight — this usually takes a few seconds" onBack={() => goStep('summary')} />
        <BookingFindingScreen
          categoryLabel={draft.categoryName}
          onComplete={handleFindingComplete}
          onNoMatch={handleNoMatch}
        />
      </div>
    )
  }

  if (noMatch) {
    return (
      <div className="space-y-4 pb-8">
        <FlowHeader title="No Labour Assigned" subtitle="We couldn't find an available worker nearby" onBack={() => navigate('/app/discover/labours')} />
        <GlassPanel className="p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <AlertCircle className="h-8 w-8 text-slate-400" aria-hidden />
          </div>
          <p className="mt-4 text-base font-bold text-slate-900">Booking Expired</p>
          <p className="mt-2 text-sm text-slate-600">No labour was able to accept your request within the 3-minute window. This can happen during peak hours.</p>
          <motion.div layout className="mt-8 flex flex-col gap-3">
            <AppPrimaryButton type="button" onClick={() => { setNoMatch(false); confirmBooking() }}>
              Book Again
            </AppPrimaryButton>
            <AppButton type="button" variant="secondary" onClick={() => navigate('/app/discover/labours')}>
              Browse Available Workers
            </AppButton>
          </motion.div>
        </GlassPanel>
      </div>
    )
  }

  if (step === 'active') {
    const booking = activeBooking
    const worker = booking?.assignedWorker || (draft.selectedWorkers || [])[0]
    return (
      <BookingLiveTrackingScreen
        booking={booking}
        worker={worker}
        draft={draft}
        onBack={() => navigate('/app/bookings', { replace: true })}
        onCancel={() => navigate('/app/bookings', { replace: true })}
      />
    )
  }

  if (step === 'payment') {
    // This step is no longer used, we now pay in the tracking screen.
    return null
  }

  return (
    <div className="space-y-4 pb-8">
      <FlowHeader
        title={
          step === 'type'
            ? 'Booking type'
            : step === 'details'
              ? 'Job details'
              : 'Review & confirm'
        }
        subtitle={draft.categoryName || 'Your booking'}
        onBack={() => {
          if (step === 'type') leaveFlow()
          else if (step === 'details') goStep('type')
          else goStep('details')
        }}
      />

      {step !== 'searching' ? (
        <AppSurface className="border-slate-200/90">
          <BookingStepProgress step={wizardIndex} total={3} />
        </AppSurface>
      ) : null}

      {step === 'type' ? (
        <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <button
            type="button"
            onClick={() => setTypeSheetOpen(true)}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-sm"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
              {draft.bookingType === 'scheduled' ? (
                <Calendar className="h-5 w-5" aria-hidden />
              ) : (
                <Zap className="h-5 w-5" aria-hidden />
              )}
            </span>
            <span className="flex-1">
              <p className="text-sm font-bold text-slate-900">
                {draft.bookingType === 'scheduled' ? 'Schedule booking' : draft.bookingType === 'instant' ? 'Instant booking' : 'Choose booking type'}
              </p>
              <p className="text-xs text-slate-500">Tap to change</p>
            </span>
            <ArrowRight className="h-5 w-5 text-slate-300" aria-hidden />
          </button>
          <AppPrimaryButton
            type="button"
            className="w-full py-3.5"
            disabled={!draft.bookingType}
            onClick={() => goStep('details')}
          >
            Continue
            <ArrowRight className="h-4 w-4" aria-hidden />
          </AppPrimaryButton>
        </motion.div>
      ) : null}

      {step === 'details' ? (
        <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {draft.matchMode === 'smart' && draft.categoryId ? (
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/app/discover/labours?categoryId=${encodeURIComponent(draft.categoryId)}&groupId=${encodeURIComponent(draft.groupId || '')}&promptMode=1`,
                )
              }
              className="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-3 text-sm font-bold text-slate-800 hover:bg-slate-100 hover:border-slate-400 transition shadow-sm"
            >
              Prefer to pick workers yourself? Browse list
            </button>
          ) : null}
          <div>
            <FieldLabel>Work location</FieldLabel>
            {isLoaded ? (
              <Autocomplete
                onLoad={(auto) => setAutocomplete(auto)}
                onPlaceChanged={handlePlaceChanged}
                options={{
                  componentRestrictions: { country: 'in' },
                  fields: ['formatted_address', 'geometry']
                }}
              >
                <AppTextInput
                  value={draft.address || ''}
                  onChange={(e) => syncDraft({ address: e.target.value })}
                  placeholder="House, street, area, city"
                  leftSlot={<MapPin className="h-4 w-4" aria-hidden />}
                />
              </Autocomplete>
            ) : (
              <AppTextInput
                value={draft.address || ''}
                onChange={(e) => syncDraft({ address: e.target.value })}
                placeholder="House, street, area, city"
                leftSlot={<MapPin className="h-4 w-4" aria-hidden />}
              />
            )}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={pickLocation}
                disabled={isLocating}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-brand/25 bg-brand/5 py-2.5 text-[11px] font-bold text-brand disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLocating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Navigation className="h-3.5 w-3.5" aria-hidden />
                )}
                {isLocating ? 'Locating...' : 'Current location'}
              </button>
              <button
                type="button"
                onClick={applySavedAddress}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 py-2.5 text-[11px] font-bold text-slate-700"
              >
                Saved address
              </button>
            </div>
          </div>

          <div>
            <FieldLabel optional>Work note</FieldLabel>
            <textarea
              value={draft.notes || ''}
              onChange={(e) => syncDraft({ notes: e.target.value })}
              rows={2}
              placeholder="Describe the work briefly…"
              className="w-full resize-none rounded-2xl border border-slate-200/90 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand/25"
            />
          </div>

          <div>
            <FieldLabel optional>Photos</FieldLabel>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-4 text-xs font-bold text-slate-600">
              <ImagePlus className="h-4 w-4 text-brand" aria-hidden />
              Upload images
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => setImageFiles([...(e.target.files || [])])}
              />
            </label>
            {imageFiles.length ? (
              <p className="mt-1 text-[11px] text-slate-500">{imageFiles.length} file(s) selected</p>
            ) : null}
          </div>

          <div>
            <FieldLabel>Working duration</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'few_hours', label: 'Few hours' },
                { id: 'full_day', label: 'Full day' },
                { id: 'multi_day', label: 'Multi day' },
              ].map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() =>
                    syncDraft({
                      durationKind: d.id,
                      durationDays: durationKindToDays(d.id, draft.durationDays),
                    })
                  }
                  className={`rounded-full px-3 py-2 text-xs font-bold transition ${draft.durationKind === d.id
                    ? 'bg-brand text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200/80'
                    }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {draft.durationKind === 'multi_day' ? (
              <input
                type="number"
                min={2}
                max={30}
                value={draft.durationDays || 2}
                onChange={(e) => syncDraft({ durationDays: Number(e.target.value) || 2 })}
                className="mt-2 w-full rounded-2xl border border-slate-200/90 px-4 py-2.5 text-sm font-bold"
              />
            ) : null}
          </div>

          {draft.bookingType === 'instant' ? (
            <GlassPanel className="flex items-center gap-2 border-brand/20 bg-brand/5 p-3">
              <Zap className="h-5 w-5 text-brand" aria-hidden />
              <div>
                <p className="text-sm font-bold text-slate-900">ASAP</p>
                <p className="text-xs text-slate-600">We&apos;ll match the earliest available slot</p>
              </div>
            </GlassPanel>
          ) : (
            <div className="space-y-3">
              <div>
                <FieldLabel>Date</FieldLabel>
                <input
                  type="date"
                  min={todayISODate()}
                  value={draft.serviceDate || ''}
                  onChange={(e) => syncDraft({ serviceDate: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200/90 px-4 py-3 text-sm font-semibold"
                />
              </div>
              <div>
                <FieldLabel>Time slot</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  {TIME_SLOTS.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => syncDraft({ timeSlot: slot })}
                      className={`rounded-xl border px-2 py-2.5 text-[11px] font-bold ${draft.timeSlot === slot
                        ? 'border-brand/40 bg-brand/8 ring-2 ring-brand/20'
                        : 'border-slate-200/90'
                        }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {formError ? (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-950">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {formError}
            </p>
          ) : null}

          <AppPrimaryButton type="button" className="w-full py-3.5" onClick={() => (validateDetails() ? goStep('summary') : null)}>
            Review booking
            <ArrowRight className="h-4 w-4" aria-hidden />
          </AppPrimaryButton>
        </motion.div>
      ) : null}

      {step === 'summary' ? (
        <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <GlassPanel className="space-y-3 p-4 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Service</span>
              <span className="text-right font-bold text-slate-900">
                {draft.groupName}
                <br />
                {draft.categoryName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Booking</span>
              <span className="font-bold capitalize">{draft.bookingType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">When</span>
              <span className="font-bold text-slate-900">
                {draft.bookingType === 'instant'
                  ? 'ASAP'
                  : `${draft.serviceDate} · ${draft.timeSlot}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Duration</span>
              <span className="font-bold">{durationKindLabel(draft.durationKind)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="shrink-0 text-slate-500">Workers</span>
              <span className="text-right font-bold">
                {draft.matchMode === 'smart'
                  ? 'Smart match'
                  : (draft.selectedWorkers || []).map((w) => w.displayName).join(', ') || '—'}
              </span>
            </div>
            <p className="flex items-start gap-2 text-slate-800">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
              {draft.address}
            </p>
            <div className="border-t border-slate-100 pt-3">
              <div className="flex justify-between text-slate-600">
                <span>Visiting charge</span>
                <span>{formatInr(estimate.estimatedSubtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Platform fee</span>
                <span>{formatInr(estimate.platformFee)}</span>
              </div>
              <div className="mt-2 flex justify-between text-base font-black text-brand">
                <span>Total</span>
                <span>{formatInr(estimate.grandTotal)}</span>
              </div>
            </div>
          </GlassPanel>

          <div className="flex gap-2">
            <AppButton type="button" variant="secondary" className="flex-1" onClick={() => goStep('details')}>
              Edit details
            </AppButton>
            <AppPrimaryButton type="button" className="flex-1 py-3.5" disabled={isGenerating} onClick={confirmBooking}>
              {isGenerating ? 'Processing...' : 'Request Booking'}
              {!isGenerating && <CheckCircle2 className="h-4 w-4 ml-1 inline" aria-hidden />}
            </AppPrimaryButton>
          </div>
        </motion.div>
      ) : null}

      <BookingTypeSheet
        open={typeSheetOpen}
        onClose={() => setTypeSheetOpen(false)}
        value={draft.bookingType}
        categoryLabel={draft.categoryName}
        onSelect={(id) => {
          syncDraft({ bookingType: id })
          setTypeSheetOpen(false)
        }}
      />
    </div>
  )
}

