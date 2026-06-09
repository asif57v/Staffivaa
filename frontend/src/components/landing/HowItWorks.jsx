import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { howItWorksLabourers, howItWorksUsers } from '../../data/landingContent'
import { LandingIcon } from '../../lib/iconMap'
import { Container } from '../ui/Container'
import { Reveal } from '../ui/Reveal'
import { SectionHeading } from '../ui/SectionHeading'

const tabs = [
  { id: 'users', label: 'For hirers', data: howItWorksUsers },
  { id: 'labour', label: 'For labour partners', data: howItWorksLabourers },
]

const STEP_IMAGES = {
  'users-1': '/hiw_hirer_1.png',
  'users-2': '/hiw_hirer_2.png',
  'users-3': '/hiw_hirer_3.png',
  'users-4': '/hiw_hirer_4.png',
  'labour-1': '/hiw_labour_1.png',
  'labour-2': '/hiw_labour_2.png',
  'labour-3': '/hiw_labour_3.png',
  'labour-4': '/hiw_labour_4.png',
}

export function HowItWorks() {
  const [tab, setTab] = useState('users')
  const reduce = useReducedMotion()
  const active = tabs.find((t) => t.id === tab) ?? tabs[0]
  const scrollContainerRef = useRef(null)

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    const interval = setInterval(() => {
      if (scrollContainer.scrollWidth > scrollContainer.clientWidth) {
        const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth
        if (scrollContainer.scrollLeft >= maxScroll - 10) {
          scrollContainer.scrollTo({ left: 0, behavior: 'smooth' })
        } else {
          // scroll by one card width (280px + 16px gap)
          scrollContainer.scrollBy({ left: 296, behavior: 'smooth' })
        }
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [tab])

  return (
    <section
      id="how-it-works"
      className="relative border-y border-slate-200/80 bg-white py-20"
      aria-labelledby="how-heading"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_70%_0%,rgba(28,175,98,0.08),transparent)]" />
      <Container className="relative">
        <SectionHeading
          titleId="how-heading"
          eyebrow="How it works"
          title="From first tap to boots on your site"
          subtitle="Whether you are staffing a high-rise pour or picking up daily helper shifts near home, Staffivaa keeps the journey simple and documented."
          align="center"
        />

        <Reveal className="mx-auto mb-10 flex max-w-md rounded-2xl border border-slate-200 bg-slate-50/80 p-1 shadow-inner">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                tab === t.id ? 'text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab === t.id ? (
                <motion.span
                  layoutId="hitab"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand-bright to-brand shadow-md shadow-brand/25"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              ) : null}
              <span className="relative z-10">{t.label}</span>
            </button>
          ))}
        </Reveal>

        <div ref={scrollContainerRef} className="relative flex flex-nowrap overflow-x-auto gap-4 snap-x snap-mandatory pb-6 px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-2 lg:grid-cols-4 md:overflow-visible md:pb-0">
          <AnimatePresence mode="wait" initial={false}>
            {active.data.map((step, i) => (
              <motion.article
                key={`${tab}-${step.step}`}
                layout
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -12 }}
                transition={{ duration: 0.35, delay: reduce ? 0 : i * 0.06 }}
                className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-sm snap-center shrink-0 w-[280px] md:w-auto flex flex-col"
              >
                <div className="h-40 w-full overflow-hidden bg-slate-100 shrink-0">
                  <img src={STEP_IMAGES[`${tab}-${step.step}`]} alt={step.title} className="h-full w-full object-cover" />
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="mb-5 flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/12 text-brand ring-1 ring-brand/20 shrink-0">
                      <LandingIcon name={step.icon} className="h-6 w-6" />
                    </span>
                    <span className="text-4xl font-black text-brand/15">0{step.step}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      </Container>
    </section>
  )
}
