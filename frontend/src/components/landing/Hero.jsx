import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Star } from 'lucide-react'
import { trustBadges } from '../../data/landingContent'
import { LandingIcon } from '../../lib/iconMap'
import { ButtonLink } from '../ui/ButtonLink'
import { Container } from '../ui/Container'
import { GlassPanel } from '../ui/GlassPanel'
import { ConstructionIllustration } from './ConstructionIllustration'

export function Hero() {
  const reduce = useReducedMotion()

  return (
    <section
      id="hero"
      className="relative overflow-hidden bg-slate-950 pt-28 pb-16 md:pt-36 md:pb-24"
      aria-labelledby="hero-heading"
      style={{
        backgroundImage: "linear-gradient(to bottom, rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.85)), url('/construction_hero_bg.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <Container className="relative z-10 flex flex-col pt-8">
        <div className="space-y-7 max-w-2xl">
          <motion.div
            className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-800/50 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm backdrop-blur-md"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="flex items-center gap-1.5 text-[#FFC107]">
              <Star className="h-3.5 w-3.5 fill-[#FFC107] text-[#FFC107]" aria-hidden />
              4.8 rating
            </span>
            <span className="text-slate-400">·</span>
            <span>Built for India</span>
          </motion.div>

          <div className="space-y-4">
            <motion.h1
              id="hero-heading"
              className="text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05 }}
            >
              Book Trusted Construction <br />
              Labour <span className="text-[#FFC107] underline decoration-[#FFC107] decoration-[3px] underline-offset-[8px]">in Minutes</span>
            </motion.h1>
            <motion.p
              className="max-w-xl text-[17px] leading-relaxed text-slate-200"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.12 }}
            >
              Aadhaar-verified skilled workers with transparent pricing, digital payments, and backup support.
            </motion.p>
          </div>

          <motion.div
            className="flex flex-col gap-3 sm:flex-row sm:items-center pt-2"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18 }}
          >
            <ButtonLink href="#services" variant="primary" className="group !bg-[#FFC107] !text-slate-900 !font-bold flex-1 sm:flex-none">
              Hire Labour
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
            </ButtonLink>
            <ButtonLink href="#app" variant="secondary" className="!bg-slate-800/40 !text-white border border-slate-700/50 backdrop-blur-sm hover:!bg-slate-700/50 flex-1 sm:flex-none">
              Register
            </ButtonLink>
          </motion.div>

          <motion.div
            className="flex flex-wrap gap-2 pt-6"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.28 }}
          >
            {trustBadges.slice(0, 3).map((b, i) => (
              <motion.div
                key={b.id}
                className="flex items-center gap-2 rounded-2xl border border-slate-700/60 bg-slate-800/30 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm backdrop-blur-md"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-700/50 text-[#FFC107]">
                  <LandingIcon name={b.icon} className="h-3.5 w-3.5" />
                </span>
                {b.label}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Container>
    </section>
  )
}
