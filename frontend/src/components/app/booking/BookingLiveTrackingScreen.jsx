import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Phone,
  MessageCircle,
  MapPin,
  X,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Navigation2,
  AlertCircle,
  Calendar,
  CreditCard,
  FileText,
  Loader2,
  User,
  Lock,
  Share2,
  ChevronUp,
  ChevronDown,
  ShieldAlert,
  HelpCircle,
  Copy,
  Check,
  Sparkles,
  Zap,
  PlusCircle,
} from 'lucide-react'
import { io } from 'socket.io-client'
import { useLoadScript } from '@react-google-maps/api'
import { LiveTrackingMap } from './LiveTrackingMap.jsx'
import {
  useGetRequestQuery,
  useCreateRazorpayOrderMutation,
  useVerifyRazorpayPaymentMutation,
  useCreateExtraWorkMutation,
  useGetExtraWorkQuery,
  useUpdateExtraWorkStatusMutation,
} from '../../../store/api/workforceApi.js'
import { hashSeed } from '../../../lib/discoverLabourDummyUi.js'
import { loadRazorpayScript } from '../../../lib/razorpay.js'
import { ExtraWorkModal } from './ExtraWorkModal.jsx'
import {
  markLocalBookingCancelled,
  notifyWorkerCancelledBooking,
} from '../../../lib/individualBookings.js'

const GOOGLE_MAPS_LIBRARIES = ['places']

