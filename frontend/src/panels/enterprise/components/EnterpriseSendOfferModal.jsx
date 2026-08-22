import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Send, Wallet, Calendar, Clock, MapPin, CheckSquare, Loader2, Award } from 'lucide-react'
import { useSendOfferLetterMutation } from '../../../store/api/enterpriseApi.js'
import { LocationAutocompleteInput } from '../../../components/app/LocationAutocompleteInput.jsx'
import toast from 'react-hot-toast'

const DEFAULT_BENEFITS = ['PF & ESIC', 'Free Accommodation', 'Food Provided', 'Medical Insurance', 'Overtime Pay', 'Transportation']

export function EnterpriseSendOfferModal({ application, onClose }) {
  const [sendOfferLetter, { isLoading }] = useSendOfferLetterMutation()

  const [salary, setSalary] = useState(application?.jobId?.salary || 18000)
  const [salaryType, setSalaryType] = useState(application?.jobId?.salaryType || 'monthly')
  const [location, setLocation] = useState(application?.jobId?.locationText || '')
  const [joiningDate, setJoiningDate] = useState(() => {
    const jobTimeline = application?.jobId?.timeline || {}
    if (jobTimeline.expectedJoiningDate) {
      return new Date(jobTimeline.expectedJoiningDate).toISOString().split('T')[0]
    }
    if (jobTimeline.projectStartDate) {
      return new Date(jobTimeline.projectStartDate).toISOString().split('T')[0]
    }
    if (application?.offerDetails?.joiningDate) {
      return new Date(application.offerDetails.joiningDate).toISOString().split('T')[0]
    }
    return new Date().toISOString().split('T')[0]
  })
  const [workingHours, setWorkingHours] = useState(8)
  const [benefits, setBenefits] = useState(['PF & ESIC', 'Food Provided'])
  const [docsRequired, setDocsRequired] = useState('Aadhaar Card, Bank Passbook, 2 Photos')

  const toggleBenefit = (b) => {
    setBenefits((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await sendOfferLetter({
        applicationId: application._id,
        salary,
        salaryType,
        location,
        joiningDate,
        workingHours,
        benefits,
        documentsRequired: docsRequired.split(',').map((s) => s.trim()).filter(Boolean),
      }).unwrap()

      toast.success('Offer Letter sent to candidate!')
      onClose()
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to send offer letter')
    }
  }

  const workerName = application?.workerId?.fullName || 'Candidate'
  const jobTitle = application?.jobId?.jobTitle || 'Job Role'

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        className="w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[85vh] my-0 sm:my-auto"
      >
        {/* Mobile Drag Indicator */}
        <div className="flex flex-col items-center pt-2.5 pb-1 sm:hidden shrink-0 bg-emerald-50/60">
          <div className="w-12 h-1.5 rounded-full bg-slate-300" />
        </div>

        {/* Header (Fixed at Top) */}
        <div className="flex items-center justify-between px-5 py-3.5 sm:py-4 border-b border-slate-100 bg-emerald-50/60 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-emerald-600 shrink-0" />
              <h3 className="text-[17px] font-extrabold text-slate-900">Generate & Send Offer Letter</h3>
            </div>
            <p className="text-[12px] font-medium text-slate-500 mt-0.5">
              To: <span className="font-bold text-slate-800">{workerName}</span> for <span className="font-bold text-slate-800">{jobTitle}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 min-h-0">
          {/* Salary & Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-1.5">
                Offered Salary (₹)
              </label>
              <div className="relative">
                <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="number"
                  required
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[13px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-1.5">
                Payout Term
              </label>
              <select
                value={salaryType}
                onChange={(e) => setSalaryType(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[13px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200"
              >
                <option value="monthly">Per Month</option>
                <option value="daily">Per Day</option>
                <option value="hourly">Per Hour</option>
              </select>
            </div>
          </div>

          {/* Joining Date & Shift Hours */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-1.5">
                Joining Date
              </label>
              <input
                type="date"
                required
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[13px] font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </div>
            <div>
              <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-1.5">
                Shift Hours (Daily)
              </label>
              <input
                type="number"
                required
                value={workingHours}
                onChange={(e) => setWorkingHours(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[13px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-1.5">
              Work Location / Reporting Address
            </label>
            <LocationAutocompleteInput
              value={location}
              onChange={(address) => setLocation(address)}
              placeholder="Search reporting location or use live GPS location..."
              required
            />
          </div>

          {/* Benefits checklist */}
          <div>
            <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-2">
              Benefits & Perks Included
            </label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_BENEFITS.map((b) => (
                <button
                  type="button"
                  key={b}
                  onClick={() => toggleBenefit(b)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                    benefits.includes(b)
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {benefits.includes(b) ? '✓ ' : '+ '}
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Documents Required */}
          <div>
            <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-1.5">
              Required Joining Documents
            </label>
            <input
              type="text"
              placeholder="e.g. Aadhaar Card, PAN, Bank Passbook"
              value={docsRequired}
              onChange={(e) => setDocsRequired(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[13px] font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </div>

          {/* Actions (Sticky at bottom of form body) */}
          <div className="sticky bottom-0 bg-white pt-3 pb-1 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0 z-10">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-[13px] font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-[13px] font-extrabold shadow-lg shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Issue & Send Offer Letter
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
