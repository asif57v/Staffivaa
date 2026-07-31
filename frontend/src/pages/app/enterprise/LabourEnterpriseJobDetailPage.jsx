import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Building2, ShieldCheck, MapPin, Wallet, Users,
  Clock, Briefcase, Calendar, GraduationCap, Star, ChevronRight,
  Home, Truck, UtensilsCrossed, HeartPulse, CheckCircle2, AlertCircle,
  Share2, Bookmark,
} from 'lucide-react'
import { useGetPublicEnterpriseJobByIdQuery } from '../../../store/api/enterpriseApi.js'
import { LabourApplyModal } from './LabourApplyModal.jsx'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  return `${Math.floor(days / 30)} months ago`
}
function companyName(job) {
  return job?.enterpriseId?.enterpriseProfile?.companyName || job?.enterpriseId?.fullName || 'Enterprise Company'
}
function companyLogo(job) { return job?.enterpriseId?.profileImageUrl || null }

const PERK_MAP = [
  { key: 'providesFood',          icon: UtensilsCrossed, label: 'Free Food',      color: 'text-orange-600 bg-orange-50 border-orange-100' },
  { key: 'providesAccommodation', icon: Home,             label: 'Accommodation',  color: 'text-blue-600 bg-blue-50 border-blue-100' },
  { key: 'providesTransportation',icon: Truck,            label: 'Transportation', color: 'text-purple-600 bg-purple-50 border-purple-100' },
]

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-[#F8F9FB] animate-pulse">
      <div className="h-48 bg-slate-200" />
      <div className="px-4 -mt-8 space-y-3">
        <div className="bg-white rounded-2xl p-5 space-y-3">
          <div className="flex gap-3">
            <div className="h-16 w-16 rounded-2xl bg-slate-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-100 rounded w-1/2" />
              <div className="h-3 bg-slate-100 rounded w-1/3" />
            </div>
          </div>
          <div className="h-6 bg-slate-100 rounded w-3/4" />
          <div className="flex gap-2">
            <div className="h-7 bg-slate-100 rounded-full w-24" />
            <div className="h-7 bg-slate-100 rounded-full w-20" />
          </div>
        </div>
        {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl p-5 h-24 bg-slate-100" />)}
      </div>
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <h3 className="text-[14px] font-extrabold text-slate-900 mb-3">{title}</h3>
      {children}
    </div>
  )
}

// ─── Info Row ─────────────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
        <Icon className="h-4 w-4 text-indigo-500" />
      </div>
      <div>
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-[13px] font-semibold text-slate-800">{value}</p>
      </div>
    </div>
  )
}

