import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { X, Briefcase, CheckCircle2, AlertCircle, Loader2, MapPin, Wallet, ArrowRight, ClipboardList } from 'lucide-react'
import { useApplyToEnterpriseJobMutation } from '../../../store/api/enterpriseApi.js'
import toast from 'react-hot-toast'

function companyName(job) {
  return (
    job?.enterpriseId?.enterpriseProfile?.companyName ||
    job?.enterpriseId?.fullName ||
    'Enterprise Company'
  )
}

export function LabourApplyModal({ job, onClose }) {
  const navigate = useNavigate()
  const [applyToJob, { isLoading, isSuccess, isError, error }] = useApplyToEnterpriseJobMutation()

  const handleApply = async () => {
    try {
      await applyToJob({ jobId: job._id }).unwrap()
      toast.success('Application submitted successfully!')
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to submit application')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ pointerEvents: 'auto' }}
    >
      {/* Tap-outside backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={isLoading ? undefined : onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative z-10 w-full bg-white rounded-t-3xl shadow-2xl overflow-hidden"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-y-auto overflow-x-hidden w-full" style={{ maxHeight: '85vh' }}>
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-slate-200" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-2 pb-3 border-b border-slate-100">
            <h3 className="text-[16px] font-extrabold text-slate-900">
              {isSuccess ? 'Application Status' : 'Apply for Job'}
            </h3>
            {!isLoading && (
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            )}
          </div>

          {/* Body */}
          <div className="px-4 pt-4 pb-20 sm:pb-8 w-full">
            {/* Job Summary */}
            <div className="w-full flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
                <Briefcase className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-extrabold text-slate-900 leading-tight line-clamp-2 break-words">
                  {job.jobTitle}
                </p>
                <p className="text-[12px] font-semibold text-slate-500 mt-0.5 truncate">
                  {companyName(job)}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    <Wallet className="h-3 w-3 shrink-0" />
                    ₹{Number(job.salary).toLocaleString('en-IN')} / {job.salaryType || 'month'}
                  </span>
                  {job.locationText && (
                    <span className="flex items-start gap-1.5 text-[11px] font-semibold text-slate-700 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 w-full mt-1.5 leading-snug break-words">
                      <MapPin className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5" />
                      <span className="flex-1 min-w-0">{job.locationText}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Success View */}
            {isSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4 py-4 text-center"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 border-2 border-emerald-200 shadow-sm">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <div>
                  <h4 className="text-[17px] font-extrabold text-slate-900">
                    Application Submitted Successfully!
                  </h4>
                  <p className="text-[13px] font-medium text-slate-500 max-w-[260px] mx-auto mt-1 leading-snug">
                    Your application has been sent to <span className="font-bold text-slate-800">{companyName(job)}</span>.
                  </p>
                </div>

                <div className="w-full p-3 bg-blue-50 border border-blue-100 rounded-2xl text-left flex items-center justify-between">
                  <span className="text-[12px] font-bold text-slate-600">Current Status:</span>
                  <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-[11px] font-extrabold tracking-wide">
                    Applied
                  </span>
                </div>

                <div className="flex flex-col gap-2 w-full pt-2">
                  <button
                    onClick={() => {
                      onClose()
                      navigate('/app/my-applications')
                    }}
                    className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-[14px] font-extrabold shadow-md shadow-indigo-200 flex items-center justify-center gap-2 transition-all"
                  >
                    <ClipboardList className="h-4 w-4" /> View My Applications
                  </button>
                  <button
                    onClick={onClose}
                    className="w-full py-3 rounded-2xl border border-slate-200 text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Continue Browsing Jobs
                  </button>
                </div>
              </motion.div>
            )}

            {/* Error View */}
            {isError && !isSuccess && (
              <div className="flex items-start gap-2 p-3 bg-rose-50 rounded-xl border border-rose-100 mb-4">
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-[12px] font-semibold text-rose-700 break-words min-w-0">
                  {error?.data?.message || 'Something went wrong. Please try again.'}
                </p>
              </div>
            )}

            {/* Default Consent View */}
            {!isSuccess && (
              <>
                <p className="text-[12px] text-slate-500 leading-relaxed mb-5 break-words">
                  By clicking <strong>Confirm Apply</strong>, your verified profile and documents will be shared with{' '}
                  <strong>{companyName(job)}</strong> for this role. They will review and contact you directly.
                </p>

                <div className="flex gap-3 w-full">
                  <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="flex-1 min-w-0 py-3.5 rounded-2xl border border-slate-200 text-[14px] font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApply}
                    disabled={isLoading}
                    className="flex-[2] min-w-0 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-[14px] font-extrabold shadow-md shadow-indigo-200 disabled:opacity-60 transition-all"
                  >
                    {isLoading ? (
                      <><Loader2 className="h-4 w-4 animate-spin shrink-0" /> Submitting…</>
                    ) : (
                      'Confirm Apply'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 60px spacer = bottom nav height */}
        <div className="h-[60px] bg-white" />
      </motion.div>
    </motion.div>
  )
}
