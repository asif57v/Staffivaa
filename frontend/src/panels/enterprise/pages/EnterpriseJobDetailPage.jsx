import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Briefcase, MapPin, Wallet, Users, Clock, ShieldCheck,
  Building2, Calendar, CheckCircle2, User, Eye, Send, Filter,
  UtensilsCrossed, Home, Truck, Award
} from 'lucide-react'
import {
  useGetEnterpriseJobsQuery,
  useGetEnterpriseCompanyApplicationsQuery,
  useUpdateApplicationStatusMutation,
} from '../../../store/api/enterpriseApi.js'
import { EnterpriseCandidateProfileDrawer } from '../components/EnterpriseCandidateProfileDrawer.jsx'
import { EnterpriseScheduleInterviewModal } from '../components/EnterpriseScheduleInterviewModal.jsx'
import { EnterpriseSendOfferModal } from '../components/EnterpriseSendOfferModal.jsx'
import toast from 'react-hot-toast'

export function EnterpriseJobDetailPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()

  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [interviewModalApp, setInterviewModalApp] = useState(null)
  const [offerModalApp, setOfferModalApp] = useState(null)

  // Fetch company jobs to find this specific job requirement
  const { data: jobsData, isLoading: loadingJobs } = useGetEnterpriseJobsQuery()
  const jobs = jobsData?.data || []
  const job = jobs.find((j) => String(j._id) === String(jobId))

  // Fetch applications specific to THIS job requirement
  const { data: appsData, isLoading: loadingApps } = useGetEnterpriseCompanyApplicationsQuery({ jobId })
  const applications = appsData?.data?.applications || []
  const stats = appsData?.data?.stats || {}

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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">App Start Date</p>
                <p className="text-[13px] font-extrabold text-slate-800 mt-0.5">
                  {job.timeline.applicationStartDate ? new Date(job.timeline.applicationStartDate).toLocaleDateString('en-IN') : 'N/A'}
                </p>
              </div>
              <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm border-l-2 border-l-rose-500">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">App Deadline</p>
                <p className="text-[13px] font-extrabold text-slate-800 mt-0.5">
                  {job.timeline.applicationLastDate ? new Date(job.timeline.applicationLastDate).toLocaleDateString('en-IN') : 'N/A'}
                </p>
              </div>
              <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm border-l-2 border-l-indigo-500">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  Expected Joining
                  <span className="bg-indigo-100 text-indigo-700 text-[9px] px-1.5 py-0.5 rounded-full">Invoice Trigger</span>
                </p>
                <p className="text-[13px] font-extrabold text-slate-800 mt-0.5">
                  {job.timeline.expectedJoiningDate ? new Date(job.timeline.expectedJoiningDate).toLocaleDateString('en-IN') : 'N/A'}
                </p>
              </div>
              {job.timeline.projectEndDate && (
                <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Project End Date</p>
                  <p className="text-[13px] font-extrabold text-slate-800 mt-0.5">
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
