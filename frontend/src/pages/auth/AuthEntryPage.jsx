import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft,
  Building2,
  ClipboardList,
  HardHat,
  Home,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Check,
} from 'lucide-react'
import { MobileShell } from '../../layouts/MobileShell.jsx'
import { AppAmbientBackground } from '../../components/app/AppAmbientBackground.jsx'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { LabourCategorySetup } from '../../components/auth/LabourCategorySetup.jsx'
import { ROLE_LABELS, USER_ROLES } from '../../constants/userRoles.js'
import { getRoleHomePath } from '../../lib/roleHomePath.js'
import { requestLoginOtp, requestRegisterOtp, verifyLogin, verifyRegister } from '../../api/authApi.js'
import { useAuth } from '../../hooks/useAuth.js'
import { ApiError } from '../../api/http.js'
import { useGetPublicLegalPagesQuery } from '../../store/api/legalApi.js'
import authBg from '../../assets/auth-bg.png'

const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i

const ROLE_OPTIONS = [
  {
    role: USER_ROLES.INDIVIDUAL,
    title: 'Homeowner / Individual',
    icon: Home,
    desc: 'Hire verified labour for your home or renovation',
  },
  {
    role: USER_ROLES.CORPORATE,
    title: 'Corporate Client',
    icon: Building2,
    desc: 'Bulk workforce for sites and projects',
  },
  {
    role: USER_ROLES.LABOUR,
    title: 'Labour / Worker',
    icon: HardHat,
    desc: 'Get matched to jobs near you',
  },
  {
    role: USER_ROLES.CONTRACTOR,
    title: 'Contractor / Vendor',
    icon: ClipboardList,
    desc: 'Supply and deploy crews for clients',
  },
  {
    role: USER_ROLES.ENTERPRISE,
    title: 'Enterprise Client',
    icon: Briefcase,
    desc: 'B2B Enterprise Workforce Management',
  },
]

function isValidIndianMobile(digits) {
  return digits.length === 10 && /^[6-9]\d{9}$/.test(digits)
}

