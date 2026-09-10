import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Star,
  Zap,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Search,
  LayoutGrid,
  List,
  Eye,
  Tag,
  RefreshCw,
} from 'lucide-react'
import { GlassPanel } from '../../../components/ui/GlassPanel.jsx'
import { apiClient } from '../../../api/http.js'
import { uploadDocument, assetUrlFromUpload } from '../../../api/uploadApi.js'
import { UPLOAD_FOLDERS } from '../../../constants/uploadFolders.js'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'

export function AdminPopularServicesPage() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingServiceId, setEditingServiceId] = useState(null)
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'table'
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL') // 'ALL' | 'ACTIVE' | 'DISABLED'
  const fileInputRef = useRef(null)

  const defaultFormData = {
    title: '',
    image: '',
    rating: '4.8',
    reviews: '10k',
    price: '',
    originalPrice: '',
    discount: '20% OFF',
    isInstant: true,
    priority: 1,
    isActive: true,
  }

  const [formData, setFormData] = useState(defaultFormData)

  const fetchServices = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true)
      else setLoading(true)
      const res = await apiClient.get('/admin/marketing/popular-services')
      if (res.data.success) {
        setServices(res.data.data.services || [])
      }
    } catch (e) {
      toast.error('Failed to load popular services')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchServices()
  }, [])

  // Auto-calculate discount percentage when price and originalPrice change
  const handlePriceChange = (newPrice, newOrigPrice) => {
    const p = Number(newPrice)
    const op = Number(newOrigPrice)
    let autoDisc = formData.discount
    if (p > 0 && op > p) {
      const pct = Math.round(((op - p) / op) * 100)
      if (pct > 0) autoDisc = `${pct}% OFF`
    }
    setFormData((prev) => ({
      ...prev,
      price: newPrice,
      originalPrice: newOrigPrice,
      discount: autoDisc,
    }))
  }

  const handleImageFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    try {
      const uploaded = await uploadDocument(file, UPLOAD_FOLDERS.KYC_DOCUMENTS)
      const remoteUrl = assetUrlFromUpload(uploaded)
      if (remoteUrl) {
        setFormData((prev) => ({ ...prev, image: remoteUrl }))
        toast.success('Image uploaded successfully')
      } else {
        throw new Error('Upload returned invalid URL')
      }
    } catch (err) {
      toast.error('Failed to upload image')
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const toggleStatus = async (id, currentStatus) => {
    try {
      const res = await apiClient.patch(`/admin/marketing/popular-services/${id}`, { isActive: !currentStatus })
      if (res.data.success) {
        toast.success('Status updated')
        fetchServices()
      }
    } catch (e) {
      toast.error('Failed to update status')
    }
  }

  const deleteService = async (id) => {
    if (!window.confirm('Are you sure you want to delete this popular service card?')) return
    try {
      const res = await apiClient.delete(`/admin/marketing/popular-services/${id}`)
      if (res.data.success) {
        toast.success('Service deleted')
        fetchServices()
      }
    } catch (e) {
      toast.error('Failed to delete service')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.title || !formData.image || !formData.price) {
      toast.error('Title, Image, and Price are required.')
      return
    }

    try {
      const payload = {
        ...formData,
        price: Number(formData.price),
        originalPrice: formData.originalPrice ? Number(formData.originalPrice) : undefined,
        priority: Number(formData.priority) || 0,
      }

      if (editingServiceId) {
        const res = await apiClient.patch(`/admin/marketing/popular-services/${editingServiceId}`, payload)
        if (res.data.success) {
          toast.success('Popular service updated successfully!')
          handleCloseModal()
          fetchServices()
        }
      } else {
        const res = await apiClient.post('/admin/marketing/popular-services', payload)
        if (res.data.success) {
          toast.success('Popular service created successfully!')
          handleCloseModal()
          fetchServices()
        }
      }
    } catch (e) {
      toast.error(editingServiceId ? 'Failed to update service' : 'Failed to create service')
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingServiceId(null)
    setFormData(defaultFormData)
  }

  const handleEdit = (service) => {
    setEditingServiceId(service._id)
    setFormData({
      title: service.title || '',
      image: service.image || '',
      rating: service.rating || '4.8',
      reviews: service.reviews || '10k',
      price: service.price || '',
      originalPrice: service.originalPrice || '',
      discount: service.discount || '',
      isInstant: Boolean(service.isInstant),
      priority: service.priority ?? 1,
      isActive: Boolean(service.isActive),
    })
    setIsModalOpen(true)
  }

  // Filtered services
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchesSearch = !searchQuery.trim() || s.title?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'ACTIVE'
          ? Boolean(s.isActive)
          : !s.isActive
      return matchesSearch && matchesStatus
    })
  }, [services, searchQuery, statusFilter])

  // KPIs
  const totalCount = services.length
  const activeCount = services.filter((s) => s.isActive).length
  const instantCount = services.filter((s) => s.isInstant).length
  const avgPrice =
    totalCount > 0 ? Math.round(services.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0) / totalCount) : 0

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Popular Services</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/70 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Homepage Cards
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage the "Popular Services" carousel cards, photos, pricing, discount badges, and instant tags shown on the User app
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchServices(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition shadow-sm disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-brand' : 'text-slate-500'}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingServiceId(null)
              setFormData(defaultFormData)
              setIsModalOpen(true)
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-xs bg-brand text-white hover:bg-brand-dark transition shadow-sm shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Add Popular Service</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <GlassPanel className="p-4 bg-white border border-slate-200/80 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Cards</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{totalCount}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700">
            <Sparkles className="w-5 h-5" />
          </div>
        </GlassPanel>

        <GlassPanel className="p-4 bg-white border border-emerald-100/80 bg-linear-to-br from-emerald-50/40 to-white flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Active on App</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{activeCount}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700">
            <CheckCircle className="w-5 h-5" />
          </div>
        </GlassPanel>

        <GlassPanel className="p-4 bg-white border border-sky-100/80 bg-linear-to-br from-sky-50/40 to-white flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700">Instant Booking</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{instantCount}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-sky-100 text-sky-700">
            <Zap className="w-5 h-5" />
          </div>
        </GlassPanel>

        <GlassPanel className="p-4 bg-white border border-amber-100/80 bg-linear-to-br from-amber-50/40 to-white flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Average Price</p>
            <p className="text-2xl font-black text-slate-900 mt-1 font-mono">₹{avgPrice}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700">
            <Tag className="w-5 h-5" />
          </div>
        </GlassPanel>
      </div>

      {/* Filter and View Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search services by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50/70 focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>

          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-bold">
            {['ALL', 'ACTIVE', 'DISABLED'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg transition text-[11px] ${
                  statusFilter === st ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'All' : st === 'ACTIVE' ? 'Active' : 'Disabled'}
              </button>
            ))}
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'grid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Table List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Card Grid View or Table View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {loading ? (
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
            ))
          ) : filteredServices.length === 0 ? (
            <div className="col-span-full p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
              No popular service cards match your filter.
            </div>
          ) : (
            filteredServices.map((service) => (
              <div
                key={service._id}
                className={`group flex flex-col overflow-hidden rounded-2xl bg-white border transition-all duration-200 hover:shadow-md ${
                  service.isActive
                    ? 'border-slate-200/90 shadow-xs'
                    : 'border-slate-200/50 opacity-60 bg-slate-50/50'
                }`}
              >
                {/* Image Container with full image contain */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-50 flex items-center justify-center p-3 border-b border-slate-100">
                  <img
                    src={service.image}
                    alt={service.title}
                    className="max-h-full max-w-full w-auto h-auto object-contain transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.src = '/service_ac.png'
                    }}
                  />
                  {service.discount && (
                    <div className="absolute left-2.5 top-2.5 rounded-lg bg-[#059669] px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                      {service.discount}
                    </div>
                  )}
                  <div className="absolute right-2.5 top-2.5">
                    <button
                      type="button"
                      onClick={() => toggleStatus(service._id, service.isActive)}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-xs transition ${
                        service.isActive
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-slate-700 text-white hover:bg-slate-800'
                      }`}
                    >
                      {service.isActive ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col p-4 justify-between">
                  <div>
                    <h3 className="line-clamp-2 text-sm font-bold text-slate-900 group-hover:text-brand transition min-h-[38px]">
                      {service.title}
                    </h3>

                    <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <span className="flex items-center gap-0.5 text-amber-600 font-bold">
                        <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                        {service.rating || '4.8'}
                      </span>
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      {service.isInstant ? (
                        <span className="flex items-center gap-0.5 text-emerald-600 font-bold">
                          <Zap className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500" />
                          Instant
                        </span>
                      ) : (
                        <span className="text-slate-500">{service.reviews || '10k'}</span>
                      )}
                    </div>

                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-lg font-black text-slate-900 font-mono">₹{service.price}</span>
                      {service.originalPrice && (
                        <span className="text-xs font-medium text-slate-400 line-through font-mono">
                          ₹{service.originalPrice}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-slate-400">
                      Priority: <strong className="text-slate-700">{service.priority ?? 0}</strong>
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleEdit(service)}
                        className="p-2 rounded-xl text-slate-600 hover:text-brand hover:bg-slate-100 transition"
                        title="Edit Card"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteService(service._id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Delete Card"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Table List View */
        <GlassPanel className="p-0 overflow-hidden bg-white border border-slate-200/80 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5">Preview</th>
                  <th className="p-3.5">Service Details</th>
                  <th className="p-3.5 text-right">Price</th>
                  <th className="p-3.5">Rating & Tag</th>
                  <th className="p-3.5 text-center">Priority</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredServices.length > 0 ? (
                  filteredServices.map((service) => (
                    <tr key={service._id} className="hover:bg-slate-50/60 transition">
                      <td className="p-3.5">
                        <div className="h-12 w-16 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center p-1 overflow-hidden">
                          <img
                            src={service.image}
                            alt=""
                            className="max-h-full max-w-full object-contain"
                            onError={(e) => {
                              e.currentTarget.src = '/service_ac.png'
                            }}
                          />
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 text-sm">{service.title}</div>
                        {service.discount && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            {service.discount}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right font-mono">
                        <div className="font-black text-slate-900">₹{service.price}</div>
                        {service.originalPrice && (
                          <div className="text-[11px] text-slate-400 line-through">₹{service.originalPrice}</div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-1 text-slate-700 font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{service.rating || '4.8'}</span>
                          <span className="text-slate-400 font-normal">({service.reviews || '10k'})</span>
                        </div>
                        {service.isInstant && (
                          <span className="inline-flex items-center gap-0.5 text-emerald-600 text-[10px] font-bold mt-0.5">
                            <Zap className="w-3 h-3 fill-emerald-600" /> Instant
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-center font-bold text-slate-700 font-mono">
                        {service.priority ?? 0}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => toggleStatus(service._id, service.isActive)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            service.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {service.isActive ? 'Active' : 'Disabled'}
                        </button>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEdit(service)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-brand hover:bg-slate-100 transition"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteService(service._id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No popular services found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassPanel>
      )}

      {/* Modal Dialog with Live Card Preview */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {editingServiceId ? 'Edit Popular Service Card' : 'Add New Popular Service'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Customize card image, pricing, discount, and instant tags</p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Form fields (2 cols) */}
                <form onSubmit={handleSubmit} className="md:col-span-2 space-y-4 text-xs">
                  {/* Image Upload / URL */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">Card Image *</label>

                    {formData.image ? (
                      <div className="relative h-44 w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-50 mb-2 flex items-center justify-center p-2">
                        <img src={formData.image} alt="Preview" className="max-h-full max-w-full object-contain" />
                        <button
                          type="button"
                          onClick={() => setFormData((p) => ({ ...p, image: '' }))}
                          className="absolute top-2 right-2 bg-slate-900/80 hover:bg-rose-600 text-white px-2 py-1 rounded-lg text-[11px] font-bold transition"
                        >
                          Change Image
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-300 rounded-xl p-5 text-center cursor-pointer hover:border-brand hover:bg-brand/5 transition"
                      >
                        <ImageIcon className="w-7 h-7 text-slate-400 mx-auto mb-1.5" />
                        <p className="font-bold text-slate-700 text-xs">Click to upload photo from device</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, WebP (Image contain)</p>
                      </div>
                    )}

                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageFileSelect}
                      accept="image/*"
                      className="hidden"
                    />

                    {uploadingImage && (
                      <p className="text-xs text-brand font-bold mt-1.5 flex items-center gap-1">
                        <Upload className="w-3.5 h-3.5 animate-bounce" /> Uploading image to storage...
                      </p>
                    )}

                    <div className="mt-2">
                      <span className="text-[11px] text-slate-400">Or paste image URL / path:</span>
                      <input
                        type="text"
                        placeholder="https://... or /service_ac.png"
                        value={formData.image}
                        onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                        className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand/30"
                      />
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Service Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. AC repair & service"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand/30 font-medium"
                    />
                  </div>

                  {/* Price & Original Price with auto-discount */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Offer Price (₹) *</label>
                      <input
                        type="number"
                        required
                        min="0"
                        placeholder="299"
                        value={formData.price}
                        onChange={(e) => handlePriceChange(e.target.value, formData.originalPrice)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand/30 font-bold font-mono text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Original Price (₹)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="499"
                        value={formData.originalPrice}
                        onChange={(e) => handlePriceChange(formData.price, e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand/30 font-mono text-slate-600"
                      />
                    </div>
                  </div>

                  {/* Discount & Rating */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Discount Tag</label>
                      <input
                        type="text"
                        placeholder="e.g. 40% OFF"
                        value={formData.discount}
                        onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand/30 font-bold text-emerald-700"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Rating</label>
                      <input
                        type="text"
                        placeholder="4.8"
                        value={formData.rating}
                        onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand/30 font-semibold"
                      />
                    </div>
                  </div>

                  {/* Reviews & Priority */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Review Sub-text</label>
                      <input
                        type="text"
                        placeholder="e.g. 12k or 8k"
                        value={formData.reviews}
                        onChange={(e) => setFormData({ ...formData, reviews: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand/30"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Display Priority (Sort)</label>
                      <input
                        type="number"
                        placeholder="1"
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand/30 font-bold"
                      />
                    </div>
                  </div>

                  {/* Checkboxes: Instant & Active */}
                  <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={formData.isInstant}
                        onChange={(e) => setFormData({ ...formData, isInstant: e.target.checked })}
                        className="rounded text-brand focus:ring-brand h-4 w-4"
                      />
                      <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                      <span>Instant Booking Tag</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="rounded text-brand focus:ring-brand h-4 w-4"
                      />
                      <span>Active on App</span>
                    </label>
                  </div>

                  {/* Submit Buttons */}
                  <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-brand text-white hover:bg-brand-dark transition shadow-sm"
                    >
                      {editingServiceId ? 'Save Changes' : 'Create Card'}
                    </button>
                  </div>
                </form>

                {/* Real-time Phone Mockup Card Preview (1 col) */}
                <div className="space-y-2 flex flex-col items-center justify-start border-t md:border-t-0 md:border-l border-slate-100 md:pl-6 pt-4 md:pt-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Live App Preview</p>

                  <div className="w-[165px] rounded-2xl bg-white shadow-md ring-1 ring-slate-100 overflow-hidden flex flex-col">
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-50 flex items-center justify-center p-2 border-b border-slate-100">
                      {formData.image ? (
                        <img src={formData.image} alt="" className="max-h-full max-w-full w-auto h-auto object-contain" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-slate-300">
                          <ImageIcon className="w-8 h-8" />
                        </div>
                      )}
                      {formData.discount && (
                        <div className="absolute left-1.5 top-1.5 rounded-md bg-[#059669] px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                          {formData.discount}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-3">
                      <h4 className="line-clamp-2 text-[14px] font-semibold leading-snug text-slate-900 min-h-[38px]">
                        {formData.title || 'Service Title'}
                      </h4>

                      <div className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-slate-600">
                        <span className="flex items-center gap-0.5 text-slate-700">
                          <Star className="h-3 w-3 fill-slate-700 text-slate-700" />
                          {formData.rating || '4.8'}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        {formData.isInstant ? (
                          <span className="flex items-center gap-0.5 text-[#059669]">
                            <Zap className="h-3 w-3 fill-[#059669]" />
                            Instant
                          </span>
                        ) : (
                          <span className="text-slate-500">{formData.reviews || '10k'}</span>
                        )}
                      </div>

                      <div className="mt-2.5 flex items-baseline gap-1.5">
                        <span className="text-[14px] font-bold text-slate-900">
                          ₹{formData.price || '0'}
                        </span>
                        {formData.originalPrice && (
                          <span className="text-[11px] font-medium text-slate-400 line-through">
                            ₹{formData.originalPrice}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 text-center mt-1">Exact look on user's phone</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
