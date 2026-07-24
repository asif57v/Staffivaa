import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Users, Building2, MapPin, Calendar, Clock, UserCircle, CheckCircle2, Construction, AlertCircle, XCircle, Phone, Star, Award, Shield, FileDown, MessageSquare, ChevronDown, ChevronUp, Check, ArrowRight, FileText } from 'lucide-react'
import { useGetRequestQuery, useRespondToQuotationMutation } from '../../../store/api/workforceApi.js'
import { useAuth } from '../../../hooks/useAuth.js'
import { useEffect, useState } from 'react'
import { useSocket } from '../../../hooks/useSocket.js'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const TIMELINE_STEPS = [
  { label: 'Request Created', statusKey: 'created' },
  { label: 'Vendor Accepted', statusKey: 'accepted' },
  { label: 'Workers Assigned', statusKey: 'assigned' },
  { label: 'Quotation Submitted', statusKey: 'quote_submitted' },
  { label: 'Corporate Reviewing Quote', statusKey: 'quote_review' },
  { label: 'Quote Approved', statusKey: 'quote_approved' },
  { label: 'Platform Fee / Payment', statusKey: 'advance_payment' },
  { label: 'Project Active', statusKey: 'project_active' },
  { label: 'Workers Check-In', statusKey: 'check_in' },
  { label: 'Attendance Running', statusKey: 'attendance' },
  { label: 'Project Completed', statusKey: 'completed' },
]

const getTimelineStepStatus = (stepKey, request, quotation, assignments) => {
  const requestStatus = request?.status
  const quoteStatus = quotation?.status
  const totalAssigned = assignments?.length || 0
  const totalRequired = (request?.lines ?? []).reduce((acc, line) => acc + (line.quantity || 1), 0)

  switch (stepKey) {
    case 'created':
      return 'completed'
    case 'accepted':
      return !['pending_review', 'searching', 'allocating'].includes(requestStatus) ? 'completed' : 'pending'
    case 'assigned':
      if (totalAssigned >= totalRequired && totalRequired > 0) return 'completed'
      return ['assigned', 'payment_pending', 'advance_paid', 'project_active', 'attendance_tracking', 'completed', 'settlement_pending', 'settlement_completed'].includes(requestStatus) ? 'completed' : 'pending'
    case 'quote_submitted':
      if (['submitted', 'under_review', 'revision_requested', 'revised', 'approved'].includes(quoteStatus)) return 'completed'
      return 'pending'
    case 'quote_review':
      if (quoteStatus === 'approved') return 'completed'
      if (['submitted', 'under_review', 'revised'].includes(quoteStatus)) return 'active'
      if (quoteStatus === 'revision_requested') return 'active'
      return 'pending'
    case 'quote_approved':
      if (quoteStatus === 'approved') return 'completed'
      return 'pending'
    case 'advance_payment':
      if (['advance_paid', 'project_active', 'attendance_tracking', 'completed', 'settlement_pending', 'settlement_completed'].includes(requestStatus)) return 'completed'
      if (['payment_pending', 'platform_fee_pending'].includes(requestStatus)) return 'active'
      return 'pending'
    case 'project_active':
      if (['project_active', 'attendance_tracking', 'completed', 'settlement_pending', 'settlement_completed'].includes(requestStatus)) return 'completed'
      return 'pending'
    case 'check_in':
      if (['attendance_tracking', 'completed', 'settlement_pending', 'settlement_completed'].includes(requestStatus)) return 'completed'
      if (requestStatus === 'project_active') return 'active'
      return 'pending'
    case 'attendance':
      if (requestStatus === 'attendance_tracking') return 'active'
      if (['completed', 'settlement_pending', 'settlement_completed'].includes(requestStatus)) return 'completed'
      return 'pending'
    case 'completed':
      if (['completed', 'settlement_pending', 'settlement_completed'].includes(requestStatus)) return 'completed'
      return 'pending'
    default:
      return 'pending'
  }
}

