import React, { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react'
import { GlassPanel } from '../../../components/ui/GlassPanel.jsx'
import { apiClient } from '../../../api/http.js'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'

export function AdminSponsoredAdsPage() {
  const [ads, setAds] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAdId, setEditingAdId] = useState(null)
  const [formData, setFormData] = useState({
    companyName: '',
    description: '',
    banner: '',
    redirectUrl: '',
    totalBudget: 1000,
    isActive: true,
  })
  const [uploadingImage, setUploadingImage] = useState(false)

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const uploadFormData = new FormData()
    uploadFormData.append('file', file)

    setUploadingImage(true)
    try {
      const res = await apiClient.post('/uploads/media?folder=general-media', uploadFormData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      if (res.data?.success) {
        setFormData(prev => ({ ...prev, banner: res.data.data.asset.url }))
        toast.success('Image uploaded successfully')
      } else {
        toast.error('Failed to upload image')
      }
    } catch (error) {
      toast.error('Error uploading image')
    } finally {
      setUploadingImage(false)
    }
  }

  const fetchAds = async () => {
    try {
      const res = await apiClient.get('/admin/marketing/ads')
      setAds(res.data.data.ads)
    } catch (e) {
      toast.error('Failed to load ads')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAds()
  }, [])

  const toggleStatus = async (id, currentStatus) => {
    try {
      const res = await apiClient.patch(`/admin/marketing/ads/${id}`, { isActive: !currentStatus })
      if (res.data.success) {
        toast.success('Status updated')
        fetchAds()
      }
    } catch (e) {
      toast.error('Failed to update status')
    }
  }

  const deleteAd = async (id) => {
    if (!window.confirm('Are you sure?')) return
    try {
      const res = await apiClient.delete(`/admin/marketing/ads/${id}`)
      if (res.data.success) {
        toast.success('Ad deleted')
        fetchAds()
      }
    } catch (e) {
      toast.error('Failed to delete ad')
    }
  }

  const handleEditClick = (ad) => {
    setFormData({
      companyName: ad.companyName,
      description: ad.description,
      banner: ad.banner,
      redirectUrl: ad.redirectUrl,
      totalBudget: ad.totalBudget,
      isActive: ad.isActive,
    })
    setEditingAdId(ad._id)
    setIsModalOpen(true)
  }

  const handleAddSubmit = async (e) => {
    e.preventDefault()
    if (!formData.banner) {
      toast.error('Please upload an image or provide a valid banner URL.')
      return
    }
    try {
      const res = editingAdId
        ? await apiClient.patch(`/admin/marketing/ads/${editingAdId}`, formData)
        : await apiClient.post('/admin/marketing/ads', formData)

      if (res.data.success) {
        toast.success(editingAdId ? 'Ad updated successfully!' : 'Ad created successfully!')
        setIsModalOpen(false)
        setEditingAdId(null)
        setFormData({ companyName: '', description: '', banner: '', redirectUrl: '', totalBudget: 1000, isActive: true })
        fetchAds()
      }
    } catch (e) {
      toast.error(editingAdId ? 'Failed to update ad' : 'Failed to create ad')
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 relative">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sponsored Ads</h1>
          <p className="text-sm text-slate-500">Manage advertisements shown inside the User App</p>
        </div>
        <button 
          onClick={() => {
            setEditingAdId(null)
            setFormData({ companyName: '', description: '', banner: '', redirectUrl: '', totalBudget: 1000, isActive: true })
            setIsModalOpen(true)
          }}
          className="bg-[#3730A3] text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-[#312E81] transition"
        >
          <Plus className="h-4 w-4" /> Add Advertisement
        </button>
      </div>

      <GlassPanel className="p-0 overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-700">Company Name</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Budget / Clicks</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Status</th>
                <th className="px-6 py-4 font-semibold text-slate-700 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : ads.length === 0 ? (
                <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-500">No sponsored ads found.</td></tr>
              ) : ads.map(ad => (
                <tr key={ad._id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 flex gap-3 items-center">
                    {ad.banner && <img src={ad.banner} alt="ad" className="w-12 h-12 rounded object-cover" />}
                    <div>
                      <div className="font-bold text-slate-900">{ad.companyName}</div>
                      <div className="text-xs text-slate-500 truncate max-w-xs">{ad.description}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-xs">
                    <div>Budget: ₹{ad.totalBudget}</div>
                    <div>Clicks: {ad.clicks} / Impr: {ad.impressions}</div>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => toggleStatus(ad._id, ad.isActive)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${ad.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                    >
                      {ad.isActive ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      {ad.isActive ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleEditClick(ad)} className="p-1.5 text-slate-400 hover:text-[#3730A3] bg-slate-50 rounded-md hover:bg-indigo-50 transition">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteAd(ad._id)} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 rounded-md hover:bg-red-50 transition">
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
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-lg text-slate-800">{editingAdId ? 'Edit Sponsored Ad' : 'Add Sponsored Ad'}</h3>
              </div>
              <form onSubmit={handleAddSubmit} className="flex flex-col">
                <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto scrollbar-thin">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Company Name</label>
                    <input type="text" required value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Acme Plumbing" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                    <textarea required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ad description..." rows={2} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-2">Banner Image</label>
                    {formData.banner ? (
                      <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-white group h-40 flex items-center justify-center">
                        <div className="absolute inset-0 bg-slate-100/50 pattern-grid-lg text-slate-200/50" />
                        <img src={formData.banner} alt="Banner Preview" className="max-w-full max-h-full object-contain relative z-10 p-2" />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm z-20">
                          <button type="button" onClick={() => setFormData({ ...formData, banner: '' })} className="bg-white text-rose-600 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm hover:bg-rose-50 transition">Remove Image</button>
                        </div>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center bg-slate-50 hover:bg-slate-100/50 transition relative">
                        {uploadingImage ? (
                          <div className="py-4 flex flex-col items-center">
                            <div className="h-6 w-6 border-2 border-[#3730A3] border-t-transparent rounded-full animate-spin mb-2"></div>
                            <p className="text-xs text-slate-500 font-medium">Uploading image...</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex justify-center">
                              <div className="h-10 w-10 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              </div>
                            </div>
                            <div>
                              <label className="cursor-pointer font-semibold text-[#3730A3] hover:text-[#312E81] text-sm">
                                Upload a file
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                              </label>
                              <p className="text-xs text-slate-500 mt-1">PNG, JPG, WEBP up to 8MB</p>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2">
                              <div className="h-px bg-slate-200 flex-1"></div>
                              <span className="text-[10px] uppercase font-bold text-slate-400">OR PASTE URL</span>
                              <div className="h-px bg-slate-200 flex-1"></div>
                            </div>
                            <input type="url" required value={formData.banner} onChange={e => setFormData({...formData, banner: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-center" placeholder="https://example.com/banner.png" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Redirect URL</label>
                      <input type="url" required value={formData.redirectUrl} onChange={e => setFormData({...formData, redirectUrl: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="https://..." />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Total Budget (₹)</label>
                      <input type="number" min="0" value={formData.totalBudget} onChange={e => setFormData({...formData, totalBudget: Number(e.target.value)})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                  </div>
                </div>
                <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/80 rounded-b-2xl">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-100 transition">Cancel</button>
                  <button type="submit" className="bg-[#3730A3] text-white px-5 py-2 rounded-lg font-medium hover:bg-[#312E81] shadow-sm transition">{editingAdId ? 'Update Ad' : 'Save Ad'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
