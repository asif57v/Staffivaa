import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Navigation, ChevronDown, ChevronUp, UserCheck } from 'lucide-react'
import { Autocomplete, useLoadScript } from '@react-google-maps/api'
import { apiRequest } from '../../../api/http.js'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import {
  useCreateRequestMutation,
  useGetCorporateProjectsQuery,
} from '../../../store/api/workforceApi.js'

const inputClass =
  'w-full rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand/35'

const SCHEDULE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'long_term', label: 'Long term' },
]

function emptyLine() {
  return { categoryId: '', quantity: 1, experienceLevel: '' }
}

export function CorporateRequestNewPage() {
  const navigate = useNavigate()
  const { data: projectsData } = useGetCorporateProjectsQuery()
  const [createRequest, { isLoading }] = useCreateRequestMutation()
  const projects = projectsData?.projects ?? []

  const [projectId, setProjectId] = useState('')
  const [scheduleType, setScheduleType] = useState('daily')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [shiftStart, setShiftStart] = useState('08:00')
  const [shiftEnd, setShiftEnd] = useState('18:00')
  const [locationText, setLocationText] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState([emptyLine()])
  const [isSkillsExpanded, setIsSkillsExpanded] = useState(true)
  const [categories, setCategories] = useState([])
  const [error, setError] = useState('')
  const [autocomplete, setAutocomplete] = useState(null)

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['places'],
  })

  const handlePlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace()
      if (place.formatted_address) {
        setLocationText(place.formatted_address)
      }
    }
  }

  const pickLocation = () => {
    if (!navigator.geolocation) {
      setError('Location is not supported by your browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        try {
          const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
          if (!apiKey) {
            setLocationText(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
            return
          }
          const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`)
          const data = await res.json()
          if (data.results && data.results.length > 0) {
            setLocationText(data.results[0].formatted_address)
          } else {
            setLocationText(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
          }
        } catch {
          setLocationText(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
        }
      },
      () => {
        setError('Unable to retrieve your location.')
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    )
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const json = await apiRequest('/labour-categories/grouped')
        if (cancelled) return
        const payload = json?.data ?? json
        const flat = []
        for (const group of payload?.groups ?? []) {
          for (const c of group.categories ?? []) {
            flat.push({ id: c._id || c.id, name: c.name, group: group.name })
          }
        }
        setCategories(flat)
      } catch {
        if (!cancelled) setCategories([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const updateLine = (idx, patch) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const validLines = lines.filter((l) => l.categoryId)
    if (!validLines.length) {
      setError('Add at least one skill line')
      return
    }
    if (!startDate) {
      setError('Start date is required')
      return
    }
    try {
      await createRequest({
        projectId: projectId || undefined,
        scheduleType,
        startDate,
        endDate: endDate || undefined,
        shiftStart,
        shiftEnd,
        locationText: locationText.trim() || undefined,
        notes: notes.trim() || undefined,
        lines: validLines.map((l) => ({
          categoryId: l.categoryId,
          quantity: Number(l.quantity) || 1,
        })),
      }).unwrap()
      navigate('/corporate/requests')
    } catch (err) {
      setError(err?.data?.message || err?.message || 'Could not create request')
    }
  }

  return (
    <div className="space-y-4 pb-8">
      <Link to="/corporate/requests" className="inline-flex items-center gap-2 text-sm font-bold text-brand">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to requests
      </Link>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-3xl bg-[#C78CC7] p-6 shadow-sm">
          <h2 className="text-2xl font-extrabold text-slate-900">New workforce request</h2>
          <div className="mt-6">
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-700">
              Project
            </label>
            <select className={`${inputClass} border-none`} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-[#FCF9FD] shadow-sm overflow-hidden">
          {/* Skill Requirements Section */}
          <div>
            <div 
              className="flex items-center justify-between p-6 cursor-pointer hover:bg-slate-100/30 transition-colors"
              onClick={() => setIsSkillsExpanded(!isSkillsExpanded)}
            >
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Skill Requirements</h3>
                <p className="mt-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Total Skills: {lines.length} • Total Workers: {lines.reduce((acc, l) => acc + (Number(l.quantity) || 0), 0)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setLines((prev) => [...prev, emptyLine()])
                    setIsSkillsExpanded(true)
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#A861A8] bg-white border border-[#F2DDF2] hover:bg-fuchsia-50 px-4 py-2 rounded-xl shadow-sm transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Skill
                </button>
                {isSkillsExpanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
              </div>
            </div>

            {isSkillsExpanded && (
              <div className="p-6 pt-0 space-y-4">
                {lines.map((line, idx) => (
                  <div key={idx} className="relative rounded-2xl bg-white p-5 shadow-sm border border-[#F2DDF2]">
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute right-4 top-4 p-1 text-rose-400 hover:text-rose-600 transition"
                        aria-label="Remove skill"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="sm:col-span-2 lg:col-span-1">
                        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Skill Name
                        </label>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <UserCheck className="h-4 w-4 text-[#C78CC7]" />
                          </div>
                          <select
                            className={`${inputClass} border-[#C78CC7]/40 pl-10 focus:ring-[#C78CC7]/30`}
                            value={line.categoryId}
                            onChange={(e) => updateLine(idx, { categoryId: e.target.value })}
                            required={idx === 0}
                          >
                            <option value="">Select skill...</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                                {c.group ? ` (${c.group})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Workers Required
                        </label>
                        <input
                          type="number"
                          min={1}
                          className={inputClass}
                          value={line.quantity}
                          onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Experience Level <span className="normal-case opacity-60">(Optional)</span>
                        </label>
                        <select
                          className={inputClass}
                          value={line.experienceLevel || ''}
                          onChange={(e) => updateLine(idx, { experienceLevel: e.target.value })}
                        >
                          <option value="">Any experience</option>
                          <option value="entry">Entry Level (0-2 yrs)</option>
                          <option value="mid">Mid Level (2-5 yrs)</option>
                          <option value="senior">Senior Level (5+ yrs)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <AppSurface>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Schedule
            </label>
            <select
              className={inputClass}
              value={scheduleType}
              onChange={(e) => setScheduleType(e.target.value)}
            >
              {SCHEDULE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Start date
              </label>
              <input
                type="date"
                className={inputClass}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                End date
              </label>
              <input type="date" className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Shift start
              </label>
              <input
                type="time"
                className={inputClass}
                value={shiftStart}
                onChange={(e) => setShiftStart(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Shift end
              </label>
              <input
                type="time"
                className={inputClass}
                value={shiftEnd}
                onChange={(e) => setShiftEnd(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Location
            </label>
            {isLoaded ? (
              <Autocomplete
                onLoad={(auto) => setAutocomplete(auto)}
                onPlaceChanged={handlePlaceChanged}
                options={{
                  componentRestrictions: { country: 'in' },
                  fields: ['formatted_address']
                }}
              >
                <input className={inputClass} value={locationText} onChange={(e) => setLocationText(e.target.value)} />
              </Autocomplete>
            ) : (
              <input className={inputClass} value={locationText} onChange={(e) => setLocationText(e.target.value)} />
            )}
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={pickLocation}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 active:scale-95"
              >
                <Navigation className="h-3.5 w-3.5" />
                Fetch live location
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Notes</label>
            <textarea className={inputClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}

          <AppPrimaryButton type="submit" className="w-full" loading={isLoading}>
            Submit request
          </AppPrimaryButton>
        </AppSurface>
      </form>
    </div>
  )
}
