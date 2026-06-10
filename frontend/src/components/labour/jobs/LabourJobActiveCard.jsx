import { CheckCircle2, FileText, MapPin } from 'lucide-react'
import { AppButton } from '../../app-ui/buttons/AppButton.jsx'
import { useNavigate } from 'react-router-dom'
import { AppPrimaryButton } from '../../app/AppPrimaryButton.jsx'
import { useEffect, useState } from 'react'
import { useGetExtraWorkQuery, useUpdateExtraWorkStatusMutation } from '../../../store/api/workforceApi.js'
import { io } from 'socket.io-client'
import { ExtraWorkNegotiateModal } from './ExtraWorkNegotiateModal.jsx'

const STEPS = [
  { key: 'accepted', label: 'Accepted' },
  { key: 'on_site', label: 'On site' },
  { key: 'done', label: 'Done' },
]

function stepIndex(status) {
  if (status === 'on_site') return 1
  return 0
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null
  const R = 6371e3 // metres
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

export function LabourJobActiveCard({ job, onMarkOnSite, onOpenDetail, onComplete }) {
  const status = job.status || 'accepted'
  const onSite = status === 'on_site'
  const idx = stepIndex(status)
  const navigate = useNavigate()

  const [currentLat, setCurrentLat] = useState(null)
  const [currentLng, setCurrentLng] = useState(null)
  const [distance, setDistance] = useState(null)
  const hasCoordinates = job.locationLat != null && job.locationLng != null

  useEffect(() => {
    if (!navigator.geolocation || onSite) return

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentLat(pos.coords.latitude)
        setCurrentLng(pos.coords.longitude)
        if (hasCoordinates) {
          const d = calculateDistance(pos.coords.latitude, pos.coords.longitude, job.locationLat, job.locationLng)
          setDistance(d)
        }
      },
      (err) => console.error('Error watching location', err),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [hasCoordinates, job.locationLat, job.locationLng, onSite])

  const requestId = job.requestId || job.id
  const { data: ewData, refetch: refetchEw } = useGetExtraWorkQuery(requestId, { skip: !requestId })
  const [updateStatus, { isLoading: isUpdatingEw }] = useUpdateExtraWorkStatusMutation()
  const extraWorks = ewData?.extraWorks || []
  
  const [negotiatingId, setNegotiatingId] = useState(null)
  
  useEffect(() => {
    if (!requestId) return
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'
    const socketUrl = baseUrl.replace('/api/v1', '')
    const socket = io(socketUrl, { withCredentials: true })
    socket.on('connect', () => socket.emit('join_request', requestId))
    socket.on('extra_work_requested', () => refetchEw())
    socket.on('extra_work_updated', () => refetchEw())
    return () => {
      socket.emit('leave_request', requestId)
      socket.disconnect()
    }
  }, [requestId, refetchEw])

  const handleStatusUpdate = async (ewId, status, revisedAmount, revisedTime) => {
    try {
      await updateStatus({ extraWorkId: ewId, status, revisedAmount, revisedTime }).unwrap()
      setNegotiatingId(null)
      refetchEw()
    } catch (err) {
      alert('Failed to update extra work')
    }
  }

  const formatDistance = (d) => {
    if (d == null) return ''
    if (d >= 1000) return `${(d / 1000).toFixed(1)} km`
    return `${Math.round(d)} m`
  }

  const isCheckInDisabled = hasCoordinates && distance != null && distance > 120

  return (
    <article className="overflow-hidden rounded-[1.35rem] border border-emerald-200/80 bg-linear-to-br from-emerald-50/80 via-white to-white shadow-[0_10px_36px_-20px_rgba(16,185,129,0.35)] ring-1 ring-emerald-100">
      <div className="border-b border-emerald-100/80 bg-emerald-500/10 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-emerald-800">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden />
            Live deployment
          </span>
          {job.requestRef ? (
            <span className="font-mono text-[10px] font-bold text-emerald-700/90">{job.requestRef}</span>
          ) : null}
        </div>
        <div className="mt-2 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-[15px] font-extrabold leading-snug text-slate-900">{job.title}</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">{job.shiftWindow}</p>
            {distance != null && !onSite && (
              <p className="mt-1 text-[11px] font-bold text-slate-700">Distance: {formatDistance(distance)}</p>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/app/navigation/${job.id}`, { state: { job } })
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md hover:bg-emerald-700 transition active:scale-95"
            aria-label="Open navigation map"
          >
            <MapPin className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 px-4 py-3">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex flex-1 items-center gap-1">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-black ${
                i <= idx ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {i + 1}
            </span>
            <span className={`text-[10px] font-bold ${i <= idx ? 'text-emerald-800' : 'text-slate-400'}`}>{s.label}</span>
            {i < STEPS.length - 1 ? <span className="mx-0.5 h-px flex-1 bg-slate-200" aria-hidden /> : null}
          </div>
        ))}
      </div>

      <div className="space-y-2 px-4 pb-4">
        {extraWorks.filter(ew => ew.status === 'pending').map(ew => (
          <div key={ew._id} className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h4 className="text-sm font-black text-amber-900 mb-1">New Request: {ew.workType}</h4>
            <p className="text-xs font-medium text-amber-700 mb-3">{ew.description}</p>
            <div className="flex justify-between text-xs font-bold text-amber-800 mb-3">
              <span>{ew.extraTime} hours</span>
              <span>₹{ew.extraAmount}</span>
            </div>
            <div className="flex gap-2">
              <button disabled={isUpdatingEw} onClick={() => handleStatusUpdate(ew._id, 'accepted')} className="flex-1 rounded-lg bg-amber-500 py-2 text-[10px] font-bold text-white transition hover:bg-amber-600">Accept</button>
              <button disabled={isUpdatingEw} onClick={() => setNegotiatingId(ew)} className="flex-1 rounded-lg bg-white border border-amber-200 py-2 text-[10px] font-bold text-amber-700 transition hover:bg-amber-100">Negotiate</button>
              <button disabled={isUpdatingEw} onClick={() => handleStatusUpdate(ew._id, 'rejected')} className="flex-1 rounded-lg bg-rose-50 border border-rose-200 py-2 text-[10px] font-bold text-rose-600 transition hover:bg-rose-100">Reject</button>
            </div>
          </div>
        ))}

        {!onSite ? (
          <div>
            <AppPrimaryButton 
              type="button" 
              className={`w-full py-3 text-sm ${isCheckInDisabled ? 'opacity-50 cursor-not-allowed bg-slate-400 border-slate-400 hover:bg-slate-400 hover:border-slate-400 hover:scale-100 active:scale-100 shadow-none' : ''}`} 
              onClick={() => {
                if (isCheckInDisabled) return
                onMarkOnSite(job.id, currentLat, currentLng)
              }}
              disabled={isCheckInDisabled}
            >
              <MapPin className="h-4 w-4" aria-hidden />
              Mark check-in on site
            </AppPrimaryButton>
            {hasCoordinates && distance != null && (
              <p className={`mt-2 text-center text-[10px] font-semibold ${isCheckInDisabled ? 'text-rose-600' : 'text-emerald-600'}`}>
                {isCheckInDisabled ? `You are ${Math.round(distance)} meters away from the job site. Move within 120 meters to mark check-in.` : 'You have arrived near the work location.'}
              </p>
            )}
          </div>
        ) : (
          <p className="rounded-xl bg-emerald-100/80 px-3 py-2 text-center text-xs font-semibold text-emerald-900">
            Checked in — attendance is being tracked
          </p>
        )}
        <div className="flex gap-2">
          <AppButton type="button" variant="secondary" className="w-full py-2.5 text-xs bg-slate-900 text-white border-0" onClick={() => onOpenDetail(job)}>
            <FileText className="h-3.5 w-3.5" aria-hidden />
            Job Description
          </AppButton>
        </div>
        <AppPrimaryButton
          type="button"
          className="w-full border border-emerald-200/90 bg-white py-2.5 text-xs text-emerald-900 shadow-sm hover:bg-emerald-50"
          onClick={() => onComplete(job.id)}
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Complete work
        </AppPrimaryButton>
      </div>

      <ExtraWorkNegotiateModal 
        isOpen={!!negotiatingId}
        onClose={() => setNegotiatingId(null)}
        initialAmount={negotiatingId?.extraAmount}
        initialTime={negotiatingId?.extraTime}
        onSubmit={(amount, time) => handleStatusUpdate(negotiatingId._id, 'negotiating', amount, time)}
        isLoading={isUpdatingEw}
      />
    </article>
  )
}
