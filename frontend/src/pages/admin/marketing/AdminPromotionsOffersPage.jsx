import React, { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react'
import { GlassPanel } from '../../../components/ui/GlassPanel.jsx'
import { apiClient } from '../../../api/http.js'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'

export function AdminPromotionsOffersPage() {
  const [offers, setOffers] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image: '',
    ctaText: 'Claim Now',
    priority: 1,
    isActive: true,
    discountPercentage: 0,
    maxUsageLimit: 0,
    categories: []
  })
  const [editingOfferId, setEditingOfferId] = useState(null)
  const [categories, setCategories] = useState([])
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
        setFormData(prev => ({ ...prev, image: res.data.data.asset.url }))
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

  const fetchOffersAndCategories = async () => {
    try {
      const [res, catRes] = await Promise.all([
        apiClient.get('/admin/marketing/offers'),
        apiClient.get('/labour-categories/grouped')
      ])
      setOffers(res.data.data.offers)
      
      const allCats = []
      if (catRes.data?.data?.groups) {
        catRes.data.data.groups.forEach(group => {
          if (group.categories && Array.isArray(group.categories)) {
            allCats.push(...group.categories)
          }
        })
      }
      setCategories(allCats)
    } catch (e) {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOffersAndCategories()
  }, [])

  const toggleStatus = async (id, currentStatus) => {
    try {
      const res = await apiClient.patch(`/admin/marketing/offers/${id}`, { isActive: !currentStatus })
      if (res.data.success) {
        toast.success('Status updated')
        fetchOffers()
      }
    } catch (e) {
      toast.error('Failed to update status')
    }
  }

  const deleteOffer = async (id) => {
    if (!window.confirm('Are you sure?')) return
    try {
      const res = await apiClient.delete(`/admin/marketing/offers/${id}`)
      if (res.data.success) {
        toast.success('Offer deleted')
        fetchOffersAndCategories()
      }
    } catch (e) {
      toast.error('Failed to delete offer')
    }
  }

  const handleEditClick = (offer) => {
    setFormData({
      title: offer.title,
      description: offer.description,
      image: offer.image,
      ctaText: offer.ctaText || '',
      priority: offer.priority,
      isActive: offer.isActive,
      discountPercentage: offer.discountPercentage || 0,
      maxUsageLimit: offer.maxUsageLimit || 0,
      categories: offer.categories || []
    })
    setEditingOfferId(offer._id)
    setIsModalOpen(true)
  }

  const handleAddSubmit = async (e) => {
    e.preventDefault()
    if (!formData.image) {
      toast.error('Please upload an image or provide a valid image URL.')
      return
    }
    try {
      const res = editingOfferId 
        ? await apiClient.patch(`/admin/marketing/offers/${editingOfferId}`, formData)
        : await apiClient.post('/admin/marketing/offers', formData)
        
      if (res.data.success) {
        toast.success(editingOfferId ? 'Offer updated successfully!' : 'Offer created successfully!')
        setIsModalOpen(false)
        setEditingOfferId(null)
        setFormData({ title: '', description: '', image: '', ctaText: 'Claim Now', priority: 1, isActive: true, discountPercentage: 0, maxUsageLimit: 0, categories: [] })
        fetchOffersAndCategories()
      }
    } catch (e) {
      toast.error(editingOfferId ? 'Failed to update offer' : 'Failed to create offer')
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 relative">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Promotions & Offers</h1>
          <p className="text-sm text-slate-500">Manage promotional offers shown on the User Home Page</p>
        </div>
        <button 
          onClick={() => {
            setEditingOfferId(null)
            setFormData({ title: '', description: '', image: '', ctaText: 'Claim Now', priority: 1, isActive: true, discountPercentage: 0, maxUsageLimit: 0, categories: [] })
            setIsModalOpen(true)
          }}
          className="bg-[#3730A3] text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-[#312E81] transition"
        >
          <Plus className="h-4 w-4" /> Add Offer
        </button>
      </div>

      <GlassPanel className="p-0 overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-700">Offer Title</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Priority</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Discount & Usage</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Dates</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Status</th>
                <th className="px-6 py-4 font-semibold text-slate-700 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : offers.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">No offers found. Create one!</td></tr>
              ) : offers.map(offer => (
                <tr key={offer._id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 flex gap-3 items-center">
                    {offer.image && <img src={offer.image} alt="offer" className="w-12 h-12 rounded object-cover" />}
                    <div>
                      <div className="font-bold text-slate-900">{offer.title}</div>
                      <div className="text-xs text-slate-500 truncate max-w-xs">{offer.description}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-700">{offer.priority}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {offer.discountPercentage > 0 ? (
                      <div>
                        <span className="font-bold text-emerald-600">{offer.discountPercentage}% Off</span>
                        <div className="text-xs text-slate-500 mt-1">
                          Limit: {offer.maxUsageLimit === 0 ? 'Unlimited' : `${offer.currentUsageCount || 0} / ${offer.maxUsageLimit}`}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">No Discount</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-xs">
                    <div>Start: {offer.startDate ? new Date(offer.startDate).toLocaleDateString() : 'N/A'}</div>
                    <div>End: {offer.endDate ? new Date(offer.endDate).toLocaleDateString() : 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => toggleStatus(offer._id, offer.isActive)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${offer.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                    >
                      {offer.isActive ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      {offer.isActive ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleEditClick(offer)} className="p-1.5 text-slate-400 hover:text-[#3730A3] bg-slate-50 rounded-md hover:bg-indigo-50 transition">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteOffer(offer._id)} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 rounded-md hover:bg-red-50 transition">
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
                <h3 className="font-bold text-lg text-slate-800">{editingOfferId ? 'Edit Offer' : 'Add New Offer'}</h3>
              </div>
              <form onSubmit={handleAddSubmit} className="flex flex-col">
                <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto scrollbar-thin">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Offer Title</label>
                    <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. 50% Off Plumbers" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                    <textarea required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Short description of the offer..." rows={2} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-2">Offer Image</label>
                    {formData.image ? (
                      <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-white group h-40 flex items-center justify-center">
                        <div className="absolute inset-0 bg-slate-100/50 pattern-grid-lg text-slate-200/50" />
                        <img src={formData.image} alt="Offer Preview" className="max-w-full max-h-full object-contain relative z-10 p-2" />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm z-20">
                          <button type="button" onClick={() => setFormData({ ...formData, image: '' })} className="bg-white text-rose-600 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm hover:bg-rose-50 transition">Remove Image</button>
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
                            <input type="url" required value={formData.image} onChange={e => setFormData({...formData, image: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-center" placeholder="https://example.com/image.png" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Target Category</label>
                      <select value={formData.categories[0] || ''} onChange={e => setFormData({...formData, categories: e.target.value ? [e.target.value] : []})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                        <option value="">All Categories</option>
                        {categories.map(cat => (
                          <option key={cat._id} value={cat._id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Platform Fee Discount (%)</label>
                      <input type="number" min="0" max="100" value={formData.discountPercentage} onChange={e => setFormData({...formData, discountPercentage: Number(e.target.value)})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. 50" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Max Usage Limit (0 = Unlimited)</label>
                      <input type="number" min="0" value={formData.maxUsageLimit} onChange={e => setFormData({...formData, maxUsageLimit: Number(e.target.value)})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. 100" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">CTA Text</label>
                      <input type="text" value={formData.ctaText} onChange={e => setFormData({...formData, ctaText: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Claim Now" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Priority (1 = Highest)</label>
                      <input type="number" min="1" value={formData.priority} onChange={e => setFormData({...formData, priority: Number(e.target.value)})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                  </div>
                </div>
                <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/80 rounded-b-2xl">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-100 transition">Cancel</button>
                  <button type="submit" className="bg-[#3730A3] text-white px-5 py-2 rounded-lg font-medium hover:bg-[#312E81] shadow-sm transition">{editingOfferId ? 'Update Offer' : 'Save Offer'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
