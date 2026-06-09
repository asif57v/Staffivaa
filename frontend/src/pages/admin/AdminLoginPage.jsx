import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { adminEmailLogin } from '../../api/authApi.js'
import { useAuth } from '../../hooks/useAuth.js'
import { ApiError } from '../../api/http.js'
import { USER_ROLES } from '../../constants/userRoles.js'

/**
 * Web-focused admin sign-in (email + password). Full dashboard comes in Admin module.
 */
export function AdminLoginPage() {
  const navigate = useNavigate()
  const { applySession } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

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
    <div className="min-h-dvh bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-extrabold">Admin panel</h1>
        <p className="mt-1 text-sm text-slate-400">Web dashboard login (not mobile shell)</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Email</label>
            <input
              type="email"
              autoComplete="username"
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-brand"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-brand"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-brand py-3 font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {message ? <p className="mt-4 text-sm text-amber-300">{message}</p> : null}

        <p className="mt-8 text-center text-sm text-slate-400">
          <Link to="/auth" className="text-brand-bright">
            Mobile OTP login
          </Link>
          {' · '}
          <Link to="/home" className="text-brand-bright">
            Home
          </Link>
        </p>
      </div>
    </div>
  )
}
