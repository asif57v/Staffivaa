import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2, Clock, IndianRupee, MapPin, RotateCcw, Sparkles } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.js'
import { KYC_STATUS } from '../../constants/userRoles.js'
import { io } from 'socket.io-client'
import { AppEmptyState } from '../../components/app/AppEmptyState.jsx'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { AppButton } from '../../components/app-ui/buttons/AppButton.jsx'
import { LabourAssignmentDetailModal } from '../../components/labour/LabourAssignmentDetailModal.jsx'
import { LabourJobActiveCard } from '../../components/labour/jobs/LabourJobActiveCard.jsx'
import { LabourJobHistoryCard } from '../../components/labour/jobs/LabourJobHistoryCard.jsx'
import { LabourJobOfferCard } from '../../components/labour/jobs/LabourJobOfferCard.jsx'
import { LabourJobsHero } from '../../components/labour/jobs/LabourJobsHero.jsx'
import { LabourJobsTabBar } from '../../components/labour/jobs/LabourJobsTabBar.jsx'
import { readAppUserLocation } from '../../lib/appUserLocationStorage.js'
import {
  useGetLabourAssignmentsQuery,
  useRespondAssignmentMutation,
  useCheckInMutation,
  useStartWorkMutation,
  useCheckOutMutation,
  useCreateRazorpayOrderMutation,
  useVerifyRazorpayPaymentMutation,
} from '../../store/api/workforceApi.js'
import {
  bucketsFromAssignments,
  loadJobDemoState,
  nowIso,
  resetJobDemoToSeed,
  saveJobDemoState,
  subscribeJobDemo,
} from '../../lib/labourJobDemoStorage.js'
import { loadRazorpayScript } from '../../lib/razorpay.js'

function isApiAssignment(job) {
  return Boolean(job?.requestId) && /^[a-f0-9]{24}$/i.test(String(job.id))
}