export function BookingLiveTrackingScreen({ booking, worker, draft, onBack, onCancel }) {
  const requestId = booking?.requestId || booking?._id
  const [stopRequestPoll, setStopRequestPoll] = useState(false)
  const [liveEtaInfo, setLiveEtaInfo] = useState(null)
  const [isSheetExpanded, setIsSheetExpanded] = useState(false)
  const [copiedOtp, setCopiedOtp] = useState(false)
  const [showSosModal, setShowSosModal] = useState(false)

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const { isLoaded: isMapLoaded } = useLoadScript({
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  })

  const { data: requestData, isLoading, error, isError, refetch } = useGetRequestQuery(requestId, {
    skip: !requestId || stopRequestPoll,
    pollingInterval: stopRequestPoll ? 0 : 7000,
  })

  // Expired / deleted bookings return 404 — stop hammering the API
  useEffect(() => {
    const status = error?.status || error?.originalStatus || error?.data?.statusCode
    if (!isError) return
    if (status === 404 || status === 410) {
      setStopRequestPoll(true)
      markLocalBookingCancelled({
        requestId,
        ref: booking?.ref || booking?.reference,
        reason: 'cancelled',
      })
    }
  }, [isError, error, requestId, booking?.ref, booking?.reference])

  const [createOrder, { isLoading: isCreatingOrder }] = useCreateRazorpayOrderMutation()
  const [verifyPayment, { isLoading: isVerifying }] = useVerifyRazorpayPaymentMutation()

  const [isExtraWorkModalOpen, setIsExtraWorkModalOpen] = useState(false)
  const { data: extraWorkData, refetch: refetchExtraWork } = useGetExtraWorkQuery(requestId, { skip: !requestId })
  const [createExtraWork, { isLoading: isCreatingExtraWork }] = useCreateExtraWorkMutation()
  const [updateExtraWorkStatus] = useUpdateExtraWorkStatusMutation()
  const extraWorks = extraWorkData?.extraWorks || []

  const handleCreateExtraWork = async (data) => {
    try {
      await createExtraWork({ id: requestId, ...data }).unwrap()
      setIsExtraWorkModalOpen(false)
      refetchExtraWork()
    } catch (err) {
      alert(err?.data?.message || 'Failed to request extra work')
    }
  }

  const handleExtraWorkUserResponse = async (ewId, status) => {
    try {
      await updateExtraWorkStatus({ extraWorkId: ewId, status }).unwrap()
      refetchExtraWork()
      refetch()
    } catch (err) {
      alert('Failed to update')
    }
  }

  const handlePayment = async () => {
    if (!requestId || String(requestId).startsWith('demo-')) {
      setRealtimeStatus({ requestStatus: 'confirmed' })
      alert('Simulated Payment Successful!')
      return
    }

    try {
      const isLoaded = await loadRazorpayScript()
      if (!isLoaded) {
        alert('Failed to load payment gateway. Please check your internet connection.')
        return
      }

      const order = await createOrder(requestId).unwrap()

      if (order?.bypassPayment) {
        await refetch()
        return
      }

      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Staffivaa',
        description: 'Booking Payment',
        order_id: order.orderId,
        handler: async function (response) {
          try {
            await verifyPayment({
              id: requestId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }).unwrap()
            await refetch()
          } catch (err) {
            console.error('Payment verification failed', err)
            alert('Payment verification failed. Please contact support.')
          }
        },
        theme: {
          color: '#FFD100',
        },
      }

      const rzp1 = new window.Razorpay(options)
      rzp1.on('payment.failed', function (response) {
        console.error(response.error)
      })
      rzp1.open()
    } catch (err) {
      console.error('Failed to create order', err)
      alert(err?.data?.message || 'Failed to initiate payment')
    }
  }

  // Socket.io integration
  const [realtimeStatus, setRealtimeStatus] = useState(null)
  const [socketConnected, setSocketConnected] = useState(false)

  useEffect(() => {
    if (!requestId) return
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'
    let socketUrl = import.meta.env.VITE_SOCKET_URL
    if (!socketUrl) {
      socketUrl = baseUrl.replace('/api/v1', '')
      if (socketUrl.includes('5000')) socketUrl = socketUrl.replace('5000', '5001')
      else if (!socketUrl.includes('5001')) socketUrl = 'http://localhost:5001'
    }
    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => {
      console.log('[Socket.io BookingLive] Connected:', socket.id)
      setSocketConnected(true)
      socket.emit('join_request', requestId)
    })

    socket.on('connect_error', (err) => console.error('[Socket.io BookingLive] Error:', err.message))

    socket.on('request_status_update', (data) => {
      setRealtimeStatus(data)
      refetch()
    })

    socket.on('bookingAccepted', (data) => {
      setRealtimeStatus({ requestStatus: data.status })
      refetch()
    })

    socket.on('extra_work_updated', () => {
      refetchExtraWork()
      refetch()
    })

    socket.on('booking_cancelled', (payload) => {
      if (!hasCancelledRef.current) {
        hasCancelledRef.current = true
        markLocalBookingCancelled({
          requestId: requestId || booking?.requestId,
          ref: booking?.ref,
          reason: payload?.reason || 'cancelled',
        })
        if (payload?.fullCancel || payload?.reason === 'labour_cancelled_unpaid') {
          notifyWorkerCancelledBooking({
            message: payload?.message || 'Worker cancelled the booking.',
            requestId: requestId || booking?.requestId,
            ref: booking?.ref,
          })
        } else {
          alert(
            `Booking Cancelled:\n${payload?.message || 'This booking was cancelled.'}\n\nNote: If you paid the platform fee, refund process has been initiated.`,
          )
        }
        onBack()
      }
    })

    socket.on('bookingCancelledByLabour', (payload) => {
      if (payload?.fullCancel || payload?.reason === 'labour_cancelled_unpaid') {
        if (!hasCancelledRef.current) {
          hasCancelledRef.current = true
          markLocalBookingCancelled({
            requestId: requestId || booking?.requestId,
            ref: booking?.ref,
            reason: 'labour_cancelled_unpaid',
          })
          notifyWorkerCancelledBooking({
            message: payload?.message || 'Worker cancelled the booking.',
            requestId: requestId || booking?.requestId,
            ref: booking?.ref,
          })
          onBack()
        }
        return
      }
      alert(payload?.message || 'The assigned worker had to cancel. We are finding a new worker for you immediately.')
      refetch()
    })

    socket.on('disconnect', (reason) => {
      console.log('[Socket.io BookingLive] Disconnected:', reason)
      setSocketConnected(false)
    })

    return () => {
      socket.off('connect')
      socket.off('connect_error')
      socket.off('request_status_update')
      socket.off('bookingAccepted')
      socket.off('extra_work_updated')
      socket.off('booking_cancelled')
      socket.off('bookingCancelledByLabour')
      socket.off('disconnect')
      socket.emit('leave_request', requestId)
      socket.disconnect()
    }
  }, [requestId, refetch])

  // Data Extraction
  const request = requestData?.request || {}

  const [timeLeft, setTimeLeft] = useState(150)

  useEffect(() => {
    let interval
    let pollInterval

    if (request?.status === 'platform_fee_pending' && request?.platformFeePendingAt) {
      const pendingAt = new Date(request.platformFeePendingAt).getTime()
      const expiryTime = pendingAt + 2.5 * 60 * 1000

      interval = setInterval(() => {
        const now = new Date().getTime()
        const remaining = Math.max(0, Math.floor((expiryTime - now) / 1000))
        setTimeLeft(remaining)

        if (remaining <= 0) {
          clearInterval(interval)
          pollInterval = setInterval(() => {
            refetch()
          }, 5000)
        }
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [request?.status, request?.platformFeePendingAt, refetch])

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const assignments = requestData?.assignments || []
  const paymentSummary = requestData?.paymentSummary || { serviceCost: 0, extraCost: 0, platformFee: 0, taxes: 0, totalAmount: 0 }

  const activeAssignment = assignments?.find((a) => ['accepted', 'on_site', 'in_progress', 'completed'].includes(a.status))

  let currentStatus = realtimeStatus?.requestStatus || request?.status || booking?.status || 'pending_review'
  if (activeAssignment && ['on_site', 'in_progress', 'completed'].includes(activeAssignment.status)) {
    currentStatus = activeAssignment.status
  }

  const hasCancelledRef = useRef(false)

  useEffect(() => {
    if (['cancelled', 'expired'].includes(currentStatus)) {
      if (!hasCancelledRef.current) {
        hasCancelledRef.current = true
        markLocalBookingCancelled({
          requestId: requestId || booking?.requestId,
          ref: booking?.ref,
          reason: request?.cancelReason || 'cancelled',
        })
        if (request?.cancelReason === 'labour_cancelled_unpaid') {
          notifyWorkerCancelledBooking({
            message: 'Worker cancelled the booking.',
            requestId: requestId || booking?.requestId,
            ref: booking?.ref,
          })
        } else {
          alert('This booking has been cancelled or expired.')
        }
        onBack()
      }
    } else if (currentStatus === 'searching') {
      onBack()
    }
  }, [currentStatus, onBack, request?.cancelReason, requestId, booking?.requestId, booking?.ref])

  const isAcceptedOrBeyond = ['accepted', 'in_progress', 'on_site', 'completed', 'platform_fee_pending'].includes(currentStatus)
  const fallbackWorker = isAcceptedOrBeyond ? (booking?.assignedWorker || worker || (draft?.selectedWorkers || [])[0]) : null

  const assignedLabour = activeAssignment?.labourId || fallbackWorker || null

  const workerName = assignedLabour?.fullName || assignedLabour?.displayName || assignedLabour?.name || 'Verified Worker'
  const workerId = assignedLabour?._id || assignedLabour?.id || 'N/A'
  const shortWorkerId =
    workerId && workerId !== 'N/A' && workerId !== 'smart-match'
      ? String(workerId).length > 8
        ? `#${String(workerId).slice(-6).toUpperCase()}`
        : `#${String(workerId).replace(/^demo-/, '').toUpperCase()}`
      : workerId

  let defaultPhone = '+91 98765 43210'
  if (workerId && String(workerId).startsWith('demo-')) {
    defaultPhone = '+91 98' + String(hashSeed(workerId, 99999999)).padStart(8, '0')
  } else if (workerId === 'smart-match') {
    defaultPhone = '+91 98989 89898'
  }

  let workerPhone = assignedLabour?.phone || defaultPhone
  if (workerPhone && workerPhone.length === 10 && !workerPhone.startsWith('+')) {
    workerPhone = `+91 ${workerPhone.slice(0, 5)} ${workerPhone.slice(5)}`
  }

  const rawCleanPhone = workerPhone.replace(/\D/g, '')

  const workerAddress = assignedLabour?.contractorProfile?.businessAddress || assignedLabour?.corporateProfile?.registeredAddress || assignedLabour?.address || 'Service Location'
  const workerPic = assignedLabour?.profileImageUrl || assignedLabour?.photoUrl || null
  const workerRating = assignedLabour?.rating || '4.9'
  const workerTotalJobs = assignedLabour?.totalJobs || '140+'

  // Derive customer coordinates for map
  const customerLocation = useMemo(() => {
    if (request?.locationLat != null && request?.locationLng != null) {
      return { lat: Number(request.locationLat), lng: Number(request.locationLng) }
    }
    if (request?.locationPoint?.coordinates?.length === 2) {
      return { lat: Number(request.locationPoint.coordinates[1]), lng: Number(request.locationPoint.coordinates[0]) }
    }
    if (draft?.lat != null && draft?.lng != null) {
      return { lat: Number(draft.lat), lng: Number(draft.lng) }
    }
    return { lat: 22.7196, lng: 75.8577 } // default Indore
  }, [request?.locationLat, request?.locationLng, request?.locationPoint, draft?.lat, draft?.lng])

  // Derive initial worker coordinates for map
  const initialWorkerLocation = useMemo(() => {
    if (request?.currentLocation?.lat && request?.currentLocation?.lng) {
      return {
        lat: Number(request.currentLocation.lat),
        lng: Number(request.currentLocation.lng),
        heading: Number(request.currentLocation.heading) || 0,
      }
    }
    if (assignedLabour?.labourProfile?.currentLocation?.lat && assignedLabour?.labourProfile?.currentLocation?.lng) {
      return {
        lat: Number(assignedLabour.labourProfile.currentLocation.lat),
        lng: Number(assignedLabour.labourProfile.currentLocation.lng),
        heading: Number(assignedLabour.labourProfile.currentLocation.heading) || 0,
      }
    }
    if (assignedLabour?.labourProfile?.locationLat && assignedLabour?.labourProfile?.locationLng) {
      return {
        lat: Number(assignedLabour.labourProfile.locationLat),
        lng: Number(assignedLabour.labourProfile.locationLng),
        heading: 0,
      }
    }
    return null
  }, [request?.currentLocation, assignedLabour])

  // Derive stable 6-digit OTP from backend ID
  const verificationOtp = useMemo(() => {
    const id = request?._id || booking?._id || requestId
    if (!id) return '------'
    const num = parseInt(String(id).slice(-6), 16) % 900000
    return String(100000 + (isNaN(num) ? 0 : num))
  }, [request?._id, booking?._id, requestId])

  const copyOtpToClipboard = () => {
    if (!verificationOtp) return
    navigator.clipboard.writeText(verificationOtp)
    setCopiedOtp(true)
    setTimeout(() => setCopiedOtp(false), 2200)
  }

  const handleShareTracking = () => {
    const shareText = `Track my worker (${workerName}) on Staffivaa: Booking #${request.reference || booking?.ref || 'N/A'}`
    const shareUrl = window.location.href
    if (navigator.share) {
      navigator.share({ title: 'Staffivaa Live Tracking', text: shareText, url: shareUrl }).catch(() => {})
    } else {
      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`)
      alert('Tracking link copied to clipboard!')
    }
  }

  const handleOpenWhatsApp = () => {
    const ref = request.reference || booking?.ref || ''
    const msg = encodeURIComponent(`Hi ${workerName}, I booked your service on Staffivaa (Ref #${ref}). Please let me know your ETA.`)
    window.open(`https://wa.me/${rawCleanPhone}?text=${msg}`, '_blank')
  }

  // Rapido 4-Stage Live Progress Stepper Calculation
  const progressPercentage = useMemo(() => {
    if (currentStatus === 'completed') return 100
    if (currentStatus === 'in_progress') return 80
    if (currentStatus === 'on_site') return 60
    if (['accepted', 'assigned'].includes(currentStatus)) return 35
    return 15
  }, [currentStatus])

  if (isLoading && !request._id && requestId) {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex h-screen w-full items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-[#FFD100]" />
          <p className="text-sm font-extrabold tracking-wide text-slate-300">Loading live tracking...</p>
        </div>
      </div>,
      document.body
    )
  }

  if (error) {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex h-screen w-full items-center justify-center bg-slate-900 p-6">
        <div className="text-center bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-black text-slate-900 mb-2">Booking Not Found</h2>
          <p className="text-slate-500 mb-6 text-xs font-semibold">We couldn't retrieve the live details for this booking.</p>
          <button onClick={onBack} className="w-full bg-[#0F172A] text-white font-extrabold py-3 rounded-2xl active:scale-95 transition">
            Go Back
          </button>
        </div>
      </div>,
      document.body
    )
  }

  // Platform Fee Pending state
  if (currentStatus === 'platform_fee_pending' || (currentStatus === 'accepted' && request.userPaymentStatus !== 'paid' && Number(request.userPlatformFee ?? 0) > 0)) {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex flex-col bg-slate-50 overflow-hidden" style={{ height: '100dvh' }}>
        <div className="relative shrink-0 bg-white border-b border-slate-100 flex items-center p-4 pt-[max(1rem,env(safe-area-inset-top,1rem))] z-10 shadow-xs">
          <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-800 transition active:scale-95">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="ml-4 text-lg font-black text-slate-900">
            {request.userPaymentStatus === 'paid' ? 'Request Accepted' : 'Confirm & Dispatch'}
          </h1>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4 pb-24">
          <div className="bg-white rounded-3xl p-6 shadow-sm ring-1 ring-slate-200 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700 mb-4">
              <Zap className="h-8 w-8 text-amber-600 fill-amber-500" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">Worker Found & Ready!</h2>
            <p className="text-xs font-semibold text-slate-500 mb-4 leading-relaxed">
              {request.userPaymentStatus === 'paid'
                ? 'Platform fee paid successfully. Waiting for worker to confirm dispatch.'
                : 'Pay the small platform fee to lock in the worker and start live GPS dispatch.'}
            </p>

            {assignedLabour && (
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/90 p-3.5 rounded-2xl mb-5 text-left">
                {workerPic ? (
                  <img src={workerPic} alt={workerName} className="h-12 w-12 rounded-full object-cover border-2 border-amber-400 shrink-0" />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900 font-extrabold text-base border-2 border-amber-300">
                    {workerName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-extrabold text-slate-900 text-sm truncate">{workerName}</h3>
                    <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mt-0.5">
                    <span>Verified Professional</span>
                    {shortWorkerId && shortWorkerId !== 'N/A' && (
                      <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-bold">{shortWorkerId}</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            <div className="text-left space-y-3 mb-6 bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <span className="text-xs font-semibold text-slate-700">Platform Fee</span>
                <span className="text-sm font-black text-slate-900">₹{request.userPlatformFee ?? 0}</span>
              </div>
              <div className="flex justify-between items-center pb-2">
                <span className="text-xs font-semibold text-slate-500">Visiting / Service Charge</span>
                <span className="text-sm font-bold text-slate-800">₹{paymentSummary?.serviceCost || booking?.estimate?.estimatedSubtotal || 0}</span>
              </div>
              <div className="rounded-xl bg-amber-50 p-3 text-[10px] font-medium leading-relaxed text-amber-900 ring-1 ring-amber-200/60">
                <AlertCircle className="inline h-3 w-3 mr-1 mb-0.5 text-amber-700" />
                Staffivaa only collects platform fees. The service charge is to be paid directly to the worker in cash or UPI after completion.
              </div>
            </div>

            {request.userPaymentStatus === 'paid' ? (
              <div className="flex flex-col items-center justify-center gap-2 bg-blue-50 p-4 rounded-2xl border border-blue-200 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-black text-blue-700 uppercase tracking-wider">
                  {timeLeft <= 0 ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Processing Dispatch</>
                  ) : (
                    <><Clock className="h-4 w-4" /> Waiting for Worker Dispatch</>
                  )}
                </div>
                <div className="flex justify-between items-center w-full mt-2 px-2 pb-2 border-b border-blue-200/50">
                  <span className="text-xs font-bold text-blue-800">Time Remaining</span>
                  <span className={`text-sm font-black ${timeLeft < 60 ? 'text-red-500' : 'text-blue-900'}`}>
                    {timeLeft <= 0 ? '00:00' : formatTime(timeLeft)}
                  </span>
                </div>
              </div>
            ) : (
              <button
                onClick={handlePayment}
                disabled={isCreatingOrder || isVerifying}
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-slate-950 font-black text-sm transition shadow-md shadow-amber-300/30 ${
                  isCreatingOrder || isVerifying ? 'bg-slate-200 cursor-not-allowed' : 'bg-[#FFD100] hover:bg-[#F5C200] active:scale-95'
                }`}
              >
                {isCreatingOrder || isVerifying ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5" />
                    {Number(request.userPlatformFee ?? 0) === 0
                      ? 'Confirm Booking (Free)'
                      : `Pay Platform Fee (₹${request.userPlatformFee ?? 0})`}
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to cancel this booking?')) {
                  onCancel()
                }
              }}
              className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-2xl border border-rose-200 bg-rose-50 text-rose-600 font-extrabold text-xs transition hover:bg-rose-100 active:scale-95"
            >
              Cancel Booking
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  // 🚀 MAIN RAPIDO-STYLE LIVE TRACKING INTERFACE
  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900 overflow-hidden select-none" style={{ height: '100dvh' }}>
      {/* 1. IMMERSIVE FULLSCREEN GOOGLE MAP BACKGROUND */}
      <div className="absolute inset-0 z-0 w-full h-full">
        {isMapLoaded && (
          <LiveTrackingMap
            bookingId={requestId}
            customerLocation={customerLocation}
            initialWorkerLocation={initialWorkerLocation}
            workerName={workerName}
            workerPic={workerPic}
            isArrived={['on_site', 'completed'].includes(currentStatus)}
            onEtaUpdate={(info) => setLiveEtaInfo(info)}
            bottomSheetPadding={isSheetExpanded ? 380 : 220}
            hideFloatingHud={true}
          />
        )}
      </div>

      {/* 2. RAPIDO FLOATING TOP GLASS HUD */}
      <div className="absolute top-0 left-0 right-0 z-30 p-4 pt-[max(1rem,env(safe-area-inset-top,1rem))] pointer-events-none flex items-center justify-between gap-2">
        {/* Back Button */}
        <button
          type="button"
          onClick={onBack}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white/95 text-slate-900 shadow-xl backdrop-blur-md border border-slate-200/90 active:scale-90 transition cursor-pointer"
          aria-label="Back to History"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {/* Live Status Pill Header */}
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-4 py-2.5 rounded-full shadow-2xl border border-slate-800 text-white">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFD100] opacity-80"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FFD100]"></span>
          </span>
          <span className="text-xs font-black tracking-wide">
            {currentStatus === 'completed'
              ? 'Job Completed'
              : currentStatus === 'in_progress'
              ? 'Work in Progress'
              : currentStatus === 'on_site'
              ? 'Arrived at Location'
              : 'Worker is on the way'}
          </span>
        </div>

        {/* Right Floating Actions: SOS & Share */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Share Live Tracking */}
          <button
            type="button"
            onClick={handleShareTracking}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/95 text-slate-900 shadow-xl backdrop-blur-md border border-slate-200/90 active:scale-90 transition cursor-pointer"
            title="Share Live Tracking"
          >
            <Share2 className="h-4 w-4 text-slate-800" />
          </button>

          {/* SOS Safety Button */}
          <button
            type="button"
            onClick={() => setShowSosModal(true)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-xl shadow-rose-500/30 backdrop-blur-md border border-rose-400 active:scale-90 transition cursor-pointer"
            title="Safety & SOS"
          >
            <ShieldAlert className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 3. RAPIDO INTERACTIVE SLIDING BOTTOM SHEET */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-[32px] shadow-[0_-12px_45px_rgba(0,0,0,0.22)] border-t border-slate-100 flex flex-col transition-all duration-300 ${
          isSheetExpanded ? 'max-h-[85dvh] h-[85dvh]' : 'max-h-[340px] sm:max-h-[380px]'
        }`}
      >
        {/* Drag Pill Handle & Tap-to-expand */}
        <div
          onClick={() => setIsSheetExpanded((prev) => !prev)}
          className="w-full pt-3 pb-2 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50/60 rounded-t-[32px] transition shrink-0"
        >
          <div className="w-12 h-1.5 bg-slate-300 rounded-full mb-1" />
          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <span>{isSheetExpanded ? 'Swipe down for map' : 'Swipe up for details'}</span>
            {isSheetExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </div>
        </div>

        {/* Scrollable Container Inside Bottom Sheet */}
        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4 no-scrollbar">
          {/* A. Hero Rapido ETA Banner */}
          <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-950 rounded-2xl p-4 text-white shadow-lg border border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-[#FFD100] text-slate-950">
                  {currentStatus === 'on_site' ? 'At Doorstep' : currentStatus === 'in_progress' ? 'Ongoing' : 'Estimated ETA'}
                </span>
                {liveEtaInfo?.distance && currentStatus !== 'on_site' && (
                  <span className="text-[11px] font-bold text-slate-300">{liveEtaInfo.distance} away</span>
                )}
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white mt-1">
                {currentStatus === 'on_site'
                  ? 'Worker Has Arrived!'
                  : currentStatus === 'in_progress'
                  ? 'Work in Progress'
                  : currentStatus === 'completed'
                  ? 'Job Finished'
                  : (liveEtaInfo?.eta || '15-20 mins')}
              </h2>
            </div>

            <div className="h-12 w-12 rounded-2xl bg-[#FFD100]/15 border border-[#FFD100]/30 flex items-center justify-center text-[#FFD100] shrink-0">
              {currentStatus === 'completed' ? (
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              ) : currentStatus === 'on_site' ? (
                <ShieldCheck className="h-7 w-7 text-[#FFD100]" />
              ) : (
                <Navigation2 className="h-7 w-7 fill-[#FFD100] text-[#FFD100] animate-pulse" />
              )}
            </div>
          </div>

          {/* B. Live Journey Progress Stepper */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
            <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-600 mb-2">
              <span className={progressPercentage >= 35 ? 'text-slate-900' : 'text-slate-400'}>Assigned</span>
              <span className={progressPercentage >= 35 ? 'text-slate-900' : 'text-slate-400'}>On Way</span>
              <span className={progressPercentage >= 60 ? 'text-slate-900' : 'text-slate-400'}>Arrived</span>
              <span className={progressPercentage >= 80 ? 'text-slate-900' : 'text-slate-400'}>Working</span>
              <span className={progressPercentage >= 100 ? 'text-emerald-600' : 'text-slate-400'}>Done</span>
            </div>
            {/* Progress Bar Track */}
            <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden relative">
              <motion.div
                className="h-full bg-gradient-to-r from-[#FFD100] via-amber-400 to-emerald-500 rounded-full"
                initial={{ width: '15%' }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* C. Rapido Worker Profile Card */}
          {assignedLabour ? (
            <div className="bg-white rounded-3xl p-4 ring-1 ring-slate-200/80 shadow-sm">
              <div className="flex items-center gap-3">
                {/* Worker Avatar with Gold Badge */}
                <div className="relative shrink-0">
                  {workerPic ? (
                    <img
                      src={workerPic}
                      alt={workerName}
                      className="h-14 w-14 rounded-2xl object-cover ring-2 ring-amber-400"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-900 font-black text-lg ring-2 ring-amber-300">
                      {workerName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white">
                    <ShieldCheck className="h-3 w-3" />
                  </span>
                </div>

                {/* Worker Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="font-black text-slate-900 text-base truncate">{workerName}</h3>
                    <span className="shrink-0 flex items-center gap-1 bg-amber-50 text-amber-900 font-extrabold text-[11px] px-2 py-0.5 rounded-lg border border-amber-200">
                      ⭐ {workerRating}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-slate-600 truncate mt-0.5">
                    {request.lines?.[0]?.categoryId?.name || draft?.categoryName || 'Daily Service Professional'}
                  </p>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      ID: {shortWorkerId}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      {workerTotalJobs} Completed
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Action Contact Buttons */}
              <div className="grid grid-cols-2 gap-2.5 mt-4 pt-3 border-t border-slate-100">
                {/* 1-Tap Call */}
                <a
                  href={`tel:${rawCleanPhone}`}
                  className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#FFD100] text-slate-950 font-black text-xs shadow-md shadow-amber-300/30 transition active:scale-95 cursor-pointer"
                >
                  <Phone className="h-4 w-4 fill-slate-950 text-slate-950" /> Call Worker
                </a>

                {/* WhatsApp Chat */}
                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-black text-xs transition active:scale-95 cursor-pointer"
                >
                  <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-3xl p-5 border border-slate-200 text-center flex flex-col items-center justify-center">
              <Loader2 className="h-6 w-6 text-amber-500 animate-spin mb-2" />
              <p className="text-sm font-bold text-slate-800">Dispatching worker...</p>
            </div>
          )}

          {/* D. Rapido-Style Start Service OTP Card */}
          <div className="bg-gradient-to-br from-amber-50/90 via-yellow-50 to-orange-50/60 rounded-3xl p-4 border border-amber-200/90 shadow-sm relative overflow-hidden">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFD100] text-slate-950 shadow-sm">
                <Lock className="h-5 w-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Start Service OTP</h4>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded-full">
                    Required on Site
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-slate-600 mt-0.5">
                  Share this OTP with {workerName} only after they arrive at your location.
                </p>

                {/* Big OTP Digits Display */}
                <div className="mt-3 flex items-center justify-between bg-white rounded-2xl p-2.5 px-3 border border-amber-200 shadow-xs">
                  <div className="flex items-center gap-1.5 tracking-[0.3em] font-mono text-xl font-black text-slate-900 ml-1">
                    {verificationOtp}
                  </div>
                  <button
                    type="button"
                    onClick={copyOtpToClipboard}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-extrabold transition active:scale-95 ${
                      copiedOtp
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {copiedOtp ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copy OTP
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* E. EXPANDED SECTIONS (Visible when sheet is expanded or scrolled) */}
          <div className="space-y-4 pt-1">
            {/* Booking Details Card */}
            <div className="bg-white rounded-3xl p-4 ring-1 ring-slate-200/80 shadow-sm space-y-3">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2">Booking & Location</h4>

              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Service Address</p>
                  <p className="text-xs font-bold text-slate-900 leading-snug">
                    {request.locationText || draft?.address || 'Service Location'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-2 border-t border-slate-100">
                <Calendar className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Scheduled Time</p>
                  <p className="text-xs font-bold text-slate-900">
                    {request.startDate ? new Date(request.startDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Today'}
                    {request.shiftStart ? ` · ${request.shiftStart}` : ' · Immediate Dispatch'}
                  </p>
                </div>
              </div>

              {request.notes && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-0.5">Special Instructions</p>
                  <p className="text-xs font-medium text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    {request.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Transparent Fare Breakdown Card */}
            <div className="bg-white rounded-3xl p-4 ring-1 ring-slate-200/80 shadow-sm space-y-2.5">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2">Fare Summary</h4>

              <div className="flex justify-between items-center text-xs font-semibold text-slate-600">
                <span>Platform Fee</span>
                <span className="font-bold text-emerald-600">₹{(paymentSummary?.userPlatformFee || request?.userPlatformFee || 0).toFixed(2)} (Paid)</span>
              </div>

              <div className="flex justify-between items-center text-xs font-semibold text-slate-600">
                <span>Labour Visiting Charge</span>
                <span className="font-bold text-slate-900">₹{((paymentSummary?.serviceCost || 0) + (paymentSummary?.extraCost || 0)).toFixed(2)}</span>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-sm font-black text-slate-900">
                <span>Payable to Worker (Cash/UPI)</span>
                <span>₹{((paymentSummary?.serviceCost || 0) + (paymentSummary?.extraCost || 0)).toFixed(2)}</span>
              </div>

              <div className="rounded-xl bg-amber-50 p-2.5 text-[10px] font-medium leading-relaxed text-amber-900 ring-1 ring-amber-200/60 mt-2">
                <Sparkles className="inline h-3 w-3 mr-1 text-amber-700" />
                Staffivaa does not take commission from worker wages. Pay the labour charge directly upon completion.
              </div>
            </div>

            {/* Extra Work Request Button */}
            {['accepted', 'in_progress', 'on_site'].includes(currentStatus) && (
              <button
                type="button"
                onClick={() => setIsExtraWorkModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-slate-300 bg-slate-50 text-slate-800 font-extrabold text-xs transition hover:bg-slate-100 active:scale-95"
              >
                <PlusCircle className="h-4 w-4 text-slate-700" /> Request Extra Scope / Overtime
              </button>
            )}

            {/* Cancel Booking Action */}
            {currentStatus !== 'completed' && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to cancel this booking?')) {
                      onCancel()
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 font-extrabold text-xs transition hover:bg-rose-100 active:scale-95"
                >
                  Cancel This Booking
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. EMERGENCY SOS MODAL */}
      <AnimatePresence>
        {showSosModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-5 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center"
            >
              <div className="h-14 w-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Safety & Emergency</h3>
              <p className="text-xs font-semibold text-slate-500 mt-1 mb-5">
                Staffivaa is committed to your safety. In case of any immediate emergency, contact local authorities or our 24/7 hotline.
              </p>

              <div className="space-y-2.5">
                <a
                  href="tel:112"
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-rose-600 text-white font-black text-sm shadow-lg shadow-rose-500/30 active:scale-95 transition"
                >
                  <Phone className="h-4 w-4" /> Call Police / Emergency (112)
                </a>

                <a
                  href="tel:18001234567"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-slate-100 text-slate-800 font-extrabold text-xs active:scale-95 transition"
                >
                  <HelpCircle className="h-4 w-4" /> Staffivaa Trust & Safety Support
                </a>

                <button
                  type="button"
                  onClick={() => setShowSosModal(false)}
                  className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Extra Work Modal */}
      <ExtraWorkModal
        isOpen={isExtraWorkModalOpen}
        onClose={() => setIsExtraWorkModalOpen(false)}
        onSubmit={handleCreateExtraWork}
        isLoading={isCreatingExtraWork}
      />
    </div>,
    document.body
  )
}
