import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Building2, ShieldCheck, Wallet, MapPin, Users, Briefcase, CheckCircle2, Clock, Calendar } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useGetPublicEnterpriseJobsQuery, useGetLabourCurrentEmploymentQuery } from '../../store/api/enterpriseApi.js'

const JOB_IMAGES = [
  'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=600&auto=format&fit=crop',
]

export function EnterprisePromotionalBanner() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const timerRef = useRef(null)
  const navigate = useNavigate()

  // 1. Fetch Active Joined Employment if worker is currently hired
  const { data: activeEmpData } = useGetLabourCurrentEmploymentQuery()
  const activeEmployment = activeEmpData?.data

  // 2. Fetch Public Jobs for browsing
  const { data: publicJobsData, isLoading } = useGetPublicEnterpriseJobsQuery()
  const jobs = publicJobsData?.data || []

  const banners = jobs.map((job, i) => ({
    id: job._id,
    headerTitle: job.categoryId?.name || job.department || 'JOB OPPORTUNITY',
    title: job.jobTitle,
    company: job.enterpriseId?.enterpriseProfile?.companyName || job.enterpriseId?.fullName || 'Verified Employer',
    vacancies: job.numberOfWorkers || 1,
    salary: `₹${Number(job.salary).toLocaleString('en-IN')} / ${job.salaryType || 'month'}`,
    location: job.locationText || 'Multiple Locations',
    image: JOB_IMAGES[i % JOB_IMAGES.length],
    jobId: job._id,
  }))

  const nextSlide = () =>
    setCurrentIndex((prev) => (prev + 1) % Math.max(banners.length, 1))

  useEffect(() => {
    if (!isHovered && banners.length > 1 && !activeEmployment) {
      timerRef.current = setInterval(nextSlide, 4500)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isHovered, banners.length, activeEmployment])

  // ── 🌟 CASE 1: WORKER HAS ACTIVE JOINED EMPLOYMENT ─────────────────────────
  if (activeEmployment) {
    const job = activeEmployment.jobId || {}
    const company = activeEmployment.enterpriseId?.enterpriseProfile?.companyName || activeEmployment.enterpriseId?.fullName || 'Enterprise Client'
    const joining = activeEmployment.joiningDetails || {}

    return (
      <section className="mb-6 relative z-10 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-teal-900 via-emerald-800 to-indigo-900 text-white shadow-xl p-5 border border-emerald-500/30"
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="flex items-center gap-1.5 bg-emerald-500/20 backdrop-blur-md border border-emerald-400/40 text-emerald-300 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5" /> CURRENT EMPLOYMENT
            </span>
            <span className="text-[11px] font-extrabold text-emerald-200">ACTIVE WORKFORCE</span>
          </div>

          <div className="space-y-1.5 mb-4">
            <p className="text-[12px] font-semibold text-emerald-200">{company}</p>
            <h3 className="text-[20px] font-black leading-tight text-white">{job.jobTitle || 'Active Deployment'}</h3>
            <p className="text-[12px] text-slate-300 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{joining.siteLocation || job.locationText || 'Main Worksite'}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-[11px] font-semibold mb-4">
            <div>
              <p className="text-slate-300 text-[9px] uppercase tracking-wider">Daily Shift</p>
              <p className="text-white font-extrabold mt-0.5">{job.shift || '09:00 AM - 06:00 PM'}</p>
            </div>
            <div>
              <p className="text-slate-300 text-[9px] uppercase tracking-wider">Monthly Salary</p>
              <p className="text-emerald-300 font-extrabold mt-0.5">₹{job.salary?.toLocaleString('en-IN') || 'As Agreed'}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/app/my-applications')}
            className="w-full bg-emerald-400 hover:bg-emerald-300 active:scale-[0.98] text-slate-950 font-extrabold py-3 text-[13px] rounded-2xl flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-emerald-950/30"
          >
            View Employment Status & Details
            <ChevronRight className="w-4 h-4" strokeWidth={3} />
          </button>
        </motion.div>
      </section>
    )
  }

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <section className="mb-6 px-4">
        <div className="relative w-full overflow-hidden rounded-[1.25rem] bg-[#FFF9ED] border border-[#FDE6A8] min-h-[180px] animate-pulse" />
      </section>
    )
  }

  // ── Empty state (no jobs posted yet) ───────────────────────────────────────
  if (!isLoading && banners.length === 0) {
    return (
      <section className="mb-6 px-4">
        <div className="relative w-full overflow-hidden rounded-[1.25rem] bg-[#FFF9ED] border border-[#FDE6A8] shadow-sm flex flex-col items-center justify-center gap-3 py-8 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <Briefcase className="w-6 h-6 text-amber-500" />
          </div>
          <p className="text-[14px] font-extrabold text-slate-800">No active jobs right now</p>
          <p className="text-[12px] text-slate-500 leading-snug max-w-[220px]">
            Check back soon — new enterprise opportunities are posted regularly.
          </p>
          <button
            type="button"
            onClick={() => navigate('/app/enterprise-jobs')}
            className="mt-1 inline-flex items-center gap-1.5 bg-[#FFC107] hover:bg-[#F0B400] text-slate-900 text-[12px] font-extrabold px-4 py-2 rounded-xl transition-colors shadow-sm"
          >
            Browse Enterprise Portal <ChevronRight className="w-3.5 h-3.5" strokeWidth={3} />
          </button>
        </div>
      </section>
    )
  }

  // ── Real job banners ────────────────────────────────────────────────────────
  const banner = banners[currentIndex] || banners[0]

  return (
    <section className="mb-6 relative z-10 px-4">
      <div
        className="relative w-full overflow-hidden rounded-[1.25rem] bg-[#FFF9ED] border border-[#FDE6A8] shadow-sm group touch-pan-y min-h-[180px]"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={() => setIsHovered(true)}
        onTouchEnd={() => setIsHovered(false)}
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={banner.id + currentIndex}
            className="flex flex-row relative w-full h-full"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.38, ease: 'easeInOut' }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={nextSlide}
          >
            {/* VERIFIED badge */}
            <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-amber-200/60 text-[9px] font-bold text-slate-700 shadow-sm">
              <ShieldCheck className="w-3 h-3 text-amber-500" />
              <span>VERIFIED</span>
            </div>

            {/* Right image */}
            <div className="absolute right-0 top-0 bottom-0 w-[42%] z-0">
              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#FFF9ED]/40 to-[#FFF9ED] z-10" />
              <img
                src={banner.image}
                alt={banner.title}
                className="w-full h-full object-cover object-center mix-blend-multiply opacity-90"
              />
            </div>

            {/* Left content */}
            <div className="relative p-4 sm:p-5 w-[62%] z-10 flex flex-col justify-between min-h-[180px]">
              <div className="flex items-center gap-1.5 text-indigo-700 font-extrabold text-[10px] tracking-widest uppercase mb-1">
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{banner.headerTitle}</span>
              </div>

              <h3 className="text-[18px] font-extrabold text-slate-900 leading-tight mb-2 line-clamp-2">
                {banner.title}
              </h3>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
                <span className="text-[11px] font-semibold text-slate-700 truncate max-w-[140px]">
                  {banner.company}
                </span>
                <span className="flex items-center gap-1 text-[11px] font-bold text-indigo-600">
                  <Users className="w-3 h-3" />
                  {banner.vacancies} {banner.vacancies === 1 ? 'vacancy' : 'vacancies'}
                </span>
              </div>

              <div className="flex flex-col gap-1 mb-4">
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700">
                  <Wallet className="w-3 h-3 shrink-0 text-slate-400" />
                  <span className="truncate">{banner.salary}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                  <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                  <span className="truncate">{banner.location}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/app/enterprise-jobs/${banner.jobId}`)}
                className="w-[90%] bg-[#FFC107] hover:bg-[#F0B400] active:scale-[0.98] text-slate-900 font-extrabold py-2.5 text-[12px] rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm relative z-20"
              >
                Apply Now
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={3} />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Pagination dots */}
        {banners.length > 1 && (
          <div className="absolute bottom-3 right-3 flex gap-1.5 z-20">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentIndex(idx)
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentIndex ? 'w-4 bg-indigo-500' : 'w-1.5 bg-indigo-200'
                }`}
                aria-label={`Slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
