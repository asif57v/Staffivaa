import React, { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react'
import { GlassPanel } from '../../../components/ui/GlassPanel.jsx'
import { apiClient } from '../../../api/http.js'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'

export function AdminBannerManagementPage() {
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    image: '',
    position: 'CAROUSEL',
    redirectScreen: '',
    priority: 1,
    isActive: true,
  })

  const fetchBanners = async () => {
    try {
      const res = await apiClient.get('/admin/marketing/banners')
      setBanners(res.data.data.banners)
    } catch (e) {
      toast.error('Failed to load banners')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBanners()
  }, [])

  const toggleStatus = async (id, currentStatus) => {
    try {
      const res = await apiClient.patch(`/admin/marketing/banners/${id}`, { isActive: !currentStatus })
      if (res.data.success) {
        toast.success('Status updated')
        fetchBanners()
      }
    } catch (e) {
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
    } catch (e) {
      toast.error('Failed to delete banner')
    }
  }

  const handleAddSubmit = async (e) => {
    e.preventDefault()
    try {
      const res = await apiClient.post('/admin/marketing/banners', formData)
      if (res.data.success) {
        toast.success('Banner uploaded successfully!')
        setIsModalOpen(false)
        setFormData({ image: '', position: 'CAROUSEL', redirectScreen: '', priority: 1, isActive: true })
        fetchBanners()
      }
    } catch (e) {
      toast.error('Failed to upload banner')
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 relative">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Banner Management</h1>
          <p className="text-sm text-slate-500">Control homepage banners (Top, Middle, Bottom, Carousel)</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-[#3730A3] text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-[#312E81] transition"
        >
          <Plus className="h-4 w-4" /> Upload Banner
        </button>
      </div>

      <GlassPanel className="p-0 overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-700">Preview</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Position & Priority</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Status</th>
                <th className="px-6 py-4 font-semibold text-slate-700 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : banners.length === 0 ? (
                <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-500">No banners found.</td></tr>
              ) : banners.map(banner => (
                <tr key={banner._id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4">
                    <img src={banner.image} alt="Banner" className="h-16 w-32 object-cover rounded shadow-sm border border-slate-200" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{banner.position}</div>
                    <div className="text-xs text-slate-500">Priority: {banner.priority}</div>
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
                      <button className="p-1.5 text-slate-400 hover:text-[#3730A3] bg-slate-50 rounded-md hover:bg-indigo-50 transition">
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
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-lg text-slate-800">Upload Banner</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAddSubmit} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Image URL</label>
                  <input type="url" required value={formData.image} onChange={e => setFormData({...formData, image: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Redirect Screen (Optional)</label>
                  <input type="text" value={formData.redirectScreen} onChange={e => setFormData({...formData, redirectScreen: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. /app/work-categories" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Position</label>
                    <select value={formData.position} onChange={e => setFormData({...formData, position: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                      <option value="CAROUSEL">Carousel</option>
                      <option value="TOP">Top</option>
                      <option value="MIDDLE">Middle</option>
                      <option value="BOTTOM">Bottom</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Priority</label>
                    <input type="number" min="1" value={formData.priority} onChange={e => setFormData({...formData, priority: Number(e.target.value)})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                </div>
                <div className="pt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
                  <button type="submit" className="bg-[#3730A3] text-white px-5 py-2 rounded-lg font-medium hover:bg-[#312E81] shadow-sm">Save Banner</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