const handleDownloadPDF = (quotation, request, allocation) => {
  const printWindow = window.open('', '_blank')
  const durationInDays = quotation.workingDays || 1
  const companyName = request.clientId?.corporateProfile?.companyName || request.clientId?.fullName || 'Client'
  const vendorName = allocation?.vendorId?.contractorProfile?.companyName || allocation?.vendorId?.fullName || 'Vendor'

  printWindow.document.write(`
    <html>
      <head>
        <title>Quotation - ${request.reference}</title>
        <style>
          body { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #1e293b; padding: 40px; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { font-size: 24px; font-weight: 800; color: #f5b800; }
          .title { font-size: 20px; font-weight: 800; text-align: right; text-transform: uppercase; color: #64748b; }
          .info-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
          .section-title { font-size: 12px; font-weight: 800; text-transform: uppercase; color: #94a3b8; margin-bottom: 10px; }
          .details-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
          .details-table th { background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 12px; text-align: left; font-size: 12px; font-weight: 800; color: #64748b; }
          .details-table td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 500; }
          .total-box { margin-left: auto; width: 300px; border-top: 2px solid #e2e8f0; padding-top: 15px; }
          .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
          .grand-total { font-weight: 900; font-size: 18px; color: #0f172a; margin-top: 10px; border-top: 1px solid #f1f5f9; padding-top: 10px; }
          .footer { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 80px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">STAFFIVAA</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Premium Workforce Solutions</div>
          </div>
          <div>
            <div class="title">Official Quotation</div>
            <div style="font-size: 12px; color: #64748b; text-align: right; margin-top: 4px;">Ref: ${request.reference}</div>
          </div>
        </div>
        
        <div class="info-grid">
          <div>
            <div class="section-title">Quoted For:</div>
            <div style="font-weight: 700; font-size: 15px;">${companyName}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Project: ${request.projectId?.name || 'Construction Work'}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Site: ${request.siteId?.name || request.locationText}</div>
          </div>
          <div style="text-align: right;">
            <div class="section-title">Quoted By:</div>
            <div style="font-weight: 700; font-size: 15px;">${vendorName}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Email/Phone: ${allocation?.vendorId?.email || ''} / ${allocation?.vendorId?.phone || ''}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Date: ${new Date(quotation.createdAt).toLocaleDateString('en-IN')}</div>
          </div>
        </div>

        <table class="details-table">
          <thead>
            <tr>
              <th>Item Description</th>
              <th style="text-align: center;">Rate (₹)</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: center;">Days</th>
              <th style="text-align: right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Labour Charges (${request.lines?.[0]?.categoryId?.name || 'Workforce Crew'})</td>
              <td style="text-align: center;">₹${quotation.labourRatePerWorker}</td>
              <td style="text-align: center;">${quotation.numberOfWorkers}</td>
              <td style="text-align: center;">${durationInDays}</td>
              <td style="text-align: right;">₹${quotation.labourCost}</td>
            </tr>
            ${quotation.transportationCharges ? `
              <tr>
                <td>Transportation Charges</td>
                <td style="text-align: center;">—</td>
                <td style="text-align: center;">—</td>
                <td style="text-align: center;">—</td>
                <td style="text-align: right;">₹${quotation.transportationCharges}</td>
              </tr>
            ` : ''}
            ${quotation.equipmentCharges ? `
              <tr>
                <td>Equipment & Safety Gear Charges</td>
                <td style="text-align: center;">—</td>
                <td style="text-align: center;">—</td>
                <td style="text-align: center;">—</td>
                <td style="text-align: right;">₹${quotation.equipmentCharges}</td>
              </tr>
            ` : ''}
            ${quotation.foodCharges ? `
              <tr>
                <td>Food & Catering Allowance</td>
                <td style="text-align: center;">—</td>
                <td style="text-align: center;">—</td>
                <td style="text-align: center;">—</td>
                <td style="text-align: right;">₹${quotation.foodCharges}</td>
              </tr>
            ` : ''}
            ${quotation.accommodationCharges ? `
              <tr>
                <td>Accommodation & Boarding Charges</td>
                <td style="text-align: center;">—</td>
                <td style="text-align: center;">—</td>
                <td style="text-align: center;">—</td>
                <td style="text-align: right;">₹${quotation.accommodationCharges}</td>
              </tr>
            ` : ''}
            ${quotation.otherCharges ? `
              <tr>
                <td>Other Miscellaneous Charges</td>
                <td style="text-align: center;">—</td>
                <td style="text-align: center;">—</td>
                <td style="text-align: center;">—</td>
                <td style="text-align: right;">₹${quotation.otherCharges}</td>
              </tr>
            ` : ''}
          </tbody>
        </table>

        <div class="total-box">
          <div class="total-row">
            <span style="color: #64748b; font-weight: 600;">Subtotal</span>
            <span style="font-weight: 700;">₹${quotation.labourCost + quotation.transportationCharges + quotation.equipmentCharges + quotation.foodCharges + quotation.accommodationCharges + quotation.otherCharges}</span>
          </div>
          ${quotation.discount ? `
            <div class="total-row" style="color: #ef4444;">
              <span>Discount</span>
              <span>- ₹${quotation.discount}</span>
            </div>
          ` : ''}
          <div class="total-row">
            <span style="color: #64748b; font-weight: 600;">GST (${quotation.gstPercentage || 18}%)</span>
            <span style="font-weight: 700;">₹${quotation.gst}</span>
          </div>
          <div class="total-row grand-total">
            <span>Grand Total</span>
            <span>₹${quotation.grandTotal}</span>
          </div>
        </div>

        <div style="margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
          <div class="section-title">Terms & Notes:</div>
          <div style="font-size: 12px; line-height: 1.6; color: #64748b;">
            ${quotation.notes || 'No notes provided by vendor.'}
          </div>
        </div>

        <div class="footer">
          Thank you for choosing Staffivaa.
        </div>
        
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          }
        </script>
      </body>
    </html>
  `)
  printWindow.document.close()
}

