import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ZoomIn } from 'lucide-react'

export function BuildMartImageCarousel({ images, productName }) {
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [zoomed, setZoomed] = useState(false)

  const src = images[index] || images[0]

  return (
    <div className="space-y-2">
      <motion.button
        type="button"
        className="relative aspect-square w-full overflow-hidden rounded-3xl bg-slate-100 ring-1 ring-orange-100/80"
        onClick={() => setZoomed((z) => !z)}
        whileTap={reduce ? undefined : { scale: 0.99 }}
        aria-label={zoomed ? 'Close zoom' : 'Zoom image'}
      >
        <motion.img
          key={`${src}-${zoomed}`}
          src={src}
          alt={productName}
          className="h-full w-full object-cover"
          animate={zoomed ? { scale: 1.35 } : { scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          drag={!reduce ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={(_, info) => {
            if (images.length < 2) return
            if (info.offset.x < -60) setIndex((i) => (i + 1) % images.length)
            else if (info.offset.x > 60) setIndex((i) => (i - 1 + images.length) % images.length)
          }}
        />
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-slate-900/75 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
          <ZoomIn className="h-3 w-3" aria-hidden />
          {zoomed ? 'Tap to reset' : 'Pinch / tap zoom'}
        </span>
      </motion.button>

      {images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {images.map((img, i) => (
            <button
              key={img}
              type="button"
              onClick={() => {
                setIndex(i)
                setZoomed(false)
              }}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-2 transition ${
                i === index ? 'ring-bm-orange' : 'ring-transparent opacity-70'
              }`}
            >
              <img src={img} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
