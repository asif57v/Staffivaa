import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { adminEmailLogin } from '../../api/authApi.js'
import { useAuth } from '../../hooks/useAuth.js'
import { ApiError } from '../../api/http.js'
import { USER_ROLES } from '../../constants/userRoles.js'
import { ArrowLeft, Lock, Mail, ShieldCheck, CheckCircle2, ArrowRight, Eye, EyeOff } from 'lucide-react'
import authBg from '../../assets/auth-bg.png'

function handleInputFocus(e) {
  const container = e.target.closest('div[id^="field-"]') || e.target.parentElement || e.target
  setTimeout(() => {
    try {
      container.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } catch (err) {}
  }, 300)
}

/**
 * Web-focused admin sign-in (email + password).
 */
export function AdminLoginPage() {
  const navigate = useNavigate()
  const { applySession } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const reason = sessionStorage.getItem('staffivaa_logout_reason')
      if (reason) {
        setMessage(reason)
        sessionStorage.removeItem('staffivaa_logout_reason')
      }
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')
    setBusy(true)
    try {
      const res = await adminEmailLogin({ email: email.trim(), password })
      const { token, user } = res.data
      if (user.role !== USER_ROLES.ADMIN) {
        setMessage('Not an admin account')
        return
      }
      applySession(token, user)
      navigate('/admin', { replace: true })
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh bg-white sm:bg-slate-950 flex flex-col justify-center items-center p-0 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-white sm:rounded-3xl overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] flex flex-col min-h-dvh sm:min-h-0">
        
        {/* ── Hero Header (Exactly matching normal user auth page) ── */}
        <div
          className="relative overflow-hidden px-6 pt-10 pb-12"
          style={{
            background: `linear-gradient(to bottom, rgba(15, 23, 42, 0.70), rgba(15, 23, 42, 0.95)), url(${authBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          {/* Decorative glow blobs */}
          <div
            aria-hidden
            style={{
              position: 'absolute', top: -40, right: -40, width: 200, height: 200,
              background: 'radial-gradient(circle, rgba(255,209,0,0.22) 0%, transparent 70%)',
              borderRadius: '50%',
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute', bottom: -20, left: -30, width: 160, height: 160,
              background: 'radial-gradient(circle, rgba(255,150,0,0.15) 0%, transparent 70%)',
              borderRadius: '50%',
            }}
          />

          {/* Logo row */}
          <div className="flex items-center justify-between mb-8 relative z-10">
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
              <span style={{ fontSize: 18, fontWeight: 800, color: '#FFD100', letterSpacing: '-0.01em' }}>
                Staffivaa
              </span>
            </div>
            <Link
              to="/home"
              aria-label="Back to home"
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)',
                textDecoration: 'none',
              }}
              className="hover:text-white transition"
            >
              <ArrowLeft style={{ width: 15, height: 15 }} />
              Home
            </Link>
          </div>

          {/* Welcome headline */}
          <div className="relative z-10">
            <p style={{ fontSize: 12, fontWeight: 800, color: '#FFD100', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              🔒 System Administrator
            </p>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: '#ffffff', lineHeight: 1.18, margin: 0 }}>
              Sign in to<br />Admin Portal
            </h1>
            <p style={{ marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
              Control centre & operational management dashboard
            </p>
          </div>

          {/* Trust badges */}
          <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }} className="relative z-10">
            {[
              { icon: ShieldCheck, label: 'Secure Auth' },
              { icon: Lock, label: '256-bit Encrypted' },
              { icon: CheckCircle2, label: 'Verified Portal' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 20,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <Icon style={{ width: 12, height: 12, color: '#FFD100' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Floating White Form Card ── */}
        <div
          className="flex-1 bg-white relative z-20 px-6 pt-8 pb-40 flex flex-col justify-between"
          style={{
            borderRadius: '24px 24px 0 0',
            marginTop: -20,
            boxShadow: '0 -8px 30px rgba(0,0,0,0.25)',
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div id="field-email">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                Email Address
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <Mail className="h-5 w-5" aria-hidden />
                </div>
                <input
                  type="email"
                  onFocus={handleInputFocus}
                  autoComplete="username"
                  className="block w-full rounded-xl border-2 border-slate-200 bg-slate-50/50 py-3.5 pl-11 pr-4 text-sm font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-[#FFD100] focus:outline-none focus:ring-4 focus:ring-[#FFD100]/20 transition duration-200"
                  placeholder="admin@staffivaa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div id="field-password">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                Password
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <Lock className="h-5 w-5" aria-hidden />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  onFocus={handleInputFocus}
                  autoComplete="current-password"
                  className="block w-full rounded-xl border-2 border-slate-200 bg-slate-50/50 py-3.5 pl-11 pr-12 text-sm font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-[#FFD100] focus:outline-none focus:ring-4 focus:ring-[#FFD100]/20 transition duration-200"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-slate-700 focus:outline-none transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              style={{
                background: '#FFD100',
                color: '#1a0800',
                boxShadow: '0 6px 20px rgba(255,209,0,0.4)',
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-4 px-4 text-base font-black hover:brightness-95 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              <span>{busy ? 'Signing in…' : 'Sign In'}</span>
              {!busy && <ArrowRight className="h-5 w-5" />}
            </button>

            {message && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-bold text-center">
                {message}
              </div>
            )}
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-300 font-medium">
              © {new Date().getFullYear()} Staffivaa Platform. All systems monitored.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
