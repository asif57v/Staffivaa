import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { safetyPoints } from '../../data/landingContent'
import { LandingIcon } from '../../lib/iconMap'
import { Container } from '../ui/Container'
import { Reveal } from '../ui/Reveal'

export function SafetySection() {
  const reduce = useReducedMotion()
  const [showAll, setShowAll] = useState(false)

  // Desired top 3 by title for initial display
  const initialTitles = ['Aadhaar verification', 'Background checks', 'Secure payments']
  
  const displayPoints = showAll 
    ? safetyPoints 
    : safetyPoints.filter(p => initialTitles.includes(p.title))

  // Accents for a premium SaaS feel
  const accents = [
    { bg: 'bg-amber-50', text: 'text-amber-600' },
    { bg: 'bg-blue-50', text: 'text-blue-600' },
    { bg: 'bg-emerald-50', text: 'text-emerald-600' },
    { bg: 'bg-indigo-50', text: 'text-indigo-600' },
    { bg: 'bg-rose-50', text: 'text-rose-600' },
  ]

  return (
    <section
      id="safety"
      className="border-y border-slate-100 bg-[#FCFCFA] py-12 lg:py-16 text-slate-900"
      aria-labelledby="safety-heading"
    >
      <Container className="max-w-3xl">
        <div className="mb-8 text-center sm:mb-10">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-4 inline-flex items-center justify-center rounded-full bg-[#F2C94C]/15 px-3.5 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.2em] text-[#D4A017]"
          >
            Safety & Verification
          </motion.div>
          <Reveal>
            <h2
              id="safety-heading"
              className="mb-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl leading-tight"
            >
              Serious sites need serious checks
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto max-w-xl text-[15px] leading-relaxed text-slate-600">
              Verification is a live system that pairs identity, behaviour, and payments so everyone sleeps better after a long shift.
            </p>
          </Reveal>
        </div>

        <div className="flex flex-col gap-3">
          {displayPoints.map((item, i) => (
            <Reveal key={item.title} delay={0.1 + (i % 3) * 0.05}>
              <motion.article
                className="group relative flex flex-row items-center gap-4 overflow-hidden rounded-[18px] border border-[#ECECEC] bg-white p-3.5 sm:p-4 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_4px_15px_-3px_rgba(0,0,0,0.06)]"
                whileHover={reduce ? undefined : { y: -1 }}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${accents[i % accents.length].bg}`}>
                  <LandingIcon name={item.icon} className={`h-5 w-5 ${accents[i % accents.length].text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="mb-0.5 text-[15px] font-bold tracking-tight text-slate-900 truncate">
                    {item.title}
                  </h3>
                  <p className="text-[13.5px] leading-snug text-slate-500 line-clamp-1 sm:line-clamp-2">
                    {item.description}
                  </p>
                </div>
              </motion.article>
            </Reveal>
          ))}
        </div>

        {/* View All CTA */}
        <Reveal delay={0.3}>
          <motion.button
            onClick={() => setShowAll(!showAll)}
            className="group mt-4 flex w-full flex-row items-center justify-between rounded-[18px] border border-[#ECECEC] bg-gradient-to-r from-[#FFFDF8] to-[#FFF9E6] p-4 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_4px_15px_-3px_rgba(0,0,0,0.06)] cursor-pointer text-left"
            whileHover={reduce ? undefined : { y: -1 }}
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F2C94C]/20 text-[#D4A017]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-[15.5px] font-bold text-slate-900">
                {showAll ? 'Show fewer features' : 'View all safety features'}
              </h3>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white border border-[#F2C94C]/30 text-[#D4A017] shadow-sm transition-all group-hover:bg-[#F2C94C] group-hover:text-slate-900 group-hover:border-[#F2C94C]">
              <ArrowRight className={`h-4 w-4 transition-transform duration-300 ${showAll ? '-rotate-90' : 'group-hover:translate-x-0.5'}`} />
            </div>
          </motion.button>
        </Reveal>
      </Container>
    </section>
  )
}
