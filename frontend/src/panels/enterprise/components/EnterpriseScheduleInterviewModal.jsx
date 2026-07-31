import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Calendar, Clock, MapPin, Video, Phone, FileText, Loader2, CheckCircle2, UserCheck, ShieldAlert, FileCheck, Layers } from 'lucide-react'
import { useScheduleInterviewMutation } from '../../../store/api/enterpriseApi.js'
import { LocationAutocompleteInput } from '../../../components/app/LocationAutocompleteInput.jsx'
import toast from 'react-hot-toast'

const DEFAULT_DOCS = [
  'Resume',
  'Aadhaar Card',
  'Experience Letter',
  'Passport Photo',
  'Educational Certificates',
  'Bank Passbook / Cancelled Cheque',
]

export function EnterpriseScheduleInterviewModal({ application, onClose }) {
  const [scheduleInterview, { isLoading }] = useScheduleInterviewMutation()

  const existingDetails = application?.interviewDetails || {}

  const [round, setRound] = useState(existingDetails.round || 'HR Round')
  const [date, setDate] = useState(
    existingDetails.date ? new Date(existingDetails.date).toISOString().split('T')[0] : new Date(Date.now() + 86400000).toISOString().split('T')[0]
  )
  const [time, setTime] = useState(existingDetails.time || '11:00 AM')
  const [duration, setDuration] = useState(existingDetails.duration || '45 Minutes')
  const [mode, setMode] = useState(existingDetails.mode || 'offline')
  
  // Location / Meeting Link / Phone
  const [officeName, setOfficeName] = useState(existingDetails.officeName || 'Samsung Engineering HQ')
  const [location, setLocation] = useState(existingDetails.location || application?.jobId?.locationText || '')
  const [joinUrl, setJoinUrl] = useState(existingDetails.joinUrl || '')
  const [phoneNumber, setPhoneNumber] = useState(existingDetails.phoneNumber || '')

  // Contact Person
  const [contactName, setContactName] = useState(existingDetails.contactPersonName || 'Amit Sharma')
  const [contactMobile, setContactMobile] = useState(existingDetails.contactPersonMobile || '9876543210')
  const [contactDesignation, setContactDesignation] = useState(existingDetails.contactPersonDesignation || 'HR Lead & Talent Acquisition')
  const [contactEmail, setContactEmail] = useState(existingDetails.contactPersonEmail || 'careers@samsung-eng.com')

  // Required Documents & Instructions
  const [requiredDocs, setRequiredDocs] = useState(
    existingDetails.requiredDocuments?.length > 0
      ? existingDetails.requiredDocuments
      : ['Resume', 'Aadhaar Card', 'Experience Letter', 'Passport Photo']
  )
  const [candidateInstructions, setCandidateInstructions] = useState(
    existingDetails.candidateInstructions || 'Please arrive 15 minutes before the interview. Carry all original documents and wear formal dress.'
  )
  const [internalNotes, setInternalNotes] = useState(existingDetails.internalNotes || '')

  const toggleDoc = (doc) => {
    if (requiredDocs.includes(doc)) {
      setRequiredDocs(requiredDocs.filter((d) => d !== doc))
    } else {
      setRequiredDocs([...requiredDocs, doc])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (mode === 'phone') {
      const cleanPhone = phoneNumber.replace(/\D/g, '')
      if (cleanPhone.length !== 10) {
        toast.error('Interview contact phone number must be exactly 10 digits')
        return
      }
    }

    if (contactMobile) {
      const cleanMobile = contactMobile.replace(/\D/g, '')
      if (cleanMobile.length !== 10) {
        toast.error('HR mobile number must be exactly 10 digits')
        return
      }
    }

    try {
      await scheduleInterview({
        applicationId: application._id,
        round,
        date,
        time,
        duration,
        mode,
        officeName: mode === 'offline' ? officeName : undefined,
        location: mode === 'offline' ? location : undefined,
        joinUrl: mode === 'online' ? joinUrl : undefined,
        phoneNumber: mode === 'phone' ? phoneNumber.replace(/\D/g, '') : undefined,
        contactPersonName: contactName,
        contactPersonMobile: contactMobile ? contactMobile.replace(/\D/g, '') : undefined,
        contactPersonDesignation: contactDesignation,
        contactPersonEmail: contactEmail,
        requiredDocuments: requiredDocs,
        candidateInstructions,
        internalNotes,
      }).unwrap()

      toast.success('Interview Invitation sent to candidate successfully!')
      onClose()
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to schedule interview')
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
        className="w-full max-w-2xl bg-white rounded-t-[32px] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[85vh] my-0 sm:my-auto"
      >
        {/* Mobile Drag Indicator / Header */}
        <div className="flex flex-col items-center pt-2.5 pb-1 sm:hidden shrink-0 bg-indigo-50/60">
          <div className="w-12 h-1.5 rounded-full bg-slate-300" />
        </div>

        {/* Header (Fixed at Top) */}
        <div className="flex items-center justify-between px-5 py-3.5 sm:py-4 border-b border-slate-100 bg-indigo-50/60 shrink-0">
          <div>
            <h3 className="text-[17px] sm:text-[18px] font-extrabold text-slate-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-600 shrink-0" /> Send Interview Invitation
            </h3>
            <p className="text-[12px] font-medium text-slate-500 mt-0.5">
              Candidate: <span className="font-bold text-slate-800">{workerName}</span> • Role: <span className="font-bold text-indigo-600">{jobTitle}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Native Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 min-h-0">
          {/* Interview Round & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">
                Interview Round
              </label>
              <select
                value={round}
                onChange={(e) => setRound(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[13px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="HR Round">HR Round</option>
                <option value="Technical Round">Technical Round</option>
                <option value="Operational Round">Operational Round</option>
                <option value="Final Managerial Round">Final Managerial Round</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">
                Expected Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[13px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="30 Minutes">30 Minutes</option>
                <option value="45 Minutes">45 Minutes</option>
                <option value="60 Minutes">60 Minutes (1 Hour)</option>
                <option value="90 Minutes">90 Minutes</option>
              </select>
            </div>
          </div>

          {/* Mode Selector */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wide mb-2">
              Interview Mode
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'offline', label: 'In-Person', icon: MapPin },
                { id: 'online', label: 'Video Call', icon: Video },
                { id: 'phone', label: 'Phone Call', icon: Phone },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => setMode(id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-[12px] font-bold transition-all cursor-pointer ${
                    mode === id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Date & Time Slot */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">
                Interview Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[13px] font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">
                Time Slot
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 11:00 AM"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[13px] font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
          </div>

          {/* Mode specific fields */}
          {mode === 'offline' && (
            <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wide mb-1">
                  Office / Site Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Samsung Engineering Corporate Tower"
                  value={officeName}
                  onChange={(e) => setOfficeName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-[13px] font-semibold text-slate-800 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wide mb-1">
                  Complete Office Address (Autocomplete + Live Location)
                </label>
                <LocationAutocompleteInput
                  value={location}
                  onChange={(address) => setLocation(address)}
                  placeholder="Search office/site address or use live GPS location..."
                  required
                />
              </div>
            </div>
          )}

          {mode === 'online' && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wide mb-1">
                Video Meeting Link (Google Meet / Zoom / MS Teams)
              </label>
              <input
                type="url"
                required
                placeholder="https://meet.google.com/abc-defg-hij"
                value={joinUrl}
                onChange={(e) => setJoinUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
          )}

          {mode === 'phone' && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wide mb-1">
                Interview Contact Phone Number (10 Digits)
              </label>
              <input
                type="tel"
                required
                maxLength={10}
                placeholder="e.g. 9876543210"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
          )}

          {/* Contact Person Details */}
          <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100 space-y-3">
            <h4 className="text-[12px] font-extrabold text-indigo-900 flex items-center gap-1.5">
              <UserCheck className="h-4 w-4 text-indigo-600" /> HR / Contact Person Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">HR Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Amit Sharma"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-[12px] font-semibold text-slate-800 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Designation</label>
                <input
                  type="text"
                  placeholder="e.g. Talent Acquisition Manager"
                  value={contactDesignation}
                  onChange={(e) => setContactDesignation(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-[12px] font-semibold text-slate-800 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mobile Number (10 Digits)</label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="9876543210"
                  value={contactMobile}
                  onChange={(e) => setContactMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-[12px] font-semibold text-slate-800 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="careers@company.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-[12px] font-semibold text-slate-800 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Required Documents Checklist */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <FileCheck className="h-3.5 w-3.5 text-indigo-500" /> Required Documents (Checklist for Candidate)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DEFAULT_DOCS.map((doc) => {
                const isSelected = requiredDocs.includes(doc)
                return (
                  <button
                    type="button"
                    key={doc}
                    onClick={() => toggleDoc(doc)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-[12px] font-bold text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-900'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <div className={`h-4 w-4 rounded-md border flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'}`}>
                      {isSelected && <CheckCircle2 className="h-3 w-3" />}
                    </div>
                    <span className="truncate">{doc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Candidate Instructions */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">
              Candidate Instructions (Visible to Candidate)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Please arrive 15 minutes before the interview. Carry all original documents and wear formal dress."
              value={candidateInstructions}
              onChange={(e) => setCandidateInstructions(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-[12px] font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {/* Confidential Internal Notes (Secure, Admin/HR Only) */}
          <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-200/80">
            <label className="block text-[11px] font-extrabold text-amber-900 uppercase tracking-wide mb-1 flex items-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-600" /> Internal HR Notes (NEVER visible to Candidate)
            </label>
            <input
              type="text"
              placeholder="Internal evaluation criteria, expected salary budget, or interviewer notes..."
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-[12px] font-medium text-slate-800 outline-none"
            />
          </div>

          {/* Submit Action (Sticky at bottom of form body) */}
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
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-[13px] font-extrabold shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Send Invitation
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
