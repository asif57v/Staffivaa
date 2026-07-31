import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Plus, Search, Edit3, Eye, Trash2, CheckCircle2, AlertCircle,
  Sparkles, Globe, Lock, Clock, History, ExternalLink, RefreshCw, X, Shield,
  Bold, Italic, List, Heading, Link as LinkIcon, Quote, Code, FileCode
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useGetAdminLegalPagesQuery,
  useCreateLegalPageMutation,
  useUpdateLegalPageMutation,
  useToggleLegalPageStatusMutation,
  useDeleteLegalPageMutation,
} from '../../store/api/legalApi.js'

export function AdminLegalContentPage() {
  const { data: res, isLoading, isFetching, refetch } = useGetAdminLegalPagesQuery()
  const pages = res?.data || []

  const [createPage] = useCreateLegalPageMutation()
  const [updatePage] = useUpdateLegalPageMutation()
  const [toggleStatus] = useToggleLegalPageStatusMutation()
  const [deletePage] = useDeleteLegalPageMutation()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Modal States
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingPage, setEditingPage] = useState(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [deleteModalPage, setDeleteModalPage] = useState(null)

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    version: 'v1.0',
    status: 'published',
    content: '',
  })

  const filteredPages = useMemo(() => {
    return pages.filter((p) => {
      const matchSearch =
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.slug.toLowerCase().includes(searchQuery.toLowerCase())
      const matchStatus = statusFilter === 'all' || p.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [pages, searchQuery, statusFilter])

  const handleOpenCreate = () => {
    setEditingPage(null)
    setFormData({
      title: '',
      slug: '',
      version: 'v1.0',
      status: 'published',
      content: '<h2>Heading Title</h2>\n<p>Write legal document details here...</p>',
    })
    setIsEditorOpen(true)
  }

  const handleOpenEdit = (page) => {
    setEditingPage(page)
    setFormData({
      title: page.title,
      slug: page.slug,
      version: page.version || 'v1.0',
      status: page.status,
      content: page.content || '',
    })
    setIsEditorOpen(true)
  }

  const handleTitleChange = (e) => {
    const val = e.target.value
    if (!editingPage) {
      const autoSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
      setFormData((prev) => ({ ...prev, title: val, slug: autoSlug }))
    } else {
      setFormData((prev) => ({ ...prev, title: val }))
    }
  }

  const handleInsertHtml = (tag, wrapper = false) => {
    const textarea = document.getElementById('legal-content-editor')
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = formData.content.substring(start, end)
    let replacement = ''

    if (tag === 'h2') replacement = `<h2>${selected || 'Heading Title'}</h2>`
    else if (tag === 'h3') replacement = `<h3>${selected || 'Subheading'}</h3>`
    else if (tag === 'b') replacement = `<strong>${selected || 'bold text'}</strong>`
    else if (tag === 'i') replacement = `<em>${selected || 'italic text'}</em>`
    else if (tag === 'ul') replacement = `<ul>\n  <li>${selected || 'List item 1'}</li>\n  <li>List item 2</li>\n</ul>`
    else if (tag === 'quote') replacement = `<blockquote>${selected || 'Important note or disclaimer...'}</blockquote>`
    else if (tag === 'code') replacement = `<code>${selected || 'code clause'}</code>`

    const newContent = formData.content.substring(0, start) + replacement + formData.content.substring(end)
    setFormData((prev) => ({ ...prev, content: newContent }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!formData.title || !formData.content) {
      toast.error('Title and content are required')
      return
    }

    try {
      if (editingPage) {
        await updatePage({ id: editingPage._id, ...formData }).unwrap()
        toast.success('Legal document updated successfully!')
      } else {
        await createPage(formData).unwrap()
        toast.success('New legal document published successfully!')
      }
      setIsEditorOpen(false)
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to save legal page')
    }
  }

  const handleToggleStatus = async (page) => {
    const nextStatus = page.status === 'published' ? 'draft' : 'published'
    try {
      await toggleStatus({ id: page._id, status: nextStatus }).unwrap()
      toast.success(`Document is now ${nextStatus.toUpperCase()}`)
    } catch (err) {
      toast.error('Failed to change status')
    }
  }

  const handleDelete = async () => {
    if (!deleteModalPage) return
    try {
      await deletePage(deleteModalPage._id).unwrap()
      toast.success('Legal page deleted')
      setDeleteModalPage(null)
    } catch (err) {
      toast.error('Failed to delete page')
    }
  }

  const handlePreview = (pageData) => {
    setPreviewData(pageData)
    setIsPreviewOpen(true)
  }

  return (
    <div className="space-y-6 pb-20">
      {/* ── Top Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-6 w-6 text-amber-500" />
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Legal Content Management</h1>
          </div>
          <p className="text-xs font-medium text-slate-500">
            Create, edit, version, and manage published legal policies (Terms, Privacy, Support, Refunds).
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-extrabold text-sm shadow-md shadow-amber-500/20 transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          <span>Add New Legal Page</span>
        </button>
      </div>

      {/* ── Filter & Search Bar ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by title or slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 outline-none focus:border-amber-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-bold">
            {['all', 'published', 'draft'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl capitalize transition-all cursor-pointer ${
                  statusFilter === st ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <button
            onClick={() => refetch()}
            className="p-2.5 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Legal Pages Table / List ───────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium animate-pulse">
            Loading legal pages...
          </div>
        ) : filteredPages.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileText className="h-10 w-10 text-slate-300 mx-auto" />
            <p className="text-sm font-extrabold text-slate-800">No legal documents found</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Create your first legal document or adjust filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-4 px-6">Document Title</th>
                  <th className="py-4 px-4">Slug / Route</th>
                  <th className="py-4 px-4">Version</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-4">Last Updated</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredPages.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-extrabold text-slate-900">{p.title}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {p._id}</div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-600 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-xl">
                        /legal/{p.slug}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-semibold text-slate-700">
                      <span className="bg-slate-100 px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold">
                        {p.version || 'v1.0'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <button
                        onClick={() => handleToggleStatus(p)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer ${
                          p.status === 'published'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {p.status === 'published' ? (
                          <>
                            <Globe className="h-3 w-3 text-emerald-600" /> Published
                          </>
                        ) : (
                          <>
                            <Lock className="h-3 w-3 text-slate-400" /> Draft
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-4 px-4 text-slate-500 font-medium whitespace-nowrap">
                      {new Date(p.updatedAt || p.lastUpdated).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handlePreview(p)}
                          className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                          title="Live Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-2 rounded-xl text-indigo-600 hover:bg-indigo-50 transition-colors font-bold flex items-center gap-1"
                          title="Edit Document"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => setDeleteModalPage(p)}
                          className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors"
                          title="Delete Document"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Editor Modal (Create / Edit) ─────────────────────────────────── */}
      <AnimatePresence>
        {isEditorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden my-auto"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-amber-500" />
                  <h3 className="text-base font-extrabold text-slate-900">
                    {editingPage ? `Edit Legal Document: ${editingPage.title}` : 'Create New Legal Document'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsEditorOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden">
                <div className="p-6 overflow-y-auto space-y-4 flex-1">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-1">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Title *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Terms & Conditions"
                        value={formData.title}
                        onChange={handleTitleChange}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Slug (URL identifier) *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. terms"
                        value={formData.slug}
                        onChange={(e) => setFormData((p) => ({ ...p, slug: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-amber-600 outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Version Tag
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. v1.0"
                        value={formData.version}
                        onChange={(e) => setFormData((p) => ({ ...p, version: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Document Content (HTML / Rich Formatting) *
                    </label>

                    {/* Rich Formatting Toolbar */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => handleInsertHtml('h2')}
                        className="p-1.5 text-slate-700 hover:bg-white rounded-lg text-xs font-bold"
                        title="Add Heading 2"
                      >
                        <Heading className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertHtml('b')}
                        className="p-1.5 text-slate-700 hover:bg-white rounded-lg text-xs font-bold"
                        title="Bold Text"
                      >
                        <Bold className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertHtml('i')}
                        className="p-1.5 text-slate-700 hover:bg-white rounded-lg text-xs font-bold"
                        title="Italic Text"
                      >
                        <Italic className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertHtml('ul')}
                        className="p-1.5 text-slate-700 hover:bg-white rounded-lg text-xs font-bold"
                        title="Bullet List"
                      >
                        <List className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertHtml('quote')}
                        className="p-1.5 text-slate-700 hover:bg-white rounded-lg text-xs font-bold"
                        title="Quote Box"
                      >
                        <Quote className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <textarea
                    id="legal-content-editor"
                    rows={14}
                    required
                    value={formData.content}
                    onChange={(e) => setFormData((p) => ({ ...p, content: e.target.value }))}
                    placeholder="Enter document HTML / text..."
                    className="w-full p-4 bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 border-0"
                  />
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.status === 'published'}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, status: e.target.checked ? 'published' : 'draft' }))
                        }
                        className="rounded accent-amber-500 h-4 w-4"
                      />
                      <span>Publish Immediately</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handlePreview(formData)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Eye className="h-3.5 w-3.5" /> Preview
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold shadow-md transition-all cursor-pointer"
                    >
                      {editingPage ? 'Save Changes' : 'Create Document'}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Preview Modal ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {isPreviewOpen && previewData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden my-auto"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-emerald-500" />
                  <span className="text-sm font-extrabold text-slate-900">Live Preview Mode</span>
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                    {previewData.version || 'v1.0'}
                  </span>
                </div>
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 flex-1 prose prose-slate max-w-none text-xs">
                <h1 className="text-xl font-extrabold text-slate-900 border-b pb-2 mb-4">{previewData.title}</h1>
                <div
                  className="space-y-3 font-normal text-slate-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: previewData.content }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Delete Confirmation Modal ────────────────────────────────────── */}
      <AnimatePresence>
        {deleteModalPage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 max-w-md w-full text-center space-y-4"
            >
              <div className="h-12 w-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Delete Legal Document?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to delete <span className="font-bold text-slate-800">"{deleteModalPage.title}"</span>? Public links will no longer display this page.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setDeleteModalPage(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-md"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
