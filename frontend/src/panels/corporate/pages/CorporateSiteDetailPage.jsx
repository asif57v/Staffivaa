import { Link, useParams, Navigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Building2, User, Phone, Map, Construction, FileText } from 'lucide-react'
import { useGetCorporateProjectQuery, useGetMyRequestsQuery } from '../../../store/api/workforceApi.js'

export function CorporateSiteDetailPage() {
  const { projectId, siteId } = useParams()
  const { data: projectData, isLoading: projectLoading, isError: projectError } = useGetCorporateProjectQuery(projectId, { skip: !projectId })
  const { data: requestsData, isLoading: requestsLoading } = useGetMyRequestsQuery({ siteId }, { skip: !siteId })

  if (projectLoading || requestsLoading) {
    return (
      <div className="p-4">
        <p className="text-sm text-slate-500">Loading site details…</p>
      </div>
    )
  }

  const project = projectData?.project
  const site = project?.sites?.find(s => s._id === siteId)

  if (projectError || !site) {
    return (
      <div className="p-4 rounded-[20px] border border-rose-200/90 bg-rose-50/50 mt-4 mx-4">
        <p className="text-sm font-semibold text-rose-800">Site not found.</p>
        <Link to={`/corporate/projects/${projectId}`} className="mt-3 inline-block text-sm font-bold text-brand">
          Back to Project
        </Link>
      </div>
    )
  }

  // If there is an active request for this site, redirect immediately to the Request Details page.
  const activeRequest = requestsData?.requests?.[0]
  if (activeRequest) {
    return <Navigate to={`/corporate/requests/${activeRequest._id}`} replace />
  }

  const addressString = [site.address, site.city].filter(Boolean).join(', ') || 'Address not provided'

  return (
    <div className="min-h-screen bg-slate-50/50 pb-40">
      {/* Sticky Header */}
      <header className="bg-white px-4 py-4 sticky top-0 z-30 shadow-sm border-b border-slate-100 flex items-center gap-3">
        <Link to={`/corporate/projects/${projectId}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-100 transition hover:bg-slate-50 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <h1 className="text-base font-extrabold text-slate-900">Site Details</h1>
      </header>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        
        {/* Top Hero Card */}
        <div className="rounded-[20px] bg-white p-4 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] border border-slate-100">
          <div className="flex gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[14px] bg-slate-200 border border-slate-100 shadow-sm flex items-center justify-center">
              <Construction className="h-8 w-8 text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <h2 className="text-[18px] font-bold text-slate-900 truncate pr-2">{site.name}</h2>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-slate-500">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <p className="text-[14px] font-medium truncate">{project?.name || 'Project Name N/A'}</p>
              </div>
              
              <div className="mt-2.5 flex items-start gap-1.5 text-slate-500">
                <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-brand" />
                <p className="text-[12px] font-medium leading-tight">{addressString}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Site Overview */}
        <div className="rounded-[20px] bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] border border-slate-100">
          <h3 className="text-[15px] font-extrabold text-slate-900 mb-4">Site Overview</h3>
          <div className="space-y-3.5">
            <div className="flex justify-between items-start gap-4">
              <div className="flex items-center gap-2 text-slate-500 shrink-0">
                <User className="h-4 w-4" />
                <span className="text-[13px] font-bold">Contact Name</span>
              </div>
              <span className="text-[13px] font-medium text-slate-900 text-right">{site.contactName || 'Not specified'}</span>
            </div>
            
            <div className="flex justify-between items-start gap-4">
              <div className="flex items-center gap-2 text-slate-500 shrink-0">
                <Phone className="h-4 w-4" />
                <span className="text-[13px] font-bold">Contact Phone</span>
              </div>
              <span className="text-[13px] font-medium text-slate-900 text-right">{site.contactPhone || 'Not specified'}</span>
            </div>

            <div className="flex justify-between items-start gap-4">
              <div className="flex items-center gap-2 text-slate-500 shrink-0">
                <Map className="h-4 w-4" />
                <span className="text-[13px] font-bold">Coordinates</span>
              </div>
              <span className="text-[13px] font-medium text-slate-900 text-right">
                {site.geo?.lat && site.geo?.lng ? `${site.geo.lat.toFixed(5)}, ${site.geo.lng.toFixed(5)}` : 'Not mapped'}
              </span>
            </div>
          </div>
        </div>

        {/* No Request State */}
        <div className="rounded-[20px] bg-blue-50/50 p-6 shadow-sm border border-blue-100 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 mb-3">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="text-[15px] font-extrabold text-slate-900 mb-1">No Active Request</h3>
          <p className="text-[13px] text-slate-500 mb-4">There is no workforce request currently active for this site.</p>
          <Link to="/corporate/requests/new" state={{ prefillProjectId: projectId, prefillSiteId: siteId }} className="inline-block rounded-xl bg-blue-600 px-4 py-2 text-[13px] font-bold text-white shadow-sm transition hover:bg-blue-700">
            Create Request
          </Link>
        </div>

      </div>
    </div>
  )
}
