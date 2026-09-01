import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2, Clock, IndianRupee, MapPin, RotateCcw, Sparkles, Building2 } from 'lucide-react'
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
import { readAppUserLocation, autoFetchLiveLocation } from '../../lib/appUserLocationStorage.js'
import {
  useGetLabourAssignmentsQuery,
  useRespondAssignmentMutation,
  useCheckInMutation,
  useStartWorkMutation,
  useCheckOutMutation,
} from '../../store/api/workforceApi.js'
import { useGetPublicEnterpriseJobsQuery } from '../../store/api/enterpriseApi.js'
import {
  bucketsFromAssignments,
  loadJobDemoState,
  nowIso,
  resetJobDemoToSeed,
  saveJobDemoState,
  subscribeJobDemo,
} from '../../lib/labourJobDemoStorage.js'
import { readLabourPresenceOnline } from '../../hooks/useLabourPresence.js'
import { readApiErrorPayload, readLabourWalletPolicy, readWalletGateFromError } from '../../lib/labourWalletPolicy.js'
import { useGetWalletBalanceQuery } from '../../store/api/walletApi.js'
import { InsufficientWalletModal } from '../../components/labour/InsufficientWalletModal.jsx'

function isApiAssignment(job) {
  return Boolean(job?.requestId) && /^[a-f0-9]{24}$/i.test(String(job.id))
}

