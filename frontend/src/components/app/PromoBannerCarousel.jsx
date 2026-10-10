import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../api/http.js'
import { useAuth } from '../../hooks/useAuth.js'
import { runBannerAction, trackBanner } from '../../lib/bannerAction.js'

/**
 * Admin-managed promo banners, filtered server-side by the logged-in role.
 * Renders nothing when there are no banners, so it can never break a home screen.
 */
export function PromoBannerCarousel({ className = '' }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [banners, setBanners] = useState([])
  const [index, setIndex] = useState(0)
  const viewed = useRef(new Set())

  useEffect(() => {
    let alive = true
    apiClient
      .get('/marketing/banners')
      .then((r) => {
        if (!alive) return
        const list = (r.data?.data?.banners || []).filter(
          (b) => ['CAROUSEL', 'TOP', 'MIDDLE', 'BOTTOM'].includes(b.position) && b.image,
        )
        setBanners(list)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const b = banners[index]
    if (b && !viewed.current.has(b._id)) {
      viewed.current.add(b._id)
      trackBanner(b._id, 'VIEW')
    }
  }, [banners, index])

  useEffect(() => {
    if (banners.length < 2) return undefined
    const t = setInterval(() => setIndex((i) => (i + 1) % banners.length), 4500)
    return () => clearInterval(t)
  }, [banners.length])

  if (!banners.length) return null
  const banner = banners[index % banners.length]
  const clickable =
    banner.action?.type === 'SKILL_BOOKING' || banner.action?.type === 'URL' || banner.redirectScreen

  const onClick = () => {
    trackBanner(banner._id, 'CLICK')
    if (clickable) runBannerAction(banner, user?.role, navigate)
  }

  return (
    <section className={className}>
      <button
        type="button"
        onClick={onClick}
        className={`relative block w-full overflow-hidden rounded-3xl bg-slate-200 text-left shadow-sm ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <img src={banner.image} alt={banner.title || 'Offer'} className="h-40 w-full object-cover sm:h-52" />
        {(banner.title || banner.subtitle) && (
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/10 to-transparent p-4 text-white">
            {banner.title && <p className="text-lg font-black leading-tight">{banner.title}</p>}
            {banner.subtitle && <p className="text-xs font-medium text-white/90">{banner.subtitle}</p>}
            {clickable && banner.ctaText && (
              <span className="mt-2 w-fit rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-900">
                {banner.ctaText}
              </span>
            )}
          </div>
        )}
      </button>
      {banners.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {banners.map((b, i) => (
            <span
              key={b._id}
              className={`h-1.5 rounded-full transition-all ${i === index % banners.length ? 'w-5 bg-slate-700' : 'w-1.5 bg-slate-300'}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
