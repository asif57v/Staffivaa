import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { HardHat, Menu, X } from 'lucide-react'
import { ButtonLink } from '../ui/ButtonLink'
import { Container } from '../ui/Container'
import { SITE } from '../../data/landingContent'

const links = [
  { href: '#problem', label: 'Why Staffivaa' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#services', label: 'Services' },
  { href: '#features', label: 'Trust' },
  { href: '#testimonials', label: 'Stories' },
  { href: '#faq', label: 'FAQ' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const reduce = useReducedMotion()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const linkClass = scrolled
    ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    : 'text-slate-300 hover:bg-white/10 hover:text-white'

  return (
    <header
      className={`fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-slate-200/90 bg-white/95 shadow-sm shadow-slate-200/50 backdrop-blur-xl py-0'
          : 'border-b border-transparent bg-transparent py-2'
      }`}
    >
      <Container className="flex h-16 items-center justify-between gap-4 md:h-[4.25rem]">
        <a
          href="#hero"
          className="flex items-center gap-2.5 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <span className={`flex h-10 w-10 items-center justify-center rounded-2xl border transition-colors duration-300 ${scrolled ? 'bg-gradient-to-br from-[#FFD100] to-[#FFB300] border-transparent text-white shadow-[0_8px_30px_-8px_rgba(255,209,0,0.45)]' : 'bg-slate-800/60 border-slate-700/60 text-[#FFD100] backdrop-blur-md'}`}>
            <img src="/logo-transparent.png" alt="Staffivaa" className={`h-[22px] w-[22px] object-contain transition-all duration-300 ${scrolled ? 'brightness-0 invert' : ''}`} aria-hidden />
          </span>
          <span className={`text-[17px] font-extrabold tracking-tight sm:text-lg transition-colors duration-300 ${scrolled ? 'text-slate-900' : 'text-white'}`}>
            {SITE.name}
          </span>
        </a>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition ${linkClass}`}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            to="/auth"
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors duration-300 ${scrolled ? 'text-brand hover:bg-brand-muted/50' : 'text-white hover:bg-white/10'}`}
          >
            Sign in
          </Link>
          <ButtonLink href="/auth" variant="secondary" className="!py-2.5 !text-xs">
            Register as Labour
          </ButtonLink>
          <ButtonLink href="/auth" variant="primary" className="!py-2.5 !text-xs !bg-[#FFC107] !text-slate-900 !font-bold">
            Start
          </ButtonLink>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ButtonLink href="/auth" variant="primary" className="!py-1.5 !px-4 !text-sm !bg-[#FFC107] !text-slate-900 !font-bold !rounded-xl">
            Start
          </ButtonLink>
          <button
            type="button"
            className={`inline-flex h-[38px] w-[38px] items-center justify-center rounded-xl border transition-colors duration-300 ${scrolled ? 'border-slate-200 bg-white text-slate-800 shadow-sm' : 'border-slate-600/50 bg-slate-800/40 text-white backdrop-blur-md'}`}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            <span className="sr-only">Toggle menu</span>
          </button>
        </div>
      </Container>

      <AnimatePresence>
        {open ? (
          <motion.div
            id="mobile-menu"
            className="border-t border-slate-200 bg-white shadow-lg backdrop-blur-xl lg:hidden"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28 }}
          >
            <Container className="flex flex-col gap-1 py-4 pb-6">
              {links.map((l, i) => (
                <motion.a
                  key={l.href}
                  href={l.href}
                  className="rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setOpen(false)}
                  initial={reduce ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 * i }}
                >
                  {l.label}
                </motion.a>
              ))}
              <div className="mt-3 flex flex-col gap-2">
                <Link
                  to="/auth"
                  className="rounded-2xl border border-brand/30 bg-brand-muted py-3 text-center text-sm font-semibold text-brand"
                  onClick={() => setOpen(false)}
                >
                  Sign in / Register
                </Link>
                <ButtonLink href="/auth" variant="primary" onClick={() => setOpen(false)}>
                  Our service
                </ButtonLink>
                <ButtonLink href="/auth" variant="secondary" onClick={() => setOpen(false)}>
                  Register as Labour
                </ButtonLink>
              </div>
            </Container>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  )
}
