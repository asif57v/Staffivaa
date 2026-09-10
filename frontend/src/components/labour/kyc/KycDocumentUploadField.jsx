import { useState, useRef, useEffect } from 'react'
import {
  UploadCloud,
  Eye,
  Crop,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileImage,
  RefreshCw,
  Camera,
} from 'lucide-react'
import { KycImageCropperModal } from './KycImageCropperModal.jsx'
import { KycImageLightboxModal } from './KycImageLightboxModal.jsx'
import { compressImageToDataUrl } from '../../../lib/cropImage.js'

/**
 * KycDocumentUploadField
 * 
 * Staged local file upload slot with:
 * - Local URL.createObjectURL staging (no server upload until final submit)
 * - Fixed-size thumbnail preview container with object-fit: cover
 * - On hover / tap action overlay with View, Edit (Crop), Delete
 * - Fullscreen zoomable lightbox
 * - Canvas pixel-accurate cropping modal (react-easy-crop)
 */
export function KycDocumentUploadField({
  id,
  label,
  description,
  required = false,
  value, // Either { file: File, previewUrl: string, dataUrl: string } or string URL
  onChange, // ({ file: File, previewUrl: string, dataUrl: string }) => void
  onDelete, // () => void
  aspectRatio = 1.6, // ~1.6 for card-like IDs (Aadhaar/PAN), 1.0 for selfie
  cropShape = 'rect', // 'rect' | 'round'
  accept = 'image/jpeg,image/png,image/webp,image/jpg',
  disabled = false,
  error = '',
}) {
  const fileInputRef = useRef(null)
  const [localError, setLocalError] = useState('')
  const [isHoveredOrFocused, setIsHoveredOrFocused] = useState(false)
  const [isCropperOpen, setIsCropperOpen] = useState(false)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)

  // Extract previewUrl from value object or string URL
  const previewUrl = typeof value === 'object' && value !== null ? (value.previewUrl || value.dataUrl) : value || ''
  const isStagedLocally = Boolean(typeof value === 'object' && value?.file)

  // Clean up previous Object URLs on unmount if it was a temporary blob
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset input value so same file can be re-selected if needed
    e.target.value = ''

    if (!file.type?.startsWith('image/')) {
      setLocalError('Please select a valid image file (JPG, PNG, WEBP).')
      return
    }

    if (file.size > 15 * 1024 * 1024) {
      setLocalError('Image file is too large (max 15MB).')
      return
    }

    setLocalError('')

    // 1. Stage immediate local object URL for instant UI response
    const objectUrl = URL.createObjectURL(file)
    onChange?.({
      file,
      previewUrl: objectUrl,
      dataUrl: objectUrl,
    })

    // 2. Asynchronously compress to mobile-optimized Data URL for rock-solid draft persistence
    try {
      const compressedDataUrl = await compressImageToDataUrl(file)
      if (compressedDataUrl) {
        onChange?.({
          file,
          previewUrl: compressedDataUrl,
          dataUrl: compressedDataUrl,
        })
      }
    } catch (err) {
      console.warn('[KycDocumentUploadField] Compression error:', err)
    }
  }

  const handleDelete = (e) => {
    e?.stopPropagation()
    if (disabled) return
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }
    setLocalError('')
    onDelete?.()
  }

  const handleOpenCropper = (e) => {
    e?.stopPropagation()
    if (!previewUrl || disabled) return
    setIsCropperOpen(true)
  }

  const handleOpenLightbox = (e) => {
    e?.stopPropagation()
    if (!previewUrl) return
    setIsLightboxOpen(true)
  }

  const handleSaveCrop = (croppedFile, croppedPreviewUrl, dataUrl) => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }
    setIsCropperOpen(false)
    const effectiveUrl = dataUrl || croppedPreviewUrl
    onChange?.({
      file: croppedFile,
      previewUrl: effectiveUrl,
      dataUrl: effectiveUrl,
    })
  }

  const displayError = error || localError

  return (
    <div className="flex flex-col gap-2">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        disabled={disabled}
        className="hidden"
        id={`upload-slot-${id}`}
      />

      {/* Main Slot Card */}
      <div
        className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border p-3.5 transition-all shadow-sm ${
          previewUrl
            ? 'border-emerald-200/90 bg-emerald-50/20 ring-1 ring-emerald-500/20'
            : displayError
              ? 'border-rose-300 bg-rose-50/30 ring-1 ring-rose-500/20'
              : required
                ? 'border-slate-200 bg-white hover:border-brand/50 hover:shadow-md'
                : 'border-slate-200/80 border-dashed bg-slate-50/60'
        }`}
      >
        {/* Slot Header */}
        <div className="mb-2.5 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">{label}</span>
              {previewUrl ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-extrabold text-emerald-800">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  {isStagedLocally ? 'Staged' : 'Attached'}
                </span>
              ) : required ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-amber-800">
                  Required
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                  Optional
                </span>
              )}
            </div>
            {description && <p className="mt-0.5 text-[11px] text-slate-500 leading-tight">{description}</p>}
          </div>
        </div>

        {/* Thumbnail Container / Empty State */}
        {previewUrl ? (
          <div
            className="group relative h-40 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900/5 transition select-none"
            onMouseEnter={() => setIsHoveredOrFocused(true)}
            onMouseLeave={() => setIsHoveredOrFocused(false)}
            onTouchStart={() => setIsHoveredOrFocused(true)}
          >
            {/* Fixed-size thumbnail with object-fit: cover */}
            <img
              src={previewUrl}
              alt={label}
              className={`h-full w-full object-cover transition-transform duration-300 ${
                cropShape === 'round' ? 'rounded-full scale-90' : ''
              } group-hover:scale-105`}
            />

            {/* Hover / Tap Action Overlay with View, Edit (Crop), Delete */}
            <div
              className={`absolute inset-0 flex items-center justify-center gap-2 bg-slate-950/40 backdrop-blur-xs transition-opacity duration-200 ${
                isHoveredOrFocused ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
              }`}
            >
              {/* 1. View Action (Full-resolution Lightbox) */}
              <button
                type="button"
                onClick={handleOpenLightbox}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/95 text-slate-800 shadow-lg backdrop-blur transition hover:bg-white hover:scale-110 active:scale-95"
                title="View Full Resolution"
                aria-label="View photo"
              >
                <Eye className="h-4.5 w-4.5 text-slate-700" />
              </button>

              {/* 2. Edit / Crop Action (react-easy-crop) */}
              {!disabled && (
                <button
                  type="button"
                  onClick={handleOpenCropper}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-lg transition hover:bg-amber-600 hover:scale-110 active:scale-95"
                  title="Edit & Crop Image"
                  aria-label="Crop photo"
                >
                  <Crop className="h-4.5 w-4.5" />
                </button>
              )}

              {/* 3. Delete Action (Reset slot) */}
              {!disabled && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white shadow-lg transition hover:bg-rose-700 hover:scale-110 active:scale-95"
                  title="Remove Image"
                  aria-label="Remove photo"
                >
                  <Trash2 className="h-4.5 w-4.5" />
                </button>
              )}
            </div>

            {/* Mobile Touch Badge / Hint */}
            <div className="sm:hidden absolute bottom-1.5 right-1.5 rounded-md bg-slate-900/70 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur">
              Tap for actions
            </div>
          </div>
        ) : (
          /* Empty "Choose File" State */
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className={`group flex h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition active:scale-98 ${
              displayError
                ? 'border-rose-300 bg-rose-50/40 hover:border-rose-400'
                : 'border-slate-300/80 bg-slate-50/50 hover:border-brand/60 hover:bg-brand/5'
            } disabled:opacity-50 disabled:pointer-events-none`}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition group-hover:scale-110 group-hover:ring-brand/30">
              <Camera className="h-5 w-5 text-slate-500 group-hover:text-brand transition" />
            </div>
            <div className="text-center px-3">
              <span className="text-xs font-extrabold text-slate-700 group-hover:text-brand transition">
                Choose Photo or Take Picture
              </span>
              <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                Supports JPG, PNG, WEBP (Max 15MB)
              </p>
            </div>
          </button>
        )}

        {/* Error message */}
        {displayError && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-rose-600 animate-fade-in">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{displayError}</span>
          </div>
        )}
      </div>

      {/* Lightbox Modal (View) */}
      <KycImageLightboxModal
        open={isLightboxOpen}
        imageUrl={previewUrl}
        title={label}
        onClose={() => setIsLightboxOpen(false)}
      />

      {/* Cropper Modal (Edit) */}
      <KycImageCropperModal
        open={isCropperOpen}
        imageSrc={previewUrl}
        aspect={aspectRatio}
        cropShape={cropShape}
        title={`Adjust & Crop: ${label}`}
        onSave={handleSaveCrop}
        onCancel={() => setIsCropperOpen(false)}
      />
    </div>
  )
}