export function AppJobsPage() {
  const { user } = useAuth()
  const reduce = useReducedMotion()
  const [tab, setTab] = useState('offers')
  const [localDemo, setLocalDemo] = useState(() => loadJobDemoState())
  const { data: apiData, error: apiError, refetch } = useGetLabourAssignmentsQuery(undefined)
  const [respondAssignment] = useRespondAssignmentMutation()
  const [checkIn] = useCheckInMutation()
  const [startWork] = useStartWorkMutation()
  const [checkOut] = useCheckOutMutation()
  const [createOrder, { isLoading: isCreatingOrder }] = useCreateRazorpayOrderMutation()
  const [verifyPayment, { isLoading: isVerifying }] = useVerifyRazorpayPaymentMutation()

  const apiBuckets = useMemo(
    () => bucketsFromAssignments(apiData?.assignments || []),
    [apiData?.assignments],
  )

  const demo = useMemo(
    () => ({
      offers: apiBuckets.offers,
      active: apiBuckets.active,
      history: apiBuckets.history,
    }),
    [apiBuckets],
  )
  const [confirmingOfferId, setConfirmingOfferId] = useState(null)
  const [detailJob, setDetailJob] = useState(null)
  const [detailKind, setDetailKind] = useState('offers')
  const [toast, setToast] = useState('')
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [feePaymentRequest, setFeePaymentRequest] = useState(null)

  const kycOk = user?.labourProfile?.kycStatus === KYC_STATUS.VERIFIED

  useEffect(() => {
    subscribeJobDemo(setLocalDemo)
  }, [])

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'
    let socketUrl = import.meta.env.VITE_SOCKET_URL
    if (!socketUrl) {
      socketUrl = baseUrl.replace('/api/v1', '')
      if (socketUrl.includes('5000')) socketUrl = socketUrl.replace('5000', '5001')
      else if (!socketUrl.includes('5001')) socketUrl = 'http://localhost:5001'
    }
    
    let socket = io(socketUrl, { 
      withCredentials: true,
      transports: ['websocket', 'polling']
    })
    
    socket.on('connect', () => {
      console.log('[Socket.io AppJobsPage] Connected:', socket.id)
      if (user) {
        socket.emit('authenticate', { _id: user.id || user._id, role: user.role || 'labour' })
      }
    })
    socket.on('connect_error', (err) => console.error('[Socket.io AppJobsPage] Error:', err.message))
    socket.on('disconnect', (reason) => console.log('[Socket.io AppJobsPage] Disconnected:', reason))

    socket.on('bookingAcceptedGlobal', (data) => {
      console.log('[LabourJobs] Global booking accepted:', data.requestId)
      refetch()
    })

    socket.on('platformFeeConfigurationUpdated', (data) => {
      console.log('[LabourJobs] Platform fee config updated:', data)
      refetch()
    })

    socket.on('payment_status_update', (data) => {
      console.log('[LabourJobs] Payment status updated:', data)
      refetch()
    })

    socket.on('request_status_update', (data) => {
      console.log('[LabourJobs] Request status updated:', data)
      refetch()
    })

    return () => {
      socket.off('connect')
      socket.off('connect_error')
      socket.off('disconnect')
      socket.off('bookingAcceptedGlobal')
      socket.off('platformFeeConfigurationUpdated')
      socket.off('payment_status_update')
      socket.off('request_status_update')
      socket.disconnect()
    }
  }, [refetch])

  const showToast = useCallback((msg) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2800)
  }, [])

  const persist = useCallback((next) => {
    saveJobDemoState(next)
    setLocalDemo(next)
  }, [])

  const refreshDemo = useCallback(() => {
    setLocalDemo(loadJobDemoState())
    refetch()
  }, [refetch])

  const thisMonthCount = useMemo(() => {
    const ym = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    return demo.history.filter((h) => String(h.completedAt || '').startsWith(ym)).length
  }, [demo.history])

  const tabCounts = useMemo(
    () => ({
      offers: demo.offers.length,
      active: demo.active.length,
      history: demo.history.length,
    }),
    [demo.offers.length, demo.active.length, demo.history.length],
  )

  const handleDeclineOffer = async (id) => {
    const offer = demo.offers.find((o) => o.id === id)
    if (offer && isApiAssignment(offer)) {
      try {
        await respondAssignment({ id, action: 'decline' }).unwrap()
        refetch()
      } catch (e) {
        showToast('Failed to decline offer')
        return
      }
    } else {
      persist({ ...localDemo, offers: localDemo.offers.filter((o) => o.id !== id) })
    }
    setConfirmingOfferId(null)
    showToast('Offer declined.')
  }

  const handleStartAccept = (id) => {
    if (!kycOk) {
      showToast('Complete Aadhaar KYC to accept jobs.')
      return
    }
    setConfirmingOfferId((prev) => (prev === id ? null : id))
  }

  const handleConfirmAccept = async (offer) => {
    if (!kycOk) return
    if (isApiAssignment(offer)) {
      try {
        const loc = readAppUserLocation()
        if (!loc?.lat || !loc?.lng) {
          showToast('Please update your Work Area with a valid GPS location first.')
          return
        }
        const res = await respondAssignment({ 
          id: offer.id, 
          action: 'accept',
          labourLat: loc?.lat,
          labourLng: loc?.lng
        }).unwrap()
        refetch()
        if (res.request && res.request.status === 'platform_fee_pending') {
          setConfirmingOfferId(null);
          showToast('Booking Accepted! Please pay the platform fee to unlock.')
          setTab('active')
          return;
        }
      } catch (e) {
        console.error('Accept error:', e)
        showToast(e?.data?.message || e?.message || 'Failed to accept offer')
        return
      }
    } else {
      persist({
        ...localDemo,
        offers: localDemo.offers.filter((o) => o.id !== offer.id),
        active: [...localDemo.active, { ...offer, acceptedAt: nowIso() }],
      })
    }
    setConfirmingOfferId(null)
    showToast('Assignment accepted — head to Active and check in on site.')
    setTab('active')
  }

  const handlePayment = async (job) => {
    if (!job || !job.requestId) return;
    const requestId = job.requestId;
    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        showToast('Failed to load payment gateway. Please check your internet connection.');
        return;
      }

      const order = await createOrder(requestId).unwrap();
      
      // Handle zero-fee bypass
      if (order.bypassPayment) {
        showToast('Platform fee waived for long distance! Shift confirmed.');
        refetch();
        return;
      }

      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Staffivaa',
        description: 'Labour Platform Fee',
        order_id: order.orderId,
        handler: async function (response) {
          try {
            await verifyPayment({
              id: requestId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            }).unwrap();
            showToast('Platform fee paid! Booking unlocked.');
            refetch();
          } catch (err) {
            console.error('Payment verification failed', err);
            showToast('Payment verification failed. Please contact support.');
          }
        },
        theme: {
          color: '#FFD100'
        }
      };
      const rzp1 = new window.Razorpay(options);
      rzp1.on('payment.failed', function (response){
        console.error(response.error);
        showToast('Payment failed');
      });
      rzp1.open();
    } catch (err) {
      console.error('Failed to create order', err);
      showToast(err?.data?.message || 'Failed to initiate payment');
    }
  }

  const handleMarkOnSite = async (id, lat, lng) => {
    const job = demo.active.find((a) => a.id === id)
    if (!job) return
    if (isApiAssignment(job)) {
      try {
        await checkIn({ assignmentId: id, lat, lng }).unwrap()
        refetch()
      } catch (e) {
        showToast(e?.data?.message || 'Failed to mark arrival')
        return
      }
    } else {
      persist({
        ...localDemo,
        active: localDemo.active.map((a) => (a.id === id ? { ...a, status: 'on_site', onSiteAt: nowIso() } : a)),
      })
    }
    showToast('Arrived at site.')
  }

  const handleStartWork = async (id) => {
    const job = demo.active.find((a) => a.id === id)
    if (!job) return
    if (isApiAssignment(job)) {
      try {
        await startWork({ assignmentId: id }).unwrap()
        refetch()
      } catch (e) {
        showToast(e?.data?.message || 'Failed to start work')
        return
      }
    } else {
      persist({
        ...localDemo,
        active: localDemo.active.map((a) => (a.id === id ? { ...a, status: 'in_progress' } : a)),
      })
    }
    showToast('Work started — tracking attendance.')
  }

  const handleCompleteActive = async (id) => {
    const job = demo.active.find((a) => a.id === id)
    if (!job) return
    if (isApiAssignment(job)) {
      try {
        await checkOut({ assignmentId: id }).unwrap()
        refetch()
      } catch (e) {
        console.error('Checkout error:', e)
        showToast(e?.data?.message || e?.error || 'Failed to complete shift')
        return
      }
    } else {
      const { acceptedAt, ...rest } = job
      persist({
        ...localDemo,
        active: localDemo.active.filter((a) => a.id !== id),
        history: [{ ...rest, acceptedAt, completedAt: nowIso() }, ...localDemo.history],
      })
    }
    showToast('Shift complete — see Earnings for payout.')
    setTab('history')
  }

  const openDetail = (job, kind = tab) => {
    setDetailJob(job)
    setDetailKind(kind)
  }

  const handleResetDemo = () => {
    setLocalDemo(resetJobDemoToSeed())
    setConfirmingOfferId(null)
    showToast('Sample jobs reloaded.')
    setTab('offers')
  }

  const emptyCopy = useMemo(() => {
    if (tab === 'offers') {
      return {
        title: kycOk ? 'No open offers' : 'All caught up',
        subtitle: kycOk
          ? 'New admin assignments will appear here.'
          : 'Verify your KYC to start receiving jobs.',
      }
    }
    if (tab === 'active') {
      return {
        title: 'No active site',
        subtitle: 'Accept an offer to see your deployment here with check-in and completion steps.',
      }
    }
    return {
      title: 'No completed shifts',
      subtitle: 'Finished jobs show here with pay rate and completion time.',
    }
  }, [tab, kycOk])

  return (
    <div className="space-y-4 pb-6">
      <AnimatePresence>
        {toast ? (
          <motion.p
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            className="fixed left-4 right-4 top-[max(4.5rem,env(safe-area-inset-top))] z-[120] mx-auto max-w-md rounded-2xl border border-brand/30 bg-slate-900/95 px-4 py-3 text-center text-sm font-semibold text-white shadow-xl backdrop-blur-md"
            role="status"
          >
            {toast}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <LabourJobsHero offersCount={demo.offers.length} activeCount={demo.active.length} kycOk={kycOk} />

      <div className="flex items-center justify-between gap-2 px-0.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {thisMonthCount} completed this month
        </p>
      </div>

      <LabourJobsTabBar tab={tab} onChange={setTab} counts={tabCounts} />

      <motion.div
        key={tab}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="space-y-3"
      >
        {tab === 'offers' &&
          (demo.offers.length === 0 ? (
            <div className="space-y-3 pt-2">
              <AppEmptyState icon={Sparkles} title={emptyCopy.title} subtitle={emptyCopy.subtitle} />
            </div>
          ) : (
            demo.offers.map((offer, i) => (
              <motion.div
                key={offer.id}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <LabourJobOfferCard
                  offer={offer}
                  kycOk={kycOk}
                  hasActiveJob={demo.active.length > 0}
                  confirming={confirmingOfferId === offer.id}
                  onDecline={handleDeclineOffer}
                  onStartAccept={handleStartAccept}
                  onConfirmAccept={handleConfirmAccept}
                  onCancelConfirm={() => setConfirmingOfferId(null)}
                  onOpenDetail={(j) => openDetail(j, 'offers')}
                />
              </motion.div>
            ))
          ))}

        {tab === 'active' &&
          (demo.active.length === 0 ? (
            <AppEmptyState icon={MapPin} title={emptyCopy.title} subtitle={emptyCopy.subtitle} className="pt-2" />
          ) : (
            demo.active.map((job, i) => (
              <motion.div
                key={job.id}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <LabourJobActiveCard
                  job={job}
                  onMarkOnSite={handleMarkOnSite}
                  onStartWork={handleStartWork}
                  onComplete={handleCompleteActive}
                  onOpenDetail={(j) => openDetail(j, 'active')}
                  onPayFee={handlePayment}
                />
              </motion.div>
            ))
          ))}

        {tab === 'history' &&
          (demo.history.length === 0 ? (
            <AppEmptyState icon={CheckCircle2} title={emptyCopy.title} subtitle={emptyCopy.subtitle} className="pt-2" />
          ) : (
            <div>
              <ul className="space-y-2 pt-1">
                {(showAllHistory ? demo.history : demo.history.slice(0, 3)).map((job, i) => (
                  <motion.div
                    key={`${job.id}-${job.completedAt}`}
                    initial={reduce ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <LabourJobHistoryCard job={job} onOpenDetail={(j) => openDetail(j, 'history')} />
                  </motion.div>
                ))}
              </ul>
              {demo.history.length > 3 && !showAllHistory && (
                <div className="mt-4 px-2 pb-2">
                  <AppButton 
                    type="button" 
                    variant="ghost" 
                    className="w-full py-3 bg-white border border-slate-200 shadow-sm"
                    onClick={() => setShowAllHistory(true)}
                  >
                    Read more
                  </AppButton>
                </div>
              )}
            </div>
          ))}
      </motion.div>

      <section className="pt-1" aria-label="Quick links">
        <Link
          to="/app/earnings"
          className="group flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-sm ring-1 ring-slate-100/90 transition hover:border-brand/30 hover:shadow-md"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
            <IndianRupee className="h-5 w-5" aria-hidden />
          </span>
          <span>
            <p className="text-xs font-extrabold text-slate-900">Earnings</p>
            <p className="text-[10px] text-slate-500">Withdraw</p>
          </span>
        </Link>
      </section>

      <LabourAssignmentDetailModal
        open={Boolean(detailJob)}
        onClose={() => setDetailJob(null)}
        job={detailJob}
        rawJob={detailJob}
        assignmentKind={detailKind === 'active' ? 'active' : 'offer'}
      />
    </div>
  )
}

