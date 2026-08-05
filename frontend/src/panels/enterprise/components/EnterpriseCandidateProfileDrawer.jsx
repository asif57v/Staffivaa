import { motion } from 'framer-motion'
import {
  X, User, Phone, Mail, MapPin, ShieldCheck, Briefcase, Calendar,
  Wallet, Award, FileText, CheckCircle2, XCircle, Clock, Star, Video,
  Send, Eye, Sparkles, Building2
} from 'lucide-react'
import { useUpdateApplicationStatusMutation, useMarkWorkerJoinedMutation } from '../../../store/api/enterpriseApi.js'
import toast from 'react-hot-toast'

export function EnterpriseCandidateProfileDrawer({ application, onClose, onScheduleInterview, onSendOffer }) {
  const [updateStatus, { isLoading }] = useUpdateApplicationStatusMutation()
  const [markJoined, { isLoading: isJoining }] = useMarkWorkerJoinedMutation()

  if (!application) return null

  const worker = application.workerId || {}
  const job = application.jobId || {}
  const labourProfile = worker.labourProfile || {}
  const status = application.status

  const handleStatusUpdate = async (newStatus) => {
    try {
      await updateStatus({
        applicationId: application._id,
        status: newStatus,
      }).unwrap()

      toast.success(`Application updated to ${newStatus.replace('_', ' ').toUpperCase()}`)
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update status')
    }
  }

  const handleMarkJoined = async () => {
    try {
      await markJoined({ applicationId: application._id }).unwrap()
      toast.success(`🎉 Candidate ${worker.fullName || ''} marked as JOINED! Added to Active Workforce.`)
      onClose()
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to mark candidate as joined')
    }
  }

  const categoryNames = labourProfile.categoryIds?.map((c) => c.name || c).join(', ') || 'General Labour'

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end">
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-indigo-100 border border-indigo-200 flex items-center justify-center overflow-hidden shrink-0">
              {worker.profileImageUrl ? (
                <img src={worker.profileImageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <User className="h-6 w-6 text-indigo-600" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[17px] font-extrabold text-slate-900">{worker.fullName || 'Candidate Profile'}</h3>
                {labourProfile.kycStatus === 'APPROVED' && (
                  <span className="flex items-center gap-0.5 text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    <ShieldCheck className="h-3 w-3" /> VERIFIED
                  </span>
                )}
              </div>
              <p className="text-[12px] font-medium text-slate-500">Applied for <span className="font-bold text-indigo-600">{job.jobTitle}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Quick Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">Category</p>
              <p className="text-[13px] font-bold text-slate-800 leading-snug break-words mt-0.5">{categoryNames}</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">Experience</p>
              <p className="text-[13px] font-bold text-slate-800 mt-0.5">{application.experienceYears || 2}+ Years</p>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl">
              <p className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wide">Expected Payout</p>
              <p className="text-[13px] font-extrabold text-emerald-800 mt-0.5">₹{job.salary || 'Market Rate'}</p>
            </div>
          </div>

          {/* Contact Details */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2.5">
            <h4 className="text-[13px] font-extrabold text-slate-900 mb-2">Contact & Location</h4>
            <div className="flex items-center gap-2 text-[13px] text-slate-700 font-medium">
              <Phone className="h-4 w-4 text-indigo-500 shrink-0" />
              <span>{worker.phone || 'Phone unavailable'}</span>
            </div>
            {worker.email && (
              <div className="flex items-center gap-2 text-[13px] text-slate-700 font-medium">
                <Mail className="h-4 w-4 text-indigo-500 shrink-0" />
                <span>{worker.email}</span>
              </div>
            )}
            <div className="flex items-start gap-2 text-[13px] text-slate-700 font-medium leading-snug break-words">
              <MapPin className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
              <span>{job.locationText || 'Location details in application'}</span>
            </div>
          </div>

          {/* Verification & KYC Status */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
            <h4 className="text-[13px] font-extrabold text-slate-900 mb-3 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-amber-500" /> Aadhaar Verification & KYC
            </h4>
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <div>
                <p className="font-semibold text-slate-400">KYC Status</p>
                <p className="font-extrabold text-emerald-700 mt-0.5">{labourProfile.kycStatus || 'APPROVED'}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-400">Aadhaar Masked</p>
                <p className="font-extrabold text-slate-800 mt-0.5">{labourProfile.aadhaarMasked || 'XXXX-XXXX-8912'}</p>
              </div>
            </div>
          </div>

          {/* Structured Workflow Detail Card */}
          {application.interviewDetails?.date && (
            <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[13px] font-extrabold text-indigo-950 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-indigo-600" /> Scheduled Interview Details
                </h4>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-200 text-indigo-900 font-extrabold text-[10px] uppercase">
                  {application.interviewDetails.status || 'Scheduled'}
                </span>
              </div>

              {/* Grid Details */}
              <div className="grid grid-cols-2 gap-2 bg-white/80 p-3 rounded-xl border border-indigo-100/70 text-[12px]">
                <div>
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase">Round</p>
                  <p className="font-extrabold text-slate-800">{application.interviewDetails.round || 'HR Round'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase">Mode</p>
                  <p className="font-extrabold text-indigo-600 capitalize">
                    {application.interviewDetails.mode === 'offline' ? 'In-Person' : application.interviewDetails.mode === 'online' ? 'Video Call' : 'Phone Call'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase">Date & Time</p>
                  <p className="font-bold text-slate-800">
                    {new Date(application.interviewDetails.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at {application.interviewDetails.time}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase">Duration</p>
                  <p className="font-bold text-slate-800">{application.interviewDetails.duration || '45 Minutes'}</p>
                </div>
              </div>

              {/* Mode Specifics */}
              {application.interviewDetails.mode === 'offline' && (
                <div className="text-[12px] bg-white/80 p-3 rounded-xl border border-indigo-100/70 space-y-1">
                  {application.interviewDetails.officeName && (
                    <p className="font-bold text-slate-900">{application.interviewDetails.officeName}</p>
                  )}
                  {application.interviewDetails.location && (
                    <p className="text-slate-600 font-medium flex items-start gap-1">
                      <MapPin className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5" />
                      <span>{application.interviewDetails.location}</span>
                    </p>
                  )}
                </div>
              )}

              {application.interviewDetails.mode === 'online' && application.interviewDetails.joinUrl && (
                <div className="text-[12px] bg-white/80 p-3 rounded-xl border border-indigo-100/70 space-y-1">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase">Video Meeting URL</p>
                  <a
                    href={application.interviewDetails.joinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 font-bold underline break-all flex items-center gap-1"
                  >
                    <Video className="h-3.5 w-3.5 shrink-0" /> {application.interviewDetails.joinUrl}
                  </a>
                </div>
              )}

              {application.interviewDetails.mode === 'phone' && (application.interviewDetails.phoneNumber || application.interviewDetails.contactPersonMobile) && (
                <div className="text-[12px] bg-white/80 p-3 rounded-xl border border-indigo-100/70">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase">Contact Phone Number</p>
                  <p className="font-mono font-extrabold text-slate-800">
                    {application.interviewDetails.phoneNumber || application.interviewDetails.contactPersonMobile}
                  </p>
                </div>
              )}

              {/* Contact Person Details */}
              {(application.interviewDetails.contactPersonName || application.interviewDetails.contactPersonMobile) && (
                <div className="text-[12px] bg-white/80 p-3 rounded-xl border border-indigo-100/70 space-y-1">
                  <p className="text-[10px] font-extrabold text-indigo-900 uppercase">HR / Contact Person</p>
                  <p className="font-bold text-slate-800">
                    {application.interviewDetails.contactPersonName || 'Amit Sharma'} ({application.interviewDetails.contactPersonDesignation || 'HR Lead'})
                  </p>
                  {application.interviewDetails.contactPersonMobile && (
                    <p className="text-slate-600 font-medium">Mobile: {application.interviewDetails.contactPersonMobile}</p>
                  )}
                  {application.interviewDetails.contactPersonEmail && (
                    <p className="text-slate-600 font-medium">Email: {application.interviewDetails.contactPersonEmail}</p>
                  )}
                </div>
              )}

              {/* Required Docs */}
              {application.interviewDetails.requiredDocuments?.length > 0 && (
                <div className="text-[12px] bg-white/80 p-3 rounded-xl border border-indigo-100/70">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase mb-1">Required Documents</p>
                  <div className="flex flex-wrap gap-1.5">
                    {application.interviewDetails.requiredDocuments.map((doc, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900 font-bold text-[11px]">
                        ✓ {doc}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Instructions */}
              {application.interviewDetails.candidateInstructions && (
                <div className="text-[12px] bg-white/80 p-3 rounded-xl border border-indigo-100/70">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase mb-0.5">Candidate Instructions</p>
                  <p className="text-slate-700 font-medium">{application.interviewDetails.candidateInstructions}</p>
                </div>
              )}

              {/* Internal Confidential HR Notes */}
              {application.interviewDetails.internalNotes && (
                <div className="text-[12px] bg-amber-50 p-3 rounded-xl border border-amber-200">
                  <p className="text-[10px] font-extrabold text-amber-900 uppercase mb-0.5 flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3 text-amber-600" /> Internal HR Notes (Enterprise Only)
                  </p>
                  <p className="text-amber-950 font-medium">{application.interviewDetails.internalNotes}</p>
                </div>
              )}
            </div>
          )}

          {application.offerDetails?.salary && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
              <h4 className="text-[13px] font-extrabold text-emerald-900 mb-2 flex items-center gap-1.5">
                <Award className="h-4 w-4 text-emerald-600" /> Issued Offer Letter
              </h4>
              <p className="text-[12px] font-extrabold text-emerald-800">
                Salary: ₹{application.offerDetails.salary.toLocaleString('en-IN')} / {application.offerDetails.salaryType}
              </p>
              <p className="text-[11px] font-medium text-emerald-700 mt-1">
                Joining Date: {new Date(application.offerDetails.joiningDate).toLocaleDateString('en-IN')}
              </p>
            </div>
          )}
        </div>

        {/* Footer Quick Actions */}
        <div className="p-4 border-t border-slate-100 bg-white space-y-2.5">
          {/* Primary Action Row */}
          {['applied', 'under_review'].includes(status) && (
            <button
              onClick={() => handleStatusUpdate('shortlisted')}
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-[13px] font-extrabold shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4 shrink-0" /> Shortlist Candidate
            </button>
          )}

          {status === 'shortlisted' && (
            <button
              onClick={() => {
                onClose()
                onScheduleInterview(application)
              }}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-[13px] font-extrabold shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Calendar className="h-4 w-4 shrink-0" /> Schedule Interview
            </button>
          )}

          {['interview_scheduled', 'selected'].includes(status) && (
            <button
              onClick={() => {
                onClose()
                onSendOffer(application)
              }}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-[13px] font-extrabold shadow-md shadow-emerald-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Send className="h-4 w-4 shrink-0" /> Issue Offer Letter
            </button>
          )}

          {['waiting_for_joining_payment', 'joining_pending', 'offered', 'offer_sent', 'offer_accepted', 'selected'].includes(status) && (
            <button
              onClick={handleMarkJoined}
              disabled={isJoining}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-[13px] font-extrabold shadow-md shadow-emerald-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" /> Confirm Candidate Joined 🚀
            </button>
          )}

          {/* Secondary / Danger Actions Row */}
          <div className="flex items-center gap-2">
            {status !== 'rejected' && (
              <button
                onClick={() => handleStatusUpdate('rejected')}
                disabled={isLoading}
                className="flex-1 py-2.5 px-3 rounded-xl border border-rose-200 text-rose-600 text-[12px] font-extrabold hover:bg-rose-50 active:scale-[0.98] transition-all text-center cursor-pointer disabled:opacity-50"
              >
                Reject Candidate
              </button>
            )}

            {status === 'applied' && (
              <button
                onClick={() => handleStatusUpdate('under_review')}
                disabled={isLoading}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-extrabold active:scale-[0.98] transition-all text-center cursor-pointer disabled:opacity-50"
              >
                Under Review
              </button>
            )}

            {['under_review'].includes(status) && (
              <button
                onClick={() => {
                  onClose()
                  onScheduleInterview(application)
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-[12px] font-extrabold hover:bg-indigo-100 active:scale-[0.98] transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <Calendar className="h-3.5 w-3.5" /> Interview
              </button>
            )}

            {['shortlisted'].includes(status) && (
              <button
                onClick={() => handleStatusUpdate('selected')}
                disabled={isLoading}
                className="flex-1 py-2.5 px-3 rounded-xl bg-purple-50 border border-purple-200/60 text-purple-700 text-[12px] font-extrabold hover:bg-purple-100 active:scale-[0.98] transition-all text-center cursor-pointer disabled:opacity-50"
              >
                Select Candidate
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
