import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Send, Search, X, Users, User, Globe, Clock, Trash2, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { GlassPanel } from '../../../components/ui/GlassPanel.jsx'
import { apiClient } from '../../../api/http.js'
import { BANNER_ROLES } from '../../../lib/bannerAction.js'

const ROLE_LABEL = Object.fromEntries(BANNER_ROLES.map((r) => [r.value, r.label]))
const inputCls =
  'w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white'
const labelCls = 'block text-xs font-semibold text-slate-600 mb-1'

const MODES = [
  { id: 'ALL', label: 'All users', icon: Globe },
  { id: 'ROLES', label: 'By role', icon: Users },
  { id: 'INDIVIDUAL', label: 'Individual', icon: User },
]

const STATUS_STYLE = {
  sent: 'bg-emerald-100 text-emerald-700',
  sending: 'bg-amber-100 text-amber-700',
  scheduled: 'bg-indigo-100 text-indigo-700',
  failed: 'bg-red-100 text-red-700',
}

function audienceLabel(a) {
  if (a.mode === 'ALL') return 'Everyone'
  if (a.mode === 'ROLES') return a.roles.map((r) => ROLE_LABEL[r] || r).join(', ')
  return `${a.userIds.length} selected user${a.userIds.length === 1 ? '' : 's'}`
}

