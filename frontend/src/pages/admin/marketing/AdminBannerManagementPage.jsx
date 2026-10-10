import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Edit2, Trash2, CheckCircle, XCircle, Upload, Loader2 } from 'lucide-react'
import { GlassPanel } from '../../../components/ui/GlassPanel.jsx'
import { apiClient } from '../../../api/http.js'
import { uploadMedia, assetUrlFromUpload } from '../../../api/uploadApi.js'
import { UPLOAD_FOLDERS } from '../../../constants/uploadFolders.js'
import { BANNER_ROLES } from '../../../lib/bannerAction.js'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'

const ROLE_LABEL = Object.fromEntries(BANNER_ROLES.map((r) => [r.value, r.label]))
const inputCls =
  'w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white'
const labelCls = 'block text-xs font-semibold text-slate-600 mb-1'

const defaultFormData = {
  image: '',
  title: '',
  subtitle: '',
  ctaText: '',
  price: '',
  position: 'CAROUSEL',
  priority: 1,
  isActive: true,
  startDate: '',
  endDate: '',
  targetRoles: [], // [] = everyone
  actionType: 'NONE', // NONE | SKILL_BOOKING | SCREEN | URL
  skillId: '',
  quantity: '',
  city: '',
  bookingType: '',
  redirectScreen: '',
  url: '',
}

const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '')

function bannerToForm(b) {
  const skill = b.action?.skillIds?.[0]
  return {
    ...defaultFormData,
    image: b.image || '',
    title: b.title || '',
    subtitle: b.subtitle || '',
    ctaText: b.ctaText || '',
    price: b.price || '',
    position: b.position,
    priority: b.priority,
    isActive: b.isActive,
    startDate: toDateInput(b.startDate),
    endDate: toDateInput(b.endDate),
    targetRoles: b.targetRoles || [],
    actionType: b.action?.type || (b.redirectScreen ? 'SCREEN' : 'NONE'),
    skillId: skill?._id || skill || '',
    quantity: b.action?.presets?.quantity || '',
    city: b.action?.presets?.city || '',
    bookingType: b.action?.presets?.bookingType || '',
    redirectScreen: b.redirectScreen || '',
    url: b.action?.url || '',
  }
}

function formToPayload(f) {
  const action = { type: f.actionType, skillIds: [], presets: {} }
  if (f.actionType === 'SKILL_BOOKING') {
    action.skillIds = f.skillId ? [f.skillId] : []
    if (f.quantity) action.presets.quantity = Number(f.quantity)
    if (f.city.trim()) action.presets.city = f.city.trim()
    if (f.bookingType) action.presets.bookingType = f.bookingType
  }
  if (f.actionType === 'URL') action.url = f.url.trim()
  return {
    image: f.image,
    title: f.title,
    subtitle: f.subtitle,
    ctaText: f.ctaText,
    price: f.price,
    position: f.position,
    priority: f.priority,
    isActive: f.isActive,
    startDate: f.startDate || null,
    endDate: f.endDate || null,
    targetRoles: f.targetRoles,
    redirectScreen: f.actionType === 'SCREEN' ? f.redirectScreen.trim() : '',
    action,
  }
}

