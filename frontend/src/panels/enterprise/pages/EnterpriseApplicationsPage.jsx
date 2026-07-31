import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, SlidersHorizontal, Filter, Users, User, MapPin, Wallet,
  Calendar, Briefcase, ShieldCheck, Eye, CheckCircle2, XCircle, Clock,
  Send, ChevronRight, Award, Plus, Sparkles, Building2
} from 'lucide-react'
import { useGetEnterpriseCompanyApplicationsQuery, useUpdateApplicationStatusMutation } from '../../../store/api/enterpriseApi.js'
import { EnterpriseCandidateProfileDrawer } from '../components/EnterpriseCandidateProfileDrawer.jsx'
import { EnterpriseScheduleInterviewModal } from '../components/EnterpriseScheduleInterviewModal.jsx'
import { EnterpriseSendOfferModal } from '../components/EnterpriseSendOfferModal.jsx'
import toast from 'react-hot-toast'

const STATUS_TABS = [
  { id: 'all', label: 'All Applications' },
  { id: 'applied', label: 'New' },
  { id: 'under_review', label: 'Under Review' },
  { id: 'shortlisted', label: 'Shortlisted' },
  { id: 'interview_scheduled', label: 'Interview' },
  { id: 'selected', label: 'Selected' },
  { id: 'offered', label: 'Offer Sent' },
  { id: 'joining_pending', label: 'Upcoming Joinings' },
  { id: 'joined', label: 'Joined' },
  { id: 'rejected', label: 'Rejected' },
]

export function EnterpriseApplicationsPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [interviewModalApp, setInterviewModalApp] = useState(null)
  const [offerModalApp, setOfferModalApp] = useState(null)

  const { data, isLoading, refetch } = useGetEnterpriseCompanyApplicationsQuery({
    status: activeTab,
    search,
  })

  const [updateStatus] = useUpdateApplicationStatusMutation()

  const applications = data?.data?.applications || []
  const stats = data?.data?.stats || {}

  const handleQuickStatus = async (app, newStatus) => {
    try {
      await updateStatus({ applicationId: app._id, status: newStatus }).unwrap()
      toast.success(`Candidate status updated`)
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update status')
    }
  }

  return (
    <div className="p-6 pb-32 space-y-6 max-w-7xl mx-auto min-h-screen bg-slate-50/50">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-extrabold text-slate-900 leading-tight">Applications Portal</h1>
          <p className="text-[13px] font-medium text-slate-500 mt-1">
            Manage candidates across your enterprise recruitment pipeline
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'New Applications', key: 'applied', color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
          { label: 'Under Review', key: 'under_review', color: 'text-blue-600 bg-blue-50 border-blue-100' },
          { label: 'Shortlisted', key: 'shortlisted', color: 'text-purple-600 bg-purple-50 border-purple-100' },
          { label: 'Interviews', key: 'interview_scheduled', color: 'text-amber-600 bg-amber-50 border-amber-100' },
          { label: 'Offers Sent', key: 'offered', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
          { label: 'Joined Workers', key: 'joined', color: 'text-teal-600 bg-teal-50 border-teal-100' },
        ].map(({ label, key, color }) => (
          <div
            key={key}
            onClick={() => setActiveTab(key)}
            className={`p-4 rounded-2xl border cursor-pointer transition-all hover:scale-[1.02] ${color}`}
          >
            <p className="text-[22px] font-extrabold">{stats[key] || 0}</p>
            <p className="text-[11px] font-bold uppercase tracking-wider mt-1 opacity-80">{label}</p>
          </div>
        ))}
      </div>

      {/* Search & Tabs Controls */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search candidate name, job title, skills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[13px] font-semibold text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <div className="text-[12px] font-bold text-slate-500">
            Showing <span className="text-slate-900">{applications.length}</span> candidates
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 pt-2 border-t border-slate-100">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 px-3.5 py-2 rounded-xl text-[12px] font-extrabold border transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {tab.label}
              {stats[tab.id] !== undefined && (
                <span
                  className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] ${
                    activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {stats[tab.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100 animate-pulse space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-slate-100 shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-100 rounded w-2/3" />
                  <div className="h-3 bg-slate-100 rounded w-1/3" />
                </div>
              </div>
              <div className="h-12 bg-slate-50 rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && applications.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center flex flex-col items-center justify-center space-y-3">
          <div className="h-16 w-16 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center">
            <Users className="h-8 w-8 text-indigo-400" />
          </div>
          <h3 className="text-[16px] font-extrabold text-slate-800">No Applications Found</h3>
          <p className="text-[13px] text-slate-500 max-w-sm">
            {search ? 'No candidates match your current search query.' : 'No candidate applications in this stage yet.'}
          </p>
        </div>
      )}

      {/* Candidate Cards Grid */}
      {!isLoading && applications.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {applications.map((app) => {
            const worker = app.workerId || {}
            const job = app.jobId || {}
            const labourProfile = worker.labourProfile || {}

            return (
              <motion.div
                key={app._id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md hover:border-indigo-200 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Candidate Row */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center overflow-hidden shrink-0">
                        {worker.profileImageUrl ? (
                          <img src={worker.profileImageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-6 w-6 text-indigo-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[15px] font-extrabold text-slate-900 leading-tight truncate">
                          {worker.fullName || 'Candidate'}
                        </h4>
                        <p className="text-[12px] font-medium text-slate-500 truncate mt-0.5">
                          {job.jobTitle || 'Role'}
                        </p>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <span className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                      {app.status?.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Chips */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    <span className="flex items-center gap-1 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                      <Wallet className="h-3 w-3" /> ₹{job.salary || 'Market Rate'}
                    </span>
                    <span className="flex items-center gap-1 bg-slate-50 border border-slate-100 text-slate-600 text-[11px] font-medium px-2.5 py-0.5 rounded-full">
                      <MapPin className="h-3 w-3 text-slate-400" /> {job.locationText || 'India'}
                    </span>
                    {labourProfile.kycStatus === 'APPROVED' && (
                      <span className="flex items-center gap-1 bg-amber-50 border border-amber-100 text-amber-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                        <ShieldCheck className="h-3 w-3" /> VERIFIED
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="pt-3 border-t border-slate-50 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedCandidate(app)}
                    className="flex items-center gap-1 text-[12px] font-extrabold text-indigo-600 hover:text-indigo-700"
                  >
                    <Eye className="h-3.5 w-3.5" /> View Profile
                  </button>

                  <div className="flex items-center gap-1.5">
                    {app.status === 'applied' && (
                      <button
                        onClick={() => handleQuickStatus(app, 'under_review')}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 text-white text-[11px] font-bold hover:bg-slate-900 transition-colors"
                      >
                        Review
                      </button>
                    )}
                    {['applied', 'under_review'].includes(app.status) && (
                      <button
                        onClick={() => handleQuickStatus(app, 'shortlisted')}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-[11px] font-bold hover:bg-indigo-700 transition-colors"
                      >
                        Shortlist
                      </button>
                    )}
                    {['shortlisted', 'under_review'].includes(app.status) && (
                      <button
                        onClick={() => setInterviewModalApp(app)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-[11px] font-bold hover:bg-indigo-700 transition-colors flex items-center gap-1"
                      >
                        <Calendar className="h-3 w-3" /> Interview
                      </button>
                    )}
                    {['interview_scheduled', 'selected'].includes(app.status) && (
                      <button
                        onClick={() => setOfferModalApp(app)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1"
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