export function AppJobsPage() {
  const { user } = useAuth()
  const reduce = useReducedMotion()
  const [tab, setTab] = useState('offers')
  const [localDemo, setLocalDemo] = useState(() => loadJobDemoState())
  const { data: apiData, error: apiError, refetch } = useGetLabourAssignmentsQuery(undefined, {
    pollingInterval: 8000,
    refetchOnMountOrArgChange: true,
  })
  const { data: walletData } = useGetWalletBalanceQuery(undefined, {
    refetchOnMountOrArgChange: true,
  })
  const [respondAssignment] = useRespondAssignmentMutation()
  const [checkIn] = useCheckInMutation()
  const [startWork] = useStartWorkMutation()
  const [checkOut] = useCheckOutMutation()
  const { data: enterpriseJobsRes } = useGetPublicEnterpriseJobsQuery(undefined)
  
  const activeEnterpriseJobsCount = enterpriseJobsRes?.data?.length || 0

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
  const [walletGate, setWalletGate] = useState(null)

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

    socket.on('assignment_assigned', (data) => {
      console.log('[LabourJobs] New assignment assigned:', data)
      // Sound and popup are now handled globally in AppShell
      refetch()
    })

    socket.on('booking_cancelled', (data) => {
      console.log('[LabourJobs] Booking cancelled:', data)
      setToast(`Booking Cancelled: ${data?.message || 'Timeout'}`)
      window.setTimeout(() => setToast(''), 3500)
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
      socket.off('assignment_assigned')
      socket.off('booking_cancelled')
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

  const [deletedHistoryIds, setDeletedHistoryIds] = useState(() => {
    try {
      const raw = localStorage.getItem('lc_deleted_history_ids')
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  const saveDeletedHistoryIds = useCallback((ids) => {
    setDeletedHistoryIds(ids)
    try {
      localStorage.setItem('lc_deleted_history_ids', JSON.stringify(ids))
    } catch (e) {
      console.error(e)
    }
  }, [])

  const filteredHistory = useMemo(() => {
    return demo.history.filter((job) => !deletedHistoryIds.includes(String(job.id || job._id)))
  }, [demo.history, deletedHistoryIds])

  const handleDeleteHistoryItem = useCallback((job) => {
    const jobIdStr = String(job.id || job._id)
    const next = [...deletedHistoryIds, jobIdStr]
    saveDeletedHistoryIds(next)
    showToast('History item deleted.')
  }, [deletedHistoryIds, saveDeletedHistoryIds, showToast])

  const handleClearAllHistory = useCallback(() => {
    const allIds = filteredHistory.map((j) => String(j.id || j._id))
    const next = Array.from(new Set([...deletedHistoryIds, ...allIds]))
    saveDeletedHistoryIds(next)
    showToast('History cleared.')
  }, [deletedHistoryIds, filteredHistory, saveDeletedHistoryIds, showToast])

  const thisMonthCount = useMemo(() => {
    const ym = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    return filteredHistory.filter((h) => String(h.completedAt || '').startsWith(ym)).length
  }, [filteredHistory])

  const tabCounts = useMemo(
    () => ({
      offers: demo.offers.length,
      active: demo.active.length,
      history: filteredHistory.length,
    }),
    [demo.offers.length, demo.active.length, filteredHistory.length],
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

  const walletPolicy = useMemo(
    () => readLabourWalletPolicy({ assignmentsData: apiData, walletData, user }),
    [apiData, walletData, user],
  )

  const handleConfirmAccept = async (offer) => {
    if (!kycOk) return
    if (!readLabourPresenceOnline()) {
      showToast('You are currently OFFLINE. Please turn ON your status from Home screen to accept this job.')
      return
    }
    if (walletPolicy.isLowBalance) {
      setWalletGate({
        balance: walletPolicy.balance,
        minimumRequired: walletPolicy.minimumRequired,
        requiredAmount: walletPolicy.minimumRequired,
      })
      return
    }
    if (isApiAssignment(offer)) {
      try {
        let loc = readAppUserLocation()
        if (!loc?.lat || !loc?.lng) {
          try {
            loc = await autoFetchLiveLocation({ timeout: 12000 })
          } catch {
            showToast('Please allow location access or set your Work Area from Home.')
            return
          }
        }
        await respondAssignment({ 
          id: offer.id, 
          action: 'accept',
          labourLat: loc?.lat,
          labourLng: loc?.lng
        }).unwrap()
        refetch()
        setConfirmingOfferId(null)
        showToast('Assignment accepted — platform fee deducted from your wallet.')
        setTab('active')
      } catch (e) {
        console.error('Accept error:', e)
        const payload = readApiErrorPayload(e)
        const gate = readWalletGateFromError(e, walletPolicy)
        if (gate) {
          setWalletGate(gate)
          return
        }
        showToast(payload?.message || e?.message || 'Failed to accept offer')
        return
      }
    } else {
      if (walletPolicy.isLowBalance) {
        setWalletGate({
          balance: walletPolicy.balance,
          minimumRequired: walletPolicy.minimumRequired,
          requiredAmount: walletPolicy.minimumRequired,
        })
        return
      }
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

  const handleCancelActive = async (id) => {
    const job = demo.active.find((a) => a.id === id)
    if (!job) return
    if (isApiAssignment(job)) {
      try {
        await respondAssignment({ id, action: 'cancel' }).unwrap()
        refetch()
        showToast('Booking cancelled successfully.')
      } catch (e) {
        console.error('Cancel error:', e)
        showToast(e?.data?.message || 'Failed to cancel booking')
        return
      }
    } else {
      persist({
        ...localDemo,
        active: localDemo.active.filter((a) => a.id !== id),
      })
      showToast('Booking cancelled.')
    }
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
            className="fixed left-4 right-4 top-3 z-[200] mx-auto max-w-md rounded-2xl border border-brand/30 bg-slate-900/95 px-4 py-3.5 text-center text-sm font-semibold text-white shadow-xl backdrop-blur-md"
            role="status"
          >
            {toast}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <LabourJobsHero offersCount={demo.offers.length} activeCount={demo.active.length} kycOk={kycOk} />

      {walletPolicy.isLowBalance ? (
        <Link
          to="/app/wallet"
          className="block rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 shadow-sm"
        >
          <p className="font-extrabold">Wallet balance too low to accept bookings</p>
          <p className="mt-1 text-xs font-medium text-rose-800">
            You have ₹{Number(walletPolicy.balance).toLocaleString('en-IN')}. Minimum ₹
            {Number(walletPolicy.minimumRequired).toLocaleString('en-IN')} required. Tap to recharge.
          </p>
        </Link>
      ) : null}

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
                  onCancelBooking={handleCancelActive}
                  onOpenDetail={(j) => openDetail(j, 'active')}
                />
              </motion.div>
            ))
          ))}

        {tab === 'history' &&
          (filteredHistory.length === 0 ? (
            <AppEmptyState icon={CheckCircle2} title={emptyCopy.title} subtitle={emptyCopy.subtitle} className="pt-2" />
          ) : (
            <div>
              <div className="flex items-center justify-between pb-2 px-1">
                <span className="text-xs font-bold text-slate-500">Completed jobs ({filteredHistory.length})</span>
                <button
                  type="button"
                  onClick={handleClearAllHistory}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 transition"
                >
                  Clear history
                </button>
              </div>
              <ul className="space-y-2 pt-1">
                {(showAllHistory ? filteredHistory : filteredHistory.slice(0, 3)).map((job, i) => (
                  <motion.div
                    key={`${job.id}-${job.completedAt}`}
                    initial={reduce ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <LabourJobHistoryCard
                      job={job}
                      onOpenDetail={(j) => openDetail(j, 'history')}
                      onDelete={handleDeleteHistoryItem}
                    />
                  </motion.div>
                ))}
              </ul>
              {filteredHistory.length > 3 && !showAllHistory && (
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
          to="/app/enterprise-jobs"
          className="group flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-linear-to-br from-indigo-50 to-white p-4 shadow-sm ring-1 ring-slate-100/90 transition hover:border-indigo-300 hover:shadow-md relative overflow-hidden"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
              <Building2 className="h-6 w-6" aria-hidden />
            </span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-extrabold text-slate-900 tracking-tight">Enterprise Jobs</p>
                {activeEnterpriseJobsCount > 0 && (
                  <span className="animate-pulse bg-rose-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm">
                    New
                  </span>
                )}
              </div>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">Full-time premium company roles</p>
            </div>
          </div>
        </Link>
      </section>

      <LabourAssignmentDetailModal
        open={Boolean(detailJob)}
        onClose={() => setDetailJob(null)}
        job={detailJob}
        rawJob={detailJob}
        assignmentKind={detailKind === 'active' ? 'active' : 'offer'}
      />

      <InsufficientWalletModal
        open={Boolean(walletGate)}
        balance={walletGate?.balance}
        minimumRequired={walletGate?.minimumRequired}
        requiredAmount={walletGate?.requiredAmount}
        context="job"
        onClose={() => setWalletGate(null)}
      />
    </div>
  )
}

