import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, UserCheck, Calendar, MapPin, Wallet, CheckCircle2,
  Building2, Clock, User, X, Loader2, ArrowRight, ShieldCheck, Briefcase
} from 'lucide-react'
import {
  useGetUpcomingJoiningsQuery,
  useGetActiveWorkforceQuery,
  useMarkWorkerJoinedMutation,
  useGetEnterpriseWorkerAttendanceQuery,
} from '../../../store/api/enterpriseApi.js'
import toast from 'react-hot-toast'

// ─── Mark Joined Modal ────────────────────────────────────────────────────────
function MarkJoinedModal({ joining, onClose }) {
  const [markJoined, { isLoading }] = useMarkWorkerJoinedMutation()

  const [joiningDate, setJoiningDate] = useState(
    joining?.offerDetails?.joiningDate
      ? new Date(joining.offerDetails.joiningDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  )
  const [siteLocation, setSiteLocation] = useState(joining?.offerDetails?.location || 'Main Project Site')
  const [reportingManager, setReportingManager] = useState('Site Supervisor')
  const [project, setProject] = useState(joining?.jobId?.jobTitle || 'Enterprise Project')
  const [department, setDepartment] = useState(joining?.jobId?.department || 'Operations')

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await markJoined({
        applicationId: joining._id,
        joiningDate,
        siteLocation,
        reportingManager,
        project,
        department,
      }).unwrap()

      toast.success('Worker officially marked as JOINED and added to Active Workforce!')
      onClose()
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to mark worker joined')
    }
  }

  const workerName = joining?.workerId?.fullName || 'Worker'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden my-8"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-teal-50/50">
          <div>
            <h3 className="text-[17px] font-extrabold text-slate-900">Mark Worker Joined</h3>
            <p className="text-[12px] font-medium text-slate-500 mt-0.5">
              Confirm onboarding for <span className="font-bold text-slate-800">{workerName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-1.5">
              Actual Joining Date
            </label>
            <input
              type="date"
              required
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[13px] font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-teal-200"
            />
          </div>

          <div>
            <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-1.5">
              Deployed Site Location
            </label>
            <input
              type="text"
              required
              value={siteLocation}
              onChange={(e) => setSiteLocation(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[13px] font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-200"
            />
          </div>

          <div>
            <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-1.5">
              Reporting Manager / Supervisor
            </label>
            <input
              type="text"
              required
              value={reportingManager}
              onChange={(e) => setReportingManager(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[13px] font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-200"
            />
          </div>

          <div>
            <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-1.5">
              Project Name
            </label>
            <input
              type="text"
              required
              value={project}
              onChange={(e) => setProject(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[13px] font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-200"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-[13px] font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-600 text-white text-[13px] font-extrabold shadow-lg shadow-teal-200 hover:bg-teal-700 disabled:opacity-50 transition-all"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Confirm & Mark Joined
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Worker Attendance Modal ──────────────────────────────────────────────────
function WorkerAttendanceModal({ item, onClose }) {
  const { data: attendanceData, isLoading } = useGetEnterpriseWorkerAttendanceQuery(item._id)
  const records = attendanceData?.data || []
  const worker = item.workerId || {}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden my-8"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-[17px] font-extrabold text-slate-900">Attendance & Check-in History</h3>
            <p className="text-[12px] font-medium text-slate-500 mt-0.5">
              Shift logs for <span className="font-bold text-indigo-600">{worker.fullName || 'Worker'}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {isLoading && (
            <div className="p-8 text-center text-slate-400 font-medium">Loading shift logs...</div>
          )}

          {!isLoading && records.length === 0 && (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
              <Clock className="h-8 w-8 text-slate-300 mx-auto" />
              <p className="text-[14px] font-bold text-slate-700">No Check-in Logs Found Yet</p>
              <p className="text-[12px] text-slate-500">
                When this worker checks in or out on the Labour App, shift timestamps will appear here in real-time.
              </p>
            </div>
          )}

          {!isLoading && records.length > 0 && (
            <div className="space-y-3">
              {records.map((r) => {
                const shiftDateStr = new Date(r.shiftDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })

                const checkInStr = r.checkInAt
                  ? new Date(r.checkInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                  : 'Not Checked In'

                const checkOutStr = r.checkOutAt
                  ? new Date(r.checkOutAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                  : r.checkInAt ? 'Shift In Progress' : '—'

                const totalHrs = r.totalHours != null && r.totalHours > 0 ? r.totalHours : (r.checkInAt && r.checkOutAt ? parseFloat(((new Date(r.checkOutAt) - new Date(r.checkInAt)) / 3600000).toFixed(2)) : 0)
                const otHrs = r.overtimeHours != null && r.overtimeHours > 0 ? r.overtimeHours : Math.max(0, parseFloat((totalHrs - (r.standardShiftHours || 8)).toFixed(2)))

                return (
                  <div key={r._id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-extrabold text-slate-900">{shiftDateStr}</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          r.checkOutAt
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.checkInAt
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {r.checkOutAt ? 'Completed' : r.checkInAt ? 'Working / On-Site' : 'Absent'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12px] pt-1">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Check In</p>
                        <p className="font-extrabold text-slate-800 mt-0.5">{checkInStr}</p>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Check Out</p>
                        <p className="font-extrabold text-slate-800 mt-0.5">{checkOutStr}</p>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Total Hours</p>
                        <p className="font-black text-indigo-600 mt-0.5">{totalHrs ? `${totalHrs} hrs` : '0 hrs'}</p>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Overtime (OT)</p>
                        <p className={`font-black mt-0.5 ${otHrs > 0 ? 'text-amber-600 font-extrabold' : 'text-slate-500'}`}>
                          {otHrs > 0 ? `${otHrs} hrs` : '0 hrs'}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function EnterpriseWorkforcePage() {
  const [activeTab, setActiveTab] = useState('upcoming') // 'upcoming' | 'active'
  const [selectedJoining, setSelectedJoining] = useState(null)
  const [selectedAttendanceApp, setSelectedAttendanceApp] = useState(null)

  const { data: upcomingData, isLoading: loadingUpcoming } = useGetUpcomingJoiningsQuery()
  const { data: activeData, isLoading: loadingActive } = useGetActiveWorkforceQuery()

  const upcoming = upcomingData?.data || []
  const activeWorkforce = activeData?.data || []

  return (
    <div className="p-6 pb-32 space-y-6 max-w-7xl mx-auto min-h-screen bg-slate-50/50">
      {/* Header */}
      <div>
        <h1 className="text-[24px] font-extrabold text-slate-900 leading-tight">Workforce & Joinings</h1>
        <p className="text-[13px] font-medium text-slate-500 mt-1">
          Track upcoming candidate joinings and active deployed workers
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex items-center gap-2 pb-3 px-4 text-[14px] font-extrabold border-b-2 transition-all ${
            activeTab === 'upcoming'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="h-4 w-4" />
          Upcoming Joinings
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-100">
            {upcoming.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2 pb-3 px-4 text-[14px] font-extrabold border-b-2 transition-all ${
            activeTab === 'active'
              ? 'border-teal-600 text-teal-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Active Workforce
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-teal-50 text-teal-700 border border-teal-100">
            {activeWorkforce.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Upcoming Joinings */}
      {activeTab === 'upcoming' && (
        <div className="space-y-4">
          {loadingUpcoming && (
            <div className="p-8 text-center text-slate-400 font-medium">Loading upcoming joinings...</div>
          )}

          {!loadingUpcoming && upcoming.length === 0 && (
            <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center flex flex-col items-center justify-center space-y-3">
              <div className="h-14 w-14 rounded-full bg-indigo-50 flex items-center justify-center">
                <Calendar className="h-7 w-7 text-indigo-400" />
              </div>
              <h3 className="text-[15px] font-extrabold text-slate-800">No Upcoming Joinings</h3>
              <p className="text-[13px] text-slate-500 max-w-sm">
                Candidates who accept offer letters will automatically appear here awaiting joining day.
              </p>
            </div>
          )}

          {!loadingUpcoming && upcoming.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcoming.map((item) => {
                const worker = item.workerId || {}
                const job = item.jobId || {}
                const offer = item.offerDetails || {}

                return (
                  <motion.div
                    key={item._id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center overflow-hidden shrink-0">
                        {worker.profileImageUrl ? (
                          <img src={worker.profileImageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-6 w-6 text-indigo-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[15px] font-extrabold text-slate-900 leading-tight truncate">
                          {worker.fullName || 'Worker'}
                        </h4>
                        <p className="text-[12px] font-semibold text-indigo-600 truncate">{job.jobTitle || 'Role'}</p>
                      </div>
                    </div>

                    <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 text-[12px] space-y-1">
                      <p className="font-semibold text-slate-500">Scheduled Joining Date</p>
                      <p className="font-extrabold text-indigo-900 text-[14px]">
                        {offer.joiningDate ? new Date(offer.joiningDate).toLocaleDateString('en-IN') : 'As Agreed'}
                      </p>
                      <p className="text-slate-600 font-medium">Offered Salary: ₹{offer.salary?.toLocaleString('en-IN') || job.salary} / {offer.salaryType || 'month'}</p>
                    </div>

                    <button
                      onClick={() => setSelectedJoining(item)}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[13px] font-extrabold shadow-md shadow-teal-100 transition-all"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Mark Joined
                    </button>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Active Workforce */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {loadingActive && <div className="p-8 text-center text-slate-400 font-medium">Loading active workforce...</div>}

          {!loadingActive && activeWorkforce.length === 0 && (
            <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center flex flex-col items-center justify-center space-y-3">
              <div className="h-14 w-14 rounded-full bg-teal-50 flex items-center justify-center">
                <UserCheck className="h-7 w-7 text-teal-500" />
              </div>
              <h3 className="text-[15px] font-extrabold text-slate-800">No Active Workers Joined Yet</h3>
              <p className="text-[13px] text-slate-500 max-w-sm">
                Workers marked as Joined will appear in this active deployed roster.
              </p>
            </div>
          )}

          {!loadingActive && activeWorkforce.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeWorkforce.map((item) => {
                const worker = item.workerId || {}
                const job = item.jobId || {}
                const joining = item.joiningDetails || {}

                return (
                  <motion.div
                    key={item._id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center overflow-hidden shrink-0">
                        {worker.profileImageUrl ? (
                          <img src={worker.profileImageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-6 w-6 text-teal-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[15px] font-extrabold text-slate-900 leading-tight truncate">
                            {worker.fullName || 'Worker'}
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100">
                            ACTIVE
                          </span>
                        </div>
                        <p className="text-[12px] font-bold text-slate-600 mt-0.5 truncate">{job.jobTitle || 'Deployed Role'}</p>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-3 text-[12px] space-y-1 text-slate-700 font-medium">
                      <p><span className="font-semibold text-slate-400">Site Location:</span> {joining.siteLocation || job.locationText || 'Main Site'}</p>
                      <p><span className="font-semibold text-slate-400">Manager:</span> {joining.reportingManager || 'Site Supervisor'}</p>
                      <p><span className="font-semibold text-slate-400">Joined On:</span> {joining.joiningDate ? new Date(joining.joiningDate).toLocaleDateString('en-IN') : 'Active'}</p>
                    </div>

                    <button
                      onClick={() => setSelectedAttendanceApp(item)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[12px] font-extrabold border border-indigo-200/60 transition-all cursor-pointer"
                    >
                      <Clock className="h-4 w-4" /> Attendance & Check-in Logs
                    </button>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Mark Joined Modal */}
      <AnimatePresence>
        {selectedJoining && (
          <MarkJoinedModal
            joining={selectedJoining}
            onClose={() => setSelectedJoining(null)}
          />
        )}
      </AnimatePresence>

      {/* Worker Attendance Logs Modal */}
      <AnimatePresence>
        {selectedAttendanceApp && (
          <WorkerAttendanceModal
            item={selectedAttendanceApp}
            onClose={() => setSelectedAttendanceApp(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
