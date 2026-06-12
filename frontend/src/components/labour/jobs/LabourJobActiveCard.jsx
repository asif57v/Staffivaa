import { CheckCircle2, FileText, MapPin } from 'lucide-react'
import { AppButton } from '../../app-ui/buttons/AppButton.jsx'
import { useNavigate } from 'react-router-dom'
import { AppPrimaryButton } from '../../app/AppPrimaryButton.jsx'
import { useEffect, useState, useMemo } from 'react'
import { useGetExtraWorkQuery, useUpdateExtraWorkStatusMutation } from '../../../store/api/workforceApi.js'
import { io } from 'socket.io-client'
import { ExtraWorkNegotiateModal } from './ExtraWorkNegotiateModal.jsx'

import { Lock, IndianRupee } from 'lucide-react'

const STEPS = [
  { key: 'accepted', label: 'Accepted' },
  { key: 'travel', label: 'Travelling' },
  { key: 'otp_wait', label: 'OTP Pending' },
  { key: 'otp_done', label: 'OTP Verified' },
  { key: 'working', label: 'Working' },
  { key: 'done', label: 'Done' },
]

function stepIndex(status) {
  if (status === 'completed') return 5
  if (status === 'in_progress') return 4
  if (status === 'on_site') return 3
  return 1 // Travelling/Pending OTP
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
  const isCompleted = status === 'completed'
  const isCheckedIn = ['on_site', 'in_progress', 'completed'].includes(status)
  const onSite = status === 'on_site' || status === 'in_progress'
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
  const [isOtpMode, setIsOtpMode] = useState(false)
  const [otpValue, setOtpValue] = useState(['', '', '', '', '', ''])
  const [otpError, setOtpError] = useState(false)
  const [otpSuccess, setOtpSuccess] = useState(false)

  const expectedOtp = useMemo(() => {
    const id = job.requestId || job.id;
    if (!id) return '------';
    const num = parseInt(String(id).slice(-6), 16) % 900000;
    return String(100000 + (isNaN(num) ? 0 : num));
  }, [job.requestId, job.id]);

  const handleOtpChange = (index, value) => {
    if (!/^[0-9]?$/.test(value)) return;
    const newOtp = [...otpValue]
    newOtp[index] = value
    setOtpValue(newOtp)
    setOtpError(false)
    if (value && index < 5) {
      document.getElementById(`otp-input-${job.id}-${index + 1}`)?.focus()
    }
  }

  const handleVerifyOtp = () => {
    const entered = otpValue.join('')
    if (entered === expectedOtp) {
      setOtpSuccess(true)
      setTimeout(() => {
        onMarkOnSite(job.id, currentLat, currentLng)
        setIsOtpMode(false)
      }, 1500)
    } else {
      setOtpError(true)
    }
  }
  
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

      <div className="flex items-center gap-0.5 px-3 py-3 overflow-x-auto no-scrollbar">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex flex-1 items-center min-w-max gap-1">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-black ${
                i <= idx ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {i + 1}
            </span>
            <span className={`text-[9px] font-bold ${i <= idx ? 'text-emerald-800' : 'text-slate-400'}`}>{s.label}</span>
            {i < STEPS.length - 1 ? <span className="mx-1 h-px w-2 bg-slate-200" aria-hidden /> : null}
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

        {isCompleted ? (
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 mb-3 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-yellow-600">
                <IndianRupee className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-yellow-600">Payment Status</h4>
                <p className="text-sm font-black text-slate-900 leading-tight">Waiting for Customer Payment</p>
              </div>
            </div>
            <p className="text-xs font-semibold text-slate-700 mt-2 leading-snug">
              Your work has been completed successfully.<br/>Waiting for payment confirmation from the customer.
            </p>
          </div>
        ) : !isCheckedIn ? (
          <div>
            {!isOtpMode ? (
              <>
                <AppPrimaryButton 
                  type="button" 
                  className={`w-full py-3 text-sm flex items-center justify-center gap-2 ${isCheckInDisabled ? 'opacity-50 cursor-not-allowed bg-slate-400 border-slate-400 hover:bg-slate-400 hover:border-slate-400 shadow-none' : ''}`} 
                  onClick={() => {
                    if (isCheckInDisabled) return
                    setIsOtpMode(true)
                  }}
                  disabled={isCheckInDisabled}
                >
                  <Lock className="h-4 w-4" aria-hidden />
                  Verify Arrival
                </AppPrimaryButton>
                {hasCoordinates && distance != null && (
                  <p className={`mt-2 text-center text-[10px] font-semibold ${isCheckInDisabled ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {isCheckInDisabled ? `You are ${Math.round(distance)} meters away. Move within 120 meters to verify arrival.` : 'You have arrived near the work location.'}
                  </p>
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-yellow-200 bg-white p-4 shadow-sm ring-1 ring-slate-100 mb-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-50 text-yellow-600">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 leading-tight">Verify Customer OTP</h4>
                    <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Ask the customer for the verification code.</p>
                  </div>
                </div>

                {otpSuccess ? (
                  <div className="py-6 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                    <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-500 flex items-center justify-center mb-2 shadow-sm">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-black text-emerald-600">OTP Verified</p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between gap-1.5 my-4 px-1">
                      {otpValue.map((digit, i) => (
                        <input
                          key={i}
                          id={`otp-input-${job.id}-${i}`}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(i, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Backspace' && !digit && i > 0) {
                              document.getElementById(`otp-input-${job.id}-${i - 1}`)?.focus()
                            }
                          }}
                          className={`w-10 h-12 text-center text-xl font-black rounded-xl border-2 outline-none transition-colors ${
                            otpError ? 'border-rose-300 bg-rose-50 text-rose-600' : 'border-slate-200 bg-slate-50 text-slate-900 focus:border-[#FFDF20] focus:bg-white'
                          }`}
                        />
                      ))}
                    </div>
                    {otpError && <p className="text-center text-[10px] font-bold text-rose-500 mb-3">Invalid OTP. Please check the code and try again.</p>}
                    
                    <div className="flex gap-2">
                      <button onClick={() => setIsOtpMode(false)} className="flex-1 rounded-xl bg-slate-100 py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-200">Cancel</button>
                      <button onClick={handleVerifyOtp} className="flex-[2] rounded-xl bg-[#FFDF20] py-3 text-xs font-black text-slate-900 shadow-sm transition active:scale-95">Verify OTP</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="rounded-xl bg-emerald-100/80 px-3 py-2 text-center text-xs font-semibold text-emerald-900 mb-3">
            Checked in — attendance is being tracked
          </p>
        )}
        <div className="flex gap-2">
          <AppButton type="button" variant="secondary" className="w-full py-2.5 text-xs bg-slate-900 text-white border-0" onClick={() => onOpenDetail(job)}>
            <FileText className="h-3.5 w-3.5" aria-hidden />
            Job Description
          </AppButton>
        </div>
        {status !== 'completed' && (
          <AppPrimaryButton
            type="button"
            className="w-full border border-emerald-200/90 bg-white py-2.5 text-xs text-emerald-900 shadow-sm hover:bg-emerald-50 mt-2"
            onClick={() => onComplete(job.id)}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Complete work
          </AppPrimaryButton>
        )}
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
