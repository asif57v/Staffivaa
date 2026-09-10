import { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Cropper from 'react-easy-crop'
import {
  ZoomIn,
  ZoomOut,
  Check,
  X,
  RotateCcw,
  Crop,
  Maximize2,
  Image as ImageIcon,
  CreditCard,
  FileText,
  Square,
  Smartphone,
} from 'lucide-react'
import { getCroppedImg } from '../../../lib/cropImage.js'

const ASPECT_PRESETS = [
  { id: 'card', label: 'ID Card (1.6:1)', aspect: 1.586, icon: CreditCard },
  { id: 'portrait', label: 'Document (3:4)', aspect: 3 / 4, icon: FileText },
  { id: 'landscape', label: 'Landscape (4:3)', aspect: 4 / 3, icon: Smartphone },
  { id: 'square', label: 'Square (1:1)', aspect: 1, icon: Square },
]

export function KycImageCropperModal({
  open,
  imageSrc,
  aspect = 1.586, // default ~1.6 for card documents
  title = 'Crop & Adjust Document',
  onSave,
  onCancel,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [currentAspect, setCurrentAspect] = useState(aspect || 1.586)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Reset zoom, crop & aspect when modal opens
  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCurrentAspect(aspect || 1.586)
    }
  }, [open, aspect, imageSrc])

  const onCropChange = useCallback((newCrop) => {
    setCrop(newCrop)
  }, [])

  const onZoomChange = useCallback((newZoom) => {
    setZoom(newZoom)
  }, [])

  const onCropComplete = useCallback((_croppedArea, currentCroppedAreaPixels) => {
    setCroppedAreaPixels(currentCroppedAreaPixels)
  }, [])

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return
    setIsProcessing(true)
    try {
      const { file, previewUrl } = await getCroppedImg(imageSrc, croppedAreaPixels, 'kyc-cropped.jpg')
      onSave?.(file, previewUrl)
    } catch (err) {
      console.error('[KycImageCropperModal] Failed to crop image:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFitFull = () => {
    setCrop({ x: 0, y: 0 })
    setZoom(0.8)
  }

  const handleReset = () => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
  }

  if (!open || !imageSrc || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[10070] flex flex-col bg-slate-950/95 backdrop-blur-md animate-fade-in select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cropper-modal-title"
    >
      {/* Top Header */}
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 bg-slate-900/90 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
            <Crop className="h-5 w-5" />
          </div>
          <div>
            <h3 id="cropper-modal-title" className="text-sm font-extrabold text-white sm:text-base">
              {title}
            </h3>
            <p className="text-[11px] font-medium text-slate-400">
              Puri image visible hai — frame ko adjust karo aur zoom set karo
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white transition active:scale-95"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {/* Aspect Ratio Selector Bar */}
      <div className="relative z-10 flex shrink-0 items-center justify-center gap-1.5 overflow-x-auto border-b border-white/10 bg-slate-900/60 px-4 py-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
          Frame Ratio:
        </span>
        {ASPECT_PRESETS.map((preset) => {
          const Icon = preset.icon
          const isActive = Math.abs(currentAspect - preset.aspect) < 0.05
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => setCurrentAspect(preset.aspect)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition active:scale-95 ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-white/10 text-slate-300 hover:bg-white/15 hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{preset.label}</span>
            </button>
          )
        })}

        <button
          type="button"
          onClick={handleFitFull}
          className="ml-1 flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold text-slate-300 hover:bg-white/15 hover:text-white transition active:scale-95"
          title="Fit full image in view"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Fit Full</span>
        </button>
      </div>

      {/* Cropper Workspace Area */}
      <main className="relative flex-1 w-full overflow-hidden bg-slate-950">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          minZoom={0.5}
          maxZoom={4}
          aspect={currentAspect}
          cropShape="rect"
          showGrid={true}
          restrictPosition={false}
          onCropChange={onCropChange}
          onCropComplete={onCropComplete}
          onZoomChange={onZoomChange}
          style={{
            containerStyle: {
              background: '#020617',
            },
            cropAreaStyle: {
              border: '2px solid #fbbf24',
              borderRadius: '12px',
              boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.48)', // Soft semi-transparent mask so whole image is clear!
            },
          }}
        />
      </main>

      {/* Controls & Action Footer */}
      <footer className="relative z-10 shrink-0 border-t border-white/10 bg-slate-900/90 px-4 py-3 sm:px-6 space-y-3">
        {/* Zoom Slider */}
        <div className="mx-auto flex max-w-md items-center gap-3">
          <button
            type="button"
            onClick={() => setZoom((prev) => Math.max(0.5, prev - 0.2))}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition active:scale-95"
            aria-label="Zoom out"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>

          <input
            type="range"
            min={0.5}
            max={3.5}
            step={0.02}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/20 accent-amber-500 focus:outline-none"
            aria-label="Zoom level"
          />

          <button
            type="button"
            onClick={() => setZoom((prev) => Math.min(4, prev + 0.2))}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition active:scale-95"
            aria-label="Zoom in"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white transition active:scale-95"
            title="Reset to 100%"
            aria-label="Reset"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="mx-auto flex max-w-md items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 sm:flex-none rounded-xl border border-white/20 px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-white/10 transition active:scale-95 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isProcessing}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-xs sm:text-sm font-extrabold text-slate-950 shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-amber-500 transition active:scale-95 disabled:opacity-50"
          >
            {isProcessing ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
            ) : (
              <Check className="h-4 w-4 stroke-[3]" />
            )}
            {isProcessing ? 'Cropping...' : 'Save Cropped'}
          </button>
        </div>
      </footer>
    </div>,
    document.body,
  )
}
