import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileText,
  LifeBuoy,
  Mail,
  Phone,
  Users,
} from 'lucide-react'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'

const TOPICS = [
  { id: 'bulk', label: 'Bulk deployment', desc: 'Headcount, mobilisation, queue', icon: Users },
  { id: 'billing', label: 'Billing & GST', desc: 'Invoices, milestones, postpaid', icon: Banknote },
  { id: 'contract', label: 'Contracts', desc: 'Terms, SLAs, rate cards', icon: FileText },
  { id: 'attendance', label: 'Attendance data', desc: 'Logs, disputes, exports', icon: ClipboardList },
]

const QUICK_LINKS = [
  { to: '/corporate/requests', label: 'Workforce requests', icon: ClipboardList },
  { to: '/corporate/billing', label: 'Billing & invoices', icon: Banknote },
  { to: '/corporate/profile', label: 'Profile & documents', icon: Building2 },
]

export function CorporateSupportPage() {
  const [topicId, setTopicId] = useState(TOPICS[0].id)
  const [subject, setSubject] = useState('')
  const [details, setDetails] = useState('')
  const [sent, setSent] = useState(false)

  const topic = TOPICS.find((t) => t.id === topicId) ?? TOPICS[0]

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!subject.trim() || !details.trim()) return
    setSent(true)
  }

  return (
    <div className="w-full space-y-5 pb-28">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand">Support</p>
        <h1 className="mt-0.5 text-xl font-black tracking-tight text-slate-900">Enterprise support</h1>
        <p className="mt-1 text-sm text-slate-600">
          Bulk deployment, billing, and contract escalations — routed with your corporate account context.
        </p>
      </div>

      <AppSurface tone="brandWash" className="border-slate-800/10 bg-slate-900 text-white">
        <div className="flex gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <LifeBuoy className="h-6 w-6" aria-hidden />
          </span>
          <p className="text-sm leading-relaxed text-white/85">
            Tickets route to admin operations. Include project refs, site names, and dates when reporting issues.
          </p>
        </div>
      </AppSurface>

      <div>
        <p className="mb-3 text-sm font-extrabold text-slate-900">Choose a topic</p>
        <div className="grid grid-cols-2 gap-2.5">
          {TOPICS.map((t) => {
            const Icon = t.icon
            const active = topicId === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTopicId(t.id)}
                className={`rounded-2xl border px-3.5 py-3 text-left transition ${
                  active
                    ? 'border-brand/45 bg-brand/10 ring-2 ring-brand/20'
                    : 'border-slate-200/90 bg-white hover:border-brand/25'
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    active ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <p className="mt-2 text-sm font-bold text-slate-900">{t.label}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{t.desc}</p>
              </button>
            )
          })}
        </div>
      </div>

      <AppSurface>
        <p className="text-sm font-extrabold text-slate-900">Report an issue</p>
        <p className="mt-1 text-xs text-slate-600">
          Topic: <span className="font-bold text-brand">{topic.label}</span>
        </p>

        {sent ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex gap-3">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-700" aria-hidden />
              <div>
                <p className="text-sm font-black text-slate-900">Ticket preview saved (demo)</p>
                <p className="mt-1 text-xs text-slate-600">API ticketing will assign IDs and status updates.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSent(false)
                    setSubject('')
                    setDetails('')
                  }}
                  className="mt-3 text-xs font-bold text-brand"
                >
                  Send another
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <input
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand/35"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
            <textarea
              className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand/35"
              rows={4}
              placeholder="Details — booking refs, dates, site names"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              required
            />
            <AppPrimaryButton type="submit" className="w-full">
              Submit to support queue
              <ArrowRight className="h-4 w-4" aria-hidden />
            </AppPrimaryButton>
          </form>
        )}
      </AppSurface>

      <div className="grid gap-3 sm:grid-cols-2">
        <AppSurface>
          <Phone className="h-5 w-5 text-sky-600" aria-hidden />
          <p className="mt-2 text-sm font-extrabold text-slate-900">Phone helpline</p>
          <p className="mt-1 text-xs text-slate-500">Regional numbers — coming soon</p>
        </AppSurface>
        <AppSurface>
          <Mail className="h-5 w-5 text-violet-600" aria-hidden />
          <p className="mt-2 text-sm font-extrabold text-slate-900">Email support</p>
          <p className="mt-1 text-xs text-slate-500">Use your registered corporate domain</p>
        </AppSurface>
      </div>

      <div>
        <p className="mb-3 text-sm font-extrabold text-slate-900">Quick links</p>
        <ul className="space-y-2">
          {QUICK_LINKS.map((link) => (
            <li key={link.to}>
              <Link
                to={link.to}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-bold text-slate-800"
              >
                <span className="flex items-center gap-2">
                  <link.icon className="h-4 w-4 text-brand" aria-hidden />
                  {link.label}
                </span>
                <ArrowRight className="h-4 w-4 text-slate-300" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
