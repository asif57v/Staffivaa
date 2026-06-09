import { motion, useReducedMotion } from 'framer-motion'
import { safetyPoints } from '../../data/landingContent'
import { LandingIcon } from '../../lib/iconMap'
import { Container } from '../ui/Container'
import { Reveal } from '../ui/Reveal'
import { SectionHeading } from '../ui/SectionHeading'

export function SafetySection() {
  const reduce = useReducedMotion()

  return (
    <section
      id="safety"
      className="border-y border-slate-200/80 bg-white py-20 text-zinc-900"
      aria-labelledby="safety-heading"
    >
      <Container>
        <SectionHeading
          titleId="safety-heading"
          eyebrow="Safety & verification"
          title="Serious sites need serious checks"
          subtitle="Verification is not a checkbox PDF—it’s a live system that pairs identity, behaviour, and payments so everyone sleeps better after a long shift."
          align="center"
        />

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {safetyPoints.map((item, i) => (
            <Reveal key={item.title} delay={i * 0.05}>
              <motion.article
                className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm"
                whileHover={reduce ? undefined : { scale: 1.01 }}
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/15 text-brand">
                  <LandingIcon name={item.icon} className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{item.description}</p>
              </motion.article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  )
}