// ─── Mini Job Card (similar jobs) ────────────────────────────────────────────
function MiniJobCard({ job }) {
  const navigate = useNavigate()
  return (
    <div
      onClick={() => navigate(`/app/enterprise-jobs/${job._id}`)}
      className="shrink-0 w-56 bg-white rounded-xl border border-slate-100 shadow-sm p-3 cursor-pointer active:scale-[0.98] transition-transform"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="h-8 w-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
          {companyLogo(job)
            ? <img src={companyLogo(job)} alt="" className="h-full w-full object-cover" />
            : <Building2 className="h-4 w-4 text-indigo-400" />}
        </div>
        <span className="text-[10px] font-semibold text-slate-500 truncate">{companyName(job)}</span>
      </div>
      <p className="text-[12px] font-bold text-slate-800 line-clamp-2 mb-1.5">{job.jobTitle}</p>
      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
        ₹{Number(job.salary).toLocaleString('en-IN')}
      </span>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function LabourEnterpriseJobDetailPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const [showApply, setShowApply] = useState(false)

  const { data, isLoading, isError } = useGetPublicEnterpriseJobByIdQuery(jobId)
  const job            = data?.data?.job
  const applicantsCount = data?.data?.applicantsCount || 0
  const alreadyApplied  = data?.data?.alreadyApplied || false
  const similarJobs     = data?.data?.similarJobs || []

  const logo = companyLogo(job)
  const name = companyName(job)
  const category = job?.categoryId?.name || 'General'

  if (isLoading) return <DetailSkeleton />

  if (isError || !job) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex flex-col items-center justify-center gap-4 px-6 text-center pb-20">
        <AlertCircle className="h-12 w-12 text-rose-300" />
        <p className="text-[16px] font-extrabold text-slate-800">Job not found</p>
        <p className="text-[12px] text-slate-500">This job may have been removed or is no longer active.</p>
        <button onClick={() => navigate(-1)} className="mt-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-[13px] font-bold shadow-md shadow-indigo-200">
          Go Back
        </button>
      </div>
    )
  }

  const activePerks = PERK_MAP.filter(p => job[p.key])

  return (
    <>
      <div className="min-h-screen bg-[#F8F9FB] pb-36 overflow-x-hidden">

        {/* ── Hero banner ───────────────────────────────────────────────────── */}
        <div className="relative h-48 bg-gradient-to-br from-indigo-700 via-indigo-600 to-purple-700 overflow-hidden">
          <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-white/5" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/30 to-transparent" />

          {/* Back + share */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-4">
            <button
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex gap-2">
              <button className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm text-white">
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Category badge */}
          <div className="absolute bottom-4 left-4">
            <span className="bg-white/20 backdrop-blur-sm text-white text-[11px] font-bold px-3 py-1 rounded-full border border-white/30">
              {category}
            </span>
          </div>
        </div>

        <div className="px-4 -mt-6 space-y-4 pb-28">

          {/* ── Company + Title card ─────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            {/* Company row */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-14 w-14 rounded-2xl border-2 border-white shadow-md bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                {logo
                  ? <img src={logo} alt={name} className="h-full w-full object-cover" />
                  : <Building2 className="h-7 w-7 text-indigo-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-bold text-slate-800 truncate">{name}</span>
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-100">
                    <ShieldCheck className="h-3 w-3" /> VERIFIED
                  </span>
                </div>
                {job.enterpriseId?.enterpriseProfile?.city && (
                  <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {[job.enterpriseId.enterpriseProfile.city, job.enterpriseId.enterpriseProfile.state].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </div>

            {/* Job Title */}
            <h1 className="text-[20px] font-extrabold text-slate-900 leading-tight mb-4">
              {job.jobTitle}
            </h1>

            {/* Key chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="flex items-center gap-1 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1.5 text-[12px] font-bold text-emerald-700">
                <Wallet className="h-3.5 w-3.5" />
                ₹{Number(job.salary).toLocaleString('en-IN')} / {job.salaryType || 'month'}
              </span>
              <span className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-[12px] font-medium text-slate-700 max-w-full leading-snug break-words">
                <MapPin className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                {job.locationText || 'Location N/A'}
              </span>
              <span className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1.5 text-[12px] font-bold text-indigo-700">
                <Users className="h-3.5 w-3.5" />
                {job.numberOfWorkers} {job.numberOfWorkers === 1 ? 'vacancy' : 'vacancies'}
              </span>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-4 pt-3 border-t border-slate-50 text-[11px] font-medium text-slate-400">
              <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {applicantsCount} applied</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Posted {timeAgo(job.createdAt)}</span>
              {job.joiningDate && (
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Join {fmt(job.joiningDate)}</span>
              )}
            </div>
          </div>

          {/* ── Job Details ──────────────────────────────────────────────────── */}
          <Section title="Job Details">
            <InfoRow icon={Briefcase}      label="Experience"   value={job.experienceRequired || 'Any / Freshers welcome'} />
            <InfoRow icon={GraduationCap}  label="Qualification" value={job.qualification || null} />
            <InfoRow icon={Clock}          label="Shift"        value={job.shift || null} />
            <InfoRow icon={Clock}          label="Working Hours" value={job.workingHours ? `${job.workingHours} hrs/day` : null} />
            <InfoRow icon={Calendar}       label="Duration"     value={job.contractDuration || null} />
            <InfoRow icon={Calendar}       label="Joining Date" value={fmt(job.joiningDate)} />
            <InfoRow icon={Users}          label="Gender"       value={job.genderPreference === 'any' ? 'Any' : job.genderPreference || null} />
            <InfoRow icon={Star}           label="Age"          value={job.agePreference || null} />
            <InfoRow icon={MapPin}         label="Department"   value={job.department || null} />
          </Section>

          {/* ── Description ─────────────────────────────────────────────────── */}
          {job.jobDescription && (
            <Section title="About This Job">
              <p className="text-[13px] font-medium text-slate-700 leading-relaxed whitespace-pre-line">
                {job.jobDescription}
              </p>
            </Section>
          )}

          {/* ── Skills ──────────────────────────────────────────────────────── */}
          {job.skillsRequired?.length > 0 && (
            <Section title="Skills Required">
              <div className="flex flex-wrap gap-2">
                {job.skillsRequired.map((s, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-[12px] font-bold text-indigo-700">
                    {s}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* ── Benefits & Perks ────────────────────────────────────────────── */}
          {activePerks.length > 0 && (
            <Section title="Benefits & Perks">
              <div className="flex flex-wrap gap-2">
                {activePerks.map(p => (
                  <div key={p.key} className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border shrink-0 ${p.color}`}>
                    <p.icon className="h-4 w-4 shrink-0" />
                    <span className="text-[12px] font-bold whitespace-nowrap">{p.label}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Company Info ────────────────────────────────────────────────── */}
          <Section title="About the Company">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                {logo ? <img src={logo} alt={name} className="h-full w-full object-cover" /> : <Building2 className="h-6 w-6 text-indigo-400" />}
              </div>
              <div>
                <p className="text-[14px] font-bold text-slate-900">{name}</p>
                {job.enterpriseId?.enterpriseProfile?.companyType && (
                  <p className="text-[11px] text-slate-500">{job.enterpriseId.enterpriseProfile.companyType}</p>
                )}
              </div>
            </div>
            {job.enterpriseId?.enterpriseProfile?.registeredAddress && (
              <p className="text-[12px] text-slate-600 flex items-start gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                {job.enterpriseId.enterpriseProfile.registeredAddress}
                {job.enterpriseId.enterpriseProfile.city && `, ${job.enterpriseId.enterpriseProfile.city}`}
              </p>
            )}
            {job.enterpriseId?.enterpriseProfile?.website && (
              <a href={job.enterpriseId.enterpriseProfile.website} target="_blank" rel="noreferrer"
                className="text-[12px] font-medium text-indigo-600 underline underline-offset-2 mt-1 block">
                {job.enterpriseId.enterpriseProfile.website}
              </a>
            )}
          </Section>

          {/* ── Similar Jobs ────────────────────────────────────────────────── */}
          {similarJobs.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[14px] font-extrabold text-slate-900">Similar Jobs</h3>
                <button
                  onClick={() => navigate('/app/enterprise-jobs')}
                  className="text-[12px] font-bold text-indigo-600 flex items-center gap-0.5"
                >
                  View All <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
                {similarJobs.map(j => <MiniJobCard key={j._id} job={j} />)}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* ── Sticky Apply Button ──────────────────────────────────────────────── */}
      <div className="fixed bottom-[60px] left-1/2 -translate-x-1/2 w-full max-w-[430px] z-40 bg-white border-t border-slate-100 px-4 py-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
        {alreadyApplied ? (
          <button
            disabled
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-[15px] font-extrabold shadow-sm cursor-not-allowed opacity-95"
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span>Already Applied</span>
          </button>
        ) : (
          <button
            onClick={() => setShowApply(true)}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-[15px] font-extrabold shadow-lg shadow-indigo-300 transition-all cursor-pointer"
          >
            Apply Now
          </button>
        )}
      </div>

      {/* ── Apply Modal ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showApply && (
          <LabourApplyModal
            job={job}
            onClose={() => setShowApply(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
