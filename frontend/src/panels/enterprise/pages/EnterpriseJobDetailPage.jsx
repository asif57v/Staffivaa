import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Briefcase, MapPin, Wallet, Users, Clock, ShieldCheck,
  Building2, Calendar, CheckCircle2, User, Eye, Send, Filter,
  UtensilsCrossed, Home, Truck, Award, ChevronDown, ChevronUp, LogIn, LogOut, Radio, Loader2
} from 'lucide-react'
import {
  useGetEnterpriseJobsQuery,
  useGetEnterpriseCompanyApplicationsQuery,
  useUpdateApplicationStatusMutation,
  useGetJobWorkersAttendanceQuery,
} from '../../../store/api/enterpriseApi.js'
import {
  useCreateRechargeOrderMutation,
  useVerifyRechargePaymentMutation,
} from '../../../store/api/enterpriseWalletApi.js'
import { EnterpriseCandidateProfileDrawer } from '../components/EnterpriseCandidateProfileDrawer.jsx'
import { EnterpriseScheduleInterviewModal } from '../components/EnterpriseScheduleInterviewModal.jsx'
import { EnterpriseSendOfferModal } from '../components/EnterpriseSendOfferModal.jsx'
import { getSocket } from '../../../services/socket.js'
import toast from 'react-hot-toast'

// 💳 Dynamic Razorpay Gateway Script Loader
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

// ⏱️ Live Working Duration Ticker component for active on-site workers
function LiveWorkerClock({ checkInAt }) {
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    if (!checkInAt) return
    const update = () => {
      const diffMs = Math.max(0, new Date() - new Date(checkInAt))
      const totalSecs = Math.floor(diffMs / 1000)
      const hours = Math.floor(totalSecs / 3600)
      const mins = Math.floor((totalSecs % 3600) / 60)
      const secs = totalSecs % 60
      setElapsed(`${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`)
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [checkInAt])

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-extrabold text-[11px] border border-blue-200 shadow-xs">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
      </span>
      {elapsed || 'Working'}
    </span>
  )
}

