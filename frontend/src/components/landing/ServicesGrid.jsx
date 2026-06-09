import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { services } from '../../data/landingContent'
import { LandingIcon } from '../../lib/iconMap'
import { ButtonLink } from '../ui/ButtonLink'
import { Container } from '../ui/Container'
import { Reveal } from '../ui/Reveal'
import { SectionHeading } from '../ui/SectionHeading'

export function ServicesGrid() {
  const reduce = useReducedMotion()
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
          // scroll by approximate card width to trigger snap
          scrollContainer.scrollBy({ left: 300, behavior: 'smooth' })
        }
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  return (
    <section id="services" className="bg-white py-20 text-zinc-900" aria-labelledby="services-heading">
      <Container>
        <SectionHeading
          titleId="services-heading"
          eyebrow="Services"
          title="Every trade your site runs on—one roster"
          subtitle="From civil core to finishes and plant operations, book by role with clear starting prices and availability signals."
          align="center"
        />

        <div ref={scrollContainerRef} className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-8 pt-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {services.map((s, i) => (
            <Reveal key={s.id} delay={i * 0.04} className="shrink-0 snap-center sm:snap-start">
              <motion.article
                className="relative group flex h-[420px] w-[280px] sm:w-[320px] flex-col justify-end overflow-hidden rounded-3xl shadow-md transition-all duration-300"
                style={{
                  backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0) 100%), url('/service_${s.id}.png')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
                whileHover={
                  reduce
                    ? undefined
                    : {
                        y: -6,
                        boxShadow: '0 24px 60px -28px rgba(245, 158, 11, 0.4)',
                      }
                }
              >
                <div className="absolute top-4 right-4 z-10">
                  <span className="rounded-full bg-black/60 backdrop-blur-md px-3 py-1.5 text-[11px] font-bold tracking-wide uppercase text-white ring-1 ring-white/20">
                    {s.availability}
                  </span>
                </div>
                
                <div className="relative z-10 p-6 pt-0">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFC107]/90 text-slate-900 shadow-sm backdrop-blur-sm">
                      <LandingIcon name={s.icon} className="h-5 w-5" />
                    </span>
                    <h3 className="text-2xl font-bold text-white">{s.title}</h3>
                  </div>
                  
                  <p className="mt-2 text-[13px] leading-relaxed text-zinc-300 line-clamp-2">{s.description}</p>
                  
                  <div className="mt-5 flex items-end justify-between border-t border-white/20 pt-5">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        Starts around
                      </p>
                      <p className="mt-0.5 text-xl font-black text-[#FFC107]">
                        ₹{s.priceFrom}
                        <span className="text-xs font-semibold text-zinc-400">/day*</span>
                      </p>
                    </div>
                    <ButtonLink href="/auth" variant="primary" className="!px-5 !py-2 !text-xs !bg-[#FFC107] !text-slate-900 !font-bold hover:!bg-[#FFD54F]">
                      Book
                    </ButtonLink>
                  </div>
                </div>
              </motion.article>
            </Reveal>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-zinc-500">
          *Indicative metro rates; final quotes depend on shift length, skill tier, and site context.
        </p>
      </Container>
    </section>
  )
}
