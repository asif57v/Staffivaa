import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { 
  ArrowLeft, Plus, Trash2, Navigation, ChevronDown, 
  MapPin, Clock, Calendar, Users, Briefcase, RefreshCw, Minus
} from 'lucide-react'
import { Autocomplete, useLoadScript } from '@react-google-maps/api'
import { apiRequest } from '../../../api/http.js'
import { 
  useCreateRequestMutation, 
  useGetCorporateProjectsQuery,
  useGetCorporateProjectQuery,
  useAddCorporateSiteMutation
} from '../../../store/api/workforceApi.js'

function emptyLine() {
  return { categoryId: '', quantity: 1, experienceLevel: '' }
}

export function CorporateRequestNewPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const prefillProjectId = location.state?.prefillProjectId || ''
  const prefillSiteId = location.state?.prefillSiteId || ''

  const { data: projectsData } = useGetCorporateProjectsQuery()
  const [createRequest, { isLoading }] = useCreateRequestMutation()
  const projects = projectsData?.projects ?? []

  const [projectId, setProjectId] = useState(prefillProjectId)
  const [siteId, setSiteId] = useState(prefillSiteId)
  
  const { data: projectData, isFetching: isFetchingProject } = useGetCorporateProjectQuery(projectId, { skip: !projectId || projectId === 'none' })
  const [addSite, { isLoading: isAddingSiteMutation }] = useAddCorporateSiteMutation()

  const projectSites = projectData?.project?.sites || []

  const [isAddingSite, setIsAddingSite] = useState(false)
  const [newSiteName, setNewSiteName] = useState('')

  const [scheduleType, setScheduleType] = useState('daily')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [shiftStart, setShiftStart] = useState('08:00')
  const [shiftEnd, setShiftEnd] = useState('18:00')
  const [locationText, setLocationText] = useState('')
  const [locationLat, setLocationLat] = useState(null)
  const [locationLng, setLocationLng] = useState(null)
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState([emptyLine()])
  const [categories, setCategories] = useState([])
  const [error, setError] = useState('')
  const [autocomplete, setAutocomplete] = useState(null)
  const [isFetchingLocation, setIsFetchingLocation] = useState(false)

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
      if (place.geometry && place.geometry.location) {
        setLocationLat(place.geometry.location.lat())
        setLocationLng(place.geometry.location.lng())
      }
    }
  }

  const pickLocation = () => {
    if (!navigator.geolocation) {
      setError('Location is not supported.')
      return
    }
    setIsFetchingLocation(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setLocationLat(lat)
        setLocationLng(lng)
        try {
          const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
          if (!apiKey) {
            setLocationText(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
            setIsFetchingLocation(false)
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
        setIsFetchingLocation(false)
      },
      () => {
        setError('Unable to retrieve location.')
        setIsFetchingLocation(false)
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    )
  }

  useEffect(() => {
    setSiteId('')
    setIsAddingSite(false)
    setNewSiteName('')
  }, [projectId])

  const handleCreateSite = async () => {
    if (!newSiteName.trim()) return
    setError('')
    try {
      const res = await addSite({
        projectId,
        name: newSiteName.trim(),
      }).unwrap()
      if (res?.data?.site?._id) {
        setSiteId(res.data.site._id)
      }
      setIsAddingSite(false)
      setNewSiteName('')
    } catch (err) {
      setError(err?.data?.message || err?.message || 'Failed to add site')
    }
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
    if (e) e.preventDefault()
    setError('')
    const validLines = lines.filter((l) => l.categoryId)
    if (!validLines.length) {
      setError('Add at least one skill')
      return
    }
    if (!startDate) {
      setError('Start date is required')
      return
    }
    try {
      await createRequest({
        projectId: projectId && projectId !== 'none' ? projectId : undefined,
        siteId: siteId || undefined,
        scheduleType,
        startDate,
        endDate: endDate || undefined,
        shiftStart,
        shiftEnd,
        locationText: locationText.trim() || undefined,
        locationLat: locationLat || undefined,
        locationLng: locationLng || undefined,
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

  const totalWorkers = lines.reduce((acc, l) => acc + (Number(l.quantity) || 0), 0)

  return (
    <div className="min-h-[100dvh] bg-[#F8F9FC] pb-24 flex flex-col mx-auto w-full max-w-[360px]">
      
        {/* Sticky Header */}
        <div className="sticky top-0 z-50 h-[56px] shrink-0 bg-[#F8F9FC]/90 backdrop-blur-xl flex items-center justify-between px-2">
          <Link to="/corporate/requests" className="p-2 text-slate-900 active:bg-slate-200/50 rounded-full transition-colors flex items-center justify-center">
            <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
          </Link>
          <h1 className="text-[14px] font-bold tracking-tight text-slate-900">New Request</h1>
          <button type="button" onClick={() => alert('Draft saved!')} className="text-[11px] font-bold text-slate-500 active:opacity-70 px-2 py-1.5 hover:text-slate-900 transition-colors">
            Save Draft
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 flex flex-col gap-4 px-3 pt-1 pb-[120px]">
          
          {error && (
            <div className="rounded-[12px] bg-rose-50 px-3 py-2 border border-rose-100">
              <p className="text-[12px] font-bold text-rose-600">{error}</p>
            </div>
          )}

          {/* Hero Header Block */}
          <div className="relative h-[90px] rounded-[16px] overflow-hidden shadow-sm">
            <img src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=800&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover" alt="Construction Workforce" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3">
              <h2 className="text-[20px] font-black tracking-tight text-white leading-none mb-0.5">Workforce Setup</h2>
              <p className="text-[10px] font-medium text-white/80">Configure team requirements</p>
            </div>
          </div>

          {/* Inline Project Selector Widget */}
          <div className="bg-slate-900 rounded-[12px] h-[48px] px-1.5 shadow-sm flex items-center">
             <div className="h-8 w-8 shrink-0 bg-slate-800 rounded-[8px] flex items-center justify-center border border-slate-700/50">
               <Briefcase className="h-4 w-4 text-[#FFC107]" />
             </div>
             <div className="flex-1 ml-2 relative pr-3">
               <select className="w-full bg-transparent text-white text-[13px] font-semibold outline-none appearance-none cursor-pointer" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                 <option value="" disabled hidden className="text-slate-900">Assign to Project...</option>
                 <option value="none" className="text-slate-900">No Project</option>
                 {projects.map(p => <option key={p._id} value={p._id} className="text-slate-900">{p.name}</option>)}
               </select>
               <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none h-4 w-4 text-slate-400" />
             </div>
          </div>

          {/* Site Selector Widget (Always visible, disabled if no project) */}
          <div className={`bg-white border border-slate-200 rounded-[12px] shadow-sm flex flex-col overflow-hidden transition-all duration-300 ${(!projectId || projectId === 'none') ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="h-[48px] px-1.5 flex items-center">
              <div className="h-8 w-8 shrink-0 bg-brand/10 rounded-[8px] flex items-center justify-center">
                <MapPin className="h-4 w-4 text-brand" />
              </div>
              
              {isAddingSite ? (
                <div className="flex-1 ml-2 flex items-center gap-2 pr-1.5">
                  <input 
                    type="text" 
                    placeholder="Enter new site name..." 
                    className="flex-1 bg-transparent text-[13px] font-semibold text-slate-900 outline-none"
                    value={newSiteName}
                    onChange={(e) => setNewSiteName(e.target.value)}
                    autoFocus
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      type="button" 
                      onClick={() => setIsAddingSite(false)} 
                      className="text-[11px] font-bold text-slate-400 hover:text-slate-600 px-2 py-1"
                    >
                      Cancel
                    </button>
                    <button 
                      type="button" 
                      disabled={isAddingSiteMutation || !newSiteName.trim()}
                      onClick={handleCreateSite}
                      className="bg-brand text-brand-foreground text-[11px] font-bold px-3 py-1.5 rounded-[8px] shadow-sm disabled:opacity-50"
                    >
                      {isAddingSiteMutation ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 ml-2 flex items-center pr-3">
                  <div className="flex-1 relative">
                    <select 
                      className="w-full bg-transparent text-slate-900 text-[13px] font-semibold outline-none appearance-none cursor-pointer" 
                      value={siteId} 
                      onChange={(e) => setSiteId(e.target.value)}
                      disabled={isFetchingProject || !projectId || projectId === 'none'}
                    >
                      <option value="" disabled hidden>
                        {(!projectId || projectId === 'none') ? 'Select a project first' : isFetchingProject ? 'Loading sites...' : 'Select a Site...'}
                      </option>
                      {projectSites.map(s => (
                        <option key={s._id} value={s._id}>{s.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none h-4 w-4 text-slate-400" />
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setIsAddingSite(true)}
                    disabled={!projectId || projectId === 'none'}
                    className="shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-slate-50 text-brand border border-slate-200 ml-2 shadow-sm hover:bg-slate-100 transition-colors disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" strokeWidth={3} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Dashboard Block: Skills & Workers */}
          <div>
            <h3 className="text-[11px] font-black text-slate-900 tracking-wider uppercase mb-1.5 flex justify-between">
               Skill Roster
            </h3>
            <div className="space-y-1.5">
              {lines.map((line, idx) => (
                <div key={idx} className="flex flex-col gap-1.5 relative">
                  {lines.length > 1 && (
                    <button type="button" onClick={() => setLines(lines.filter((_, i) => i !== idx))} className="absolute right-0 top-0 h-6 w-6 flex items-center justify-center text-slate-400 hover:text-rose-500 z-10">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                  
                  <div className="relative">
                    <select className="w-full bg-white border border-slate-200 shadow-sm rounded-[12px] h-[44px] px-3 pr-8 text-[13px] font-bold text-slate-900 outline-none appearance-none" value={line.categoryId} onChange={(e) => updateLine(idx, { categoryId: e.target.value })} required={idx === 0}>
                      <option value="" disabled hidden>Select Skill...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none h-4 w-4 text-slate-400" />
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 relative">
                       <select className="w-full bg-white border border-slate-200 shadow-sm rounded-[12px] h-[36px] px-2 pr-6 text-[11px] font-semibold text-slate-700 outline-none appearance-none" value={line.experienceLevel || ''} onChange={(e) => updateLine(idx, { experienceLevel: e.target.value })}>
                          <option value="">Any Experience</option>
                          <option value="entry">0-2 yrs</option>
                          <option value="mid">2-5 yrs</option>
                          <option value="senior">5+ yrs</option>
                       </select>
                       <ChevronDown className="h-3 w-3 text-slate-400 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
                    </div>
                    
                    <div className="flex items-center justify-between bg-white border border-slate-200 shadow-sm rounded-[12px] h-[36px] w-[80px] px-1">
                      <button type="button" onClick={() => updateLine(idx, { quantity: Math.max(1, Number(line.quantity) - 1) })} className="h-7 w-7 flex items-center justify-center text-slate-500 active:bg-slate-50 rounded-md">
                        <Minus className="h-3 w-3" strokeWidth={3} />
                      </button>
                      <span className="text-[13px] font-black text-slate-900">{line.quantity}</span>
                      <button type="button" onClick={() => updateLine(idx, { quantity: Number(line.quantity) + 1 })} className="h-7 w-7 flex items-center justify-center text-slate-500 active:bg-slate-50 rounded-md">
                        <Plus className="h-3 w-3" strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setLines([...lines, emptyLine()])} className="w-full h-[40px] flex items-center justify-center gap-1 rounded-[12px] bg-white border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50 shadow-sm transition-colors mt-1">
                <Plus className="h-3 w-3" strokeWidth={3} /> Add Another Skill
              </button>
            </div>
          </div>

          {/* Timeline Grid: Schedule & Shift */}
          <div>
            <h3 className="text-[11px] font-black text-slate-900 tracking-wider uppercase mb-1.5">Timeline</h3>
            <div className="flex items-center gap-1 mb-2 bg-slate-200/60 p-1 rounded-[10px]">
              {['daily', 'weekly', 'monthly', 'long_term'].map(freq => (
                <button 
                  key={freq} type="button" onClick={() => setScheduleType(freq)}
                  className={`flex-1 py-1.5 text-[9px] font-bold rounded-[8px] transition-all capitalize ${scheduleType === freq ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] text-slate-900 border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {freq.replace('_', ' ')}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="bg-white border border-slate-200 shadow-sm rounded-[12px] p-2">
                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Start Date</label>
                <input type="date" min={new Date().toISOString().split('T')[0]} className="w-full bg-transparent text-[12px] font-semibold text-slate-900 outline-none" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </div>
              <div className="bg-white border border-slate-200 shadow-sm rounded-[12px] p-2">
                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">End Date</label>
                <input type="date" min={startDate || new Date().toISOString().split('T')[0]} className="w-full bg-transparent text-[12px] font-semibold text-slate-900 outline-none" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white border border-slate-200 shadow-sm rounded-[12px] p-2">
                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Shift Start</label>
                <input type="time" className="w-full bg-transparent text-[12px] font-semibold text-slate-900 outline-none" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} />
              </div>
              <div className="bg-white border border-slate-200 shadow-sm rounded-[12px] p-2">
                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Shift End</label>
                <input type="time" className="w-full bg-transparent text-[12px] font-semibold text-slate-900 outline-none" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Location Map Widget */}
          <div>
            <h3 className="text-[11px] font-black text-slate-900 tracking-wider uppercase mb-1.5">Location</h3>
            <div className="bg-white rounded-[16px] shadow-sm border border-slate-200 overflow-hidden flex flex-col">
               <div className="relative h-[65px] bg-slate-100 flex items-center justify-center border-b border-slate-200">
                   <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:12px_12px]" />
                   <div className="h-7 w-7 bg-slate-900 text-[#FFC107] rounded-[8px] flex items-center justify-center shadow-md border-[1.5px] border-white z-10">
                     <MapPin className="h-3.5 w-3.5" strokeWidth={2.5} />
                   </div>
               </div>
               <div className="flex gap-1.5 p-1.5">
                 <div className="flex-1 bg-[#F8F9FC] rounded-[10px] p-2">
                   {isLoaded ? (
                     <Autocomplete onLoad={setAutocomplete} onPlaceChanged={handlePlaceChanged} options={{ componentRestrictions: { country: 'in' }, fields: ['formatted_address'] }}>
                       <input className="w-full bg-transparent text-[11px] font-semibold text-slate-900 outline-none placeholder:text-slate-400" placeholder="Search address..." value={locationText} onChange={(e) => setLocationText(e.target.value)} />
                     </Autocomplete>
                   ) : (
                     <input className="w-full bg-transparent text-[11px] font-semibold text-slate-900 outline-none placeholder:text-slate-400" placeholder="Search address..." value={locationText} onChange={(e) => setLocationText(e.target.value)} />
                   )}
                 </div>
                 <button type="button" onClick={pickLocation} disabled={isFetchingLocation} className="shrink-0 w-[38px] rounded-[10px] bg-slate-900 text-[#FFC107] flex items-center justify-center disabled:opacity-70 active:scale-95 transition-transform">
                    {isFetchingLocation ? <RefreshCw className="h-3.5 w-3.5 animate-spin text-white" /> : <Navigation className="h-3.5 w-3.5 fill-current" />}
                 </button>
               </div>
            </div>
          </div>

          {/* Notes Card */}
          <div>
            <h3 className="text-[11px] font-black text-slate-900 tracking-wider uppercase mb-1.5">Instructions</h3>
            <textarea className="w-full min-h-[70px] bg-white rounded-[16px] p-3 text-[12px] font-medium text-slate-900 outline-none border border-slate-200 resize-none placeholder:text-slate-400 shadow-sm" placeholder="Any special requirements..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {/* Checkout Action Block */}
          <div className="mt-2 w-full flex items-center justify-between rounded-[20px] bg-[#0F172A] p-2 pl-4 shadow-[0_8px_30px_rgba(15,23,42,0.15)] border border-slate-800">
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Total</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                 <span className="text-[20px] font-black text-white leading-none tracking-tight">{totalWorkers}</span>
                 <span className="text-[9px] font-bold text-slate-400">Workers</span>
              </div>
            </div>
            <button type="button" disabled={isLoading} onClick={handleSubmit} className="h-[44px] px-5 flex items-center justify-center gap-1.5 rounded-[14px] bg-[#FFC107] text-[13px] font-black text-slate-900 shadow-[0_4px_12px_rgba(255,193,7,0.2)] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-70">
              {isLoading ? 'Wait...' : 'Request Team'}
            </button>
          </div>

        </div>

    </div>
  )
}
