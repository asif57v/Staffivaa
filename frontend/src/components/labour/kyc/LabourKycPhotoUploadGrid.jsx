import { useState } from 'react'
import { Camera, Image as ImageIcon, Loader2, Trash2, CheckCircle2, ShieldAlert, Eye, X } from 'lucide-react'
import { uploadDocument, assetUrlFromUpload } from '../../../api/uploadApi.js'
import { UPLOAD_FOLDERS } from '../../../constants/uploadFolders.js'
import { ApiError } from '../../../api/http.js'

const KYC_SLOTS = [
  {
    id: 'aadhaar_front',
    label: 'Aadhaar Card (Front)',
    desc: 'Front side with photo and full details',
    required: true,
    cameraFacing: 'environment',
  },
  {
    id: 'aadhaar_back',
    label: 'Aadhaar Card (Back)',
    desc: 'Back side with address and barcode',
    required: true,
    cameraFacing: 'environment',
  },
  {
    id: 'selfie',
    label: 'Worker Selfie / Live Face Photo',
    desc: 'Clear face photo taken in good lighting',
    required: true,
    cameraFacing: 'user',
  },
  {
    id: 'pan',
    label: 'PAN Card / Certificate',
    desc: 'PAN card or any skill/trade certificate',
    required: false,
    cameraFacing: 'environment',
  },
]

export function LabourKycPhotoUploadGrid({ photos = {}, onChange, disabled = false }) {
  const [uploadingSlot, setUploadingSlot] = useState(null)
  const [slotErrors, setSlotErrors] = useState({})
  const [previewImage, setPreviewImage] = useState(null)

  const handleFileUpload = async (slotId, file) => {
    if (!file) return
    if (!file.type?.startsWith('image/')) {
      setSlotErrors((prev) => ({ ...prev, [slotId]: 'Please select a valid JPG, PNG, or WEBP image.' }))
      return
    }

    setSlotErrors((prev) => ({ ...prev, [slotId]: '' }))
    setUploadingSlot(slotId)

    try {
      const uploaded = await uploadDocument(file, UPLOAD_FOLDERS.KYC_DOCUMENTS)
      const url = assetUrlFromUpload(uploaded)
      if (url) {
        onChange({
          ...photos,
          [slotId]: url,
        })
      } else {
        setSlotErrors((prev) => ({ ...prev, [slotId]: 'Upload succeeded but no image URL was returned.' }))
      }
    } catch (err) {
      setSlotErrors((prev) => ({
        ...prev,
        [slotId]: err instanceof ApiError ? err.message : 'Upload failed. Try again.',
      }))
    } finally {
      setUploadingSlot(null)
    }
  }

  const handleRemovePhoto = (slotId) => {
    if (disabled) return
    const updated = { ...photos }
    delete updated[slotId]
    onChange(updated)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">KYC Photos & Documents</p>
          <p className="text-xs text-slate-600">Take clear photos with your camera or upload from your gallery.</p>
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        {KYC_SLOTS.map((slot) => {
          const photoUrl = photos[slot.id]
          const isBusy = uploadingSlot === slot.id
          const errorMsg = slotErrors[slot.id]

          return (
            <div
              key={slot.id}
              className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-white p-3.5 shadow-sm transition ${
                photoUrl
                  ? 'border-emerald-200/90 ring-1 ring-emerald-500/20'
                  : slot.required
                  ? 'border-slate-200/90 hover:border-brand/40'
                  : 'border-slate-200/70 border-dashed bg-slate-50/50'
              }`}
            >
              <div className="mb-2.5 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900 truncate">{slot.label}</span>
                    {photoUrl ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                    ) : slot.required ? (
                      <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-brand">
                        Required
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                        Optional
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500 leading-tight">{slot.desc}</p>
                </div>
              </div>

              {photoUrl ? (
                <div className="group relative h-40 w-full overflow-hidden rounded-xl border border-slate-200/90 bg-slate-900/5">
                  <img
                    src={photoUrl}
                    alt={slot.label}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-slate-950/25 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewImage({ url: photoUrl, title: slot.label })}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/95 text-slate-800 shadow-md backdrop-blur transition hover:scale-110 active:scale-95"
                      title="View Photo"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(slot.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 text-white shadow-md transition hover:bg-rose-700 hover:scale-110 active:scale-95"
                        title="Remove Photo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Camera Capture Option */}
                    <label
                      htmlFor={`camera-input-${slot.id}`}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border border-brand/25 bg-brand/5 py-3 px-2 text-center transition cursor-pointer hover:bg-brand/10 active:scale-[0.98] ${
                        disabled || isBusy ? 'pointer-events-none opacity-50' : ''
                      }`}
                    >
                      <input
                        id={`camera-input-${slot.id}`}
                        type="file"
                        accept="image/*"
                        capture={slot.cameraFacing}
                        disabled={disabled || isBusy}
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) void handleFileUpload(slot.id, f)
                          e.target.value = ''
                        }}
                      />
                      {isBusy ? (
                        <Loader2 className="h-5 w-5 animate-spin text-brand" />
                      ) : (
                        <Camera className="h-5 w-5 text-brand" />
                      )}
                      <span className="text-xs font-bold text-slate-800">Camera</span>
                    </label>

                    {/* Gallery Pick Option */}
                    <label
                      htmlFor={`gallery-input-${slot.id}`}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 bg-slate-50 py-3 px-2 text-center transition cursor-pointer hover:bg-slate-100 active:scale-[0.98] ${
                        disabled || isBusy ? 'pointer-events-none opacity-50' : ''
                      }`}
                    >
                      <input
                        id={`gallery-input-${slot.id}`}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={disabled || isBusy}
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) void handleFileUpload(slot.id, f)
                          e.target.value = ''
                        }}
                      />
                      {isBusy ? (
                        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-slate-600" />
                      )}
                      <span className="text-xs font-bold text-slate-700">Gallery</span>
                    </label>
                  </div>

                  {errorMsg ? (
                    <p className="flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                      <span>{errorMsg}</span>
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Lightbox / Zoom Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative max-h-[90vh] max-w-lg w-full overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50">
              <p className="text-sm font-bold text-slate-900">{previewImage.title}</p>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-3 bg-slate-900/5 flex items-center justify-center max-h-[75vh] overflow-auto">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-h-[70vh] w-auto rounded-xl object-contain shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
