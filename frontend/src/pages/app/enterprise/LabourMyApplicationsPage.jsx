import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardList, Briefcase, Building2, MapPin, Wallet,
  ChevronRight, Clock, ArrowLeft, CheckCircle2, XCircle,
  AlertCircle, Eye, Loader2, Users, Star, Calendar, Award,
  Video, Phone, Navigation, Check, X, Send
} from 'lucide-react'
import { useGetMyEnterpriseApplicationsQuery, useRespondToOfferMutation } from '../../../store/api/enterpriseApi.js'
import toast from 'react-hot-toast'

// ─── Status Config Mappings ───────────────────────────────────────────────────
const STATUS_CONFIG = {
  applied: { label: 'Applied', color: 'bg-blue-50 text-blue-700 border-blue-100', dot: 'bg-blue-500' },
  under_review: { label: 'Under Review', color: 'bg-indigo-50 text-indigo-700 border-indigo-100', dot: 'bg-indigo-500' },
  shortlisted: { label: 'Shortlisted ✓', color: 'bg-purple-50 text-purple-700 border-purple-100', dot: 'bg-purple-500' },
  interview_scheduled: { label: 'Interview Scheduled', color: 'bg-amber-50 text-amber-700 border-amber-100', dot: 'bg-amber-500' },
  selected: { label: 'Selected 🎉', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' },
  offered: { label: 'Offer Received 📜', color: 'bg-teal-50 text-teal-700 border-teal-100', dot: 'bg-teal-500' },
  offer_accepted: { label: 'Offer Accepted', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' },
  joining_pending: { label: 'Upcoming Joining 🚀', color: 'bg-indigo-50 text-indigo-700 border-indigo-100', dot: 'bg-indigo-500' },
  joined: { label: 'Joined Active Workforce', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-600' },
  rejected: { label: 'Not Selected', color: 'bg-rose-50 text-rose-700 border-rose-100', dot: 'bg-rose-500' },
}

const STATUS_STEPS = ['applied', 'under_review', 'shortlisted', 'interview_scheduled', 'selected', 'offered', 'joining_pending', 'joined']

function timeAgo(dateStr) {
  if (!dateStr) return 'Recently'
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function companyName(app) {
  return (
    app?.jobId?.enterpriseId?.enterpriseProfile?.companyName ||
    app?.jobId?.enterpriseId?.fullName ||
    'Enterprise Company'
  )
}

function companyLogo(app) {
  return app?.jobId?.enterpriseId?.profileImageUrl || null
}

function AppCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-slate-100 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-100 rounded w-2/3" />
          <div className="h-3 bg-slate-100 rounded w-1/2" />
        </div>
        <div className="h-6 w-20 bg-slate-100 rounded-full" />
      </div>
      <div className="h-3 bg-slate-100 rounded w-3/4" />
    </div>
  )
}

function ApplicationCard({ app, index }) {
  const navigate = useNavigate()
  const [respondToOffer, { isLoading: isResponding }] = useRespondToOfferMutation()

  const status = STATUS_CONFIG[app.status] || STATUS_CONFIG.applied
  const logo = companyLogo(app)
  const name = companyName(app)
  const job = app.jobId
  const isRejected = app.status === 'rejected'

  const stepIndex = STATUS_STEPS.indexOf(app.status)
  const progressPct = isRejected ? 100 : stepIndex >= 0 ? ((stepIndex + 1) / STATUS_STEPS.length) * 100 : 10

  const handleOfferResponse = async (action) => {
    try {
      await respondToOffer({
        applicationId: app._id,
        action,
      }).unwrap()

      toast.success(action === 'accept' ? 'Offer Accepted! You are in Upcoming Joinings.' : 'Offer declined.')
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to respond to offer')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
    >
      {/* Top progress line */}
      <div className={`h-1.5 w-full ${isRejected ? 'bg-rose-200' : 'bg-slate-100'}`}>
        <div
          className={`h-full rounded-full transition-all duration-700 ${isRejected ? 'bg-rose-500' : 'bg-indigo-600'}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="p-4 space-y-3">
        {/* Company + status header */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                {logo ? (
                  <img src={logo} alt={name} className="h-full w-full object-cover" />
                ) : (
                  <Building2 className="h-4.5 w-4.5 text-indigo-400" />
                )}
              </div>
              <p className="text-[13px] font-extrabold text-slate-800 leading-snug break-words">{name}</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold border shrink-0 ${status.color}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          </div>

          <h3 className="text-[15px] font-extrabold text-slate-900 leading-snug break-words">
            {job?.jobTitle || 'Job Role'}
          </h3>
        </div>

        {/* Chips */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {job?.salary && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-xl">
              <Wallet className="h-3 w-3" /> ₹{Number(job.salary).toLocaleString('en-IN')} / {job.salaryType || 'month'}
            </span>
          )}
          {job?.locationText && (
            <span className="flex items-start gap-1.5 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-xl w-full leading-snug break-words">
              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span className="flex-1 min-w-0">{job.locationText}</span>
            </span>
          )}
        </div>

        {/* Dynamic Workflow Details */}
        {app.status === 'interview_scheduled' && app.interviewDetails && (
          <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-3 shadow-xs">
            {/* Title & Mode */}
            <div className="flex items-center justify-between border-b border-amber-200/60 pb-2.5">
              <span className="text-[13px] font-extrabold text-amber-950 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-amber-600 shrink-0" /> Interview Invitation
              </span>
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900">
                {app.interviewDetails.mode === 'offline' ? 'In-Person' : app.interviewDetails.mode === 'online' ? 'Video Call' : 'Phone Call'}
              </span>
            </div>

            {/* Date, Time & Round */}
            <div className="grid grid-cols-2 gap-2 text-[12px] bg-white/80 p-3 rounded-xl border border-amber-100">
              <div>
                <p className="text-[10px] font-extrabold text-amber-800 uppercase">Interview Date & Time</p>
                <p className="font-extrabold text-slate-900 mt-0.5">
                  {new Date(app.interviewDetails.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at {app.interviewDetails.time}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold text-amber-800 uppercase">Round & Duration</p>
                <p className="font-bold text-amber-900 mt-0.5">
                  {app.interviewDetails.round || 'HR Round'} ({app.interviewDetails.duration || '45 Mins'})
                </p>
              </div>
            </div>

            {/* Location / Meeting Link */}
            {app.interviewDetails.mode === 'offline' && (
              <div className="p-3 bg-white/80 rounded-xl border border-amber-100 text-[12px] space-y-1">
                {app.interviewDetails.officeName && (
                  <p className="font-extrabold text-slate-900">{app.interviewDetails.officeName}</p>
                )}
                <p className="text-slate-700 font-medium leading-snug flex items-start gap-1">
                  <MapPin className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>{app.interviewDetails.location || job.locationText}</span>
                </p>
                {app.interviewDetails.location && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(app.interviewDetails.location)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 mt-1 text-[11px] font-extrabold text-amber-700 hover:text-amber-800"
                  >
                    <Navigation className="h-3 w-3" /> Get Directions on Maps
                  </a>
                )}
              </div>
            )}

            {app.interviewDetails.mode === 'online' && app.interviewDetails.joinUrl && (
              <div className="p-3 bg-white/80 rounded-xl border border-amber-100 text-[12px] space-y-1">
                <p className="text-[10px] font-extrabold text-amber-800 uppercase">Video Meeting URL</p>
                <a
                  href={app.interviewDetails.joinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold shadow-xs transition-all"
                >
                  <Video className="h-3.5 w-3.5" /> Join Video Interview
                </a>
              </div>
            )}

            {app.interviewDetails.mode === 'phone' && (app.interviewDetails.phoneNumber || app.interviewDetails.contactPersonMobile) && (
              <div className="p-3 bg-white/80 rounded-xl border border-amber-100 text-[12px] space-y-1">
                <p className="text-[10px] font-extrabold text-amber-800 uppercase">Interview Contact Number</p>
                <a
                  href={`tel:${app.interviewDetails.phoneNumber || app.interviewDetails.contactPersonMobile}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold shadow-xs transition-all"
                >
                  <Phone className="h-3.5 w-3.5" /> Call HR Coordinator
                </a>
              </div>
            )}

            {/* HR Contact Person */}
            {(app.interviewDetails.contactPersonName || app.interviewDetails.contactPersonMobile) && (
              <div className="p-3 bg-white/80 rounded-xl border border-amber-100 text-[12px] space-y-0.5">
                <p className="text-[10px] font-extrabold text-amber-800 uppercase">HR Contact Person</p>
                <p className="font-extrabold text-slate-900">
                  {app.interviewDetails.contactPersonName || 'Amit Sharma'} ({app.interviewDetails.contactPersonDesignation || 'HR Manager'})
                </p>
                {app.interviewDetails.contactPersonMobile && (
                  <p className="text-slate-600 font-medium">Mobile: <a href={`tel:${app.interviewDetails.contactPersonMobile}`} className="font-bold text-amber-700 underline">{app.interviewDetails.contactPersonMobile}</a></p>
                )}
              </div>
            )}

            {/* Required Documents */}
            {app.interviewDetails.requiredDocuments?.length > 0 && (
              <div className="p-3 bg-white/80 rounded-xl border border-amber-100 text-[12px]">
                <p className="text-[10px] font-extrabold text-amber-800 uppercase mb-1">Required Documents</p>
                <div className="flex flex-wrap gap-1">
                  {app.interviewDetails.requiredDocuments.map((doc, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-[11px]">
                      ✓ {doc}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Candidate Instructions */}
            {app.interviewDetails.candidateInstructions && (
              <div className="p-3 bg-white/80 rounded-xl border border-amber-100 text-[12px]">
                <p className="text-[10px] font-extrabold text-amber-800 uppercase mb-0.5">Instructions</p>
                <p className="text-slate-700 font-medium leading-relaxed">{app.interviewDetails.candidateInstructions}</p>
              </div>
            )}

            {/* Detailed Page Button */}
            <div className="pt-1">
              <button
                onClick={() => navigate(`/app/applications/${app._id}/interview`)}
                className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[12px] font-extrabold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Eye className="h-4 w-4 shrink-0" /> Open Full Interview Invitation Page
              </button>
            </div>
          </div>
        )}

        {app.status === 'offered' && app.offerDetails && (
          <div className="p-4 bg-teal-50 border border-teal-100 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-extrabold text-teal-900 flex items-center gap-1.5">
                <Award className="h-4 w-4 text-teal-600" /> Official Offer Letter Received
              </span>
            </div>
            <div className="text-[12px] text-teal-800 font-medium space-y-1">
              <p>Offered Salary: <span className="font-extrabold text-teal-950">₹{app.offerDetails.salary?.toLocaleString('en-IN')} / {app.offerDetails.salaryType}</span></p>
              <p>Joining Date: <span className="font-bold text-teal-950">{new Date(app.offerDetails.joiningDate).toLocaleDateString('en-IN')}</span></p>
              {app.offerDetails.benefits?.length > 0 && (
                <p className="text-[11px] text-teal-700">Perks: {app.offerDetails.benefits.join(', ')}</p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => handleOfferResponse('accept')}
                disabled={isResponding}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-extrabold shadow-sm flex items-center justify-center gap-1 transition-all disabled:opacity-50"
              >
                {isResponding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Accept Offer
              </button>
              <button
                onClick={() => handleOfferResponse('reject')}
                disabled={isResponding}
                className="py-2.5 px-3 rounded-xl border border-rose-200 text-rose-600 text-[12px] font-extrabold hover:bg-rose-50 transition-colors disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {['waiting_for_joining_payment', 'joining_pending', 'offer_accepted'].includes(app.status) && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-[12px] text-amber-900 font-medium space-y-1.5">
            <p className="font-extrabold text-amber-950 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-600 animate-pulse" /> Waiting For Employer Confirmation
            </p>
            <p className="text-amber-800 leading-snug">
              You have accepted the offer! Your employer is completing the joining confirmation payment. Once Staffivaa Admin verifies payment, your joining will be activated and attendance enabled.
            </p>
            <div className="pt-1 flex items-center gap-1.5 text-[11px] font-bold text-amber-700">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" /> Attendance Disabled Until Joining Activation
            </div>
          </div>
        )}

        {['joining_activated', 'joined'].includes(app.status) && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-[12px] text-emerald-900 font-medium space-y-1">
            <p className="font-extrabold text-emerald-950 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Confirmed & Active Employment! 🎉
            </p>
            <p className="text-emerald-800 leading-snug">
              Your joining has been verified and confirmed. You can now check in for work and log daily attendance.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-50">
          <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
            <Clock className="h-3 w-3" /> Applied {timeAgo(app.createdAt)}
          </span>
          <button
            onClick={() => navigate(`/app/enterprise-jobs/${job?._id}`)}
            className="flex items-center gap-1 text-[12px] font-bold text-indigo-600"
          >
            View Role <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export function LabourMyApplicationsPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useGetMyEnterpriseApplicationsQuery()
  const apps = data?.data || []

  const stats = {
    total: apps.length,
    active: apps.filter((a) => !['rejected', 'joined'].includes(a.status)).length,
    shortlisted: apps.filter((a) => ['shortlisted', 'interview_scheduled', 'selected', 'offered'].includes(a.status)).length,
    joined: apps.filter((a) => a.status === 'joined').length,
  }

  return (
    <div className="-mx-4 min-h-screen bg-[#F8F9FB] overflow-x-hidden">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-gradient-to-br from-indigo-700 to-purple-700 px-4 pt-4 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-[18px] font-extrabold text-white leading-tight">My Applications</h1>
            <p className="text-indigo-200 text-[11px] font-medium">{apps.length} total applications</p>
          </div>
        </div>

        {/* Stats Summary Bar */}
        {apps.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Total', val: stats.total, color: 'text-white' },
              { label: 'Active', val: stats.active, color: 'text-indigo-200' },
              { label: 'In Pipeline', val: stats.shortlisted, color: 'text-amber-300' },
              { label: 'Joined', val: stats.joined, color: 'text-emerald-300' },
            ].map((s) => (
              <div key={s.label} className="bg-white/10 backdrop-blur-sm rounded-xl p-2 text-center">
                <p className={`text-[17px] font-extrabold ${s.color}`}>{s.val}</p>
                <p className="text-[9px] font-semibold text-white/70 uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-4 space-y-3 pb-28">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <AppCardSkeleton key={i} />)}

        {isError && (
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 text-center">
            <AlertCircle className="h-8 w-8 text-rose-300 mx-auto mb-2" />
            <p className="text-[13px] font-bold text-rose-600">Failed to load applications</p>
          </div>
        )}

        {!isLoading && apps.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 text-center gap-3"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 border border-indigo-100">
              <ClipboardList className="h-7 w-7 text-indigo-300" />
            </div>
            <p className="text-[15px] font-extrabold text-slate-800">No applications yet</p>
            <p className="text-[12px] text-slate-500 max-w-[200px] leading-snug">
              Start applying to enterprise jobs and track your progress here.
            </p>
            <button
              onClick={() => navigate('/app/enterprise-jobs')}
              className="mt-2 flex items-center gap-1.5 bg-indigo-600 text-white text-[12px] font-bold px-4 py-2.5 rounded-xl shadow-md shadow-indigo-200"
            >
              <Briefcase className="h-4 w-4" /> Browse Enterprise Jobs
            </button>
          </motion.div>
        )}

        <AnimatePresence>
          {!isLoading && apps.map((app, i) => <ApplicationCard key={app._id} app={app} index={i} />)}
        </AnimatePresence>
      </div>
    </div>
  )
}
