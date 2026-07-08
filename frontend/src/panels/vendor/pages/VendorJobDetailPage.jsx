import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, Building2, MapPin, Calendar, Clock, UserCircle, CheckCircle2, Construction, AlertCircle, XCircle, Phone, Star, Award, Shield, FileDown, MessageSquare, ChevronDown, ChevronUp, Check, ArrowRight, IndianRupee, Percent, FileText } from 'lucide-react'
import { useAcceptVendorJobMutation, useGetVendorJobsQuery, useGetVendorQuotationQuery, useSubmitQuotationMutation, useGetSystemPricingQuery } from '../../../store/api/workforceApi.js'
import { useState, useEffect } from 'react'
import { getSocket } from '../../../services/socket.js'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function VendorJobDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch: refetchJobs } = useGetVendorJobsQuery()
  const [acceptJob, { isLoading: accepting }] = useAcceptVendorJobMutation()

  const { data: quoteData, refetch: refetchQuote } = useGetVendorQuotationQuery(id, { skip: !id })
  const [submitQuotation, { isLoading: submittingQuote }] = useSubmitQuotationMutation()
  const { data: pricingData } = useGetSystemPricingQuery()
  
  const advancePercentage = pricingData?.pricing?.corporate?.advancePercentage || 30

  const allocation = (data?.allocations ?? []).find((a) => String(a._id) === String(id))
  const req = allocation?.requestId

  const [showEditor, setShowEditor] = useState(false)
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

  const quotation = quoteData?.quotation
  const assignments = allocation?.assignments ?? []
  const totalRequired = (req?.lines ?? []).reduce((acc, line) => acc + (line.quantity || 1), 0)
  const totalAssigned = assignments.length
  const pending = !allocation?.vendorAcceptedAt

  useEffect(() => {
    if (showEditor && req) {
      setWorkersCount(totalAssigned || totalRequired || 1)
      
      let days = 1
      if (req.startDate && req.endDate) {
        const start = new Date(req.startDate)
        const end = new Date(req.endDate)
        const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24))
        days = Math.max(1, diffDays + 1)
      }
      setWorkingDays(days)
      
      if (assignments.length > 0) {
        const avgRate = Math.round(assignments.reduce((sum, a) => sum + (a.perDayRate || 0), 0) / assignments.length)
        setLabourRate(avgRate || 800)
      } else {
        setLabourRate(800)
      }
      
      if (quotation) {
        setLabourRate(quotation.labourRatePerWorker)
        setWorkersCount(quotation.numberOfWorkers)
        setWorkingDays(quotation.workingDays)
        setTransportation(quotation.transportationCharges)
        setEquipment(quotation.equipmentCharges)
        setFood(quotation.foodCharges)
        setAccommodation(quotation.accommodationCharges)
        setOther(quotation.otherCharges)
        setGstPercentage(quotation.gstPercentage)
        setDiscount(quotation.discount)
        setNotes(quotation.notes || '')
      }
    }
  }, [showEditor, req, quotation, totalAssigned, totalRequired, assignments])

  useEffect(() => {
    const socket = getSocket()
    if (socket && id) {
      const handleUpdate = () => {
        refetchJobs()
        refetchQuote()
      }
      socket.on('corporate_responded_quotation', handleUpdate)
      socket.on('vendor_submitted_quotation', handleUpdate)
      socket.on('request_status_update', handleUpdate)
      
      return () => {
        socket.off('corporate_responded_quotation', handleUpdate)
        socket.off('vendor_submitted_quotation', handleUpdate)
        socket.off('request_status_update', handleUpdate)
      }
    }
  }, [id, refetchJobs, refetchQuote])

  if (isLoading) {
    return (
      <div className="p-4">
        <p className="text-sm text-slate-500">Loading job…</p>
      </div>
    )
  }

  if (isError || !allocation || !req) {
    return (
      <div className="p-4 rounded-[20px] border border-rose-200/90 bg-rose-50/50 mt-4 mx-4">
        <p className="text-sm font-semibold text-rose-800">Job not found.</p>
        <Link to="/vendor/jobs" className="mt-3 inline-block text-sm font-bold text-brand">
          Back
        </Link>
      </div>
    )
  }

  const projectName = req.projectId?.name || 'Maiyur'
  const companyName = req.clientId?.corporateProfile?.companyName || req.clientId?.fullName || 'Appzeto'
  const tradeName = req.lines?.[0]?.categoryId?.name || 'Mason (Raj Mistri)'
  const shiftStr = (req.shiftStart && req.shiftEnd) ? `${req.shiftStart} - ${req.shiftEnd}` : '08:00 AM - 06:00 PM'
  
  let statusLabel = pending ? 'Pending' : 'Accepted'
  let statusTone = pending ? 'bg-orange-50 text-orange-700' : 'bg-emerald-50 text-emerald-700'
  let StatusIcon = pending ? AlertCircle : CheckCircle2
  
  if (allocation.status === 'completed') {
    statusLabel = 'Completed'
    statusTone = 'bg-emerald-50 text-emerald-700'
    StatusIcon = CheckCircle2
  } else if (allocation.status === 'cancelled') {
    statusLabel = 'Cancelled'
    statusTone = 'bg-rose-50 text-rose-700'
    StatusIcon = XCircle
  }

  const durationStr = `${formatDate(req.startDate)}${req.endDate ? ` – ${formatDate(req.endDate)}` : ''}`

  return (
    <div className="min-h-screen bg-slate-50/50 pb-40">
      {/* Sticky Header */}
      <header className="bg-white px-4 py-4 sticky top-0 z-30 shadow-sm border-b border-slate-100 flex items-center gap-3">
        <Link to="/vendor/jobs" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-100 transition hover:bg-slate-50 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <h1 className="text-base font-extrabold text-slate-900">Job Details</h1>
      </header>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        
        {/* Top Hero Card */}
        <div className="rounded-[20px] bg-white p-4 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] border border-slate-100">
          <div className="flex gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[14px] bg-slate-200 border border-slate-100 shadow-sm">
              <img src="https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=300&q=80" alt="Site" className="h-full w-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <h2 className="text-[18px] font-bold text-slate-900 truncate pr-2">{projectName}</h2>
                <span className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone}`}>
                  <StatusIcon className="h-2.5 w-2.5" strokeWidth={3} /> {statusLabel}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-slate-500">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <p className="text-[14px] font-medium truncate">{companyName}</p>
              </div>
              
              <div className="mt-2.5 flex items-center gap-1.5 text-slate-500">
                <MapPin className="h-3 w-3 shrink-0" />
                <p className="text-[12px] font-medium truncate">{req.locationText || 'Location TBD'}</p>
              </div>
              
              <div className="mt-1 text-slate-500 text-[12px] font-medium flex items-center gap-1.5 flex-wrap">
                <Calendar className="h-3 w-3 shrink-0" /> {durationStr}
              </div>
              <div className="mt-1 text-slate-500 text-[12px] font-medium flex items-center gap-1.5">
                <Users className="h-3 w-3 shrink-0" /> {totalRequired} Workers
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 rounded-full bg-blue-50/50 px-3 py-1.5 text-[11px] font-bold text-blue-700 border border-blue-100">
              <UserCircle className="h-3.5 w-3.5" strokeWidth={2.5} /> {tradeName}
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-600 border border-slate-200">
              <Clock className="h-3.5 w-3.5" /> {shiftStr}
            </span>
          </div>
          
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="text-[11px] font-bold text-slate-400 tracking-wide uppercase flex items-center gap-1">
              ID: {req.reference}
            </p>
          </div>
        </div>

        {/* Vendor Quotation Status Panel */}
        {quotation ? (
          <div className="rounded-[20px] bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-[14px] font-black text-slate-900">Quotation Status</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Submitted Quote Summary</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                quotation.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                quotation.status === 'revision_requested' ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' :
                quotation.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                {quotation.status.replace('_', ' ')}
              </span>
            </div>

            {quotation.status === 'revision_requested' && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 text-amber-800 rounded-2xl text-[12px] space-y-1">
                <p className="font-extrabold flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" /> Client requested a revision:
                </p>
                <p className="italic font-medium">"{quotation.feedback || 'No comments'}"</p>
              </div>
            )}

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Labour Cost</span>
                <span className="font-extrabold text-slate-900">₹{quotation.labourCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Logistics & Charges</span>
                <span className="font-extrabold text-slate-900">₹{(quotation.transportationCharges + quotation.equipmentCharges + quotation.foodCharges + quotation.accommodationCharges + quotation.otherCharges).toLocaleString()}</span>
              </div>
              {quotation.discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Special Discount</span>
                  <span>- ₹{quotation.discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">GST</span>
                <span className="font-extrabold text-slate-900">₹{quotation.gst.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2 font-black text-[13px] text-slate-900">
                <span>Quoted Total</span>
                <span>₹{quotation.grandTotal.toLocaleString()}</span>
              </div>
              {quotation.status === 'approved' && (
                <div className="pt-2 mt-2 border-t border-slate-100 border-dashed space-y-1.5">
                  <div className="flex justify-between text-[12px] font-bold text-emerald-600">
                    <span>{req?.advancePaymentStatus === 'paid' ? `Advance Received (${advancePercentage}%)` : `Advance Pending (${advancePercentage}%)`}</span>
                    <span>₹{Math.round(quotation.grandTotal * (advancePercentage / 100)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[12px] font-bold text-amber-600">
                    <span>{req?.finalPaymentStatus === 'paid' ? 'Balance Paid' : 'Remaining Balance'}</span>
                    <span>₹{Math.round(quotation.grandTotal * (1 - (advancePercentage / 100))).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            {['draft', 'submitted', 'under_review', 'revision_requested', 'revised'].includes(quotation.status) && (
              <button 
                onClick={() => setShowEditor(true)}
                className="w-full text-center rounded-xl bg-slate-900 text-white py-2 text-xs font-bold hover:bg-slate-800 transition"
              >
                {quotation.status === 'revision_requested' ? 'Edit & Resubmit Quote' : 'Edit Quotation'}
              </button>
            )}
          </div>
        ) : (
          !pending && totalAssigned === totalRequired && (
            <div className="rounded-[20px] bg-slate-900 p-5 text-white border border-slate-900 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-sm font-black text-slate-100">Prepare Professional Quotation</h4>
                  <p className="text-[11px] text-slate-400 font-bold mt-1">Submit logistics and rates to client.</p>
                </div>
                <span className="text-[10px] font-black uppercase bg-brand text-slate-900 px-2 py-0.5 rounded">REQUIRED</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Before the corporate client can proceed to advance payment, you must configure and submit a detailed quotation breakdown.
              </p>
              <button 
                onClick={() => setShowEditor(true)}
                className="w-full text-center rounded-xl bg-brand text-slate-900 py-2.5 text-xs font-black hover:bg-[#e0a800] transition active:scale-[0.98]"
              >
                Create Quotation
              </button>
            </div>
          )
        )}

        {/* Request Overview */}
        <div className="rounded-[20px] bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] border border-slate-100">
          <h3 className="text-[15px] font-extrabold text-slate-900 mb-4">Job Overview</h3>
          <div className="space-y-3.5">
            <div className="flex justify-between items-start gap-4">
              <div className="flex items-center gap-2 text-slate-500 shrink-0">
                <Calendar className="h-4 w-4" />
                <span className="text-[13px] font-bold">Request Date</span>
              </div>
              <span className="text-[13px] font-medium text-slate-900 text-right">{req?.createdAt ? new Date(req.createdAt).toLocaleString('en-IN', {day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit'}) : 'Invalid Date'}</span>
            </div>
            
            <div className="flex justify-between items-start gap-4">
              <div className="flex items-center gap-2 text-slate-500 shrink-0">
                <UserCircle className="h-4 w-4" />
                <span className="text-[13px] font-bold">Required Skill</span>
              </div>
              <span className="text-[13px] font-medium text-slate-900 text-right">{tradeName}</span>
            </div>

            <div className="flex justify-between items-start gap-4">
              <div className="flex items-center gap-2 text-slate-500 shrink-0">
                <Building2 className="h-4 w-4" />
                <span className="text-[13px] font-bold">Work Type</span>
              </div>
              <span className="text-[13px] font-medium text-slate-900 text-right capitalize">{req.bookingType || 'Construction Work'}</span>
            </div>

            <div className="flex justify-between items-start gap-4">
              <div className="flex items-center gap-2 text-slate-500 shrink-0">
                <Calendar className="h-4 w-4" />
                <span className="text-[13px] font-bold">Project Duration</span>
              </div>
              <span className="text-[13px] font-medium text-slate-900 text-right">{durationStr}</span>
            </div>

            <div className="flex justify-between items-start gap-4">
              <div className="flex items-center gap-2 text-slate-500 shrink-0">
                <Clock className="h-4 w-4" />
                <span className="text-[13px] font-bold">Work Time</span>
              </div>
              <span className="text-[13px] font-medium text-slate-900 text-right">{shiftStr}</span>
            </div>

            <div className="flex justify-between items-start gap-4">
              <div className="flex items-center gap-2 text-slate-500 shrink-0">
                <Users className="h-4 w-4" />
                <span className="text-[13px] font-bold">Workers Required</span>
              </div>
              <span className="text-[13px] font-bold text-slate-900 text-right">{totalRequired}</span>
            </div>

            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-2 text-slate-500 shrink-0">
                <AlertCircle className="h-4 w-4" />
                <span className="text-[13px] font-bold">Status</span>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone}`}>
                {statusLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Skill Lines */}
        <div className="rounded-[20px] bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] border border-slate-100">
          <h3 className="text-[15px] font-extrabold text-slate-900 mb-3">Skill Lines</h3>
          <div className="space-y-2">
            {(req.lines ?? []).map((line, i) => (
              <div key={i} className="flex justify-between items-center px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[14px] font-bold text-slate-700">{line.categoryId?.name || 'Worker'}</span>
                <span className="text-[14px] font-extrabold text-slate-900">× {line.quantity}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Corporate Client */}
        {req.clientId && (
          <div className="rounded-[20px] bg-indigo-50/50 p-5 shadow-sm border border-indigo-100/50">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-indigo-500" />
              <h3 className="text-[15px] font-extrabold text-slate-900">Corporate Client</h3>
            </div>
            <div>
              <p className="text-[15px] font-black text-slate-900">
                {companyName}
              </p>
              <p className="text-[13px] font-medium text-slate-500 mt-1">
                {req.clientId?.phone || 'Client Phone'}
              </p>
              <p className="text-[12px] text-slate-500 mt-1.5 leading-relaxed">
                {req.clientId?.corporateProfile?.registeredAddress || 'No address provided'}
              </p>
            </div>
          </div>
        )}

        {/* Assigned Roster */}
        {(!pending || assignments.length > 0) && (
          <div className="rounded-[20px] bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-amber-500" />
                <h3 className="text-[15px] font-extrabold text-slate-900">Assigned Roster</h3>
              </div>
              <div className="text-[13px] font-extrabold text-slate-500">
                {totalAssigned} / {totalRequired}
              </div>
            </div>
            
            {assignments.length === 0 ? (
              <div className="py-6 flex flex-col items-center justify-center text-center">
                <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                  <Users className="h-5 w-5 text-slate-300" />
                </div>
                <p className="text-[14px] font-bold text-slate-500">No workers assigned yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignments.map((a) => (
                  <Link key={a._id} to={`/vendor/attendance/${req.projectId?._id || req._id}/worker/${a.labourId?._id}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 transition hover:bg-slate-100 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white border border-slate-200">
                        <img src={a.labourId?.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.labourId?.fullName || 'W')}&background=random`} alt="Worker" className="h-full w-full object-cover" />
                      </div>
                      <div>
                        <p className="text-[14px] font-bold text-slate-900">
                          {a.labourId?.fullName || 'Worker'}
                        </p>
                        <p className="text-[11px] text-slate-500 font-medium">{a.labourId?.phone || a.status}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-white border border-slate-200 px-2.5 py-1 text-[10px] font-black uppercase text-slate-600">
                      {a.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Bottom Actions */}
      <div className="mt-4 p-4 pb-24 max-w-md mx-auto flex flex-col gap-3">
        {pending ? (
          <button onClick={() => acceptJob(id)} disabled={accepting} className="w-full flex items-center justify-center gap-2 rounded-[16px] bg-[#f5b800] py-3.5 text-[15px] font-black text-slate-900 transition hover:bg-[#e0a800] active:scale-[0.98] shadow-sm disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" /> Accept Job
          </button>
        ) : (req?.status === 'accepted' || req?.status === 'allocated' || req?.status === 'assigned') && totalAssigned < totalRequired ? (
          <button onClick={() => navigate(`/vendor/jobs/${id}/assign`)} className="w-full flex items-center justify-center gap-2 rounded-[16px] bg-[#f5b800] py-3.5 text-[15px] font-black text-slate-900 transition hover:bg-[#e0a800] active:scale-[0.98] shadow-sm">
            <Users className="h-4 w-4" /> Assign Workers
          </button>
        ) : !quotation && totalAssigned === totalRequired ? (
          <button onClick={() => setShowEditor(true)} className="w-full flex items-center justify-center gap-2 rounded-[16px] bg-[#f5b800] py-3.5 text-[15px] font-black text-slate-900 transition hover:bg-[#e0a800] active:scale-[0.98] shadow-sm">
            <FileText className="h-4 w-4" /> Create & Submit Quotation
          </button>
        ) : quotation && ['draft', 'submitted', 'under_review', 'revision_requested', 'revised'].includes(quotation.status) ? (
          <button onClick={() => setShowEditor(true)} className="w-full flex items-center justify-center gap-2 rounded-[16px] bg-[#f5b800] py-3.5 text-[15px] font-black text-slate-900 transition hover:bg-[#e0a800] active:scale-[0.98] shadow-sm">
            <FileText className="h-4 w-4" /> {quotation.status === 'revision_requested' ? 'Edit & Resubmit Quotation' : 'Edit Quotation'}
          </button>
        ) : null}
        
        <button className="w-full flex items-center justify-center gap-2 rounded-[16px] bg-white border border-slate-200 py-3.5 text-[15px] font-bold text-slate-600 transition hover:bg-slate-50 active:scale-[0.98] shadow-sm">
          <Phone className="h-4 w-4" /> Contact Client
        </button>
      </div>

      {/* Fullscreen Quotation Editor Modal */}
      {showEditor && (
        <div className="fixed top-0 bottom-[calc(68px+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-slate-950/80 backdrop-blur-md z-50 flex flex-col h-[calc(100vh-68px-env(safe-area-inset-bottom,0px))] overflow-y-auto">
          {/* Header */}
          <div className="bg-slate-900 border-b border-slate-800 px-4 py-4 sticky top-0 z-20 flex justify-between items-center text-white">
            <div>
              <h3 className="text-sm font-black">Quotation Builder</h3>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">Real-time Auto Calculation</p>
            </div>
            <button 
              onClick={() => setShowEditor(false)}
              className="text-xs font-bold text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded-lg"
            >
              Cancel
            </button>
          </div>

          <div className="p-5 space-y-5 flex-1 bg-slate-900 text-slate-200">
            
            {/* Real-time Sticky Cost Summary Card */}
            <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 border border-indigo-800/60 p-4 rounded-2xl shadow-lg space-y-2">
              <span className="text-[9px] font-black text-indigo-300 tracking-wider uppercase">Live Cost Calculator Summary</span>
              
              <div className="space-y-1 text-xs text-indigo-200">
                <div className="flex justify-between">
                  <span>Labour Cost:</span>
                  <span className="font-bold">₹{(Number(labourRate) * Number(workersCount) * Number(workingDays)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Logistics Charges:</span>
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
                <span>Grand Total:</span>
                <span className="text-[20px] text-brand">₹{
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

            {/* Input Config Fields */}
            <div className="space-y-4 pt-2">
              
              {/* Labour Rate */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Labour Rate Per Worker (₹ / Day)</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-slate-500 text-xs font-semibold">₹</span>
                  </div>
                  <input 
                    type="number"
                    value={labourRate || ''}
                    min="0"
                    onChange={(e) => setLabourRate(Number(e.target.value))}
                    className="block w-full rounded-xl border-0 py-2.5 pl-7 pr-3 text-sm text-white shadow-sm ring-1 ring-inset ring-slate-800 placeholder:text-slate-600 focus:ring-2 focus:ring-inset focus:ring-brand bg-slate-950 focus:outline-none"
                  />
                </div>
              </div>

              {/* Number of Workers & Working Days */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Workers Count</label>
                  <input 
                    type="number"
                    value={workersCount || ''}
                    min="1"
                    onChange={(e) => setWorkersCount(Number(e.target.value))}
                    className="block w-full rounded-xl border-0 py-2.5 px-3 text-sm text-white shadow-sm ring-1 ring-inset ring-slate-800 bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Working Days</label>
                  <input 
                    type="number"
                    value={workingDays || ''}
                    min="1"
                    onChange={(e) => setWorkingDays(Number(e.target.value))}
                    className="block w-full rounded-xl border-0 py-2.5 px-3 text-sm text-white shadow-sm ring-1 ring-inset ring-slate-800 bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>

              {/* Transportation & Equipment */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Transportation (₹)</label>
                  <input 
                    type="number"
                    value={transportation || ''}
                    min="0"
                    onChange={(e) => setTransportation(Number(e.target.value))}
                    className="block w-full rounded-xl border-0 py-2.5 px-3 text-sm text-white shadow-sm ring-1 ring-inset ring-slate-800 bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Equipment (₹)</label>
                  <input 
                    type="number"
                    value={equipment || ''}
                    min="0"
                    onChange={(e) => setEquipment(Number(e.target.value))}
                    className="block w-full rounded-xl border-0 py-2.5 px-3 text-sm text-white shadow-sm ring-1 ring-inset ring-slate-800 bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>

              {/* Food & Accommodation */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Food Charges (₹)</label>
                  <input 
                    type="number"
                    value={food || ''}
                    min="0"
                    onChange={(e) => setFood(Number(e.target.value))}
                    className="block w-full rounded-xl border-0 py-2.5 px-3 text-sm text-white shadow-sm ring-1 ring-inset ring-slate-800 bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Accommodation (₹)</label>
                  <input 
                    type="number"
                    value={accommodation || ''}
                    min="0"
                    onChange={(e) => setAccommodation(Number(e.target.value))}
                    className="block w-full rounded-xl border-0 py-2.5 px-3 text-sm text-white shadow-sm ring-1 ring-inset ring-slate-800 bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>

              {/* Other, GST % and Discount */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 mb-1.5 truncate">Other (₹)</label>
                  <input 
                    type="number"
                    value={other || ''}
                    min="0"
                    onChange={(e) => setOther(Number(e.target.value))}
                    className="block w-full rounded-xl border-0 py-2.5 px-2 text-sm text-white shadow-sm ring-1 ring-inset ring-slate-800 bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 mb-1.5 truncate">GST (%)</label>
                  <input 
                    type="number"
                    value={gstPercentage || ''}
                    min="0"
                    onChange={(e) => setGstPercentage(Number(e.target.value))}
                    className="block w-full rounded-xl border-0 py-2.5 px-2 text-sm text-white shadow-sm ring-1 ring-inset ring-slate-800 bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 mb-1.5 truncate">Discount (₹)</label>
                  <input 
                    type="number"
                    value={discount || ''}
                    min="0"
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="block w-full rounded-xl border-0 py-2.5 px-2 text-sm text-white shadow-sm ring-1 ring-inset ring-slate-800 bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Notes & Terms (Optional)</label>
                <textarea 
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Mention standard hours, replacement terms, etc."
                  className="block w-full rounded-xl border-0 py-2 px-3 text-xs text-white shadow-sm ring-1 ring-inset ring-slate-800 bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand resize-none placeholder:text-slate-600"
                />
              </div>

            </div>
          </div>

          {/* Submit Action footer */}
          <div className="bg-slate-900 border-t border-slate-800 p-4 sticky bottom-0 z-20">
            <button 
              onClick={async () => {
                try {
                  await submitQuotation({
                    id,
                    requestId: req._id,
                    labourRatePerWorker: labourRate,
                    numberOfWorkers: workersCount,
                    workingDays,
                    transportationCharges: transportation,
                    equipmentCharges: equipment,
                    foodCharges: food,
                    accommodationCharges: accommodation,
                    otherCharges: other,
                    gstPercentage,
                    discount,
                    notes
                  }).unwrap()
                  alert('Quotation submitted successfully')
                  setShowEditor(false)
                } catch (err) {
                  alert(err?.data?.message || 'Failed to submit quotation')
                }
              }}
              disabled={submittingQuote || Number(labourRate) <= 0 || Number(workersCount) <= 0 || Number(workingDays) <= 0}
              className="w-full flex items-center justify-center gap-2 rounded-[16px] bg-brand py-3.5 text-[15px] font-black text-slate-900 transition hover:bg-[#e0a800] active:scale-[0.98] disabled:opacity-40"
            >
              Submit Quotation to Client
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
