import React, { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Calendar, Clock, MapPin, Video, Phone, Building2,
  Navigation, UserCheck, Mail, ShieldCheck, CheckCircle2, AlertCircle,
  Copy, ExternalLink, Bell, CheckSquare, Loader2, Sparkles, FileText,
  XCircle, Award, Check
} from 'lucide-react'
import { useGetInterviewDetailsQuery } from '../../../store/api/enterpriseApi.js'
import toast from 'react-hot-toast'

export function LabourInterviewDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [copiedLink, setCopiedLink] = useState(false)

  const { data: response, isLoading, isError, refetch } = useGetInterviewDetailsQuery(id)

  const application = response?.data
  const job = application?.jobId || {}
  const enterprise = application?.enterpriseId || {}
  const interview = application?.interviewDetails || {}

  const companyName = enterprise?.enterpriseProfile?.companyName || enterprise?.fullName || 'Samsung Engineering'
  const companyLogo = enterprise?.profileImageUrl || null
  const jobTitle = job?.jobTitle || 'AC Technician'
  const locationText = job?.locationText || 'Indore, MP'
  const appIdShort = application?._id ? application._id.slice(-6).toUpperCase() : '8912'

  const copyMeetingLink = (url) => {
    if (!url) return
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    toast.success('Meeting link copied to clipboard!')
    setTimeout(() => setCopiedLink(false), 3000)
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
          <p className="text-[13px] font-bold text-slate-500">Loading interview details...</p>
        </div>
      </div>
    )
  }

  if (isError || !application) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center text-center">
        <div className="h-16 w-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-[18px] font-extrabold text-slate-900">Interview Invitation Not Found</h2>
        <p className="text-[13px] text-slate-500 mt-1 max-w-sm">
          The interview schedule you are looking for does not exist or has been updated.
        </p>
        <button
          onClick={() => navigate('/app/my-applications')}
          className="mt-6 px-6 py-2.5 rounded-xl bg-slate-900 text-white text-[13px] font-extrabold shadow-md"
        >
          Back to Applications
        </button>
      </div>
    )
  }

  const isCancelled = interview.status === 'cancelled' || application.status === 'rejected'
  const isSelected = application.status === 'selected' || application.status === 'offered'

  // Timeline Steps
  const timelineSteps = [
    { id: 'applied', label: 'Applied', done: true },
    { id: 'shortlisted', label: 'Shortlisted', done: ['shortlisted', 'interview_scheduled', 'selected', 'offered', 'joined'].includes(application.status) },
    { id: 'interview_scheduled', label: 'Interview Scheduled', done: ['interview_scheduled', 'selected', 'offered', 'joined'].includes(application.status) },
    { id: 'interview_completed', label: 'Interview Completed', done: ['selected', 'offered', 'joined'].includes(application.status) },
    { id: 'outcome', label: isSelected ? 'Selected 🎉' : application.status === 'rejected' ? 'Not Selected' : 'Outcome Pending', done: ['selected', 'offered', 'joined', 'rejected'].includes(application.status) },
  ]

  const directionsUrl = interview.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(interview.location)}`
    : '#'

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-28">
      {/* Top Header Bar */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/app/my-applications')}
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-[17px] font-extrabold text-slate-900 leading-tight">Interview Invitation</h1>
            <p className="text-[11px] font-medium text-slate-500">Ref ID: #{appIdShort}</p>
          </div>
        </div>

        {/* Current Status Badge */}
        <span
          className={`px-3 py-1 rounded-full text-[11px] font-extrabold uppercase flex items-center gap-1 border ${
            isCancelled
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : isSelected
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${isCancelled ? 'bg-rose-500' : isSelected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
          {isCancelled ? 'Cancelled' : isSelected ? 'Selected' : 'Scheduled'}
        </span>
      </div>

      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
        {/* Cancellation Notice if Cancelled */}
        {isCancelled && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
            <XCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-[14px] font-extrabold text-rose-900">Interview Cancelled</h4>
              <p className="text-[12px] text-rose-700 mt-0.5">
                {interview.cancellationReason || 'The enterprise client has updated or cancelled this interview schedule.'}
              </p>
            </div>
          </div>
        )}

        {/* Company & Job Overview Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="h-14 w-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                {companyLogo ? (
                  <img src={companyLogo} alt={companyName} className="h-full w-full object-cover" />
                ) : (
                  <Building2 className="h-7 w-7 text-indigo-600" />
                )}
              </div>
              <div>
                <h2 className="text-[18px] font-extrabold text-slate-900 leading-tight">{companyName}</h2>
                <p className="text-[14px] font-extrabold text-indigo-600 mt-0.5">{jobTitle}</p>
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500 mt-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{locationText}</span>
                </div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600 font-mono font-extrabold text-[11px]">
              #{appIdShort}
            </span>
          </div>
        </div>

        {/* Interview Information Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-[14px] font-extrabold text-slate-900 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-indigo-600" /> Interview Information
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Round</p>
              <p className="text-[13px] font-extrabold text-slate-800 mt-0.5">{interview.round || 'HR Round'}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Mode</p>
              <p className="text-[13px] font-extrabold text-indigo-600 capitalize mt-0.5">
                {interview.mode === 'offline' ? 'In Person' : interview.mode === 'online' ? 'Video Call' : 'Phone Call'}
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Date</p>
              <p className="text-[13px] font-extrabold text-slate-800 mt-0.5">
                {interview.date ? new Date(interview.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '30 Jul 2026'}
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Time & Duration</p>
              <p className="text-[13px] font-extrabold text-slate-800 mt-0.5">
                {interview.time || '11:00 AM'} ({interview.duration || '45 Mins'})
              </p>
            </div>
          </div>
        </div>

        {/* Meeting / Venue Details */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
          <h3 className="text-[14px] font-extrabold text-slate-900 flex items-center gap-2">
            {interview.mode === 'offline' && <MapPin className="h-4 w-4 text-emerald-600" />}
            {interview.mode === 'online' && <Video className="h-4 w-4 text-indigo-600" />}
            {interview.mode === 'phone' && <Phone className="h-4 w-4 text-purple-600" />}
            Meeting & Location Details
          </h3>

          {/* Mode = In Person */}
          {interview.mode === 'offline' && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
              <div>
                <p className="text-[11px] font-extrabold text-slate-400 uppercase">Office / Site Name</p>
                <p className="text-[14px] font-bold text-slate-800 mt-0.5">{interview.officeName || companyName}</p>
              </div>
              <div>
                <p className="text-[11px] font-extrabold text-slate-400 uppercase">Complete Address</p>
                <p className="text-[13px] font-medium text-slate-700 leading-relaxed mt-0.5 break-words">
                  {interview.location || locationText}
                </p>
              </div>
              <div className="pt-1 flex items-center gap-2">
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-extrabold shadow-sm transition-all"
                >
                  <Navigation className="h-4 w-4 shrink-0" /> Get Directions on Maps
                </a>
              </div>
            </div>
          )}

          {/* Mode = Video Call */}
          {interview.mode === 'online' && (
            <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3">
              <p className="text-[11px] font-extrabold text-indigo-900 uppercase">Video Meeting URL</p>
              <p className="text-[13px] font-mono font-bold text-indigo-700 break-all">
                {interview.joinUrl || 'https://meet.google.com/abc-defg-hij'}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {interview.joinUrl && (
                  <a
                    href={interview.joinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-extrabold shadow-sm transition-all"
                  >
                    <Video className="h-4 w-4 shrink-0" /> Join Video Meeting
                  </a>
                )}
                <button
                  onClick={() => copyMeetingLink(interview.joinUrl)}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-[12px] font-bold hover:bg-slate-50 transition-all cursor-pointer"
                >
                  {copiedLink ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-slate-500" />}
                  {copiedLink ? 'Copied' : 'Copy Link'}
                </button>
              </div>
            </div>
          )}

          {/* Mode = Phone Interview */}
          {interview.mode === 'phone' && (
            <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100 space-y-3">
              <p className="text-[11px] font-extrabold text-purple-900 uppercase">Contact Interview Number</p>
              <p className="text-[16px] font-mono font-black text-purple-900">
                {interview.phoneNumber || interview.contactPersonMobile || '9876543210'}
              </p>
              <a
                href={`tel:${interview.phoneNumber || interview.contactPersonMobile}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[12px] font-extrabold shadow-sm transition-all"
              >
                <Phone className="h-4 w-4 shrink-0" /> Call HR / Manager
              </a>
            </div>
          )}
        </div>

        {/* Contact Person Details */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
          <h3 className="text-[14px] font-extrabold text-slate-900 flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-indigo-600" /> Contact Person / HR Coordinator
          </h3>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="space-y-0.5">
              <h4 className="text-[14px] font-extrabold text-slate-900">{interview.contactPersonName || 'Amit Sharma'}</h4>
              <p className="text-[12px] font-medium text-slate-500">{interview.contactPersonDesignation || 'HR Lead & Recruitment Manager'}</p>
              {interview.contactPersonEmail && (
                <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                  <Mail className="h-3 w-3" /> {interview.contactPersonEmail}
                </p>
              )}
            </div>

            {interview.contactPersonMobile && (
              <a
                href={`tel:${interview.contactPersonMobile}`}
                className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center hover:bg-emerald-100 transition-colors shrink-0"
              >
                <Phone className="h-5 w-5" />
              </a>
            )}
          </div>
        </div>

        {/* Required Documents Checklist */}
        {interview.requiredDocuments && interview.requiredDocuments.length > 0 && (
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
            <h3 className="text-[14px] font-extrabold text-slate-900 flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-indigo-600" /> Required Documents (Carry for Interview)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {interview.requiredDocuments.map((doc, idx) => (
                <div key={idx} className="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                  <div className="h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                  <span className="text-[13px] font-bold text-emerald-950">{doc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions for Candidate */}
        {interview.candidateInstructions && (
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-2">
            <h3 className="text-[14px] font-extrabold text-slate-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-600" /> Instructions for Candidate
            </h3>
            <p className="text-[13px] font-medium text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
              {interview.candidateInstructions}
            </p>
          </div>
        )}

        {/* Automatic Reminder Section */}
        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-3xl flex items-start gap-3">
          <div className="h-9 w-9 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
            <Bell className="h-5 w-5 animate-bounce" />
          </div>
          <div>
            <h4 className="text-[13px] font-extrabold text-indigo-950">Interview Reminder System</h4>
            <p className="text-[12px] font-medium text-indigo-700 mt-0.5">
              You will receive push reminders <span className="font-bold">24 Hours Before</span> and <span className="font-bold">1 Hour Before</span> your scheduled time slot.
            </p>
          </div>
        </div>

        {/* Recruitment Status Timeline */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-[14px] font-extrabold text-slate-900">Application Stage Timeline</h3>

          <div className="space-y-3 relative before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
            {timelineSteps.map((step, idx) => (
              <div key={step.id} className="flex items-center gap-3 relative z-10">
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0 border-2 ${
                    step.done
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-slate-400 border-slate-200'
                  }`}
                >
                  {step.done ? <Check className="h-4 w-4 stroke-[3]" /> : idx + 1}
                </div>
                <span className={`text-[13px] font-bold ${step.done ? 'text-slate-900 font-extrabold' : 'text-slate-400'}`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Primary Sticky Action Bar at Bottom */}
      {!isCancelled && (
        <div className="fixed inset-x-0 bottom-0 z-40 bg-white border-t border-slate-100 p-4 shadow-xl flex items-center justify-center">
          <div className="w-full max-w-2xl flex items-center gap-3">
            {interview.mode === 'offline' && (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-[14px] font-extrabold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
              >
                <Navigation className="h-5 w-5" /> Get Directions to Venue
              </a>
            )}

            {interview.mode === 'online' && (
              <a
                href={interview.joinUrl || '#'}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-[14px] font-extrabold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
              >
                <Video className="h-5 w-5" /> Join Video Interview
              </a>
            )}

            {interview.mode === 'phone' && (
              <a
                href={`tel:${interview.phoneNumber || interview.contactPersonMobile}`}
                className="w-full py-3.5 px-6 rounded-2xl bg-purple-600 hover:bg-purple-700 active:scale-[0.98] text-white text-[14px] font-extrabold shadow-lg shadow-purple-200 transition-all flex items-center justify-center gap-2"
              >
                <Phone className="h-5 w-5" /> Call HR Coordinator
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