function formatProfessionalName(val) {
  let cleaned = String(val || '').replace(/[^a-zA-Z\s\-'.]/g, '')
  cleaned = cleaned.replace(/^\s+/, '').replace(/\s{2,}/g, ' ')
  return cleaned
}

function FeedbackBanner({ variant, children }) {
  if (!children) return null
  const styles =
    variant === 'error'
      ? 'border-amber-200/90 bg-amber-50 text-amber-950 ring-amber-100'
      : 'border-emerald-200/90 bg-emerald-50 text-emerald-950 ring-emerald-100'
  return (
    <p role="alert" className={`rounded-2xl border px-4 py-3 text-sm font-medium leading-relaxed ring-1 ${styles}`}>
      {children}
    </p>
  )
}

function AuthField({ label, hint, children }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</label>
        {hint}
      </div>
      {children}
    </div>
  )
}

const inputClass =
  'w-full rounded-2xl border border-slate-200/90 bg-white px-4 py-3.5 text-base font-medium text-slate-900 shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/25'

function handleInputFocus(e) {
  const container = e.target.closest('div[id^="field-"]') || e.target.parentElement || e.target
  setTimeout(() => {
    try {
      container.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } catch (err) {}
  }, 300)
}

export function AuthEntryPage() {
  const navigate = useNavigate()
  const { data: legalRes } = useGetPublicLegalPagesQuery()
  const legalPages = legalRes?.data || []
  const { applySession } = useAuth()
  const reduce = useReducedMotion()
  const otpInputRefs = useRef([])

  const [mode, setMode] = useState('login')
  const [step, setStep] = useState('form')
  const [role, setRole] = useState(USER_ROLES.INDIVIDUAL)
  const [isAccordionOpen, setIsAccordionOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [gstNumber, setGstNumber] = useState('')
  const [otpCells, setOtpCells] = useState(() => Array(6).fill(''))
  const [challengeId, setChallengeId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState(null)

  const p = isValidIndianMobile(phone) ? phone : null
  const code = otpCells.join('')
  const phoneComplete = phone.length === 10

  function clearOtpError() {
    setBanner((b) => (b?.variant === 'error' ? null : b))
  }

  function digitsToOtpCells(raw) {
    const d = String(raw ?? '').replace(/\D/g, '').slice(0, 6)
    const out = Array(6).fill('')
    for (let k = 0; k < d.length; k++) out[k] = d[k]
    return out
  }

  function handleOtpPaste(e) {
    e.preventDefault()
    const cells = digitsToOtpCells(e.clipboardData.getData('text/plain'))
    setOtpCells(cells)
    clearOtpError()
    const nextEmpty = cells.findIndex((c) => c === '')
    queueMicrotask(() => {
      otpInputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus()
    })
  }

  useEffect(() => {
    if (step !== 'otp') return
    queueMicrotask(() => {
      otpInputRefs.current[0]?.focus()
    })
  }, [step])

  function setPhoneDigits(value) {
    const digits = String(value).replace(/\D/g, '').slice(0, 10)
    setPhone(digits)
    if (banner?.variant === 'error') setBanner(null)
  }

  function resetFlowToForm() {
    setStep('form')
    setChallengeId(null)
    setBanner(null)
    setOtpCells(Array(6).fill(''))
  }

  function switchMode(next) {
    setMode(next)
    setIsAccordionOpen(false)
    resetFlowToForm()
  }

  async function handleSendOtp() {
    setBanner(null)
    setChallengeId(null)
    if (!isValidIndianMobile(phone)) {
      setBanner({
        variant: 'error',
        message: 'Enter exactly 10 digits starting with 6, 7, 8, or 9.',
      })
      return
    }
    setBusy(true)
    try {
      if (mode === 'login') {
        const res = await requestLoginOtp({ phone: p })
        setChallengeId(res.data?.challengeId ?? null)
      } else {
        if (!fullName.trim() || fullName.trim().length < 2 || !/[a-zA-Z]{2,}/.test(fullName)) {
          setBanner({ variant: 'error', message: 'Please enter your full legal name (minimum 2 letters, alphabets only).' })
          setBusy(false)
          return
        }
        if ((role === USER_ROLES.CORPORATE || role === USER_ROLES.ENTERPRISE) && !companyName.trim()) {
          setBanner({ variant: 'error', message: 'Company name is required.' })
          setBusy(false)
          return
        }
        if (role === USER_ROLES.CONTRACTOR && !businessName.trim()) {
          setBanner({ variant: 'error', message: 'Business name is required.' })
          setBusy(false)
          return
        }
        if ((role === USER_ROLES.CORPORATE || role === USER_ROLES.ENTERPRISE) && gstNumber.trim() && !GST_RE.test(gstNumber.trim())) {
          setBanner({ variant: 'error', message: 'Invalid GST format (e.g. 22AAAAA0000A1Z5). Enter a valid 15-character GSTIN or leave blank.' })
          setBusy(false)
          return
        }
        const res = await requestRegisterOtp({
          phone: p,
          role,
          fullName: fullName.trim() || undefined,
        })
        setChallengeId(res.data?.challengeId ?? null)
      }
      setOtpCells(Array(6).fill(''))
      setStep('otp')
      setBanner({
        variant: 'success',
        message: 'OTP sent. Check SMS.',
      })
    } catch (e) {
      setBanner({
        variant: 'error',
        message: e instanceof ApiError ? e.message : 'Could not send OTP. Try again.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleVerifyOtp() {
    setBanner(null)
    if (code.length !== 6) {
      setBanner({ variant: 'error', message: 'Enter all 6 digits of the OTP.' })
      return
    }
    if (!challengeId) {
      setBanner({ variant: 'error', message: 'Session expired. Go back and tap Send OTP again.' })
      return
    }
    if (!p) {
      setBanner({ variant: 'error', message: 'Phone number is invalid. Go back and fix it.' })
      return
    }
    setBusy(true)
    try {
      let signedInUser
      if (mode === 'login') {
        const res = await verifyLogin({ phone: p, code, challengeId })
        const { token, user } = res.data
        applySession(token, user)
        signedInUser = user
      } else {
        if (!fullName.trim() || fullName.trim().length < 2 || !/[a-zA-Z]{2,}/.test(fullName)) {
          setBanner({ variant: 'error', message: 'Please enter your full legal name (minimum 2 letters, alphabets only).' })
          setBusy(false)
          return
        }
        const body = {
          phone: p,
          role,
          code,
          challengeId,
          fullName: fullName.trim(),
        }
        if (role === USER_ROLES.CORPORATE || role === USER_ROLES.ENTERPRISE) {
          body.companyName = companyName.trim()
          if (gstNumber.trim()) {
            if (!GST_RE.test(gstNumber.trim())) {
              setBanner({ variant: 'error', message: 'Invalid GST format (e.g. 22AAAAA0000A1Z5). Enter a valid 15-character GSTIN or leave blank.' })
              setBusy(false)
              return
            }
            body.gstNumber = gstNumber.trim().toUpperCase()
          }
        }
        if (role === USER_ROLES.CONTRACTOR) {
          body.businessName = businessName.trim()
        }
        const res = await verifyRegister(body)
        const { token, user } = res.data
        applySession(token, user)
        signedInUser = user
      }

      const needsWorkSetup =
        signedInUser.role === USER_ROLES.LABOUR && !(signedInUser.labourProfile?.categoryIds?.length > 0)
      if (needsWorkSetup) {
        setStep('work-setup')
        setBanner(null)
      } else {
        navigate(getRoleHomePath(signedInUser.role), { replace: true })
      }
    } catch (e) {
      setBanner({
        variant: 'error',
        message: e instanceof ApiError ? e.message : 'Verification failed. Check the code and try again.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh bg-white flex flex-col" style={{ maxWidth: 430, margin: '0 auto' }}>

      {/* ── Hero Header ── */}
      <div
        className="relative overflow-hidden flex-shrink-0"
        style={{
          background: `linear-gradient(to bottom, rgba(15, 23, 42, 0.65), rgba(15, 23, 42, 0.95)), url(${authBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          paddingTop: step === 'work-setup' ? 0 : 56,
          paddingBottom: step === 'work-setup' ? 0 : 40,
        }}
      >
        {/* Decorative glow blobs */}
        <div
          aria-hidden
          style={{
            position: 'absolute', top: -40, right: -40, width: 200, height: 200,
            background: 'radial-gradient(circle, rgba(255,209,0,0.18) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute', bottom: -20, left: -30, width: 160, height: 160,
            background: 'radial-gradient(circle, rgba(255,150,0,0.12) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        {step === 'work-setup' ? (
          <>
            <AppAmbientBackground />
            <MobileShell transparent className="pb-0 pt-4">
              <LabourCategorySetup variant="auth" onComplete={() => navigate(getRoleHomePath(USER_ROLES.LABOUR), { replace: true })} />
            </MobileShell>
          </>
        ) : (
          <div className="relative px-6">
            {/* Logo row */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <div
                  style={{
                    width: 38, height: 38, borderRadius: 12,
                    background: '#FFD100',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 20px rgba(255,209,0,0.35)',
                  }}
                >
                  <img src="/logo-transparent.png" alt="Staffivaa Logo" style={{ width: 20, height: 20, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                </div>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#FFD100', letterSpacing: '-0.01em' }}>
                  Staffivaa
                </span>
              </div>
              <Link
                to="/home"
                aria-label="Back to home"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
                  textDecoration: 'none',
                }}
              >
                <ArrowLeft style={{ width: 14, height: 14 }} />
                Home
              </Link>
            </div>

            {/* Welcome headline */}
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <p style={{ fontSize: 13, fontWeight: 700, color: '#FFD100', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                {step === 'otp' ? '🔒 OTP Verification' : mode === 'login' ? '👋 Welcome back' : '🚀 Get started free'}
              </p>
              <h1 style={{ fontSize: 28, fontWeight: 900, color: '#ffffff', lineHeight: 1.18, margin: 0 }}>
                {step === 'otp'
                  ? 'Check your\nmessages'
                  : mode === 'login'
                    ? 'Sign in to\nStaffivaa'
                    : 'Create your\naccount'}
              </h1>
              {step !== 'otp' && (
                <p style={{ marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                  {mode === 'login'
                    ? 'India\'s #1 verified labour platform'
                    : 'Join 50,000+ workers and businesses'}
                </p>
              )}
            </motion.div>

            {/* Trust badges (login only) */}
            {step === 'form' && mode === 'login' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
                {[
                  { icon: ShieldCheck, label: 'Aadhaar-verified' },
                  { icon: Sparkles, label: 'Instant OTP' },
                ].map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: 'rgba(255,255,255,0.07)', borderRadius: 20,
                      padding: '4px 10px', border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <Icon style={{ width: 12, height: 12, color: '#FFD100' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Skip rest of content if work-setup (already rendered above) */}
      {step === 'work-setup' ? null : (
        <>
          {/* ── Floating Form Card ── */}
          <div
            style={{
              flex: 1,
              background: '#ffffff',
              borderRadius: '24px 24px 0 0',
              marginTop: -16,
              padding: '28px 20px 40px',
              position: 'relative',
              zIndex: 2,
              boxShadow: '0 -4px 40px rgba(0,0,0,0.25)',
            }}
          >
            {/* Tab switcher */}
            {step === 'form' && (
              <div
                style={{
                  display: 'flex', gap: 4, padding: 4,
                  background: '#f1f5f9', borderRadius: 16, marginBottom: 24,
                }}
              >
                {['login', 'register'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 12, border: 'none',
                      fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                      background: mode === m ? '#FFD100' : 'transparent',
                      color: mode === m ? '#1a0800' : '#64748b',
                      boxShadow: mode === m ? '0 2px 12px rgba(255,209,0,0.35)' : 'none',
                    }}
                  >
                    {m === 'login' ? 'Login' : 'Register'}
                  </button>
                ))}
              </div>
            )}

            <AnimatePresence mode="wait">
              {step === 'form' ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  {/* Role selector for register */}
                  {mode === 'register' ? (
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                        I AM A
                      </p>

                      {/* Default / Selected Main Card */}
                      {(() => {
                        const activeOpt = ROLE_OPTIONS.find((o) => o.role === role) || ROLE_OPTIONS[0]
                        const ActiveIcon = activeOpt.icon
                        return (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                              padding: '14px 16px',
                              borderRadius: 18,
                              border: '2px solid #FFD100',
                              background: 'linear-gradient(135deg, rgba(255,209,0,0.1), rgba(255,209,0,0.03))',
                              boxShadow: '0 4px 16px rgba(255,209,0,0.18)',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                              <span
                                style={{
                                  width: 42,
                                  height: 42,
                                  borderRadius: 14,
                                  flexShrink: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: '#FFD100',
                                  color: '#1a0800',
                                  boxShadow: '0 2px 8px rgba(255,209,0,0.3)',
                                }}
                              >
                                <ActiveIcon style={{ width: 20, height: 20 }} />
                              </span>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                                  {activeOpt.title}
                                </span>
                                <span style={{ display: 'block', fontSize: 11, color: '#64748b', marginTop: 3, lineHeight: 1.35 }}>
                                  {activeOpt.desc}
                                </span>
                              </div>
                            </div>
                            <span
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                background: '#FFD100',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                boxShadow: '0 2px 6px rgba(255,209,0,0.35)',
                              }}
                            >
                              <Check style={{ width: 13, height: 13, color: '#1a0800', strokeWidth: 3 }} />
                            </span>
                          </div>
                        )
                      })()}

                      {/* Expandable Accordion Trigger Card */}
                      <div style={{ marginTop: 10 }}>
                        <button
                          type="button"
                          onClick={() => setIsAccordionOpen((prev) => !prev)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            padding: '14px 16px',
                            borderRadius: 18,
                            border: '1px solid #f1f5f9',
                            background: '#ffffff',
                            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.2s ease',
                            outline: 'none',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                                Explore more account types
                              </span>
                            </div>
                            <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', margin: '2px 0 0 0' }}>
                              For Businesses, Contractors & Workers
                            </p>
                            <p style={{ fontSize: 10, fontWeight: 500, color: '#94a3b8', margin: '2px 0 0 0' }}>
                              Tap to choose another account type
                            </p>
                          </div>
                          <motion.div
                            animate={{ rotate: isAccordionOpen ? 180 : 0 }}
                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: '50%',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              color: '#475569',
                            }}
                          >
                            <ChevronDown style={{ width: 16, height: 16 }} />
                          </motion.div>
                        </button>

                        {/* Accordion Content with Framer Motion */}
                        <AnimatePresence initial={false}>
                          {isAccordionOpen && (
                            <motion.div
                              key="account-types-accordion"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: reduce ? 0 : 0.28, ease: [0.25, 0.1, 0.25, 1.0] }}
                              style={{ overflow: 'hidden' }}
                            >
                              <div style={{ display: 'grid', gap: 8, paddingTop: 10 }}>
                                {ROLE_OPTIONS.filter((opt) => opt.role !== role).map((opt) => {
                                  const Icon = opt.icon
                                  return (
                                    <motion.button
                                      key={opt.role}
                                      type="button"
                                      initial={{ y: -6, opacity: 0 }}
                                      animate={{ y: 0, opacity: 1 }}
                                      exit={{ y: -6, opacity: 0 }}
                                      transition={{ duration: 0.2 }}
                                      whileHover={{ scale: 1.01, backgroundColor: '#f8fafc' }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={() => {
                                        setRole(opt.role)
                                        setIsAccordionOpen(false)
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 12,
                                        padding: '11px 14px',
                                        borderRadius: 14,
                                        border: '1px solid #e2e8f0',
                                        background: '#ffffff',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        transition: 'border-color 0.15s, box-shadow 0.15s',
                                        outline: 'none',
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                                        <span
                                          style={{
                                            width: 34,
                                            height: 34,
                                            borderRadius: 10,
                                            flexShrink: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: '#f1f5f9',
                                            color: '#475569',
                                          }}
                                        >
                                          <Icon style={{ width: 16, height: 16 }} />
                                        </span>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                          <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                                            {opt.title}
                                          </span>
                                          <span style={{ display: 'block', fontSize: 10.5, color: '#64748b', marginTop: 1 }}>
                                            {opt.desc}
                                          </span>
                                        </div>
                                      </div>
                                      <ChevronRight style={{ width: 15, height: 15, color: '#94a3b8', flexShrink: 0 }} />
                                    </motion.button>
                                  )
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {role === USER_ROLES.LABOUR ? (
                        <p style={{ marginTop: 10, fontSize: 11, color: '#64748b', background: 'rgba(255,209,0,0.06)', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,209,0,0.2)' }}>
                          After OTP, you&apos;ll pick your work areas on this screen.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Phone input */}
                  <div id="field-phone">
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                      Mobile Number
                    </label>
                    <div
                      style={{
                        display: 'flex', overflow: 'hidden', borderRadius: 14,
                        border: '2px solid',
                        borderColor: banner?.variant === 'error' && phone.length > 0 && !phoneComplete ? '#fbbf24' : '#e2e8f0',
                        background: '#fff', transition: 'border-color 0.15s',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', padding: '0 14px', background: '#f8fafc', borderRight: '1px solid #e2e8f0', fontSize: 15, fontWeight: 700, color: '#475569', flexShrink: 0 }}>
                        +91
                      </span>
                      <input
                        id="auth-phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        maxLength={10}
                        placeholder="9876543210"
                        onFocus={handleInputFocus}
                        style={{ flex: 1, border: 'none', outline: 'none', padding: '14px 16px', fontSize: 18, fontWeight: 600, letterSpacing: '0.05em', color: '#0f172a', background: 'transparent', minWidth: 0 }}
                        value={phone}
                        onChange={(e) => setPhoneDigits(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            if (!busy) void handleSendOtp()
                            return
                          }
                          const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
                          if (allowed.includes(e.key)) return
                          if (e.ctrlKey || e.metaKey) return
                          if (!/^\d$/.test(e.key)) e.preventDefault()
                        }}
                      />
                      {phoneComplete && (
                        <span style={{ display: 'flex', alignItems: 'center', paddingRight: 14 }}>
                          <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Register extra fields */}
                  {mode === 'register' ? (
                    <>
                      <div id="field-fullname">
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Full Name</label>
                        <input
                          type="text"
                          onFocus={handleInputFocus}
                          style={{ width: '100%', borderRadius: 14, border: '2px solid #e2e8f0', padding: '14px 16px', fontSize: 15, fontWeight: 500, color: '#0f172a', outline: 'none', boxSizing: 'border-box', background: '#fff', transition: 'border-color 0.15s' }}
                          value={fullName}
                          onChange={(e) => setFullName(formatProfessionalName(e.target.value))}
                          placeholder="e.g. Rajesh Kumar"
                          autoComplete="name"
                          autoCapitalize="words"
                          autoCorrect="off"
                          spellCheck="false"
                          maxLength={50}
                        />
                      </div>
                      {role === USER_ROLES.CORPORATE || role === USER_ROLES.ENTERPRISE ? (
                        <>
                          <div id="field-company">
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Company Name</label>
                            <input type="text" onFocus={handleInputFocus} style={{ width: '100%', borderRadius: 14, border: '2px solid #e2e8f0', padding: '14px 16px', fontSize: 15, fontWeight: 500, color: '#0f172a', outline: 'none', boxSizing: 'border-box', background: '#fff' }} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                          </div>
                          <div id="field-gst">
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>GST (optional)</label>
                            <input
                              type="text"
                              onFocus={handleInputFocus}
                              maxLength={15}
                              placeholder="e.g. 22AAAAA0000A1Z5"
                              style={{ width: '100%', borderRadius: 14, border: '2px solid #e2e8f0', padding: '14px 16px', fontSize: 15, fontWeight: 500, color: '#0f172a', outline: 'none', boxSizing: 'border-box', background: '#fff' }}
                              value={gstNumber}
                              onChange={(e) => setGstNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                            />
                          </div>
                        </>
                      ) : null}
                      {role === USER_ROLES.CONTRACTOR ? (
                        <div id="field-business">
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Business Name</label>
                          <input type="text" onFocus={handleInputFocus} style={{ width: '100%', borderRadius: 14, border: '2px solid #e2e8f0', padding: '14px 16px', fontSize: 15, fontWeight: 500, color: '#0f172a', outline: 'none', boxSizing: 'border-box', background: '#fff' }} value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {/* Error banner */}
                  <FeedbackBanner variant={banner?.variant}>{banner?.message}</FeedbackBanner>

                  {/* CTA button */}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSendOtp()}
                    style={{
                      width: '100%', padding: '16px 0', borderRadius: 16, border: 'none',
                      background: busy ? '#e2e8f0' : '#FFD100',
                      color: busy ? '#94a3b8' : '#1a0800',
                      fontSize: 16, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: busy ? 'none' : '0 4px 20px rgba(255,209,0,0.4)',
                      transition: 'all 0.2s', letterSpacing: '-0.01em',
                    }}
                  >
                    {busy ? 'Please wait…' : 'Send OTP'}
                    {!busy && <Phone style={{ width: 18, height: 18 }} />}
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-5"
                >
                  {/* OTP sent info */}
                  <div style={{ background: 'rgba(255,209,0,0.06)', borderRadius: 14, padding: '14px 16px', border: '1px solid rgba(255,209,0,0.2)' }}>
                    <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                      6-digit code sent to{' '}
                      <span style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>+91 {phone}</span>
                    </p>
                  </div>

                  {/* OTP boxes */}
                  <div id="field-otp">
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Enter OTP</p>
                    <div style={{ display: 'flex', gap: 8 }} onPaste={handleOtpPaste}>
                      {otpCells.map((digit, i) => (
                        <input
                          key={i}
                          onFocus={handleInputFocus}
                          ref={(el) => { otpInputRefs.current[i] = el }}
                          type="text"
                          inputMode="numeric"
                          autoComplete={i === 0 ? 'one-time-code' : 'off'}
                          maxLength={1}
                          aria-label={`OTP digit ${i + 1} of 6`}
                          style={{
                            flex: 1, minWidth: 0, borderRadius: 14,
                            border: '2px solid',
                            borderColor: digit ? '#FFD100' : '#e2e8f0',
                            background: digit ? 'rgba(255,209,0,0.06)' : '#f8fafc',
                            padding: '14px 0', textAlign: 'center',
                            fontFamily: 'monospace', fontSize: 22, fontWeight: 800, color: '#0f172a',
                            outline: 'none', transition: 'border-color 0.15s, background 0.15s',
                            boxShadow: digit ? '0 0 0 3px rgba(255,209,0,0.15)' : 'none',
                          }}
                          value={digit}
                          onPaste={handleOtpPaste}
                          onChange={(e) => {
                            const d = e.target.value.replace(/\D/g, '').slice(-1)
                            const next = [...otpCells]
                            if (d) {
                              next[i] = d
                              setOtpCells(next)
                              clearOtpError()
                              if (i < 5) otpInputRefs.current[i + 1]?.focus()
                            } else {
                              next[i] = ''
                              setOtpCells(next)
                              clearOtpError()
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); if (!busy) void handleVerifyOtp(); return }
                            if (e.key === 'Backspace') {
                              e.preventDefault()
                              if (otpCells[i]) { const next = [...otpCells]; next[i] = ''; setOtpCells(next); clearOtpError() }
                              else if (i > 0) { const next = [...otpCells]; next[i - 1] = ''; setOtpCells(next); clearOtpError(); otpInputRefs.current[i - 1]?.focus() }
                              return
                            }
                            if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); otpInputRefs.current[i - 1]?.focus(); return }
                            if (e.key === 'ArrowRight' && i < 5) { e.preventDefault(); otpInputRefs.current[i + 1]?.focus(); return }
                            if (e.ctrlKey || e.metaKey) return
                            if (!/^\d$/.test(e.key) && e.key.length === 1) e.preventDefault()
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <FeedbackBanner variant={banner?.variant}>{banner?.message}</FeedbackBanner>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleVerifyOtp()}
                    style={{
                      width: '100%', padding: '16px 0', borderRadius: 16, border: 'none',
                      background: busy ? '#e2e8f0' : '#FFD100',
                      color: busy ? '#94a3b8' : '#1a0800',
                      fontSize: 16, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: busy ? 'none' : '0 4px 20px rgba(255,209,0,0.4)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {busy ? 'Verifying…' : mode === 'login' ? 'Verify & Sign in' : 'Verify & Continue'}
                    {!busy && <User style={{ width: 18, height: 18 }} />}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Dynamic Published Legal Links (TERMS, PRIVACY, SUPPORT, etc.) */}
            {legalPages.length > 0 && (
              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', margin: '0 0 8px 0' }}>
                  By continuing, you agree to our
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {legalPages.map((page, idx) => (
                    <div key={page.slug} style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                      {idx > 0 && <span style={{ color: '#94a3b8', fontSize: 11 }}>•</span>}
                      <Link
                        to={`/legal/${page.slug}`}
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: '#64748b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          textDecoration: 'none',
                          transition: 'color 0.2s',
                        }}
                        onMouseEnter={(e) => (e.target.style.color = '#0f172a')}
                        onMouseLeave={(e) => (e.target.style.color = '#64748b')}
                      >
                        {page.slug === 'terms' ? 'TERMS' : page.slug === 'privacy' ? 'PRIVACY' : page.slug === 'support' ? 'SUPPORT' : page.title.replace(' Policy', '').replace(' & Conditions', '')}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin link */}
            <p style={{ marginTop: 18, textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>
              Admin?{' '}
              <Link to="/admin/login" style={{ fontWeight: 700, color: '#FFD100', textDecoration: 'none' }}>
                Web login
              </Link>
            </p>
          </div>
        </>
      )}
    </div>
  )
}
