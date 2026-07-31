import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useCreateEnterpriseJobMutation, useGetEnterpriseSecuritySettingsQuery } from '../../../store/api/enterpriseApi.js'
import { EnterpriseJobCategorySelector } from '../../../components/app/EnterpriseJobCategorySelector.jsx'
import { LocationAutocompleteInput } from '../../../components/app/LocationAutocompleteInput.jsx'
import { EnterpriseMinimumSecurityBalanceModal } from '../components/EnterpriseMinimumSecurityBalanceModal.jsx'
import { ShieldAlert, ArrowLeft, CheckCircle2 } from 'lucide-react'

export function EnterpriseJobNewPage() {
  const navigate = useNavigate()
  const [createJob, { isLoading }] = useCreateEnterpriseJobMutation()
  const { data: securityResponse } = useGetEnterpriseSecuritySettingsQuery()

  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const [modalSecurityData, setModalSecurityData] = useState(null)

  const securityInfo = securityResponse?.data || {}

  const [formData, setFormData] = useState({
    jobTitle: '',
    department: '',
    categoryId: '',
    numberOfWorkers: 1,
    locationText: '',
    locationPoint: null,
    salary: '',
    salaryType: 'monthly',
    experienceRequired: '',
    workingHours: 8,
    shift: '09:00 AM – 06:00 PM',
    providesAccommodation: false,
    providesFood: false,
    providesTransportation: false,
    contractDuration: '',
    jobDescription: '',
    timeline: {
      applicationStartDate: new Date().toISOString().slice(0, 10),
      applicationLastDate: '',
      interviewStartDate: '',
      expectedJoiningDate: '',
      projectStartDate: '',
      projectEndDate: '',
    }
  })

  const [shiftStartTime, setShiftStartTime] = useState('09:00')
  const [shiftEndTime, setShiftEndTime] = useState('18:00')

  const formatTime12Hour = (time24) => {
    if (!time24) return ''
    const [hStr, mStr] = time24.split(':')
    let hours = parseInt(hStr, 10)
    const minutes = mStr || '00'
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12 || 12
    const formattedHours = hours < 10 ? `0${hours}` : hours
    return `${formattedHours}:${minutes} ${ampm}`
  }

  const updateShiftFromTimes = (start, end) => {
    setShiftStartTime(start)
    setShiftEndTime(end)
    if (start && end) {
      const formatted = `${formatTime12Hour(start)} – ${formatTime12Hour(end)}`
      setFormData(prev => ({ ...prev, shift: formatted }))
    }
  }

  const SHIFT_PRESETS = [
    { label: '☀️ Day (9 AM - 6 PM)', start: '09:00', end: '18:00' },
    { label: '🌅 Morning (6 AM - 3 PM)', start: '06:00', end: '15:00' },
    { label: '🌆 Evening (2 PM - 11 PM)', start: '14:00', end: '23:00' },
    { label: '🌙 Night (9 PM - 6 AM)', start: '21:00', end: '06:00' },
  ]

  useEffect(() => {
    if (securityInfo?.timelineConfig) {
      const tc = securityInfo.timelineConfig
      const today = new Date()
      
      const appLast = new Date(today)
      appLast.setDate(today.getDate() + (tc.defaultApplicationWindowDays || 10))
      
      const expectedJoining = new Date(appLast)
      expectedJoining.setDate(appLast.getDate() + (tc.defaultJoiningGapDays || 5))
      
      setFormData(prev => {
        // Prevent infinite loop if already set
        if (prev.timeline.applicationLastDate) return prev
        return {
          ...prev,
          timeline: {
            ...prev.timeline,
            applicationLastDate: appLast.toISOString().slice(0, 10),
            expectedJoiningDate: expectedJoining.toISOString().slice(0, 10),
            projectStartDate: expectedJoining.toISOString().slice(0, 10),
          }
        }
      })
    }
  }, [securityInfo?.timelineConfig])

  const handleTimelineChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      timeline: {
        ...prev.timeline,
        [name]: value
      }
    }))
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleLocationChange = (address, geoPoint) => {
    setFormData(prev => ({
      ...prev,
      locationText: address,
      locationPoint: geoPoint
        ? { type: 'Point', coordinates: [geoPoint.lng, geoPoint.lat] }
        : prev.locationPoint,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (securityInfo.isEnabled && !securityInfo.isSufficient) {
      setModalSecurityData(securityInfo)
      setShowSecurityModal(true)
      return
    }

    if (!formData.categoryId || !formData.jobTitle) {
      toast.error('Please select a job role and ensure a title is provided')
      return
    }

    if (!formData.locationText || !formData.locationText.trim()) {
      toast.error('Please enter or detect a location')
      return
    }

    // Timeline Validations
    const { timeline } = formData
    if (!timeline.applicationLastDate || !timeline.expectedJoiningDate) {
      toast.error('Application Deadline and Expected Joining Date are required')
      return
    }
    if (new Date(timeline.applicationLastDate) < new Date(timeline.applicationStartDate)) {
      toast.error('Application Deadline must be after Start Date')
      return
    }
    if (timeline.interviewStartDate && new Date(timeline.expectedJoiningDate) < new Date(timeline.interviewStartDate)) {
      toast.error('Expected Joining Date must be after Interview Date')
      return
    }
    if (new Date(timeline.expectedJoiningDate) < new Date(timeline.applicationLastDate)) {
      toast.error('Expected Joining Date must be after Application Deadline')
      return
    }
    if (timeline.projectEndDate && timeline.projectStartDate && new Date(timeline.projectEndDate) <= new Date(timeline.projectStartDate)) {
      toast.error('Project End Date must be after Project Start Date')
      return
    }

    try {
      const payload = {
        ...formData,
        numberOfWorkers: parseInt(formData.numberOfWorkers, 10),
        salary: Number(formData.salary),
        workingHours: parseInt(formData.workingHours, 10),
      }

      await createJob(payload).unwrap()
      toast.success('Job requirement created successfully! Published live.')
      navigate('/enterprise/jobs')
    } catch (err) {
      if (err?.data?.data?.insufficientSecurityBalance) {
        setModalSecurityData(err.data.data)
        setShowSecurityModal(true)
      } else {
        toast.error(err?.data?.message || 'Failed to create job requirement')
      }
    }
  }

  return (
    // pb-36 ensures the submit button stays above the mobile bottom nav bar
    <div className="mx-auto max-w-[800px] w-full px-4 sm:px-6 py-6 sm:py-8 pb-36 space-y-6">

      {/* Overdue Invoice Restriction Warning Banner */}
      {securityInfo.isPaymentOverdueRestricted && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-900 font-medium">
          <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0" />
          <div>
            <p className="font-extrabold text-rose-950 text-sm">Hiring Restricted Due to Overdue Payment</p>
            <p className="text-rose-800">
              Please clear your outstanding invoice to publish new job requirements on Staffivaa.
            </p>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-slate-500 hover:text-slate-900 text-[13px] font-bold self-start mb-2 flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-[22px] sm:text-[28px] font-extrabold text-slate-900 tracking-tight leading-tight">
          Create Job Requirement
        </h1>
        <p className="text-[13px] sm:text-[14px] font-medium text-slate-500">
          Fill in the details below to hire workers in bulk.
        </p>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-[16px] shadow-sm border border-slate-100 p-5 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Job Role / Category Selector */}
          <div className="w-full">
            <EnterpriseJobCategorySelector
              value={{ categoryId: formData.categoryId, jobTitle: formData.jobTitle }}
              onChange={({ categoryId, jobTitle }) =>
                setFormData(prev => ({ ...prev, categoryId, jobTitle }))
              }
            />
          </div>

          {/* Number of Workers & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="block text-[12px] font-bold text-slate-700 uppercase tracking-wide">
                Number of Workers *
              </label>
              <input
                required
                type="number"
                min="1"
                name="numberOfWorkers"
                value={formData.numberOfWorkers}
                onChange={handleChange}
                className="w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[12px] font-bold text-slate-700 uppercase tracking-wide">
                Location *
              </label>
              <LocationAutocompleteInput
                required
                name="locationText"
                value={formData.locationText}
                onChange={handleLocationChange}
                placeholder="e.g. Warehouse A, Mumbai"
              />
            </div>
          </div>

          {/* Salary & Salary Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-[12px] font-bold text-slate-700 uppercase tracking-wide">
                Salary (₹) *
              </label>
              <input
                required
                type="number"
                name="salary"
                value={formData.salary}
                onChange={handleChange}
                placeholder="e.g. 15000"
                className="w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[12px] font-bold text-slate-700 uppercase tracking-wide">
                Salary Type
              </label>
              <select
                name="salaryType"
                value={formData.salaryType}
                onChange={handleChange}
                className="w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
              >
                <option value="monthly">Monthly</option>
                <option value="daily">Daily</option>
                <option value="hourly">Hourly</option>
              </select>
            </div>
          </div>

          {/* Working Hours & Shift Timings */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[12px] font-bold text-slate-700 uppercase tracking-wide">
                  Working Hours / Day
                </label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  name="workingHours"
                  value={formData.workingHours}
                  onChange={handleChange}
                  className="w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[12px] font-bold text-slate-700 uppercase tracking-wide">
                  Shift Start Time
                </label>
                <input
                  type="time"
                  value={shiftStartTime}
                  onChange={(e) => updateShiftFromTimes(e.target.value, shiftEndTime)}
                  className="w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[12px] font-bold text-slate-700 uppercase tracking-wide">
                  Shift End Time
                </label>
                <input
                  type="time"
                  value={shiftEndTime}
                  onChange={(e) => updateShiftFromTimes(shiftStartTime, e.target.value)}
                  className="w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>
            </div>

            {/* Quick Shift Presets & Formatted Result */}
            <div className="space-y-2 bg-slate-50 border border-slate-200/80 rounded-[12px] p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">⚡ Quick Shift Presets</span>
                <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                  <span>Formatted:</span>
                  <span className="font-extrabold text-indigo-900">{formData.shift || '09:00 AM – 06:00 PM'}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {SHIFT_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => updateShiftFromTimes(preset.start, preset.end)}
                    className={`text-[12px] font-bold px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                      shiftStartTime === preset.start && shiftEndTime === preset.end
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <input
                  type="text"
                  name="shift"
                  value={formData.shift}
                  onChange={handleChange}
                  placeholder="Custom Shift Timings string (e.g. 09:00 AM – 06:00 PM)"
                  className="w-full rounded-[8px] border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Amenities Provided */}
          <div className="space-y-2">
            <label className="block text-[12px] font-bold text-slate-700 uppercase tracking-wide">
              Amenities Provided
            </label>
            <div className="flex flex-wrap gap-5 pt-1">
              {[
                { name: 'providesAccommodation', label: 'Accommodation' },
                { name: 'providesFood', label: 'Food' },
                { name: 'providesTransportation', label: 'Transportation' },
              ].map(({ name, label }) => (
                <label
                  key={name}
                  className="flex items-center gap-2 text-[14px] font-medium text-slate-700 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    name={name}
                    checked={formData[name]}
                    onChange={handleChange}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* 📅 Job Timeline */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <h4 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
              📅 Job Timeline
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="block text-[12px] font-bold text-slate-700 uppercase tracking-wide">
                  Application Start Date *
                </label>
                <input
                  required
                  type="date"
                  name="applicationStartDate"
                  value={formData.timeline.applicationStartDate}
                  onChange={handleTimelineChange}
                  className="w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] font-bold text-slate-700 uppercase tracking-wide">
                  Application Deadline *
                </label>
                <input
                  required
                  type="date"
                  name="applicationLastDate"
                  value={formData.timeline.applicationLastDate}
                  onChange={handleTimelineChange}
                  className="w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[12px] font-bold text-slate-700 uppercase tracking-wide flex justify-between">
                  <span>Interview Start Date</span>
                  <span className="text-slate-400 font-normal normal-case">(Optional)</span>
                </label>
                <input
                  type="date"
                  name="interviewStartDate"
                  value={formData.timeline.interviewStartDate}
                  onChange={handleTimelineChange}
                  className="w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] font-bold text-slate-700 uppercase tracking-wide flex items-center justify-between">
                  <span>Expected Joining Date *</span>
                  <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full">Triggers Invoice</span>
                </label>
                <input
                  required
                  type="date"
                  name="expectedJoiningDate"
                  value={formData.timeline.expectedJoiningDate}
                  onChange={handleTimelineChange}
                  className="w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] font-bold text-indigo-900 outline-none transition focus:border-indigo-500 focus:bg-indigo-50 focus:ring-4 focus:ring-indigo-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[12px] font-bold text-slate-700 uppercase tracking-wide flex justify-between">
                  <span>Project Start Date</span>
                  <span className="text-slate-400 font-normal normal-case">(Optional)</span>
                </label>
                <input
                  type="date"
                  name="projectStartDate"
                  value={formData.timeline.projectStartDate}
                  onChange={handleTimelineChange}
                  className="w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] font-bold text-slate-700 uppercase tracking-wide flex justify-between">
                  <span>Project End Date</span>
                  <span className="text-slate-400 font-normal normal-case">(Optional)</span>
                </label>
                <input
                  type="date"
                  name="projectEndDate"
                  value={formData.timeline.projectEndDate}
                  onChange={handleTimelineChange}
                  className="w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>
            </div>
          </div>

          {/* Job Description */}
          <div className="space-y-1.5">
            <label className="block text-[12px] font-bold text-slate-700 uppercase tracking-wide">
              Job Description
            </label>
            <textarea
              name="jobDescription"
              value={formData.jobDescription}
              onChange={handleChange}
              rows="4"
              placeholder="Briefly describe the responsibilities and requirements..."
              className="w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 resize-none"
            />
          </div>

          {/* Submit Button — full width on mobile so it's always visible */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto sm:float-right bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold py-4 px-10 rounded-[14px] text-[15px] transition active:scale-[0.98] shadow-md shadow-indigo-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  Post Requirement
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