export function AdminPushNotificationsPage() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [mode, setMode] = useState('ALL')
  const [roles, setRoles] = useState([])
  const [picked, setPicked] = useState([]) // [{_id, fullName, phone, role}]
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [roleFilter, setRoleFilter] = useState('') // '' = all roles
  const [listOpen, setListOpen] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const pickerRef = useRef(null)
  const [actionType, setActionType] = useState('NONE')
  const [screen, setScreen] = useState('')
  const [skillId, setSkillId] = useState('')
  const [groups, setGroups] = useState([])
  const [schedule, setSchedule] = useState('')
  const [count, setCount] = useState(null)
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState([])

  const audience = useMemo(
    () => ({ mode, roles, userIds: picked.map((u) => u._id) }),
    [mode, roles, picked],
  )
  const audienceValid =
    mode === 'ALL' || (mode === 'ROLES' && roles.length > 0) || (mode === 'INDIVIDUAL' && picked.length > 0)

  const loadHistory = useCallback(async () => {
    try {
      const res = await apiClient.get('/admin/push-notifications')
      setHistory(res.data.data.campaigns)
    } catch {
      /* non-blocking */
    }
  }, [])

  useEffect(() => {
    loadHistory()
    apiClient
      .get('/labour-categories/grouped')
      .then((r) => r.data.success && setGroups(r.data.data.groups))
      .catch(() => {})
  }, [loadHistory])

  // Keep the history fresh while a campaign is still sending.
  useEffect(() => {
    if (!history.some((c) => c.status === 'sending')) return undefined
    const t = setInterval(loadHistory, 4000)
    return () => clearInterval(t)
  }, [history, loadHistory])

  // Live "estimated recipients"
  useEffect(() => {
    if (!audienceValid) {
      setCount(null)
      return undefined
    }
    const t = setTimeout(() => {
      apiClient
        .post('/admin/push-notifications/recipients/count', audience)
        .then((r) => setCount(r.data.data))
        .catch(() => setCount(null))
    }, 300)
    return () => clearTimeout(t)
  }, [audience, audienceValid])

  // Individual picker: lists users as soon as the box is focused, filtered by role + search text
  useEffect(() => {
    if (mode !== 'INDIVIDUAL' || !listOpen) return undefined
    setListLoading(true)
    const t = setTimeout(() => {
      apiClient
        .get('/admin/push-notifications/recipients/search', {
          params: { q: query.trim(), role: roleFilter || undefined },
        })
        .then((r) => setResults(r.data.data.users))
        .catch(() => setResults([]))
        .finally(() => setListLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [query, roleFilter, mode, listOpen])

  // Close the dropdown when clicking outside the picker
  useEffect(() => {
    const onDown = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setListOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const toggleRole = (r) => setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]))
  const pickUser = (u) => {
    setPicked((cur) => (cur.some((x) => x._id === u._id) ? cur.filter((x) => x._id !== u._id) : [...cur, u]))
  }
  const allListed = results.length > 0 && results.every((u) => picked.some((x) => x._id === u._id))
  const toggleAllListed = () =>
    setPicked((cur) =>
      allListed
        ? cur.filter((x) => !results.some((u) => u._id === x._id))
        : [...cur, ...results.filter((u) => !cur.some((x) => x._id === u._id))],
    )

  const handleSend = async (e) => {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return toast.error('Title and message are required')
    if (!audienceValid) return toast.error('Choose who should receive this')
    if (actionType === 'SCREEN' && !screen.trim()) return toast.error('Enter a screen path')
    if (actionType === 'SKILL_BOOKING' && !skillId) return toast.error('Select a skill')

    const who = count ? `${count.total} recipient${count.total === 1 ? '' : 's'}` : audienceLabel(audience)
    const when = schedule ? `on ${new Date(schedule).toLocaleString()}` : 'now'
    if (!window.confirm(`Send "${title.trim()}" to ${who} (${audienceLabel(audience)}) ${when}?`)) return

    setSending(true)
    try {
      await apiClient.post('/admin/push-notifications/send', {
        title: title.trim(),
        body: body.trim(),
        audience,
        action: { type: actionType, screen: screen.trim(), skillId },
        scheduledAt: schedule ? new Date(schedule).toISOString() : undefined,
      })
      toast.success(schedule ? 'Notification scheduled' : 'Sending started')
      setTitle('')
      setBody('')
      setSchedule('')
      setActionType('NONE')
      setScreen('')
      setSkillId('')
      setPicked([])
      loadHistory()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to send notification')
    } finally {
      setSending(false)
    }
  }

  const cancelScheduled = async (id) => {
    if (!window.confirm('Cancel this scheduled notification?')) return
    try {
      await apiClient.delete(`/admin/push-notifications/${id}`)
      toast.success('Cancelled')
      loadHistory()
    } catch {
      toast.error('Could not cancel')
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Push Notifications</h1>
        <p className="text-sm text-slate-500">Send announcements to everyone, to specific roles, or to individual people</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <GlassPanel className="lg:col-span-3 p-5 bg-white">
          <form onSubmit={handleSend} className="space-y-5">
            <div>
              <label className={labelCls}>Title * <span className="text-slate-400">({title.length}/65)</span></label>
              <input value={title} maxLength={65} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="e.g. Festival offer 🎉" />
            </div>
            <div>
              <label className={labelCls}>Message * <span className="text-slate-400">({body.length}/240)</span></label>
              <textarea value={body} maxLength={240} rows={3} onChange={(e) => setBody(e.target.value)} className={inputCls} placeholder="Write the notification text" />
            </div>

            <div>
              <label className={labelCls}>Send to</label>
              <div className="grid grid-cols-3 gap-2">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold ${mode === m.id ? 'bg-[#3730A3] text-white border-[#3730A3]' : 'bg-white text-slate-600 border-slate-200'}`}
                  >
                    <m.icon className="h-4 w-4" /> {m.label}
                  </button>
                ))}
              </div>

              {mode === 'ROLES' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {BANNER_ROLES.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => toggleRole(r.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border ${roles.includes(r.value) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}

              {mode === 'INDIVIDUAL' && (
                <div className="mt-3 space-y-2" ref={pickerRef}>
                  <div className="flex flex-wrap gap-2">
                    {[{ value: '', label: 'All' }, ...BANNER_ROLES].map((r) => (
                      <button
                        key={r.value || 'all'}
                        type="button"
                        onClick={() => { setRoleFilter(r.value); setListOpen(true) }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border ${roleFilter === r.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      value={query}
                      onFocus={() => setListOpen(true)}
                      onChange={(e) => { setQuery(e.target.value); setListOpen(true) }}
                      className={`${inputCls} pl-9 pr-10`}
                      placeholder="Click to list users, or search by name, phone, email or ID"
                    />
                    <button
                      type="button"
                      onClick={() => setListOpen((o) => !o)}
                      aria-label={listOpen ? 'Close user list' : 'Open user list'}
                      className="absolute right-2 top-1.5 p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${listOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {listOpen && (
                      <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-64 overflow-y-auto">
                        {results.length > 0 && (
                          <label className="flex items-center gap-3 px-3 py-2 border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-600 cursor-pointer sticky top-0">
                            <input type="checkbox" checked={allListed} onChange={toggleAllListed} className="h-4 w-4 accent-indigo-600" />
                            Select all listed ({results.length})
                          </label>
                        )}
                        {listLoading && results.length === 0 ? (
                          <p className="px-3 py-3 text-xs text-slate-500">Loading…</p>
                        ) : results.length === 0 ? (
                          <p className="px-3 py-3 text-xs text-slate-500">No users found</p>
                        ) : results.map((u) => {
                          const chosen = picked.some((x) => x._id === u._id)
                          return (
                            <label key={u._id} className={`w-full px-3 py-2 hover:bg-slate-50 text-sm flex items-center gap-3 cursor-pointer ${chosen ? 'bg-indigo-50/60' : ''}`}>
                              <input type="checkbox" checked={chosen} onChange={() => pickUser(u)} className="h-4 w-4 accent-indigo-600" />
                              <span className="font-semibold text-slate-800">{u.fullName || 'Unnamed'}</span>
                              <span className="text-xs text-slate-500">{u.phone || u.email}</span>
                              <span className="ml-auto rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5">{ROLE_LABEL[u.role] || u.role}</span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {picked.map((u) => (
                      <span key={u._id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {u.fullName || u.phone}
                        <button type="button" onClick={() => setPicked((c) => c.filter((x) => x._id !== u._id))}><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {count && (
                <p className="mt-2 text-xs text-slate-600">
                  Estimated recipients: <b>{count.total}</b> · with a registered device: <b>{count.withDevice}</b>
                </p>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/60">
              <label className={labelCls}>When tapped</label>
              <select value={actionType} onChange={(e) => setActionType(e.target.value)} className={inputCls}>
                <option value="NONE">Just open the app</option>
                <option value="SCREEN">Open an app screen</option>
                <option value="SKILL_BOOKING">Open booking / hiring for a skill</option>
              </select>
              {actionType === 'SCREEN' && (
                <input value={screen} onChange={(e) => setScreen(e.target.value)} className={inputCls} placeholder="e.g. /app/bookings" />
              )}
              {actionType === 'SKILL_BOOKING' && (
                <select value={skillId} onChange={(e) => setSkillId(e.target.value)} className={inputCls}>
                  <option value="">Select skill…</option>
                  {groups.map((g) => (
                    <optgroup key={g._id} label={g.name}>
                      {(g.categories || []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className={labelCls}>Schedule (optional — leave empty to send now)</label>
              <input type="datetime-local" value={schedule} onChange={(e) => setSchedule(e.target.value)} className={inputCls} />
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={sending} className="bg-[#3730A3] text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 hover:bg-[#312E81] disabled:opacity-60">
                <Send className="h-4 w-4" /> {sending ? 'Sending…' : schedule ? 'Schedule' : 'Send now'}
              </button>
            </div>
          </form>
        </GlassPanel>

        {/* Live preview */}
        <div className="lg:col-span-2">
          <GlassPanel className="p-5 bg-white sticky top-4">
            <p className="text-xs font-semibold text-slate-500 mb-3">Preview</p>
            <div className="rounded-2xl bg-slate-100 p-3">
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <p className="text-[10px] font-bold uppercase text-slate-400">Staffivaa · now</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{title || 'Notification title'}</p>
                <p className="text-xs text-slate-600">{body || 'Your message will appear here.'}</p>
              </div>
            </div>
          </GlassPanel>
        </div>
      </div>

      <GlassPanel className="p-0 overflow-hidden bg-white">
        <div className="px-6 py-4 border-b border-slate-100 font-semibold text-slate-800">History</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-semibold text-slate-700">Notification</th>
                <th className="px-6 py-3 font-semibold text-slate-700">Audience</th>
                <th className="px-6 py-3 font-semibold text-slate-700">Delivered / Failed</th>
                <th className="px-6 py-3 font-semibold text-slate-700">Status</th>
                <th className="px-6 py-3 font-semibold text-slate-700">When</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-500">Nothing sent yet.</td></tr>
              ) : history.map((c) => (
                <tr key={c._id}>
                  <td className="px-6 py-3">
                    <div className="font-semibold text-slate-900">{c.title}</div>
                    <div className="text-xs text-slate-500 max-w-xs truncate">{c.body}</div>
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-600">{audienceLabel(c.audience)}</td>
                  <td className="px-6 py-3 text-xs text-slate-600">
                    {c.counts.delivered} / {c.counts.failed} <span className="text-slate-400">of {c.counts.targeted}</span>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[c.status]}`}>{c.status}</span>
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-600">
                    {c.status === 'scheduled' && <Clock className="inline h-3 w-3 mr-1" />}
                    {new Date(c.scheduledAt || c.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {c.status === 'scheduled' && (
                      <button onClick={() => cancelScheduled(c._id)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>
  )
}