export function EnterpriseJobDetailPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()

  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [interviewModalApp, setInterviewModalApp] = useState(null)
  const [offerModalApp, setOfferModalApp] = useState(null)
  const [expandedWorker, setExpandedWorker] = useState(null)

  // Fetch company jobs to find this specific job requirement
  const { data: jobsData, isLoading: loadingJobs } = useGetEnterpriseJobsQuery()
  const jobs = jobsData?.data || []
  const job = jobs.find((j) => String(j._id) === String(jobId))

  // Fetch applications specific to THIS job requirement
  const { data: appsData, isLoading: loadingApps } = useGetEnterpriseCompanyApplicationsQuery({ jobId })
  const applications = appsData?.data?.applications || []

  // Fetch job-specific worker attendance (Fast 3-second live auto-sync polling)
  const { data: workersAttData, isLoading: loadingWorkersAtt, refetch: refetchAttendance } = useGetJobWorkersAttendanceQuery(jobId)
  const workersAttendance = workersAttData?.data || []

  // 💳 Enterprise Razorpay Direct Payment Gateway Integration
  const [createRechargeOrder] = useCreateRechargeOrderMutation()
  const [verifyRechargePayment] = useVerifyRechargePaymentMutation()
  const [isProcessingPay, setIsProcessingPay] = useState(false)

  const handlePayAndSettle = async (amount, workerName, workerId, applicationId) => {
    if (!amount || amount <= 0) {
      toast.error('Invalid settlement amount')
      return
    }
    setIsProcessingPay(true)
    try {
      const orderRes = await createRechargeOrder({ amount, paymentMethod: 'Razorpay', jobId, workerId, applicationId }).unwrap()
      const orderData = orderRes?.data || {}

      const scriptLoaded = await loadRazorpayScript()
      if (!scriptLoaded) {
        toast.error('Razorpay SDK failed to load. Check your internet connection.')
        setIsProcessingPay(false)
        return
      }

      const options = {
        key: orderData.keyId || 'rzp_test_key',
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Staffivaa Escrow Settlement',
        description: `Wage Settlement for ${workerName} - ₹${amount.toLocaleString('en-IN')}`,
        order_id: orderData.orderId,
        handler: async (response) => {
          try {
            await verifyRechargePayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              paymentMethod: 'Razorpay',
              jobId,
              workerId,
              applicationId,
            }).unwrap()
            toast.success(`Payment of ₹${amount.toLocaleString('en-IN')} successful! Status updated to PAID & SETTLED.`)
            refetchAttendance()
          } catch (err) {
            toast.error(err?.data?.message || 'Payment verification failed')
          } finally {
            setIsProcessingPay(false)
          }
        },
        prefill: {
          name: orderData.companyName || 'Enterprise Client',
          email: orderData.email || '',
          contact: orderData.phone || '',
        },
        theme: {
          color: '#4F46E5',
        },
        modal: {
          ondismiss: () => {
            setIsProcessingPay(false)
            toast('Payment gateway closed', { icon: 'ℹ️' })
          },
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to open Razorpay gateway')
      setIsProcessingPay(false)
    }
  }

  // Real-time socket event listener for instant attendance updates
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleAttendanceChange = () => {
      refetchAttendance()
    }

    socket.on('attendance:updated', handleAttendanceChange)
    socket.on('attendance:checkedIn', handleAttendanceChange)
    socket.on('attendance:checkOut', handleAttendanceChange)

    return () => {
      socket.off('attendance:updated', handleAttendanceChange)
      socket.off('attendance:checkedIn', handleAttendanceChange)
      socket.off('attendance:checkOut', handleAttendanceChange)
    }
  }, [refetchAttendance])

  const [updateStatus] = useUpdateApplicationStatusMutation()

  const handleQuickStatus = async (app, newStatus) => {
    try {
      await updateStatus({ applicationId: app._id, status: newStatus }).unwrap()
      toast.success('Candidate status updated')
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update status')
    }
  }

  if (loadingJobs) {
    return (
      <div className="p-8 text-center text-slate-400 font-medium">
        Loading job requirement details...
      </div>
    )
  }

  if (!job) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <h3 className="text-xl font-bold text-slate-800">Job Requirement Not Found</h3>
        <button
          onClick={() => navigate('/enterprise/jobs')}
          className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm"
        >
          Back to Job Requirements
        </button>
      </div>
    )
  }

  const filledRatio = (job.acceptedCount || 0) / job.numberOfWorkers
  const filledPct = Math.min(Math.round(filledRatio * 100), 100)

  return (
    <div className="px-3.5 py-4 sm:p-6 pb-28 space-y-5 max-w-7xl mx-auto min-h-screen bg-slate-50/50">
      {/* Back button + Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/enterprise/jobs')}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[20px] sm:text-[22px] font-extrabold text-slate-900 leading-tight">{job.jobTitle}</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                job.status === 'approved'
                  ? 'bg-emerald-100 text-emerald-800'
                  : job.status === 'rejected'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {job.status.toUpperCase()}
            </span>
          </div>
          <p className="text-[12.5px] font-medium text-slate-500 mt-0.5">
            Category: <span className="font-bold text-slate-700">{job.categoryId?.name || job.department || 'General'}</span>
          </p>
        </div>
      </div>

      {/* Main Job Overview Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Progress Bar & Vacancy Stats */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] sm:text-[12px] font-extrabold text-slate-400 uppercase tracking-wide">Vacancy Completion</p>
              <p className="text-[17px] sm:text-[20px] font-black text-slate-900 mt-0.5">
                {job.acceptedCount || 0} of {job.numberOfWorkers} Vacancies Filled
              </p>
            </div>
            <span className="text-[20px] sm:text-[22px] font-black text-indigo-600">{filledPct}%</span>
          </div>
          <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-700"
              style={{ width: `${filledPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] sm:text-[12px] font-bold text-slate-500">
            <span>{job.joinedCount || 0} Joined Active Workforce</span>
            <span>{(job.numberOfWorkers || 0) - (job.acceptedCount || 0)} Vacancies Remaining</span>
          </div>
        </div>

        {/* Specs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="p-3 sm:p-4 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl">
            <p className="text-[10.5px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Salary Payout</p>
            <p className="text-[14px] sm:text-[15px] font-black text-emerald-700 mt-0.5">
              ₹{Number(job.salary).toLocaleString('en-IN')} / {job.salaryType || 'month'}
            </p>
          </div>
          <div className="p-3 sm:p-4 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl">
            <p className="text-[10.5px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Work Location</p>
            <p className="text-[12.5px] sm:text-[13px] font-bold text-slate-800 leading-snug break-words mt-0.5">{job.locationText || 'Main Site'}</p>
          </div>
          <div className="p-3 sm:p-4 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl">
            <p className="text-[10.5px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Daily Shift</p>
            <p className="text-[13px] sm:text-[14px] font-bold text-slate-800 mt-0.5">{job.shift || '09:00 AM - 06:00 PM'}</p>
          </div>
          <div className="p-3 sm:p-4 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl">
            <p className="text-[10.5px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Working Hours</p>
            <p className="text-[13px] sm:text-[14px] font-bold text-slate-800 mt-0.5">{job.workingHours || 8} hrs/day</p>
          </div>
        </div>

        {/* 📅 Job Timeline View */}
        {job.timeline && (
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <h4 className="text-[13px] font-extrabold text-slate-900">📅 Job Timeline</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-xs">
                <p className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider">App Start Date</p>
                <p className="text-[13px] font-black text-slate-900 mt-1">
                  {job.timeline.applicationStartDate ? new Date(job.timeline.applicationStartDate).toLocaleDateString('en-IN') : 'N/A'}
                </p>
              </div>
              <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-xs border-l-3 border-l-rose-500">
                <p className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider">App Deadline</p>
                <p className="text-[13px] font-black text-slate-900 mt-1">
                  {job.timeline.applicationLastDate ? new Date(job.timeline.applicationLastDate).toLocaleDateString('en-IN') : 'N/A'}
                </p>
              </div>
              <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-xs border-l-3 border-l-indigo-500 space-y-1">
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <p className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider">Expected Joining</p>
                  <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[8px] font-black px-1.5 py-0.5 rounded-md shrink-0">
                    Invoice Trigger
                  </span>
                </div>
                <p className="text-[13px] font-black text-slate-900">
                  {job.timeline.expectedJoiningDate ? new Date(job.timeline.expectedJoiningDate).toLocaleDateString('en-IN') : 'N/A'}
                </p>
              </div>
              {job.timeline.projectEndDate && (
                <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-xs">
                  <p className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider">Project End Date</p>
                  <p className="text-[13px] font-black text-slate-900 mt-1">
                    {job.timeline.projectEndDate ? new Date(job.timeline.projectEndDate).toLocaleDateString('en-IN') : 'N/A'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Description & Perks */}
        {job.jobDescription && (
          <div className="pt-2 border-t border-slate-100 space-y-1">
            <h4 className="text-[13px] font-extrabold text-slate-900">Description</h4>
            <p className="text-[13px] font-medium text-slate-600 leading-relaxed">{job.jobDescription}</p>
          </div>
        )}

        {(job.providesFood || job.providesAccommodation || job.providesTransportation) && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <h4 className="text-[13px] font-extrabold text-slate-900">Perks & Amenities Provided</h4>
            <div className="flex flex-wrap gap-2">
              {job.providesFood && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-3 py-1 rounded-full">
                  <UtensilsCrossed className="h-3.5 w-3.5" /> Free Food
                </span>
              )}
              {job.providesAccommodation && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full">
                  <Home className="h-3.5 w-3.5" /> Free Accommodation
                </span>
              )}
              {job.providesTransportation && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-100 px-3 py-1 rounded-full">
                  <Truck className="h-3.5 w-3.5" /> Transportation
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 🧑‍💼 Real-Time Worker Attendance Tracker Section */}
      {workersAttendance.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-[18px] font-extrabold text-slate-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-teal-600" /> Worker Attendance ({workersAttendance.length})
            </h2>

            {/* Live Auto-Sync Indicator Badge */}
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11.5px] font-extrabold shadow-2xs">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              Live Auto-Sync
            </span>
          </div>

          <div className="space-y-3">
            {workersAttendance.map((w) => {
              const isExpanded = expandedWorker === w.applicationId
              const statusColor =
                w.todayStatus === 'completed' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                w.todayStatus === 'working' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                'bg-slate-100 text-slate-600 border-slate-200'
              const statusLabel =
                w.todayStatus === 'completed' ? 'Checked Out' :
                w.todayStatus === 'working' ? 'Working Live' :
                'Not Checked In'

              return (
                <div key={w.applicationId} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
                  {/* Worker Header */}
                  <div
                    className="p-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                    onClick={() => setExpandedWorker(isExpanded ? null : w.applicationId)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center overflow-hidden shrink-0">
                        {w.worker.profileImageUrl ? (
                          <img src={w.worker.profileImageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-5 w-5 text-teal-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h4 className="text-[14px] font-extrabold text-slate-900 truncate">{w.worker.fullName || 'Worker'}</h4>
                          <div className="flex items-center gap-2">
                            {w.todayStatus === 'working' && w.todayCheckIn && (
                              <LiveWorkerClock checkInAt={w.todayCheckIn} />
                            )}
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border shrink-0 ${statusColor}`}>
                              {statusLabel}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-1.5 text-[11px] font-semibold text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <LogIn className="h-3 w-3 text-emerald-600" />
                            <span className="text-slate-400">Check In:</span> {w.todayCheckIn ? new Date(w.todayCheckIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}
                          </span>
                          <span className="flex items-center gap-1">
                            <LogOut className="h-3 w-3 text-rose-500" />
                            <span className="text-slate-400">Check Out:</span> {w.todayCheckOut ? new Date(w.todayCheckOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}
                          </span>
                          {w.todayTotalHours > 0 && (
                            <span className="flex items-center gap-1 font-extrabold text-indigo-600">
                              <Clock className="h-3 w-3" /> {w.todayTotalHours}h Total
                            </span>
                          )}
                          {w.todayOvertimeHours > 0 && (
                            <span className="font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              +{w.todayOvertimeHours}h Overtime
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 ml-1">
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                      </div>
                    </div>

                    {/* Summary stats row */}
                    <div className="grid grid-cols-4 gap-2 mt-3">
                      <div className="bg-emerald-50/80 rounded-xl p-2.5 text-center border border-emerald-100">
                        <p className="text-[16px] font-black text-slate-900">{w.summary.presentDays}</p>
                        <p className="text-[9px] font-bold text-emerald-600 uppercase">Present</p>
                      </div>
                      <div className="bg-rose-50/80 rounded-xl p-2.5 text-center border border-rose-100">
                        <p className="text-[16px] font-black text-slate-900">{w.summary.absentDays}</p>
                        <p className="text-[9px] font-bold text-rose-600 uppercase">Absent</p>
                      </div>
                      <div className="bg-indigo-50/80 rounded-xl p-2.5 text-center border border-indigo-100">
                        <p className="text-[16px] font-black text-slate-900">{w.summary.totalHours}h</p>
                        <p className="text-[9px] font-bold text-indigo-600 uppercase">Total Hrs</p>
                      </div>
                      <div className="bg-amber-50/80 rounded-xl p-2.5 text-center border border-amber-100">
                        <p className="text-[16px] font-black text-slate-900">{w.summary.totalOvertime}h</p>
                        <p className="text-[9px] font-bold text-amber-600 uppercase">Overtime</p>
                      </div>
                    </div>

                    {/* 💰 Real Attendance-Based Calculated Wage & Completion Bar */}
                    <div className="mt-3 p-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 rounded-xl border border-emerald-200/80 flex items-center justify-between gap-2 flex-wrap">
                      {(() => {
                        const shiftHrs = job.workingHours || 8
                        const salaryVal = Number(job.salary || 0)
                        const salType = job.salaryType || 'daily'
                        const totHrs = w.summary?.totalHours || 0

                        let hrRate = 0
                        if (salType === 'daily' || salType === 'per_day') hrRate = salaryVal / shiftHrs
                        else if (salType === 'hourly' || salType === 'per_hour') hrRate = salaryVal
                        else hrRate = (salaryVal / 26) / shiftHrs

                        const normalHrs = Math.min(totHrs, shiftHrs)
                        const otHrs = w.summary?.totalOvertime != null ? w.summary.totalOvertime : Math.max(0, parseFloat((totHrs - shiftHrs).toFixed(2)))
                        const baseWage = Math.round(normalHrs * hrRate)
                        const otWage = Math.round(otHrs * (hrRate * 1.5))
                        const totalPayout = baseWage + otWage

                        const compPct = w.summary?.completionPercentage != null && !isNaN(w.summary?.completionPercentage)
                          ? w.summary.completionPercentage 
                          : (shiftHrs > 0 ? Math.min(100, Math.round((totHrs / shiftHrs) * 100)) : 100)

                        return (
                          <div className="w-full space-y-2.5">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div>
                                <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                                  💵 Real Attendance Calculated Wage
                                </p>
                                <p className="text-[17px] font-black text-slate-900 mt-0.5">
                                  ₹{totalPayout.toLocaleString('en-IN')}{' '}
                                  <span className="text-[11px] font-bold text-slate-500">
                                    ({totHrs}h worked vs {shiftHrs}h shift)
                                  </span>
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap justify-end">
                                {w.summary?.isPaid ? (
                                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-[12px] font-black shadow-sm border border-emerald-500">
                                    ✅ PAID & SETTLED (₹{totalPayout.toLocaleString('en-IN')})
                                  </span>
                                ) : (
                                  <>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-black shadow-xs">
                                      {compPct >= 100 ? '✅ 100% Full Payout' : `⏱ ${compPct}% Pro-Rata Payout`}
                                    </span>
                                    <button
                                      type="button"
                                      disabled={isProcessingPay}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handlePayAndSettle(totalPayout, w.worker?.fullName || 'Worker', w.worker?._id, w.applicationId)
                                      }}
                                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[11.5px] font-extrabold shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                    >
                                      {isProcessingPay ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Wallet className="h-3.5 w-3.5" />
                                      )}
                                      {isProcessingPay ? 'Opening Gateway...' : `Pay & Settle ₹${totalPayout.toLocaleString('en-IN')}`}
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* 📊 Detailed Itemized Breakdown Card */}
                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-200/60 text-[11px] font-bold">
                              <div className="bg-white/90 p-2 rounded-lg border border-emerald-100">
                                <p className="text-[9px] font-extrabold text-slate-400 uppercase">Base Shift Wage</p>
                                <p className="text-[13px] font-black text-slate-900 mt-0.5">₹{baseWage.toLocaleString('en-IN')}</p>
                                <p className="text-[9.5px] text-slate-500 font-medium">{normalHrs}h @ ₹{Math.round(hrRate)}/h</p>
                              </div>
                              <div className="bg-amber-50/90 p-2 rounded-lg border border-amber-200/80">
                                <p className="text-[9px] font-extrabold text-amber-700 uppercase">Overtime Pay (+1.5x)</p>
                                <p className="text-[13px] font-black text-amber-900 mt-0.5">+₹{otWage.toLocaleString('en-IN')}</p>
                                <p className="text-[9.5px] text-amber-700 font-medium">{otHrs}h OT @ 1.5x</p>
                              </div>
                              <div className="bg-emerald-100/90 p-2 rounded-lg border border-emerald-300">
                                <p className="text-[9px] font-extrabold text-emerald-800 uppercase">Net Total Payable</p>
                                <p className="text-[13px] font-black text-emerald-950 mt-0.5">₹{totalPayout.toLocaleString('en-IN')}</p>
                                <p className="text-[9.5px] text-emerald-700 font-medium">Final Verified</p>
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>

                  {/* Expanded History */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-2 space-y-2 border-t border-slate-100">
                          <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Recent Attendance Logs</p>
                          {w.records.length === 0 ? (
                            <p className="text-[12px] font-medium text-slate-400 py-3 text-center">No attendance logs recorded yet for this worker.</p>
                          ) : (
                            w.records.map((r) => {
                              const dateStr = new Date(r.shiftDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                              const ciStr = r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'
                              const coStr = r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : (r.checkInAt ? 'Working' : '--')
                              const rSt = r.checkOutAt ? 'Completed' : r.checkInAt ? 'Working' : 'Absent'
                              const stCls = rSt === 'Completed' ? 'bg-emerald-100 text-emerald-800' : rSt === 'Working' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'

                              return (
                                <div key={r._id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-[12px] gap-2">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <span className="font-extrabold text-slate-800 shrink-0">{dateStr}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 ${stCls}`}>{rSt}</span>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0 font-bold text-slate-600">
                                    <span>{ciStr}</span>
                                    <span className="text-slate-300">→</span>
                                    <span>{coStr}</span>
                                    <span className="text-indigo-600 font-extrabold">{r.totalHours > 0 ? `${r.totalHours}h` : '--'}</span>
                                    {r.overtimeHours > 0 && (
                                      <span className="text-amber-600 font-extrabold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">+{r.overtimeHours}h OT</span>
                                    )}
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {loadingWorkersAtt && (
        <div className="p-6 text-center text-slate-400 font-medium">Loading real-time worker attendance...</div>
      )}

      {/* Candidates & Applicants section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-extrabold text-slate-900">Applicants for this Job ({applications.length})</h2>
        </div>

        {loadingApps && (
          <div className="p-8 text-center text-slate-400 font-medium">Loading candidate applications...</div>
        )}

        {!loadingApps && applications.length === 0 && (
          <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center flex flex-col items-center justify-center space-y-3">
            <div className="h-14 w-14 rounded-full bg-indigo-50 flex items-center justify-center">
              <Users className="h-7 w-7 text-indigo-400" />
            </div>
            <h3 className="text-[16px] font-extrabold text-slate-800">No Applicants Yet</h3>
            <p className="text-[13px] text-slate-500 max-w-sm">
              As soon as labour workers apply for this job requirement, they will appear here.
            </p>
          </div>
        )}

        {!loadingApps && applications.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {applications.map((app) => {
              const worker = app.workerId || {}

              return (
                <motion.div
                  key={app._id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center overflow-hidden shrink-0">
                        {worker.profileImageUrl ? (
                          <img src={worker.profileImageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-5 w-5 text-indigo-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[14px] font-extrabold text-slate-900 truncate">
                          {worker.fullName || 'Candidate'}
                        </h4>
                        <p className="text-[11px] font-medium text-slate-500">{worker.phone}</p>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 uppercase border border-slate-200">
                      {app.status?.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-slate-50 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedCandidate(app)}
                      className="flex items-center gap-1 text-[12px] font-extrabold text-indigo-600"
                    >
                      <Eye className="h-3.5 w-3.5" /> Candidate Profile
                    </button>

                    <div className="flex items-center gap-1.5">
                      {app.status === 'applied' && (
                        <button
                          onClick={() => handleQuickStatus(app, 'under_review')}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 text-white text-[11px] font-bold"
                        >
                          Review
                        </button>
                      )}
                      {['applied', 'under_review'].includes(app.status) && (
                        <button
                          onClick={() => handleQuickStatus(app, 'shortlisted')}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-[11px] font-bold"
                        >
                          Shortlist
                        </button>
                      )}
                      {['shortlisted', 'under_review'].includes(app.status) && (
                        <button
                          onClick={() => setInterviewModalApp(app)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-[11px] font-bold flex items-center gap-1"
                        >
                          <Calendar className="h-3 w-3" /> Interview
                        </button>
                      )}
                      {['interview_scheduled', 'selected'].includes(app.status) && (
                        <button
                          onClick={() => setOfferModalApp(app)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1"
                        >
                          <Send className="h-3 w-3" /> Send Offer
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Candidate Profile Drawer */}
      <AnimatePresence>
        {selectedCandidate && (
          <EnterpriseCandidateProfileDrawer
            application={selectedCandidate}
            onClose={() => setSelectedCandidate(null)}
            onScheduleInterview={(app) => setInterviewModalApp(app)}
            onSendOffer={(app) => setOfferModalApp(app)}
          />
        )}
      </AnimatePresence>

      {/* Interview Scheduling Modal */}
      <AnimatePresence>
        {interviewModalApp && (
          <EnterpriseScheduleInterviewModal
            application={interviewModalApp}
            onClose={() => setInterviewModalApp(null)}
          />
        )}
      </AnimatePresence>

      {/* Offer Letter Generator Modal */}
      <AnimatePresence>
        {offerModalApp && (
          <EnterpriseSendOfferModal
            application={offerModalApp}
            onClose={() => setOfferModalApp(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