export function CorporateRequestDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { data, isLoading, isError, refetch } = useGetRequestQuery(id, { skip: !id })
  const [respondToQuotation, { isLoading: responding }] = useRespondToQuotationMutation()

  const [showBreakdown, setShowBreakdown] = useState(false)
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [revisionFeedback, setRevisionFeedback] = useState('')
  const [showTimeline, setShowTimeline] = useState(false)

  const socket = useSocket()

  useEffect(() => {
    if (socket && id) {
      socket.emit('join_request', id)

      const handleUpdate = () => refetch()
      socket.on('vendor_accepted_job', handleUpdate)
      socket.on('vendor_accepted_request', handleUpdate)
      socket.on('corporate_fee_pending', handleUpdate)
      socket.on('vendor_assigned_workforce', handleUpdate)
      socket.on('work_progress_update', handleUpdate)
      socket.on('work_completed', handleUpdate)
      socket.on('request_status_update', handleUpdate)
      socket.on('vendor_submitted_quotation', handleUpdate)
      socket.on('corporate_responded_quotation', handleUpdate)
      
      return () => {
        socket.emit('leave_request', id)
        socket.off('vendor_accepted_job', handleUpdate)
        socket.off('vendor_accepted_request', handleUpdate)
        socket.off('corporate_fee_pending', handleUpdate)
        socket.off('vendor_assigned_workforce', handleUpdate)
        socket.off('work_progress_update', handleUpdate)
        socket.off('work_completed', handleUpdate)
        socket.off('request_status_update', handleUpdate)
        socket.off('vendor_submitted_quotation', handleUpdate)
        socket.off('corporate_responded_quotation', handleUpdate)
      }
    }
  }, [socket, id, refetch])

  const request = data?.request
  const allocation = data?.allocation
  const assignments = data?.assignments ?? []
  const quotation = data?.quotation
  const paymentSummary = data?.paymentSummary
  
  const totalRequired = (request?.lines ?? []).reduce((acc, line) => acc + (line.quantity || 1), 0)
  const totalAssigned = assignments.length

  if (isLoading) {
    return (
      <div className="p-4">
        <p className="text-sm text-slate-500">Loading request…</p>
      </div>
    )
  }

  if (isError || !request) {
    return (
      <div className="p-4 rounded-[20px] border border-rose-200/90 bg-rose-50/50 mt-4 mx-4">
        <p className="text-sm font-semibold text-rose-800">Request not found.</p>
        <Link to="/corporate/requests" className="mt-3 inline-block text-sm font-bold text-brand">
          Back
        </Link>
      </div>
    )
  }

  const projectName = request.projectId?.name || 'Project Name N/A'
  const companyName = user?.corporateProfile?.companyName || user?.fullName || 'Company Name N/A'
  const tradeName = request.lines?.[0]?.categoryId?.name || 'Skill Not Specified'
  const shiftStr = (request.shiftStart && request.shiftEnd) ? `${request.shiftStart} - ${request.shiftEnd}` : 'Standard Shift'
  
  let statusLabel = 'Pending'
  let statusTone = 'bg-orange-50 text-orange-700'
  let StatusIcon = AlertCircle
  
  if (request.status === 'accepted' || request.status === 'allocated' || request.status === 'assigned') {
    statusLabel = 'Assigned'
    statusTone = 'bg-blue-50 text-blue-700 border border-blue-100'
    StatusIcon = Users
  } else if (request.status === 'vendor_platform_fee_pending') {
    statusLabel = 'Awaiting Vendor Fee'
    statusTone = 'bg-amber-50 text-amber-700 border border-amber-200'
    StatusIcon = AlertCircle
  } else if (request.status === 'corporate_platform_fee_pending') {
    statusLabel = 'Platform Fee Pending'
    statusTone = 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
    StatusIcon = AlertCircle
  } else if (request.status === 'quotation_unlocked') {
    statusLabel = 'Quotation Phase'
    statusTone = 'bg-blue-50 text-blue-700 border border-blue-100'
    StatusIcon = FileText
  } else if (request.status === 'payment_pending') {
    statusLabel = 'Payment Pending'
    statusTone = 'bg-amber-50 text-amber-700 border border-amber-200'
    StatusIcon = AlertCircle
  } else if (request.status === 'advance_paid') {
    statusLabel = 'Advance Paid'
    statusTone = 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    StatusIcon = CheckCircle2
  } else if (request.status === 'project_active') {
    statusLabel = 'Project Active'
    statusTone = 'bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse'
    StatusIcon = Construction
  } else if (request.status === 'settlement_pending') {
    statusLabel = 'Settlement Pending'
    statusTone = 'bg-amber-50 text-amber-700 border border-amber-200'
    StatusIcon = AlertCircle
  } else if (request.status === 'settlement_completed') {
    statusLabel = 'Settlement Completed'
    statusTone = 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    StatusIcon = CheckCircle2
  } else if (request.status === 'completed') {
    statusLabel = 'Completed'
    statusTone = 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    StatusIcon = CheckCircle2
  } else if (request.status === 'cancelled' || request.status === 'rejected') {
    statusLabel = request.status.charAt(0).toUpperCase() + request.status.slice(1)
    statusTone = 'bg-rose-50 text-rose-700 border border-rose-200'
    StatusIcon = XCircle
  }

  const durationStr = `${formatDate(request.startDate)}${request.endDate ? ` – ${formatDate(request.endDate)}` : ''}`

  const handleQuotationAction = async (action, feedback) => {
    try {
      await respondToQuotation({ id, action, feedback }).unwrap()
      alert(`Quotation successfully ${action === 'approve' ? 'approved' : action === 'revision' ? 'revision requested' : 'rejected'}`)
      setShowRevisionModal(false)
      setRevisionFeedback('')
    } catch (err) {
      alert(err?.data?.message || 'Action failed')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-40">
      {/* Sticky Header */}
      <header className="bg-white px-4 py-4 sticky top-0 z-30 shadow-sm border-b border-slate-100 flex items-center gap-3">
        <Link to="/corporate/requests" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-100 transition hover:bg-slate-50 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <h1 className="text-base font-extrabold text-slate-900">Request Details</h1>
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
              
              {request.siteId?.name && (
                <div className="flex items-center gap-1.5 mt-0.5 text-slate-700">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <p className="text-[14px] font-bold truncate">{request.siteId.name}</p>
                </div>
              )}

              <div className="flex items-center gap-1.5 mt-0.5 text-slate-500">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <p className="text-[13px] font-medium truncate">{companyName}</p>
              </div>
              
              <div className="mt-2.5 flex items-center gap-1.5 text-slate-500">
                <MapPin className="h-3 w-3 shrink-0" />
                <p className="text-[12px] font-medium truncate">{request.locationText || 'Location TBD'}</p>
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
              ID: {request.reference}
            </p>
          </div>
        </div>

        {/* Professional Step-by-Step Timeline (Collapsible) */}
        <div className="rounded-[20px] bg-white p-4 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] border border-slate-100">
          <button 
            onClick={() => setShowTimeline(!showTimeline)} 
            className="w-full flex items-center justify-between text-left focus:outline-none"
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-brand" />
              <span className="text-[14px] font-extrabold text-slate-900">Project Workflow Timeline</span>
            </div>
            {showTimeline ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </button>
          
          {showTimeline && (
            <div className="mt-4 pt-4 border-t border-slate-100 pl-2 space-y-4">
              {TIMELINE_STEPS
                .map((step) => ({ ...step, computedStatus: getTimelineStepStatus(step.statusKey, request, quotation, assignments) }))
                .filter((step, idx, arr) => {
                  if (step.computedStatus !== 'pending') return true;
                  const firstPendingIdx = arr.findIndex(s => s.computedStatus === 'pending');
                  return idx === firstPendingIdx; // only show the first pending step
                })
                .map((step, idx, arr) => {
                const status = step.computedStatus
                let badgeColor = 'bg-slate-100 text-slate-400'
                let lineCol = 'bg-slate-100'
                let bullet = <span className="h-2 w-2 rounded-full bg-slate-300" />

                if (status === 'completed') {
                  badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  lineCol = 'bg-emerald-400'
                  bullet = <Check className="h-3 w-3 text-white" strokeWidth={3} />
                } else if (status === 'active') {
                  badgeColor = 'bg-yellow-50 text-yellow-800 border-yellow-200 animate-pulse'
                  lineCol = 'bg-yellow-400'
                  bullet = <span className="h-2 w-2 rounded-full bg-yellow-500" />
                }

                return (
                  <div key={idx} className="flex gap-3 items-start relative">
                    {/* Bullet line */}
                    {idx < arr.length - 1 && (
                      <div className={`absolute left-4 top-8 w-[2px] h-6 -ml-[1px] ${lineCol}`} />
                    )}
                    <div className={`h-8 w-8 rounded-full border flex items-center justify-center shrink-0 ${status === 'completed' ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-200'}`}>
                      {bullet}
                    </div>
                    <div className="pt-1.5 flex-1 min-w-0">
                      <p className={`text-[12px] font-bold ${status === 'completed' ? 'text-slate-800' : status === 'active' ? 'text-brand font-extrabold' : 'text-slate-400'}`}>
                        {step.label}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Enterprise Quotation Panel */}
        {quotation ? (
          <div className="rounded-[20px] bg-white p-5 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.12)] border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-[16px] font-black text-slate-900 tracking-tight">Enterprise Quotation</h3>
                <p className="text-[11px] text-slate-400 font-semibold uppercase mt-0.5">Ref: {request.reference}-Q</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                quotation.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                quotation.status === 'revision_requested' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                quotation.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                {quotation.status.replace('_', ' ')}
              </span>
            </div>

            {/* Vendor Profile Brief */}
            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-extrabold text-slate-900 truncate">
                  {quotation.vendorId?.contractorProfile?.companyName || quotation.vendorId?.fullName || 'Vendor Name'}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-bold mt-0.5">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                  <span>{quotation.vendorId?.contractorProfile?.rating || '4.8'} (Rating)</span>
                  <span>&middot;</span>
                  <Award className="h-3 w-3 text-indigo-500 shrink-0" />
                  <span>{quotation.vendorId?.contractorProfile?.experience || '5+'} Years Exp.</span>
                </div>
                {['project_active', 'in_progress', 'completed', 'settlement_pending', 'settlement_completed'].includes(request.status) ? (
                  <div className="flex items-center gap-1.5 text-[12px] text-emerald-600 font-bold mt-1">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{quotation.vendorId?.phone || '+91-XXXXXXXXXX'}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-500 font-bold mt-1">
                    <Phone className="h-3.5 w-3.5" />
                    <span>Number hidden until fee paid</span>
                  </div>
                )}
              </div>
            </div>

            {/* Real-time Pricing Table */}
            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between items-center py-1">
                <span className="font-bold">Labour Cost ({quotation.numberOfWorkers} workers &times; {quotation.workingDays} days)</span>
                <span className="font-extrabold text-slate-900">₹{quotation.labourCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="font-bold">Transportation Charges</span>
                <span className="font-extrabold text-slate-900">₹{(quotation.transportationCharges || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="font-bold">Equipment & Safety Charges</span>
                <span className="font-extrabold text-slate-900">₹{(quotation.equipmentCharges || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="font-bold">Catering & Food Charges</span>
                <span className="font-extrabold text-slate-900">₹{(quotation.foodCharges || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="font-bold">Accommodation Charges</span>
                <span className="font-extrabold text-slate-900">₹{(quotation.accommodationCharges || 0).toLocaleString()}</span>
              </div>
              {quotation.otherCharges > 0 && (
                <div className="flex justify-between items-center py-1">
                  <span className="font-bold">Other Logistics / Charges</span>
                  <span className="font-extrabold text-slate-900">₹{quotation.otherCharges.toLocaleString()}</span>
                </div>
              )}
              {quotation.discount > 0 && (
                <div className="flex justify-between items-center py-1 text-emerald-600 font-bold">
                  <span>Special Vendor Discount</span>
                  <span>- ₹{quotation.discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-1">
                <span className="font-bold">GST ({quotation.gstPercentage}%)</span>
                <span className="font-extrabold text-slate-900">₹{quotation.gst.toLocaleString()}</span>
              </div>

              {/* Grand Total box (Only Vendor part) */}
              <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl text-white font-extrabold mt-3 shadow-sm border border-slate-900">
                <span className="text-slate-300 text-[13px]">Total Project Value</span>
                <span className="text-[18px]">₹{quotation.grandTotal.toLocaleString()}</span>
              </div>

            </div>

            {/* Included Services Checks */}
            <div className="border-t border-slate-100 pt-4">
              <span className="text-[11px] font-black text-slate-400 tracking-wider uppercase">Included Platform Services</span>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                  <Shield className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Safety Equipment
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                  <Users className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Worker Replacement
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                  <Clock className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Attendance Tracking
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                  <Phone className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> 24/7 Platform Support
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 col-span-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500 shrink-0" /> Escrow Payment Protection Included
                </div>
              </div>
            </div>

            {/* Quotation Actions */}
            <div className="border-t border-slate-100 pt-4 flex flex-col gap-2">
              {['submitted', 'under_review', 'revised'].includes(quotation.status) ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => handleQuotationAction('approve')} 
                      disabled={responding}
                      className="w-full flex items-center justify-center gap-1.5 rounded-[12px] bg-slate-900 text-white font-extrabold py-2.5 text-[13px] hover:bg-slate-800 transition active:scale-[0.98] disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" /> Accept Quote
                    </button>
                    <button 
                      onClick={() => setShowRevisionModal(true)} 
                      disabled={responding}
                      className="w-full flex items-center justify-center gap-1.5 rounded-[12px] bg-amber-50 border border-amber-200 text-amber-800 font-extrabold py-2.5 text-[13px] hover:bg-amber-100 transition active:scale-[0.98] disabled:opacity-50"
                    >
                      <MessageSquare className="h-4 w-4" /> Request Revision
                    </button>
                  </div>
                  <button 
                    onClick={() => handleQuotationAction('reject')} 
                    disabled={responding}
                    className="w-full text-center text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100/50 py-2.5 rounded-xl border border-rose-200/50 transition"
                  >
                    Reject Quotation
                  </button>
                </>
              ) : null}

              {quotation.status === 'revision_requested' && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl text-[12px] text-amber-800 font-medium">
                  <p className="font-extrabold mb-1">Feedback sent to vendor:</p>
                  <p className="italic">"{quotation.feedback || 'No comments'}"</p>
                  <p className="mt-2 text-[10px] text-slate-400 font-bold">Waiting for vendor to submit a revised quotation.</p>
                </div>
              )}

              {/* Utility actions */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button 
                  onClick={() => setShowBreakdown(true)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  View Breakdown
                </button>
                <button 
                  onClick={() => handleDownloadPDF(quotation, request, allocation)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  <FileDown className="h-3.5 w-3.5" /> Download PDF
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-[20px] bg-white p-5 border border-slate-200 text-center space-y-3">
            <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Quotation Pending</h4>
              <p className="text-xs text-slate-500 mt-1 leading-normal">
                The vendor is currently allocating workers and compiling the project rates. Once submitted, the official quotation summary will appear here for review.
              </p>
            </div>
          </div>
        )}

        {/* Request Overview */}
        <div className="rounded-[20px] bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] border border-slate-100">
          <h3 className="text-[15px] font-extrabold text-slate-900 mb-4">Request Overview</h3>
          <div className="space-y-3.5">
            <div className="flex justify-between items-start gap-4">
              <div className="flex items-center gap-2 text-slate-500 shrink-0">
                <Calendar className="h-4 w-4" />
                <span className="text-[13px] font-bold">Request Date</span>
              </div>
              <span className="text-[13px] font-medium text-slate-900 text-right">{new Date(request.createdAt).toLocaleString('en-IN', {day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit'})}</span>
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
              <span className="text-[13px] font-medium text-slate-900 text-right capitalize">{request.bookingType || 'Construction Work'}</span>
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
            {(request.lines ?? []).map((line, i) => (
              <div key={i} className="flex justify-between items-center px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[14px] font-bold text-slate-700">{line.categoryId?.name || 'Worker'}</span>
                <span className="text-[14px] font-extrabold text-slate-900">× {line.quantity}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Vendor Partner */}
        {allocation?.vendorId && (
          <div className="rounded-[20px] bg-[#fffdf0] p-5 shadow-sm border border-amber-100">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-amber-500" />
              <h3 className="text-[15px] font-extrabold text-slate-900">Vendor Partner</h3>
            </div>
            <div>
              <p className="text-[15px] font-black text-slate-900">
                {allocation.vendorId?.contractorProfile?.companyName || allocation.vendorId?.fullName || 'Vendor Name N/A'}
              </p>
              {['project_active', 'in_progress', 'completed', 'settlement_pending', 'settlement_completed'].includes(request.status) ? (
                <>
                  <p className="text-[13px] font-medium text-emerald-600 mt-1 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> {allocation.vendorId?.phone || 'Phone N/A'}
                  </p>
                  <p className="text-[12px] text-slate-500 mt-1.5 leading-relaxed">
                    {allocation.vendorId?.contractorProfile?.businessAddress || 'Business Address N/A'}
                  </p>
                </>
              ) : (
                <p className="text-[12px] font-bold text-amber-500 mt-1 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Information hidden until fee paid
                </p>
              )}
              <div className="mt-3 inline-block rounded bg-amber-100 px-2 py-1 text-[9px] font-black uppercase text-amber-700 tracking-wider">
                ACCEPTED JOB
              </div>
            </div>
          </div>
        )}

        {/* Assigned Roster */}
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
                <Link key={a._id} to={`/corporate/attendance/${request.projectId?._id || request._id}/worker/${a.labourId?._id}`} className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors rounded-2xl border border-slate-100 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white border border-slate-200">
                      <img src={a.labourId?.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.labourId?.fullName || 'W')}&background=random`} alt="Worker" className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-slate-900">
                        {a.labourId?.fullName || 'Worker'}
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {['project_active', 'in_progress', 'completed', 'settlement_pending', 'settlement_completed'].includes(request.status) ? (a.labourId?.phone || a.status) : 'Number hidden'}
                      </p>
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

      </div>

      {/* Bottom Actions */}
      <div className="mt-4 p-4 pb-24 max-w-md mx-auto flex flex-col gap-3">
        {request.status === 'corporate_platform_fee_pending' ? (
          <Link to={`/corporate/requests/${id}/payment`} className="w-full flex items-center justify-center gap-2 rounded-[16px] bg-[#f5b800] py-3.5 text-[15px] font-black text-slate-900 transition hover:bg-[#e0a800] active:scale-[0.98] shadow-sm">
            Pay Platform Fee to Unlock Quotation Phase
          </Link>
        ) : request.status === 'vendor_platform_fee_pending' ? (
          <button disabled className="w-full flex items-center justify-center gap-2 rounded-[16px] bg-emerald-50 border border-emerald-200 py-3.5 text-[15px] font-bold text-emerald-600 cursor-not-allowed shadow-sm">
            Waiting for Vendor to Pay Platform Fee...
          </button>
        ) : (
          <>
            <button className="w-full flex items-center justify-center gap-2 rounded-[16px] bg-[#f5b800] py-3.5 text-[15px] font-black text-slate-900 transition hover:bg-[#e0a800] active:scale-[0.98] shadow-sm">
              <Users className="h-4 w-4" /> Manage Roster
            </button>
            <button className="w-full flex items-center justify-center gap-2 rounded-[16px] bg-white border border-slate-200 py-3.5 text-[15px] font-bold text-slate-600 transition hover:bg-slate-50 active:scale-[0.98] shadow-sm">
              <Phone className="h-4 w-4" /> Contact Vendor
            </button>
          </>
        )}
      </div>

      {/* Revision Request Feedback Modal */}
      {showRevisionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl border border-slate-100 space-y-4">
            <div>
              <h4 className="text-sm font-black text-slate-900">Request Revision</h4>
              <p className="text-[11px] text-slate-400 font-semibold mt-1">Send pricing feedback to the vendor partner.</p>
            </div>
            
            <textarea 
              rows={4}
              placeholder='e.g. "This quotation exceeds our budget. Please reduce transportation charges."'
              value={revisionFeedback}
              onChange={(e) => setRevisionFeedback(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand bg-white resize-none"
            />
            
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => setShowRevisionModal(false)}
                className="w-full rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleQuotationAction('revision', revisionFeedback)}
                disabled={!revisionFeedback.trim() || responding}
                className="w-full rounded-xl bg-slate-900 text-white py-2.5 text-xs font-bold hover:bg-slate-800 disabled:opacity-50"
              >
                Submit Feedback
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Breakdown Modal */}
      {showBreakdown && quotation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl border border-slate-100 max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-black text-slate-900">Quotation Detailed Breakdown</h4>
              <button onClick={() => setShowBreakdown(false)} className="text-slate-400 hover:text-slate-600 text-xs font-black">Close</button>
            </div>
            
            <div className="space-y-4 text-xs">
              {/* Calculations Explanation */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase">Cost Formulas</span>
                <div className="space-y-1 text-slate-600 leading-normal">
                  <p><strong>Labour Cost Calculation:</strong></p>
                  <p>₹{quotation.labourRatePerWorker} (Rate) &times; {quotation.numberOfWorkers} (Workers) &times; {quotation.workingDays} (Days) = <strong>₹{quotation.labourCost.toLocaleString()}</strong></p>
                  
                  <p className="mt-2"><strong>Taxable Cost:</strong></p>
                  <p>Labour Cost + Logistics - Discount</p>
                  <p>₹{quotation.labourCost} + ₹{quotation.transportationCharges + quotation.equipmentCharges + quotation.foodCharges + quotation.accommodationCharges + quotation.otherCharges} - ₹{quotation.discount} = <strong>₹{(quotation.labourCost + quotation.transportationCharges + quotation.equipmentCharges + quotation.foodCharges + quotation.accommodationCharges + quotation.otherCharges - quotation.discount).toLocaleString()}</strong></p>

                  <p className="mt-2"><strong>GST ({quotation.gstPercentage}%):</strong></p>
                  <p>Calculated on Taxable Cost = <strong>₹{quotation.gst.toLocaleString()}</strong></p>

                  <p className="mt-2"><strong>Grand Total:</strong></p>
                  <p>Taxable Cost + GST = <strong>₹{quotation.grandTotal.toLocaleString()}</strong></p>
                </div>
              </div>

              {/* Revision History */}
              {quotation.revisions && quotation.revisions.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase">Revision History</span>
                  <div className="space-y-2">
                    {quotation.revisions.map((rev, index) => (
                      <div key={index} className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 flex justify-between items-center text-[11px]">
                        <div>
                          <p className="font-bold text-slate-700">Revision #{index + 1}</p>
                          <p className="text-[10px] text-slate-400">{new Date(rev.createdAt).toLocaleDateString('en-IN')}</p>
                          {rev.feedback && <p className="text-[10px] text-amber-700 italic mt-0.5">Note: "{rev.feedback}"</p>}
                        </div>
                        <span className="font-extrabold text-slate-900">₹{rev.grandTotal?.toLocaleString() || 'N/A'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Vendor Notes */}
              <div>
                <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase">Vendor Notes</span>
                <p className="mt-1 p-3 bg-slate-50 border border-slate-100 rounded-2xl italic text-slate-600 leading-normal">
                  {quotation.notes || '"No additional notes provided by vendor."'}
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => setShowBreakdown(false)}
              className="w-full rounded-xl bg-slate-900 text-white py-2.5 text-xs font-bold hover:bg-slate-800"
            >
              Done
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
