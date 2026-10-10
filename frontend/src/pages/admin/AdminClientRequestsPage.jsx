import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Briefcase,
  MapPin,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  ChevronRight,
  Inbox,
  Send,
  Search,
  Building2,
  Phone,
  X,
  UserCheck,
  Sparkles,
  FileText,
  Percent,
  Check,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { useSocket } from '../../hooks/useSocket.js'
import {
  useGetAdminClientRequestsQuery,
  useAcceptClientRequestMutation,
  useSendToVendorClientRequestMutation,
  useListVendorVerificationsQuery,
  useGetAdminQuotationQuery,
  useSubmitAdminQuotationMutation,
} from '../../store/api/workforceApi.js'
import toast from 'react-hot-toast'

const STATUS_FILTERS = [
  { value: '', label: 'Pending Review' },
  { value: 'accepted', label: 'Accepted (Direct)' },
  { value: 'revision_requested', label: '⚠️ Revision Requested' },
  { value: 'vendor_platform_fee_pending', label: 'Accepted (Vendor)' },
  { value: 'quotation_unlocked', label: 'Quotation Phase' },
  { value: 'project_active', label: 'Project Active' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function totalWorkers(lines) {
  if (!Array.isArray(lines)) return 0
  return lines.reduce((sum, l) => sum + (l.quantity || 1), 0)
}

function categoryNames(lines) {
  if (!Array.isArray(lines)) return '—'
  return (
    lines
      .map((l) => l.categoryId?.name || 'Worker')
      .filter(Boolean)
      .join(', ') || '—'
  )
}

export function AdminClientRequestsPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const { data, isLoading, isError, refetch } = useGetAdminClientRequestsQuery(
    statusFilter ? { status: statusFilter } : undefined,
  )
  const [acceptRequest, { isLoading: accepting }] = useAcceptClientRequestMutation()
  const [sendToVendor, { isLoading: sending }] = useSendToVendorClientRequestMutation()

  // Vendor selection modal state
  const [selectedRequestForVendor, setSelectedRequestForVendor] = useState(null)
  const [vendorSearch, setVendorSearch] = useState('')
  const [selectedVendorId, setSelectedVendorId] = useState('')

  // Fetch approved vendors
  const { data: vendorsData, isLoading: loadingVendors } = useListVendorVerificationsQuery(
    { filter: 'approved', limit: 50 },
    { skip: !selectedRequestForVendor },
  )

  const requests = data?.requests ?? []
  const vendorsList = vendorsData?.items || []

  const filteredVendors = useMemo(() => {
    if (!vendorSearch.trim()) return vendorsList
    const q = vendorSearch.toLowerCase()
    return vendorsList.filter((v) => {
      const bName = v.contractorProfile?.businessName?.toLowerCase() || ''
      const fName = v.fullName?.toLowerCase() || ''
      const phone = v.phone || ''
      const city = v.contractorProfile?.city?.toLowerCase() || ''
      return bName.includes(q) || fName.includes(q) || phone.includes(q) || city.includes(q)
    })
  }, [vendorsList, vendorSearch])

  // Quotation Builder Modal state for Admin Direct Accept
  const [selectedRequestForQuote, setSelectedRequestForQuote] = useState(null)
  const [labourRate, setLabourRate] = useState(800)
  const [workersCount, setWorkersCount] = useState(1)
  const [workingDays, setWorkingDays] = useState(1)
  const [transportation, setTransportation] = useState(0)
  const [equipment, setEquipment] = useState(0)
  const [food, setFood] = useState(0)
  const [accommodation, setAccommodation] = useState(0)
  const [other, setOther] = useState(0)
  const [gstPercentage, setGstPercentage] = useState(18)
  const [discount, setDiscount] = useState(0)
  const [notes, setNotes] = useState('')

  const { data: quoteData, refetch: refetchAdminQuote } = useGetAdminQuotationQuery(
    selectedRequestForQuote?._id,
    { skip: !selectedRequestForQuote }
  )
  const [submitAdminQuotation, { isLoading: submittingAdminQuote }] = useSubmitAdminQuotationMutation()

  const socket = useSocket()

  useEffect(() => {
    if (!socket) return
    const handleQuotationUpdate = (payload) => {
      refetch()
      if (payload?.action === 'revision' || payload?.status === 'revision_requested' || payload?.quotationStatus === 'revision_requested') {
        toast((t) => (
          <div className="flex items-start gap-2.5">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-bold text-xs text-slate-900">Quotation Revision Requested!</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Client feedback: "{payload.feedback || 'Revision needed'}"</p>
            </div>
          </div>
        ), { duration: 7000, id: `quote-rev-${payload?.requestId}` })
      } else if (payload?.action === 'approve') {
        toast.success(`Quotation approved by client! Project is now Active.`, { id: `quote-app-${payload?.requestId}` })
      } else if (payload?.action === 'reject') {
        toast.error(`Quotation rejected by client.`, { id: `quote-rej-${payload?.requestId}` })
      }
    }

    socket.on('corporate_responded_quotation', handleQuotationUpdate)
    socket.on('request_status_update', handleQuotationUpdate)
    return () => {
      socket.off('corporate_responded_quotation', handleQuotationUpdate)
      socket.off('request_status_update', handleQuotationUpdate)
    }
  }, [socket, refetch])

  useEffect(() => {
    if (selectedRequestForQuote) {
      const q = quoteData?.quotation
      if (q) {
        setLabourRate(q.labourRatePerWorker || 800)
        setWorkersCount(q.numberOfWorkers || totalWorkers(selectedRequestForQuote.lines) || 1)
        setWorkingDays(q.workingDays || 1)
        setTransportation(q.transportationCharges || 0)
        setEquipment(q.equipmentCharges || 0)
        setFood(q.foodCharges || 0)
        setAccommodation(q.accommodationCharges || 0)
        setOther(q.otherCharges || 0)
        setGstPercentage(q.gstPercentage !== undefined ? q.gstPercentage : 18)
        setDiscount(q.discount || 0)
        setNotes(q.notes || '')
      } else {
        setWorkersCount(totalWorkers(selectedRequestForQuote.lines) || 1)
        let days = 1
        if (selectedRequestForQuote.startDate && selectedRequestForQuote.endDate) {
          const start = new Date(selectedRequestForQuote.startDate)
          const end = new Date(selectedRequestForQuote.endDate)
          const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24))
          days = Math.max(1, diffDays + 1)
        }
        setWorkingDays(days)
        setLabourRate(800)
        setTransportation(0)
        setEquipment(0)
        setFood(0)
        setAccommodation(0)
        setOther(0)
        setGstPercentage(18)
        setDiscount(0)
        setNotes('')
      }
    }
  }, [selectedRequestForQuote, quoteData])

  const handleOpenQuotationModal = (reqItem) => {
    setSelectedRequestForQuote(reqItem)
  }

  const handleCloseQuotationModal = () => {
    setSelectedRequestForQuote(null)
  }

  const handleSubmitAdminQuote = async () => {
    if (!selectedRequestForQuote) return
    try {
      await submitAdminQuotation({
        id: selectedRequestForQuote._id,
        requestId: selectedRequestForQuote._id,
        labourRatePerWorker: Number(labourRate),
        numberOfWorkers: Number(workersCount),
        workingDays: Number(workingDays),
        transportationCharges: Number(transportation),
        equipmentCharges: Number(equipment),
        foodCharges: Number(food),
        accommodationCharges: Number(accommodation),
        otherCharges: Number(other),
        gstPercentage: Number(gstPercentage),
        discount: Number(discount),
        notes,
      }).unwrap()
      toast.success('Official quotation submitted to Corporate Client successfully!')
      handleCloseQuotationModal()
      refetch()
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to submit quotation')
    }
  }

  const handleAccept = async (reqItem) => {
    try {
      await acceptRequest({ id: reqItem._id }).unwrap()
      toast.success('Request directly accepted by Admin!')
      setStatusFilter('accepted')
      refetch()
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to accept request')
    }
  }

  const handleOpenVendorModal = (reqItem) => {
    setSelectedRequestForVendor(reqItem)
    setSelectedVendorId(reqItem.assignedVendor?._id || '')
    setVendorSearch('')
  }

  const handleCloseVendorModal = () => {
    setSelectedRequestForVendor(null)
    setSelectedVendorId('')
    setVendorSearch('')
  }

  const handleConfirmSendToVendor = async () => {
    if (!selectedRequestForVendor || !selectedVendorId) {
      toast.error('Please select a vendor to dispatch this request')
      return
    }
    try {
      const res = await sendToVendor({
        id: selectedRequestForVendor._id,
        vendorId: selectedVendorId,
      }).unwrap()
      toast.success(res?.message || 'Request successfully dispatched to vendor!')
      handleCloseVendorModal()
      refetch()
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to dispatch request to vendor')
    }
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-200/40">
            <Inbox className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Corporate Booking</h1>
            <p className="text-sm text-slate-600">
              Incoming workforce requests from corporate clients — review, assign vendors, or accept directly.
            </p>
          </div>
        </div>
      </div>

      {/* Status Filters */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value || 'pending'}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold ring-1 transition ${
              statusFilter === f.value
                ? 'bg-brand text-white ring-brand shadow-sm shadow-brand/20'
                : 'bg-white text-slate-600 ring-slate-200 hover:ring-brand/30'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <GlassPanel className="p-8 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-slate-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-brand" />
            Loading requests…
          </div>
        </GlassPanel>
      )}

      {/* Error */}
      {isError && (
        <GlassPanel className="border-rose-200 p-6">
          <p className="text-sm font-semibold text-rose-800">Failed to load client requests.</p>
        </GlassPanel>
      )}

      {/* Empty */}
      {!isLoading && !isError && requests.length === 0 && (
        <GlassPanel className="p-10 text-center">
          <Inbox className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
          <p className="mt-3 text-sm font-bold text-slate-700">
            {statusFilter ? 'No requests match this filter.' : 'No pending client requests right now.'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Corporate client requests will appear here when submitted.
          </p>
        </GlassPanel>
      )}

      {/* Request List */}
      <ul className="space-y-4">
        {requests.map((r) => {
          const clientName =
            r.clientId?.corporateProfile?.companyName || r.clientId?.fullName || 'Corporate Client'
          const isPending = r.status === 'admin_review'
          const assignedVendor = r.assignedVendor

          return (
            <li key={r._id}>
              <GlassPanel className="p-0 overflow-hidden transition hover:shadow-lg hover:ring-brand/10">
                <div className="p-5 space-y-4">
                  {/* Top Row */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700 ring-1 ring-amber-200/60">
                          <Briefcase className="h-3 w-3" />
                          Corporate
                        </span>
                        <span className="text-sm font-black text-slate-900">{r.reference}</span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-700">{clientName}</p>
                      {r.clientId?.phone && (
                        <p className="text-[11px] text-slate-500">{r.clientId.phone}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isPending ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800 ring-1 ring-amber-200/60">
                          <Clock className="h-3 w-3" />
                          Pending Review
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-200/60">
                          <CheckCircle2 className="h-3 w-3" />
                          {r.status?.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl bg-slate-50/80 p-3 ring-1 ring-slate-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Location</p>
                      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-700 truncate">
                        <MapPin className="h-3 w-3 shrink-0 text-brand" />
                        {r.locationText || 'Not specified'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50/80 p-3 ring-1 ring-slate-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Start Date</p>
                      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-700">
                        <Calendar className="h-3 w-3 shrink-0 text-brand" />
                        {formatDate(r.startDate)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50/80 p-3 ring-1 ring-slate-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Workers</p>
                      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-700">
                        <Users className="h-3 w-3 shrink-0 text-brand" />
                        {totalWorkers(r.lines)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50/80 p-3 ring-1 ring-slate-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Skills</p>
                      <p className="mt-1 text-xs font-semibold text-slate-700 truncate">
                        {categoryNames(r.lines)}
                      </p>
                    </div>
                  </div>

                  {/* Assigned Vendor Banner (if any) */}
                  {assignedVendor && (
                    <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 px-3.5 py-2.5 ring-1 ring-emerald-200/60">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-black text-xs shadow-sm">
                          <UserCheck className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                            Assigned Vendor
                          </p>
                          <p className="text-xs font-bold text-slate-900">
                            {assignedVendor.contractorProfile?.businessName || assignedVendor.fullName}
                            {assignedVendor.phone ? ` • ${assignedVendor.phone}` : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenVendorModal(r)}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                      >
                        Change Vendor
                      </button>
                    </div>
                  )}

                  {/* Direct Fulfillment by Staffivaa Banner (Admin accepted) */}
                  {(r.isDirectAdminAccept || r.acceptedByAdmin || (r.status === 'accepted' && !assignedVendor)) && (
                    <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 px-3.5 py-2.5 ring-1 ring-amber-200/70">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-slate-950 font-black text-xs shadow-sm">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-amber-900">
                            Staffivaa Direct Fulfillment
                          </p>
                          <p className="text-xs font-medium text-amber-800">
                            Directly accepted by Admin. Create and submit quotation for client.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenQuotationModal(r)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 px-3 py-1.5 text-xs font-black shadow-xs transition cursor-pointer"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Quotation
                      </button>
                    </div>
                  )}

                  {/* Revision Requested by Client Alert Banner */}
                  {r.quotation?.status === 'revision_requested' && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl bg-amber-500/15 border-2 border-amber-400 p-4 text-amber-950 animate-in fade-in shadow-xs">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-slate-950 font-black text-xs shrink-0 shadow-sm mt-0.5">
                          <MessageSquare className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-950 bg-amber-200/90 px-2 py-0.5 rounded-md border border-amber-300">
                              ⚠️ Revision Requested by Client
                            </span>
                            {r.quotation.grandTotal && (
                              <span className="text-[11px] font-semibold text-amber-800">
                                Previous Quote: ₹{r.quotation.grandTotal.toLocaleString()}
                              </span>
                            )}
                          </div>
                          <p className="mt-1.5 text-xs font-bold text-slate-900">
                            Client Feedback: <span className="font-extrabold italic text-amber-900 bg-white/90 px-2.5 py-1 rounded-lg border border-amber-200 shadow-2xs">"{r.quotation.feedback || 'Please review and adjust pricing.'}"</span>
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenQuotationModal(r)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 px-4 py-2.5 text-xs font-black text-slate-950 shadow-md transition cursor-pointer active:scale-95"
                      >
                        <FileText className="h-4 w-4" />
                        Revise & Resubmit Quote
                      </button>
                    </div>
                  )}

                  {/* Quotation Status Bar (when quotation exists and not revision_requested) */}
                  {r.quotation && r.quotation.status !== 'revision_requested' && (
                    <div className="flex items-center justify-between rounded-xl bg-slate-50/90 p-2.5 px-3.5 border border-slate-200/80 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <FileText className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        <span className="font-bold text-slate-600 text-[11px]">Quotation:</span>
                        <span className={`font-black uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-md border ${
                          r.quotation.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          r.quotation.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {r.quotation.status.replace('_', ' ')}
                        </span>
                        <span className="font-extrabold text-slate-900">
                          ₹{r.quotation.grandTotal?.toLocaleString()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenQuotationModal(r)}
                        className="text-[11px] font-bold text-brand hover:underline cursor-pointer"
                      >
                        Edit Quote
                      </button>
                    </div>
                  )}

                  {/* Notes */}
                  {r.notes && (
                    <p className="text-xs text-slate-500 bg-slate-50/50 rounded-lg px-3 py-2 ring-1 ring-slate-100">
                      <span className="font-bold text-slate-600">Notes: </span>
                      {r.notes}
                    </p>
                  )}

                  {/* Project / Site */}
                  {(r.projectId?.name || r.siteId?.name) && (
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      {r.projectId?.name && (
                        <span className="font-semibold">
                          Project: <span className="text-slate-700">{r.projectId.name}</span>
                        </span>
                      )}
                      {r.siteId?.name && (
                        <span className="font-semibold">
                          Site: <span className="text-slate-700">{r.siteId.name}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Bar */}
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/40 px-5 py-3">
                  <p className="text-[10px] font-medium text-slate-400">
                    {new Date(r.createdAt).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    {/* Send to Vendor Action */}
                    <button
                      type="button"
                      onClick={() => handleOpenVendorModal(r)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 shadow-sm transition hover:bg-blue-100 cursor-pointer"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {assignedVendor ? 'Re-send to Vendor' : 'Send to Vendor'}
                    </button>

                    {isPending && (
                      <button
                        type="button"
                        disabled={accepting}
                        onClick={() => handleAccept(r)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand to-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-brand/20 transition hover:shadow-lg hover:shadow-brand/30 disabled:opacity-50 cursor-pointer"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Accept Directly
                      </button>
                    )}

                    {/* Direct Admin Quotation Action */}
                    {['accepted', 'quotation_unlocked', 'allocated', 'assigned', 'project_active'].includes(r.status) && (
                      <button
                        type="button"
                        onClick={() => handleOpenQuotationModal(r)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-800 shadow-sm transition hover:bg-amber-100 cursor-pointer"
                      >
                        <FileText className="h-3.5 w-3.5 text-amber-600" />
                        Quotation
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => navigate(`/admin/payments/${r._id}`)}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-brand/30 hover:text-brand cursor-pointer"
                    >
                      View Details
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </GlassPanel>
            </li>
          )
        })}
      </ul>

      {/* Vendor Selection Modal */}
      {selectedRequestForVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                    <Send className="h-4 w-4" />
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-900">Send Request to Vendor</h3>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Select an approved vendor to dispatch request{' '}
                  <span className="font-bold text-slate-700">{selectedRequestForVendor.reference}</span>.
                  The vendor will receive an instant push notification and incoming popup.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseVendorModal}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="mt-4">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search vendor by business name, city, phone..."
                  value={vendorSearch}
                  onChange={(e) => setVendorSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>

            {/* Vendor List */}
            <div className="mt-3 max-h-64 overflow-y-auto space-y-2 pr-1">
              {loadingVendors ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand mb-2" />
                  Loading approved vendors…
                </div>
              ) : filteredVendors.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                  No approved vendors found matching search criteria.
                </div>
              ) : (
                filteredVendors.map((vendor) => {
                  const bName = vendor.contractorProfile?.businessName || vendor.fullName
                  const isSelected = selectedVendorId === vendor._id

                  return (
                    <div
                      key={vendor._id}
                      onClick={() => setSelectedVendorId(vendor._id)}
                      className={`flex items-center justify-between rounded-2xl p-3 ring-1 transition cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/80 ring-blue-400 border-blue-400'
                          : 'bg-white ring-slate-100 hover:bg-slate-50/80 hover:ring-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-900">{bName}</p>
                          <p className="flex items-center gap-2 text-[11px] text-slate-500">
                            {vendor.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-2.5 w-2.5" />
                                {vendor.phone}
                              </span>
                            )}
                            {vendor.contractorProfile?.city && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-2.5 w-2.5" />
                                {vendor.contractorProfile.city}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 pl-2">
                        <input
                          type="radio"
                          name="selectedVendor"
                          checked={isSelected}
                          onChange={() => setSelectedVendorId(vendor._id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Modal Actions */}
            <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleCloseVendorModal}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedVendorId || sending}
                onClick={handleConfirmSendToVendor}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                {sending ? 'Dispatching…' : 'Dispatch to Vendor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Quotation Builder Modal for Direct Accept */}
      {selectedRequestForQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 text-white shadow-2xl ring-1 ring-slate-800 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 p-5 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400 text-slate-950">
                    <FileText className="h-4 w-4" />
                  </span>
                  <h3 className="text-lg font-extrabold text-white">Direct Admin Quotation Builder</h3>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Request Ref: <span className="font-bold text-amber-400">{selectedRequestForQuote.reference}</span> ({selectedRequestForQuote.clientId?.corporateProfile?.companyName || selectedRequestForQuote.clientId?.fullName || 'Client'})
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseQuotationModal}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-slate-200">
              {/* Cost Summary Box */}
              <div className="bg-gradient-to-br from-indigo-950 to-slate-950 border border-indigo-800/60 p-4 rounded-2xl space-y-2">
                <span className="text-[10px] font-black text-indigo-300 tracking-wider uppercase">Quotation Calculation Breakdown</span>
                <div className="space-y-1 text-xs text-indigo-200">
                  <div className="flex justify-between">
                    <span>Labour Base Cost:</span>
                    <span className="font-bold">₹{(Number(labourRate) * Number(workersCount) * Number(workingDays)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Logistics & Extras:</span>
                    <span className="font-bold">₹{(Number(transportation) + Number(equipment) + Number(food) + Number(accommodation) + Number(other)).toLocaleString()}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-emerald-400 font-bold">
                      <span>Discount:</span>
                      <span>- ₹{Number(discount).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>GST ({gstPercentage}%):</span>
                    <span className="font-bold">₹{
                      Math.round(
                        Math.max(0, 
                          (Number(labourRate) * Number(workersCount) * Number(workingDays) + 
                           Number(transportation) + Number(equipment) + Number(food) + Number(accommodation) + Number(other) - 
                           Number(discount))
                        ) * Number(gstPercentage) / 100
                      ).toLocaleString()
                    }</span>
                  </div>
                </div>
                
                <div className="border-t border-indigo-800/80 pt-2 flex justify-between items-center text-white font-black text-base">
                  <span>Grand Total to Client:</span>
                  <span className="text-[19px] text-amber-400">₹{
                    (
                      Number(labourRate) * Number(workersCount) * Number(workingDays) + 
                      Number(transportation) + Number(equipment) + Number(food) + Number(accommodation) + Number(other) - 
                      Number(discount) + 
                      Math.round(
                        Math.max(0, 
                          (Number(labourRate) * Number(workersCount) * Number(workingDays) + 
                           Number(transportation) + Number(equipment) + Number(food) + Number(accommodation) + Number(other) - 
                           Number(discount))
                        ) * Number(gstPercentage) / 100
                      )
                    ).toLocaleString()
                  }</span>
                </div>
              </div>

              {/* Input Fields */}
              <div className="space-y-3 pt-1 text-xs">
                {/* Labour Rate */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Labour Rate Per Worker (₹ / Day)</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className="text-slate-500 font-semibold">₹</span>
                    </div>
                    <input 
                      type="number"
                      value={labourRate || ''}
                      min="0"
                      onChange={(e) => setLabourRate(Number(e.target.value))}
                      className="block w-full rounded-xl border border-slate-700 py-2 pl-7 pr-3 text-sm text-white bg-slate-950 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Workers Count & Days */}
                <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Workers Count</label>
                    <input 
                      type="number"
                      value={workersCount || ''}
                      min="1"
                      onChange={(e) => setWorkersCount(Number(e.target.value))}
                      className="block w-full rounded-xl border border-slate-700 py-2 px-3 text-sm text-white bg-slate-950 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Working Days</label>
                    <input 
                      type="number"
                      value={workingDays || ''}
                      min="1"
                      onChange={(e) => setWorkingDays(Number(e.target.value))}
                      className="block w-full rounded-xl border border-slate-700 py-2 px-3 text-sm text-white bg-slate-950 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Logistics */}
                <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Transportation (₹)</label>
                    <input 
                      type="number"
                      value={transportation || ''}
                      min="0"
                      onChange={(e) => setTransportation(Number(e.target.value))}
                      className="block w-full rounded-xl border border-slate-700 py-2 px-3 text-sm text-white bg-slate-950 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Equipment (₹)</label>
                    <input 
                      type="number"
                      value={equipment || ''}
                      min="0"
                      onChange={(e) => setEquipment(Number(e.target.value))}
                      className="block w-full rounded-xl border border-slate-700 py-2 px-3 text-sm text-white bg-slate-950 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Food & Accommodation */}
                <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Food / Catering (₹)</label>
                    <input 
                      type="number"
                      value={food || ''}
                      min="0"
                      onChange={(e) => setFood(Number(e.target.value))}
                      className="block w-full rounded-xl border border-slate-700 py-2 px-3 text-sm text-white bg-slate-950 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Accommodation (₹)</label>
                    <input 
                      type="number"
                      value={accommodation || ''}
                      min="0"
                      onChange={(e) => setAccommodation(Number(e.target.value))}
                      className="block w-full rounded-xl border border-slate-700 py-2 px-3 text-sm text-white bg-slate-950 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Other, GST, Discount */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1 truncate">Other (₹)</label>
                    <input 
                      type="number"
                      value={other || ''}
                      min="0"
                      onChange={(e) => setOther(Number(e.target.value))}
                      className="block w-full rounded-xl border border-slate-700 py-2 px-2 text-sm text-white bg-slate-950 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-300 mb-1 truncate">GST (%)</label>
                    <input 
                      type="number"
                      value={gstPercentage || ''}
                      min="0"
                      onChange={(e) => setGstPercentage(Number(e.target.value))}
                      className="block w-full rounded-xl border border-slate-700 py-2 px-2 text-sm text-white bg-slate-950 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-300 mb-1 truncate">Discount (₹)</label>
                    <input 
                      type="number"
                      value={discount || ''}
                      min="0"
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      className="block w-full rounded-xl border border-slate-700 py-2 px-2 text-sm text-white bg-slate-950 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Notes & Scope of Work</label>
                  <textarea 
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Staffivaa Direct Fulfillment terms..."
                    className="block w-full rounded-xl border border-slate-700 py-2 px-3 text-xs text-white bg-slate-950 focus:border-amber-400 focus:outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 shrink-0 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseQuotationModal}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAdminQuote}
                onClick={handleSubmitAdminQuote}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-400/20 hover:bg-amber-300 disabled:opacity-50 cursor-pointer"
              >
                <Check className="h-4 w-4" />
                {submittingAdminQuote ? 'Sending Quotation…' : 'Send Quotation to Client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
