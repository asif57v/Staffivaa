import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  HardHat,
  LifeBuoy,
  MessageSquare,
  Users,
  Wallet,
} from 'lucide-react'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'

const TOPICS = [
  { id: 'supply', label: 'Supply & allocation', desc: 'Admin assignments, crew counts', icon: ClipboardList },
  { id: 'workforce', label: 'Workforce', desc: 'Onboarding, replacements', icon: Users },
  { id: 'client', label: 'Client sites', desc: 'Coordination, escalations', icon: HardHat },
  { id: 'payment', label: 'Vendor payments', desc: 'Settlement, disputes', icon: Wallet },
]

export function VendorSupportPage() {
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
    <div className="space-y-5 pb-28">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand">Support</p>
        <h1 className="text-xl font-black text-slate-900">Vendor support</h1>
        <p className="mt-1 text-sm text-slate-600">Supply, workforce, and client coordination.</p>
      </div>

      <AppSurface className="flex gap-3 border-amber-100 bg-amber-50/50">
        <LifeBuoy className="h-6 w-6 shrink-0 text-amber-800" aria-hidden />
        <p className="text-sm text-slate-600">
          Aligned with admin-controlled allocation. Include job reference and site when reporting issues.
        </p>
      </AppSurface>

      <div className="grid grid-cols-2 gap-2">
        {TOPICS.map((t) => {
          const Icon = t.icon
          const active = topicId === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTopicId(t.id)}
              className={`rounded-2xl border px-3 py-3 text-left ${
                active ? 'border-brand/40 bg-brand/10' : 'border-slate-200 bg-white'
              }`}
            >
              <Icon className="h-4 w-4 text-brand" aria-hidden />
              <p className="mt-2 text-sm font-bold text-slate-900">{t.label}</p>
              <p className="text-[10px] text-slate-500">{t.desc}</p>
            </button>
          )
        })}
      </div>

      <AppSurface>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-brand" aria-hidden />
          <p className="text-sm font-extrabold text-slate-900">Report an issue</p>
        </div>
        <p className="mt-1 text-xs text-slate-600">
          Topic: <span className="font-bold text-brand">{topic.label}</span>
        </p>

        {sent ? (
          <div className="mt-4 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <CheckCircle2 className="h-6 w-6 text-emerald-700" aria-hidden />
            <div>
              <p className="text-sm font-black text-slate-900">Ticket preview saved (demo)</p>
              <button
                type="button"
                className="mt-2 text-xs font-bold text-brand"
                onClick={() => {
                  setSent(false)
                  setSubject('')
                  setDetails('')
                }}
              >
                Send another
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <input
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
            <textarea
              className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              rows={4}
              placeholder="Details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              required
            />
            <AppPrimaryButton type="submit" className="w-full">
              Submit
              <ArrowRight className="h-4 w-4" aria-hidden />
            </AppPrimaryButton>
          </form>
        )}
      </AppSurface>

      <Link
        to="/vendor/jobs"
        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800"
      >
        Supply jobs
        <ArrowRight className="h-4 w-4 text-slate-300" aria-hidden />
      </Link>
    </div>
  )
}
