import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Users, Building2, MapPin, Calendar, Clock, UserCircle, CheckCircle2, Construction, AlertCircle, XCircle, Phone } from 'lucide-react'
import { useGetRequestQuery } from '../../../store/api/workforceApi.js'
import { useAuth } from '../../../hooks/useAuth.js'
import { useEffect } from 'react'
import { getSocket } from '../../../services/socket.js'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function CorporateRequestDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { data, isLoading, isError, refetch } = useGetRequestQuery(id, { skip: !id })

  useEffect(() => {
    const socket = getSocket()
    if (socket && id) {
      const handleUpdate = () => refetch()
      socket.on('vendor_accepted_job', handleUpdate)
      socket.on('vendor_assigned_workforce', handleUpdate)
      socket.on('work_progress_update', handleUpdate)
      socket.on('work_completed', handleUpdate)
      socket.on('request_status_update', handleUpdate)
      
      return () => {
        socket.off('vendor_accepted_job', handleUpdate)
        socket.off('vendor_assigned_workforce', handleUpdate)
        socket.off('work_progress_update', handleUpdate)
        socket.off('work_completed', handleUpdate)
        socket.off('request_status_update', handleUpdate)
      }
    }
  }, [id, refetch])

  const request = data?.request
  const allocation = data?.allocation
  const assignments = data?.assignments ?? []
  
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
    statusLabel = 'Accepted'
    statusTone = 'bg-emerald-50 text-emerald-700'
    StatusIcon = CheckCircle2
  } else if (request.status === 'completed') {
    statusLabel = 'Completed'
    statusTone = 'bg-emerald-50 text-emerald-700'
    StatusIcon = CheckCircle2
  } else if (request.status === 'cancelled' || request.status === 'rejected') {
    statusLabel = request.status.charAt(0).toUpperCase() + request.status.slice(1)
    statusTone = 'bg-rose-50 text-rose-700'
    StatusIcon = XCircle
  }

  const durationStr = `${formatDate(request.startDate)}${request.endDate ? ` – ${formatDate(request.endDate)}` : ''}`

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
              <p className="text-[13px] font-medium text-slate-500 mt-1">
                {allocation.vendorId?.phone || 'Phone N/A'}
              </p>
              <p className="text-[12px] text-slate-500 mt-1.5 leading-relaxed">
                {allocation.vendorId?.contractorProfile?.businessAddress || 'Business Address N/A'}
              </p>
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

      </div>

      {/* Bottom Actions */}
      <div className="mt-4 p-4 pb-24 max-w-md mx-auto flex flex-col gap-3">
        {request.status === 'completed' && request.userPaymentStatus !== 'paid' ? (
          <Link to={`/corporate/requests/${id}/payment`} className="w-full flex items-center justify-center gap-2 rounded-[16px] bg-[#f5b800] py-3.5 text-[15px] font-black text-slate-900 transition hover:bg-[#e0a800] active:scale-[0.98] shadow-sm">
            Proceed to Final Payment
          </Link>
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

    </div>
  )
}
