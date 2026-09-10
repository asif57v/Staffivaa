import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ZoomIn, ZoomOut, RotateCcw, FileText } from 'lucide-react'

export function KycImageLightboxModal({ open, imageUrl, title = 'Document Preview', onClose }) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 })

  // Reset zoom & pan when modal opens or image changes
  useEffect(() => {
    if (open) {
      setScale(1)
      setPosition({ x: 0, y: 0 })
    }
  }, [open, imageUrl])

  // Handle ESC key to close
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const handleZoomIn = () => {
    setScale((prev) => Math.min(4, prev + 0.3))
  }

  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(1, prev - 0.3)
      if (next === 1) setPosition({ x: 0, y: 0 })
      return next
    })
  }

  const handleReset = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  const handleMouseDown = (e) => {
    if (scale <= 1) return
    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    }
  }

  const handleMouseMove = (e) => {
    if (!isDragging || scale <= 1) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    setPosition({
      x: dragStartRef.current.posX + dx,
      y: dragStartRef.current.posY + dy,
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  if (!open || !imageUrl || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[10080] flex flex-col bg-slate-950/95 backdrop-blur-md animate-fade-in select-none"
      role="dialog"
      aria-modal="true"
      onMouseUp={handleMouseUp}
    >
      {/* Top Header */}
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 bg-slate-900/80 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-white sm:text-base">{title}</h3>
            <p className="text-[11px] font-medium text-slate-400">Full Resolution Document View</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white transition active:scale-95"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {/* Main Image Container */}
      <main
        className={`relative flex-1 w-full overflow-hidden flex items-center justify-center p-4 ${
          scale > 1 ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
      >
        <img
          src={imageUrl}
          alt={title}
          draggable={false}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            maxHeight: 'calc(100vh - 160px)',
            maxWidth: '100%',
          }}
          className="rounded-xl object-contain shadow-2xl ring-1 ring-white/10"
        />
      </main>

      {/* Floating Bottom Zoom Controls */}
      <footer className="relative z-10 shrink-0 border-t border-white/10 bg-slate-900/90 px-4 py-3 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={handleZoomOut}
          disabled={scale <= 1}
          className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/20 transition active:scale-95 disabled:opacity-40"
        >
          <ZoomOut className="h-4 w-4" />
          Zoom Out
        </button>

        <span className="min-w-[4rem] text-center text-xs font-extrabold text-amber-400">
          {Math.round(scale * 100)}%
        </span>

        <button
          type="button"
          onClick={handleZoomIn}
          disabled={scale >= 4}
          className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/20 transition active:scale-95 disabled:opacity-40"
        >
          <ZoomIn className="h-4 w-4" />
          Zoom In
        </button>

        <button
          type="button"
          onClick={handleReset}
          disabled={scale === 1 && position.x === 0 && position.y === 0}
          className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-bold text-slate-300 hover:bg-white/20 hover:text-white transition active:scale-95 disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </footer>
    </div>,
    document.body,
  )
}
