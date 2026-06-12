import { useState } from 'react'
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion'
import { ArrowRight, ChevronDown, Users } from 'lucide-react'
import { userTypes } from '../../data/landingContent'
import { LandingIcon } from '../../lib/iconMap'
import { Container } from '../ui/Container'
import { Reveal } from '../ui/Reveal'

export function UserTypesSection() {
  const reduce = useReducedMotion()
  const [showAll, setShowAll] = useState(false)
  const [expandedCard, setExpandedCard] = useState(null)

  const displayTypes = showAll ? userTypes : userTypes.slice(0, 3)

  // Accents for a premium SaaS feel
  const accents = [
    { bg: 'bg-orange-50', text: 'text-orange-600' },
    { bg: 'bg-blue-50', text: 'text-blue-600' },
    { bg: 'bg-amber-50', text: 'text-amber-600' },
    { bg: 'bg-emerald-50', text: 'text-emerald-600' },
    { bg: 'bg-purple-50', text: 'text-purple-600' },
  ]

  const toggleExpand = (title) => {
    setExpandedCard(expandedCard === title ? null : title)
  }

  return (
    <section
      id="users"
      className="border-y border-slate-100 bg-[#FCFCFA] py-12 lg:py-16 text-slate-900"
      aria-labelledby="users-heading"
    >
      <Container className="max-w-3xl">
        <div className="mb-8 text-center sm:mb-10">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-4 inline-flex items-center justify-center rounded-full bg-[#F2C94C]/15 px-3.5 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.2em] text-[#D4A017]"
          >
            Who It’s For
          </motion.div>
          <Reveal>
            <h2
              id="users-heading"
              className="mb-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl leading-tight"
            >
              One ecosystem—many stakeholders
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto max-w-xl text-[15px] leading-relaxed text-slate-600">
              Staffivaa aligns incentives: faster hiring for clients, fair visibility for workers, and cleaner records for everyone in between.
            </p>
          </Reveal>
        </div>

        <div className="flex flex-col gap-3">
          {displayTypes.map((u, i) => {
            const isExpanded = expandedCard === u.title
            return (
              <Reveal key={u.title} delay={0.1 + (i % 3) * 0.05}>
                <motion.article
                  className="group relative flex flex-col overflow-hidden rounded-[20px] border border-[#EAEAEA] bg-white p-3.5 sm:p-4 shadow-[0_2px_12px_-3px_rgba(0,0,0,0.03)] transition-all duration-300 hover:border-[#EAEAEA]/80 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] cursor-pointer"
                  whileHover={reduce ? undefined : { y: -1 }}
                  onClick={() => toggleExpand(u.title)}
                >
                  <div className="flex flex-row items-center gap-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${accents[i % accents.length].bg}`}>
                      <LandingIcon name={u.icon} className={`h-5 w-5 ${accents[i % accents.length].text}`} />
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="mb-0.5 text-[15.5px] font-bold tracking-tight text-slate-900 truncate">
                        {u.title}
                      </h3>
                      <p className={`text-[13.5px] leading-snug text-slate-500 transition-all duration-300 ${isExpanded ? '' : 'line-clamp-1 sm:line-clamp-2'}`}>
                        {u.description}
                      </p>
                    </div>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600 transition-colors">
                      <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {/* Expandable Content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-4 mt-2 sm:ml-14 border-t border-[#F0F0F0]">
                          <ul className="space-y-2.5 text-[13.5px] text-slate-600">
                            {u.perks.map((p, idx) => (
                              <li key={idx} className="flex items-start gap-2.5">
                                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#F2C94C]/20 text-[10px] font-bold text-[#D4A017]`}>
                                  ✓
                                </span>
                                <span>{p}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.article>
              </Reveal>
            )
          })}
        </div>

        {/* View All CTA */}
        <Reveal delay={0.3}>
          <motion.button
            onClick={() => setShowAll(!showAll)}
            className="group mt-4 flex w-full flex-col sm:flex-row items-start sm:items-center justify-between rounded-[20px] border border-[#EAEAEA] bg-gradient-to-r from-[#FFFDF8] to-[#FFF9E6] p-5 sm:p-4 shadow-[0_2px_12px_-3px_rgba(0,0,0,0.03)] transition-all duration-300 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] cursor-pointer text-left"
            whileHover={reduce ? undefined : { y: -1 }}
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F2C94C]/20 text-[#D4A017]">
                <Users className="h-6 w-6" />
              </div>
              <div className="pr-4">
                <h3 className="text-[16px] font-bold text-slate-900 mb-0.5">
                  {showAll ? 'Show fewer stakeholders' : 'View All Stakeholders'}
                </h3>
                <p className="text-[13.5px] text-slate-600 leading-snug">
                  {showAll 
                    ? 'Collapse list to view only the primary stakeholders.'
                    : 'Explore solutions for Companies, Labourers, Builders, Contractors, and Homeowners.'}
                </p>
              </div>
            </div>
            <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F2C94C] text-slate-900 shadow-sm transition-transform group-hover:scale-105">
              <ArrowRight className={`h-4 w-4 transition-transform duration-300 ${showAll ? '-rotate-90' : 'group-hover:translate-x-0.5'}`} />
            </div>
          </motion.button>
        </Reveal>
      </Container>
    </section>
  )
}
