import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Grid2X2 } from 'lucide-react'
import { features } from '../../data/landingContent'
import { LandingIcon } from '../../lib/iconMap'
import { Container } from '../ui/Container'
import { Reveal } from '../ui/Reveal'

export function FeaturesSection() {
  const reduce = useReducedMotion()
  const [showAll, setShowAll] = useState(false)
  
  // Toggle between first 3 or all features
  const displayFeatures = showAll ? features : features.slice(0, 3)
  
  // Accent colors for the cards
  const accents = [
    { bg: 'bg-emerald-50', text: 'text-emerald-600', iconBg: 'bg-emerald-100', border: 'border-emerald-100/50' },
    { bg: 'bg-blue-50', text: 'text-blue-600', iconBg: 'bg-blue-100', border: 'border-blue-100/50' },
    { bg: 'bg-purple-50', text: 'text-purple-600', iconBg: 'bg-purple-100', border: 'border-purple-100/50' },
  ]

  return (
    <section
      id="features"
      className="relative overflow-hidden border-b border-slate-100 bg-[#FCFCFA] py-16 lg:py-24"
      aria-labelledby="features-heading"
    >
      {/* Subtle decorative background elements */}
      <div className="pointer-events-none absolute left-0 top-0 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F2C94C]/10 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 bottom-0 h-[400px] w-[400px] translate-x-1/3 translate-y-1/3 rounded-full bg-slate-200/40 blur-[100px]" />
      
      {/* Dotted pattern top right */}
      <div className="pointer-events-none absolute right-8 top-16 hidden opacity-20 lg:block">
        <svg width="120" height="120" fill="none" viewBox="0 0 100 100">
          <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle fill="#F2C94C" cx="2" cy="2" r="2"></circle>
          </pattern>
          <rect x="0" y="0" width="100" height="100" fill="url(#dots)"></rect>
        </svg>
      </div>

      <Container className="relative z-10 max-w-5xl">
        <div className="mx-auto mb-12 max-w-3xl text-center sm:mb-16">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-5 inline-flex items-center justify-center rounded-full bg-[#F2C94C]/15 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#D4A017]"
          >
            Why Staffivaa
          </motion.div>
          <Reveal>
            <h2
              id="features-heading"
              className="mb-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-[52px] leading-[1.1]"
            >
              Trust, speed, and <br className="hidden sm:block" />
              clarity—by design
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto max-w-xl text-[16px] leading-relaxed text-slate-600 sm:text-[18px]">
              We built verification, tracking, and payments into the core flow so contractors can focus on execution—not chasing people.
            </p>
          </Reveal>
        </div>

        {/* Premium Feature Cards - Horizontal Layout */}
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-3">
          {displayFeatures.map((f, i) => (
            <Reveal key={f.title} delay={0.1 + (i % 3) * 0.1}>
              <motion.article
                className="group relative flex flex-col sm:flex-row md:flex-col items-start sm:items-center md:items-start gap-4 overflow-hidden rounded-[22px] border border-[#ECECEC] bg-white p-5 sm:p-6 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)]"
                whileHover={reduce ? undefined : { y: -3 }}
              >
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] ${accents[i % accents.length].iconBg}`}>
                  <LandingIcon name={f.icon} className={`h-6 w-6 ${accents[i % accents.length].text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="mb-1.5 text-[17px] font-bold tracking-tight text-slate-900">
                    {f.title}
                  </h3>
                  <p className="text-[14px] leading-relaxed text-slate-500 line-clamp-2">
                    {f.description}
                  </p>
                  <div className={`mt-3 flex items-center text-[13.5px] font-semibold ${accents[i % accents.length].text}`}>
                    Learn more
                    <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </motion.article>
            </Reveal>
          ))}
        </div>

        {/* Explore More CTA */}
        <Reveal delay={0.4}>
          <motion.button
            onClick={() => setShowAll(!showAll)}
            className="group mt-6 sm:mt-8 flex w-full flex-col items-start gap-5 sm:gap-6 rounded-[24px] border border-[#ECECEC] bg-gradient-to-br from-[#FFFDF8] to-[#FFF9E6] p-6 sm:flex-row sm:items-center sm:p-8 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] cursor-pointer text-left"
            whileHover={reduce ? undefined : { y: -2 }}
          >
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-[#F2C94C]/20 text-[#D4A017]">
              <Grid2X2 className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <h3 className="mb-1.5 text-[19px] font-bold text-slate-900">
                {showAll ? 'Show fewer features' : 'Explore all features'}
              </h3>
              <p className="text-[15px] text-slate-600 leading-relaxed max-w-xl">
                {showAll 
                  ? 'Collapse the feature list to view just the highlights.'
                  : 'Discover attendance, secure payments, ratings, multilingual support, emergency labour, and more.'}
              </p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F2C94C] text-slate-900 shadow-sm transition-transform group-hover:scale-105 mt-2 sm:mt-0">
              <ArrowRight className={`h-5 w-5 transition-transform duration-300 ${showAll ? '-rotate-90' : 'group-hover:translate-x-0.5'}`} />
            </div>
          </motion.button>
        </Reveal>
      </Container>
    </section>
  )
}
