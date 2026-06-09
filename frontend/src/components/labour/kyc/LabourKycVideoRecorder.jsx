import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Camera, CheckCircle2, Loader2, RefreshCw, Square, Video } from 'lucide-react'

function bestMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  const options = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
  return options.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

function formatElapsed(seconds) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

async function openRecordingStream() {
  const video = { facingMode: { ideal: 'environment' } }
  try {
    return await navigator.mediaDevices.getUserMedia({ video, audio: true })
  } catch (e) {
    if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') throw e
    return navigator.mediaDevices.getUserMedia({ video, audio: false })
  }
}

function createRecorder(stream, mimeType) {
  if (mimeType) {
    try {
      return new MediaRecorder(stream, { mimeType })
    } catch {
      // Some browsers report support but still reject the codec at runtime.
    }
  }
  return new MediaRecorder(stream)
}

export function LabourKycVideoRecorder({ previewUrl, onRecorded, onClear, disabled }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const [recording, setRecording] = useState(false)
  const [starting, setStarting] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  const clearTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = null
  }

  useEffect(() => {
    return () => {
      clearTimer()
      stopCamera()
    }
  }, [])

  const startRecording = async () => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Your browser does not support in-app video recording. Please use Chrome or Edge on this device.')
      return
    }

    setStarting(true)
    try {
      await new Promise((resolve) => window.requestAnimationFrame(resolve))
      const stream = await openRecordingStream()
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }

      chunksRef.current = []
      const mimeType = bestMimeType()
      const recorder = createRecorder(stream, mimeType)
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        clearTimer()
        setRecording(false)
        stopCamera()
        setError('Recording stopped because the browser reported a recorder error. Please try again.')
      }
      recorder.onstop = () => {
        clearTimer()
        setRecording(false)
        stopCamera()
        const type = recorder.mimeType || mimeType || 'video/webm'
        const blob = new Blob(chunksRef.current, { type })
        if (!blob.size) {
          setError('Recording failed. Please record again.')
          return
        }
        const ext = type.includes('mp4') ? 'mp4' : 'webm'
        const file = new File([blob], `kyc-video-${Date.now()}.${ext}`, { type })
        onRecorded(file, URL.createObjectURL(blob))
      }
      recorder.start(1000)
      setElapsed(0)
      timerRef.current = window.setInterval(() => setElapsed((v) => v + 1), 1000)
      setRecording(true)
    } catch (e) {
      stopCamera()
      setRecording(false)
      setError(
        e?.name === 'NotAllowedError' || e?.name === 'SecurityError'
          ? 'Camera permission is required to record KYC video.'
          : `Could not start camera recording${e?.message ? `: ${e.message}` : '.'}`,
      )
    } finally {
      setStarting(false)
    }
  }

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  return (
    <div className="rounded-2xl border-2 border-slate-200/90 bg-slate-50/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Step 3</p>
          <p className="text-sm font-extrabold text-slate-900">Record verification video</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            Show front and back of Aadhaar and PAN clearly in one live recording.
          </p>
        </div>
        {previewUrl ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden /> : null}
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
        {starting || recording ? (
          <video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" />
        ) : previewUrl ? (
          <video src={previewUrl} controls playsInline className="aspect-video w-full bg-slate-950 object-contain" />
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center gap-2 text-center text-white/80">
            <Video className="h-10 w-10 text-white/35" aria-hidden />
            <p className="max-w-xs px-5 text-xs font-semibold leading-relaxed">
              Carry your Aadhaar card photo and PAN card photo before recording.
            </p>
          </div>
        )}
      </div>

      {error ? (
        <p className="mt-3 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {recording ? (
          <button
            type="button"
            onClick={stopRecording}
            disabled={disabled}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-50"
          >
            <Square className="h-4 w-4 fill-current" aria-hidden />
            Stop recording ({formatElapsed(elapsed)})
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            disabled={disabled || starting}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}
            {previewUrl ? 'Record again' : 'Start recording'}
          </button>
        )}
        {previewUrl && !recording ? (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Clear
          </button>
        ) : null}
      </div>
    </div>
  )
}
