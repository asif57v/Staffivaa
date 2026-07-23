import { useState, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Phone,
  MapPin,
  X,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Navigation2,
  AlertCircle,
  MoreVertical,
  Calendar,
  CreditCard,
  FileText,
  Map,
  Loader2,
  User,
  Lock
} from 'lucide-react'
import { io } from 'socket.io-client'
import { useGetRequestQuery, useCreateRazorpayOrderMutation, useVerifyRazorpayPaymentMutation, useCreateExtraWorkMutation, useGetExtraWorkQuery, useUpdateExtraWorkStatusMutation } from '../../../store/api/workforceApi.js'
import { enrichDiscoverLabourUi, hashSeed } from '../../../lib/discoverLabourDummyUi.js'
import { loadRazorpayScript } from '../../../lib/razorpay.js'
import { ExtraWorkModal } from './ExtraWorkModal.jsx'
import { PlusCircle } from 'lucide-react'

export function BookingLiveTrackingScreen({ booking, worker, draft, onBack, onCancel }) {
  const requestId = booking?.requestId || booking?._id

  const { data: requestData, isLoading, error, refetch } = useGetRequestQuery(requestId, {
    skip: !requestId,
  })

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
      // Simulate successful payment for demo bookings
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
              razorpay_signature: response.razorpay_signature
            }).unwrap()
          } catch (err) {
            console.error('Payment verification failed', err)
            alert('Payment verification failed. Please contact support.')
          }
        },
        theme: {
          color: '#FFD100'
        }
      }
      
      const rzp1 = new window.Razorpay(options)
      rzp1.on('payment.failed', function (response){
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
      transports: ['websocket', 'polling']
    })

    socket.on('connect', () => {
      console.log('[Socket.io BookingLive] Connected:', socket.id)
      setSocketConnected(true)
      socket.emit('join_request', requestId)
    })

    socket.on('connect_error', (err) => console.error('[Socket.io BookingLive] Error:', err.message))

    socket.on('request_status_update', (data) => {
      setRealtimeStatus(data)
      refetch() // Refetch the full data to ensure consistency
    })

    socket.on('bookingAccepted', (data) => {
      setRealtimeStatus({ requestStatus: data.status })
      refetch() // Refetch to get the accepted labour details
    })

    socket.on('extra_work_updated', () => {
      refetchExtraWork()
      refetch() // Refresh booking total if accepted
    })

    socket.on('booking_cancelled', (payload) => {
      alert(`Booking Cancelled:\n${payload.message}\n\nNote: If you paid the platform fee, the refund process has been initiated. You can check your Wallet for updates.`)
      onBack()
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
      socket.off('disconnect')
      socket.emit('leave_request', requestId)
      socket.disconnect()
    }
  }, [requestId, refetch])

  // Data Extraction
  const request = requestData?.request || {}
  
  const [timeLeft, setTimeLeft] = useState(150)

  useEffect(() => {
    let interval;
    let pollInterval;

    if (request?.status === 'platform_fee_pending' && request?.platformFeePendingAt) {
      const pendingAt = new Date(request.platformFeePendingAt).getTime()
      const expiryTime = pendingAt + 2.5 * 60 * 1000
      
      interval = setInterval(() => {
        const now = new Date().getTime()
        const remaining = Math.max(0, Math.floor((expiryTime - now) / 1000))
        setTimeLeft(remaining)
        
        if (remaining <= 0) {
          clearInterval(interval)
          // Start polling if timer expires and status hasn't updated via socket
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

  const activeAssignment = assignments?.find(a => ['accepted', 'on_site', 'in_progress', 'completed'].includes(a.status))

  let currentStatus = realtimeStatus?.requestStatus || request?.status || booking?.status || 'pending_review'
  if (activeAssignment && ['on_site', 'in_progress', 'completed'].includes(activeAssignment.status)) {
    // Override request status with assignment status if worker has progressed
    // This ensures OTP is shown when worker marks 'on_site'
    currentStatus = activeAssignment.status
  }

  useEffect(() => {
    if (['cancelled', 'expired'].includes(currentStatus)) {
      alert("This booking has been cancelled or expired.")
      onBack()
    }
  }, [currentStatus, onBack])

  // Only fallback to demo/draft workers if the booking has actually been accepted
  const isAcceptedOrBeyond = ['accepted', 'in_progress', 'on_site', 'completed'].includes(currentStatus)
  const fallbackWorker = isAcceptedOrBeyond ? (booking?.assignedWorker || worker || (draft?.selectedWorkers || [])[0]) : null

  const assignedLabour = activeAssignment?.labourId || null

  // Normalize fields so they always display correctly
  // activeAssignment?.labourId is populated from the backend, so it's an object containing _id, fullName, phone, etc.
  const workerName = assignedLabour?.fullName || assignedLabour?.displayName || assignedLabour?.name || 'Verified Worker'
  const workerId = assignedLabour?._id || assignedLabour?.id || 'N/A'

  // If the backend returned a real phone number, use it. Otherwise, if it's a demo/dummy worker without a phone, generate a placeholder.
  let defaultPhone = '+91 98765 43210'
  if (workerId && String(workerId).startsWith('demo-')) {
    defaultPhone = '+91 98' + String(hashSeed(workerId, 99999999)).padStart(8, '0')
  } else if (workerId === 'smart-match') {
    defaultPhone = '+91 98989 89898'
  }

  let workerPhone = assignedLabour?.phone || defaultPhone
  // Ensure Indian phone numbers have +91 prefix if missing
  if (workerPhone && workerPhone.length === 10 && !workerPhone.startsWith('+')) {
    workerPhone = `+91 ${workerPhone.slice(0, 5)} ${workerPhone.slice(5)}`
  }

  const workerAddress = assignedLabour?.contractorProfile?.businessAddress || assignedLabour?.corporateProfile?.registeredAddress || assignedLabour?.address || 'Address not provided'
  const workerPic = assignedLabour?.profileImageUrl || assignedLabour?.photoUrl || null



  // Derive stable 6-digit OTP from backend ID
  const verificationOtp = useMemo(() => {
    const id = request?._id || booking?._id || requestId;
    if (!id) return '------';
    const num = parseInt(String(id).slice(-6), 16) % 900000;
    return String(100000 + (isNaN(num) ? 0 : num));
  }, [request?._id, booking?._id, requestId]);

  // Derive timeline steps
  const steps = [
    { label: 'Booking Created', done: true, key: 'created' },
    { label: 'Labour Assigned', done: ['accepted', 'assigned', 'on_site', 'in_progress', 'completed'].includes(currentStatus) || !!assignedLabour, key: 'assigned' },
    { label: 'On The Way', done: ['accepted', 'on_site', 'in_progress', 'completed'].includes(currentStatus), key: 'travel' },
    { label: 'Worker Arrived (OTP Pending)', done: ['on_site', 'in_progress', 'completed'].includes(currentStatus), key: 'waiting_otp' },
    { label: 'Work In Progress', done: ['in_progress', 'completed'].includes(currentStatus), key: 'work_in_progress' },
    { label: 'Work Completed', done: ['completed'].includes(currentStatus), key: 'completed' },
  ]
  const currentStepIdx = steps.findLastIndex(s => s.done)

  if (isLoading && !request._id && requestId) {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex h-screen w-full items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-brand" />
          <p className="text-sm font-bold text-slate-500">Loading booking details...</p>
        </div>
      </div>,
      document.body
    )
  }

  if (error) {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex h-screen w-full items-center justify-center bg-slate-100 p-6">
        <div className="text-center bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Failed to load booking</h2>
          <p className="text-slate-500 mb-6 text-sm">We couldn't retrieve the details for this booking.</p>
          <button onClick={onBack} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl">Go Back</button>
        </div>
      </div>,
      document.body
    )
  }

  if (currentStatus === 'platform_fee_pending' || currentStatus === 'accepted') {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex flex-col bg-slate-50 overflow-hidden" style={{ height: '100dvh' }}>
        <div className="relative shrink-0 bg-white border-b border-slate-100 flex items-center p-4 pt-[max(1rem,env(safe-area-inset-top,1rem))] z-10 shadow-sm">
          <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-800 transition active:scale-95">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="ml-4 text-lg font-black text-slate-900">Payment Required</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4 pb-24">
          <div className="bg-white rounded-[20px] p-6 shadow-sm ring-1 ring-slate-200 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 mb-4">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">Worker Accepted!</h2>
            <p className="text-sm font-semibold text-slate-500 mb-6">
              {request.userPaymentStatus === 'paid' 
                ? "Platform fee paid successfully. Waiting for the worker to confirm their payment to dispatch."
                : "Please pay the Staffivaa platform fee to confirm the booking and dispatch your worker."}
            </p>
            
            <div className="text-left space-y-3 mb-6 bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <span className="font-semibold text-slate-700">Platform Fee</span>
                <span className="font-bold text-slate-900">₹{request.userPlatformFee ?? 0}</span>
              </div>
              <div className="mt-3 flex justify-between items-center pb-2">
                <span className="text-xs font-semibold text-slate-500">Visiting Charge</span>
                <span className="text-sm font-bold text-slate-800">₹{paymentSummary?.serviceCost || booking?.estimate?.estimatedSubtotal || 0}</span>
              </div>
              <div className="mt-2 rounded-lg bg-amber-50 p-3 text-[10px] font-medium leading-relaxed text-amber-800 ring-1 ring-amber-200/50">
                <AlertCircle className="inline h-3 w-3 mr-1 mb-0.5" />
                Staffivaa only collects platform fees. The visiting charge is to be paid directly to the labour outside the platform after work is completed.
              </div>
            </div>

            {request.userPaymentStatus === 'paid' ? (
              <div className="mt-4 flex flex-col items-center justify-center gap-2 bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-extrabold text-blue-700 uppercase tracking-widest">
                  {timeLeft <= 0 ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Processing Cancellation</>
                  ) : (
                    <><Clock className="h-4 w-4" /> Waiting for Worker</>
                  )}
                </div>
                <div className="flex justify-between items-center w-full mt-2 px-2 pb-2 border-b border-blue-200/50">
                  <span className="text-xs font-bold text-blue-800">Time Remaining</span>
                  <span className={`text-sm font-black ${timeLeft < 60 ? 'text-red-500' : 'text-blue-900'}`}>
                    {timeLeft <= 0 ? '00:00' : formatTime(timeLeft)}
                  </span>
                </div>
                <p className="text-center text-[11px] font-semibold text-blue-600/90 leading-relaxed mt-1">
                  {timeLeft <= 0 
                    ? "The 2.5-minute window has ended. The server is processing the auto-cancellation and your refund will be initiated momentarily."
                    : "You have successfully paid the platform fee. The booking will automatically cancel and your fee will be refunded if the worker does not pay their fee within 2.5 minutes."}
                </p>
              </div>
            ) : (
              <button 
                onClick={handlePayment} 
                disabled={isCreatingOrder || isVerifying}
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl text-slate-900 font-black transition shadow-sm ${
                  isCreatingOrder || isVerifying ? 'bg-slate-200 cursor-not-allowed' : 'bg-[#FFDF20] hover:bg-[#F0B400] active:scale-95'
                }`}
              >
                {isCreatingOrder || isVerifying ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5" /> Pay Platform Fee (₹{request.userPlatformFee ?? 0})
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-50 overflow-hidden" style={{ height: '100dvh' }}>
      {/* Top Navigation Bar */}
      <div className="relative shrink-0 bg-white border-b border-slate-100 flex items-center p-4 pt-[max(1rem,env(safe-area-inset-top,1rem))] z-10 shadow-sm">
        <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-800 transition active:scale-95">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="ml-4 text-lg font-black text-slate-900">Booking Details</h1>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto z-20 relative no-scrollbar pb-24">

        {/* Top Section */}
        <div className="px-5 py-4 bg-white border-b border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center justify-center h-5 w-5 rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-3 w-3" />
            </div>
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Booking Confirmed</span>
            {socketConnected && <span className="ml-auto flex h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Live connection active" />}
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Booking #{request.reference || booking?.ref || 'N/A'}</h1>
          <p className="text-slate-500 text-xs font-medium mt-0.5">
            {new Date(request.createdAt || booking?.createdAt || Date.now()).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>

        {/* Worker Details Card */}
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-xs font-extrabold text-slate-900 mb-2 uppercase tracking-wider">Assigned Labour</h3>

          {assignedLabour ? (
            <div className="bg-white rounded-3xl p-3 ring-1 ring-slate-200/60 shadow-sm flex items-center gap-3">
              <div className="relative shrink-0">
                {workerPic ? (
                  <img
                    src={workerPic}
                    alt={workerName}
                    className="h-12 w-12 rounded-full object-cover ring-2 ring-slate-100"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 ring-2 ring-slate-200">
                    <User className="h-6 w-6 text-slate-400" />
                  </div>
                )}
                <span className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-green-500 text-white">
                  <ShieldCheck className="h-2 w-2" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-black text-slate-900 leading-tight">
                  {workerName}
                </h2>
                <p className="mt-1 truncate text-[10px] font-bold text-brand mb-1">
                  ID: {workerId}
                </p>
                <p className="truncate text-[10px] font-semibold text-slate-500 leading-tight">
                  {request.lines?.[0]?.categoryId?.name || draft?.categoryName || 'General Category'}
                </p>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                  <Phone className="h-2.5 w-2.5 text-brand" />
                  <span className="text-slate-700">{workerPhone}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                  <MapPin className="h-2.5 w-2.5 text-brand shrink-0" />
                  <span className="text-slate-700 truncate">{workerAddress}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-3xl p-4 ring-1 ring-slate-200/60 shadow-sm flex flex-col items-center justify-center text-center">
              <div className="h-10 w-10 rounded-full bg-brand/10 flex items-center justify-center mb-2">
                <Loader2 className="h-5 w-5 text-brand animate-spin" />
              </div>
              <h2 className="text-sm font-bold text-slate-800">Finding available labours...</h2>
              <p className="text-xs font-semibold text-brand mt-1">Searching nearby professionals...</p>
            </div>
          )}

          {assignedLabour && ['in_progress', 'on_site'].includes(currentStatus) && (
            <div className="mt-2 flex items-center justify-between rounded-2xl bg-gradient-to-br from-brand to-yellow-500 p-3 text-white shadow-lg shadow-brand/20">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide opacity-90">Estimated Arrival</p>
                <p className="text-xl font-black tracking-tighter leading-none mt-0.5">15-20 Min</p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
                <Clock className="h-4 w-4 text-white" />
              </div>
            </div>
          )}
        </div>

        {/* Booking Details Card */}
        <div className="px-5 pb-4">
          <h3 className="text-xs font-extrabold text-slate-900 mb-2 uppercase tracking-wider">Booking Details</h3>
          <div className="bg-white rounded-3xl p-4 ring-1 ring-slate-200/60 shadow-sm space-y-3">
            <div>
              <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold mb-0.5"><FileText className="w-3 h-3" /> Service</div>
              <p className="text-xs font-semibold text-slate-900">{request.lines?.map(l => l.categoryId?.name).join(', ') || draft?.categoryName || 'Labour Service'}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold mb-0.5"><MapPin className="w-3 h-3" /> Address</div>
              <p className="text-xs font-medium text-slate-900 leading-snug">{request.locationText || draft?.address || 'Service Location'}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold mb-0.5"><Calendar className="w-3 h-3" /> Scheduled For</div>
              <p className="text-xs font-medium text-slate-900">
                {request.startDate ? new Date(request.startDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : 'Today'}
                {request.shiftStart ? ` at ${request.shiftStart}` : ''}
              </p>
            </div>
            {request.notes && (
              <div>
                <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold mb-0.5"><AlertCircle className="w-3 h-3" /> Special Instructions</div>
                <p className="text-xs font-medium text-slate-700 bg-amber-50 p-2.5 rounded-xl border border-amber-100">{request.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Site Verification OTP Card */}
        {currentStatus === 'on_site' && (
          <div className="px-5 pb-4">
            <div className="bg-white rounded-[20px] p-5 ring-1 ring-slate-200/60 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-[#FFDF20]" />
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-yellow-50 text-yellow-600">
                  <Lock className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">Site Verification OTP</h3>
                  <p className="text-[10px] font-bold text-slate-500 leading-snug mt-0.5 pr-2">
                    Share this OTP only after the worker reaches your location.
                  </p>
                  
                  <div className="mt-4 flex items-center justify-between bg-slate-50 rounded-2xl p-3 border border-slate-100">
                    <span className="text-2xl font-black tracking-[0.25em] text-slate-900 ml-2">
                      {verificationOtp}
                    </span>
                    <button 
                      onClick={() => navigator.clipboard.writeText(verificationOtp)}
                      className="flex h-8 items-center justify-center rounded-xl bg-white px-3 text-[10px] font-bold text-slate-700 shadow-sm ring-1 ring-slate-200/50 hover:bg-slate-50 transition active:scale-95"
                    >
                      Copy OTP
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status Timeline */}
        <div className="px-5 pb-4">
          <h3 className="text-xs font-extrabold text-slate-900 mb-2 uppercase tracking-wider">Live Status Tracker</h3>
          <div className="bg-white rounded-3xl p-5 ring-1 ring-slate-200/60 shadow-sm">
            <div className="relative pl-5 ml-2 space-y-5 border-l-2 border-slate-100">
              {steps.map((step, idx) => {
                const isActive = idx === currentStepIdx
                const isPast = idx < currentStepIdx
                const isDone = isPast || isActive

                return (
                  <div key={step.key} className="relative">
                    <span className={`absolute -left-[1.7rem] top-[0.15rem] flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-white ${isDone ? 'bg-brand' : 'bg-slate-200'}`} />
                    <p className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${isDone ? 'text-brand' : 'text-slate-400'}`}>
                      {isDone ? (isActive ? 'CURRENT STATUS' : 'COMPLETED') : 'PENDING'}
                    </p>
                    <p className={`text-sm font-black leading-tight ${isDone ? 'text-slate-900' : 'text-slate-400'}`}>{step.label}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>



        {/* Payment Summary */}
        <div className="px-5 pb-8">
          <h3 className="text-xs font-extrabold text-slate-900 mb-2 uppercase tracking-wider">Payment Summary</h3>
          <div className="bg-white rounded-3xl p-5 ring-1 ring-slate-200/60 shadow-sm">
            <div className="space-y-3 text-sm font-medium">
              <div className="flex justify-between text-slate-600">
                <span>Platform Fee Paid</span>
                <span>₹{(paymentSummary?.userPlatformFee || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Visiting Charge</span>
                <span>₹{((paymentSummary?.serviceCost || 0) + (paymentSummary?.extraCost || 0)).toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-100 pt-3 mt-1 flex justify-between font-black text-slate-900 text-lg">
                <span>Total Amount Paid on Staffivaa</span>
                <span>₹{(paymentSummary?.userPlatformFee || 0).toFixed(2)}</span>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-amber-50 p-3 text-[10px] font-medium leading-relaxed text-amber-800 ring-1 ring-amber-200/50">
              <AlertCircle className="inline h-3 w-3 mr-1" />
              Staffivaa only collects platform fees. The visiting charge is to be paid directly to the labour.
            </div>

            {currentStatus === 'completed' ? (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="mb-3 flex items-start gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
                   <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                     <CheckCircle2 className="w-4 h-4" />
                   </div>
                   <div>
                     <h4 className="text-sm font-black text-slate-900 leading-tight mb-0.5">✅ Work Completed</h4>
                     <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">Your worker has marked this job as completed. Please pay the labour charge directly to the worker.</p>
                   </div>
                </div>
              </div>
            ) : isAcceptedOrBeyond ? (
              <div className="mt-4 flex flex-col items-center justify-center gap-2 bg-yellow-50 p-4 rounded-xl border border-yellow-200 shadow-sm">
                <div className="flex items-center gap-1.5 text-sm font-extrabold text-yellow-700 uppercase tracking-widest">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                  </span>
                  Work in Progress
                </div>
                <p className="text-center text-[11px] font-semibold text-yellow-600/90 leading-relaxed mt-1">
                  Your assigned worker is currently completing the service. Pay the labour directly after work is done.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom,1rem))] z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-3">
          {assignedLabour && (
            <button className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-brand text-sm font-bold text-white transition active:scale-95 shadow-md shadow-brand/20">
              <Phone className="h-4 w-4" /> Call Worker
            </button>
          )}
          <button onClick={onCancel} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-100 text-sm font-bold text-slate-900 transition active:scale-95">
            Reschedule
          </button>
          <button onClick={onCancel} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 transition active:scale-95">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

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