export function AdminBannerManagementPage() {
  const [banners, setBanners] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBannerId, setEditingBannerId] = useState(null)
  const [formData, setFormData] = useState(defaultFormData)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const skills = useMemo(
    () => groups.flatMap((g) => (g.categories || []).map((c) => ({ ...c, groupName: g.name }))),
    [groups],
  )
  const set = (patch) => setFormData((f) => ({ ...f, ...patch }))

  const fetchBanners = async () => {
    try {
      const res = await apiClient.get('/admin/marketing/banners')
      setBanners(res.data.data.banners)
    } catch {
      toast.error('Failed to load banners')
    } finally {
      setLoading(false)
    }
  }

  const fetchGroups = async () => {
    try {
      const res = await apiClient.get('/labour-categories/grouped')
      if (res.data.success) setGroups(res.data.data.groups)
    } catch {
      console.error('Failed to load skills')
    }
  }

  useEffect(() => {
    fetchBanners()
    fetchGroups()
  }, [])

  const toggleStatus = async (id, currentStatus) => {
    try {
      const res = await apiClient.patch(`/admin/marketing/banners/${id}`, { isActive: !currentStatus })
      if (res.data.success) {
        toast.success('Status updated')
        fetchBanners()
      }
    } catch {
      toast.error('Failed to update status')
    }
  }

  const deleteBanner = async (id) => {
    if (!window.confirm('Are you sure?')) return
    try {
      const res = await apiClient.delete(`/admin/marketing/banners/${id}`)
      if (res.data.success) {
        toast.success('Banner deleted')
        fetchBanners()
      }
    } catch {
      toast.error('Failed to delete banner')
    }
  }

  const handleImageFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = assetUrlFromUpload(await uploadMedia(file, UPLOAD_FOLDERS.GENERAL_MEDIA))
      if (!url) throw new Error('No URL')
      set({ image: url })
    } catch {
      toast.error('Image upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const toggleRole = (role) =>
    set({
      targetRoles: formData.targetRoles.includes(role)
        ? formData.targetRoles.filter((r) => r !== role)
        : [...formData.targetRoles, role],
    })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.image) return toast.error('Please add a banner image')
    if (formData.actionType === 'SKILL_BOOKING' && !formData.skillId) return toast.error('Select a skill')
    if (formData.actionType === 'SCREEN' && !formData.redirectScreen.trim()) return toast.error('Enter a screen path')
    if (formData.actionType === 'URL' && !formData.url.trim()) return toast.error('Enter a URL')
    if (formData.startDate && formData.endDate && formData.endDate < formData.startDate) {
      return toast.error('End date must be after start date')
    }
    setSaving(true)
    try {
      const payload = formToPayload(formData)
      const res = editingBannerId
        ? await apiClient.patch(`/admin/marketing/banners/${editingBannerId}`, payload)
        : await apiClient.post('/admin/marketing/banners', payload)
      if (res.data.success) {
        toast.success(editingBannerId ? 'Banner updated' : 'Banner created')
        handleCloseModal()
        fetchBanners()
      }
    } catch {
      toast.error(editingBannerId ? 'Failed to update banner' : 'Failed to create banner')
    } finally {
      setSaving(false)
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingBannerId(null)
    setFormData(defaultFormData)
  }

  const actionSummary = (b) => {
    const t = b.action?.type
    if (t === 'SKILL_BOOKING') return `Skill: ${b.action.skillIds?.[0]?.name || '—'}`
    if (t === 'URL') return 'Opens URL'
    if (t === 'SCREEN' || b.redirectScreen) return `Screen: ${b.redirectScreen}`
    return 'No action'
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 relative">
      <div className="flex justify-between items-center max-md:flex-wrap max-md:gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Banner Management</h1>
          <p className="text-sm text-slate-500">
            Offers &amp; promotional banners — choose who sees them and what happens on click
          </p>
        </div>
        <button
          onClick={() => {
            setEditingBannerId(null)
            setFormData(defaultFormData)
            setIsModalOpen(true)
          }}
          className="bg-[#3730A3] text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-[#312E81] transition"
        >
          <Plus className="h-4 w-4" /> New Banner
        </button>
      </div>

      <GlassPanel className="p-0 overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm table-fixed">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-700">Preview</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Audience &amp; Action</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Position</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Views / Clicks</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Status</th>
                <th className="px-6 py-4 font-semibold text-slate-700 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : banners.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-500">No banners found.</td></tr>
              ) : banners.map((banner) => (
                <tr key={banner._id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 max-w-[200px]">
                    <img src={banner.image} alt="" className="h-16 w-32 object-cover rounded shadow-sm border border-slate-200" />
                    {banner.title && <div className="mt-1 text-xs font-semibold text-slate-700 break-all line-clamp-2">{banner.title}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1 max-w-[260px]">
                      {banner.targetRoles?.length ? (
                        banner.targetRoles.map((r) => (
                          <span key={r} className="rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5">
                            {ROLE_LABEL[r] || r}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5">Everyone</span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 break-all line-clamp-2 max-w-[260px]">{actionSummary(banner)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{banner.position}</div>
                    <div className="text-xs text-slate-500">Priority: {banner.priority}</div>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600">
                    {banner.views || 0} / {banner.clicks || 0}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleStatus(banner._id, banner.isActive)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${banner.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                    >
                      {banner.isActive ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      {banner.isActive ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingBannerId(banner._id)
                          setFormData(bannerToForm(banner))
                          setIsModalOpen(true)
                        }}
                        className="p-1.5 text-slate-400 hover:text-[#3730A3] bg-slate-50 rounded-md hover:bg-indigo-50 transition"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteBanner(banner._id)} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 rounded-md hover:bg-red-50 transition">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassPanel>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
            >
              <div className="p-5 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
                <h3 className="font-bold text-lg text-slate-800">{editingBannerId ? 'Edit Banner' : 'New Banner'}</h3>
              </div>
              <form onSubmit={handleSubmit} className="p-5 space-y-5">
                {/* Image */}
                <div>
                  <label className={labelCls}>Banner image *</label>
                  <div className="flex gap-3 items-start">
                    <label className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-slate-300 text-sm text-slate-600 cursor-pointer hover:bg-slate-50 shrink-0">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {uploading ? 'Uploading…' : 'Upload'}
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageFile} disabled={uploading} />
                    </label>
                    <input type="url" value={formData.image} onChange={(e) => set({ image: e.target.value })} className={`${inputCls} break-all`} placeholder="…or paste image URL" />
                  </div>
                  {formData.image && <img src={formData.image} alt="Preview" className="mt-2 h-28 w-full object-cover rounded-lg border border-slate-200" />}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Title</label>
                    <input type="text" value={formData.title} onChange={(e) => set({ title: e.target.value })} className={inputCls} placeholder="e.g. 20% off on AC repair" />
                  </div>
                  <div>
                    <label className={labelCls}>Subtitle</label>
                    <input type="text" value={formData.subtitle} onChange={(e) => set({ subtitle: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Button text (CTA)</label>
                    <input type="text" value={formData.ctaText} onChange={(e) => set({ ctaText: e.target.value })} className={inputCls} placeholder="e.g. Book now" />
                  </div>
                  <div>
                    <label className={labelCls}>Price text</label>
                    <input type="text" value={formData.price} onChange={(e) => set({ price: e.target.value })} className={inputCls} placeholder="e.g. ₹99/hr" />
                  </div>
                </div>

                {/* Audience */}
                <div>
                  <label className={labelCls}>Who should see this banner?</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => set({ targetRoles: [] })}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border ${formData.targetRoles.length === 0 ? 'bg-[#3730A3] text-white border-[#3730A3]' : 'bg-white text-slate-600 border-slate-200'}`}
                    >
                      Everyone
                    </button>
                    {BANNER_ROLES.map((r) => {
                      const on = formData.targetRoles.includes(r.value)
                      return (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => toggleRole(r.value)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border ${on ? 'bg-[#3730A3] text-white border-[#3730A3]' : 'bg-white text-slate-600 border-slate-200'}`}
                        >
                          {r.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Click action */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/60">
                  <label className={labelCls}>On click</label>
                  <select value={formData.actionType} onChange={(e) => set({ actionType: e.target.value })} className={inputCls}>
                    <option value="NONE">Do nothing</option>
                    <option value="SKILL_BOOKING">Open booking / hiring for a skill</option>
                    <option value="SCREEN">Open an app screen</option>
                    <option value="URL">Open a URL</option>
                  </select>

                  {formData.actionType === 'SKILL_BOOKING' && (
                    <div className="space-y-3">
                      <div>
                        <label className={labelCls}>Skill *</label>
                        <select value={formData.skillId} onChange={(e) => set({ skillId: e.target.value })} className={inputCls}>
                          <option value="">Select skill…</option>
                          {groups.map((g) => (
                            <optgroup key={g._id} label={g.name}>
                              {(g.categories || []).map((c) => (
                                <option key={c._id} value={c._id}>{c.name}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <p className="mt-1 text-[11px] text-slate-500">
                          User → booking flow, Corporate → new request, Enterprise → new job, with this skill pre-selected.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className={labelCls}>Workers (preset)</label>
                          <input type="number" min="1" value={formData.quantity} onChange={(e) => set({ quantity: e.target.value })} className={inputCls} placeholder="Optional" />
                        </div>
                        <div>
                          <label className={labelCls}>City (preset)</label>
                          <input type="text" value={formData.city} onChange={(e) => set({ city: e.target.value })} className={inputCls} placeholder="Optional" />
                        </div>
                        <div>
                          <label className={labelCls}>Booking type (User)</label>
                          <select value={formData.bookingType} onChange={(e) => set({ bookingType: e.target.value })} className={inputCls}>
                            <option value="">Let user choose</option>
                            <option value="instant">Instant</option>
                            <option value="scheduled">Scheduled</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.actionType === 'SCREEN' && (
                    <div>
                      <label className={labelCls}>Screen path *</label>
                      <input type="text" value={formData.redirectScreen} onChange={(e) => set({ redirectScreen: e.target.value })} className={inputCls} placeholder="e.g. /app/bookings or /corporate/wallet" />
                    </div>
                  )}
                  {formData.actionType === 'URL' && (
                    <div>
                      <label className={labelCls}>URL *</label>
                      <input type="text" value={formData.url} onChange={(e) => set({ url: e.target.value })} className={inputCls} placeholder="https://…" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className={labelCls}>Position</label>
                    <select value={formData.position} onChange={(e) => set({ position: e.target.value })} className={inputCls}>
                      <option value="CAROUSEL">Carousel</option>
                      <option value="TOP">Top</option>
                      <option value="MIDDLE">Middle</option>
                      <option value="BOTTOM">Bottom</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Priority</label>
                    <input type="number" min="1" value={formData.priority} onChange={(e) => set({ priority: Number(e.target.value) })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Start date</label>
                    <input type="date" value={formData.startDate} onChange={(e) => set({ startDate: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>End date</label>
                    <input type="date" value={formData.endDate} onChange={(e) => set({ endDate: e.target.value })} className={inputCls} />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button type="button" onClick={handleCloseModal} className="px-4 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
                  <button type="submit" disabled={saving || uploading} className="bg-[#3730A3] text-white px-5 py-2 rounded-lg font-medium hover:bg-[#312E81] shadow-sm disabled:opacity-60">
                    {saving ? 'Saving…' : editingBannerId ? 'Update Banner' : 'Save Banner'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
