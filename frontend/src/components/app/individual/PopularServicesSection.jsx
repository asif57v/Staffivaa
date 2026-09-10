import React, { useState, useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Star, Zap } from 'lucide-react'
import { apiClient } from '../../../api/http.js'

const DEFAULT_POPULAR_SERVICES = [
  {
    _id: 'ac-repair',
    id: 'ac-repair',
    title: 'AC repair & service',
    image: '/service_ac.png',
    rating: '4.73',
    reviews: '12k',
    price: 299,
    originalPrice: 499,
    discount: '40% OFF',
    isInstant: true,
  },
  {
    _id: 'intense-cleaning',
    id: 'intense-cleaning',
    title: 'Intense cleaning (2 bathrooms)',
    image: '/service_cleaning_realistic.png',
    rating: '4.80',
    reviews: '8k',
    price: 872,
    originalPrice: 1038,
    discount: '16% OFF',
    isInstant: false,
  },
  {
    _id: 'plumbing',
    id: 'plumbing',
    title: 'Tap & pipe repair',
    image: '/service_plumber.png',
    rating: '4.85',
    reviews: '15k',
    price: 149,
    originalPrice: 199,
    discount: '25% OFF',
    isInstant: true,
  },
  {
    _id: 'electrician',
    id: 'electrician',
    title: 'Switch & wire repair',
    image: '/service_electrician.png',
    rating: '4.91',
    reviews: '22k',
    price: 99,
    originalPrice: 149,
    discount: '33% OFF',
    isInstant: true,
  },
]

export function PopularServicesSection({ onBook }) {
  const reduce = useReducedMotion()
  const [services, setServices] = useState(DEFAULT_POPULAR_SERVICES)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let isMounted = true
    const fetchPopularServices = async () => {
      try {
        const res = await apiClient.get('/marketing/popular-services')
        if (isMounted && res.data.success && res.data.data?.services?.length > 0) {
          setServices(res.data.data.services)
        }
      } catch (err) {
        // graceful fallback to default cards
      }
    }
    fetchPopularServices()
    return () => {
      isMounted = false
    }
  }, [])

  if (!services || services.length === 0) return null

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: 0.05 }}
      className="space-y-3 mt-8"
      aria-labelledby="popular-services-heading"
    >
      <div className="px-1 flex items-center justify-between">
        <h3 id="popular-services-heading" className="text-[17px] font-bold tracking-tight text-slate-900">
          Popular Services
        </h3>
      </div>

      <div className="flex gap-3.5 overflow-x-auto -mx-3 px-3 pb-3 pt-1 scrollbar-none [&::-webkit-scrollbar]:hidden touch-pan-y touch-pan-x [-webkit-overflow-scrolling:touch]">
        {services.map((service) => (
          <div
            key={service._id || service.id || service.title}
            className="group relative flex w-[165px] min-w-[165px] shrink-0 cursor-pointer flex-col overflow-hidden rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] ring-1 ring-slate-100 transition-all hover:shadow-[0_8px_16px_rgba(0,0,0,0.08)] active:scale-[0.97]"
            onClick={() => onBook?.(service)}
          >
            {/* Image Container with full image contain */}
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-50 flex items-center justify-center p-2">
              <img
                src={service.image}
                alt={service.title}
                className="max-h-full max-w-full w-auto h-auto object-contain transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.src = '/service_ac.png'
                }}
              />
              {service.discount && (
                <div className="absolute left-2 top-2 rounded-md bg-[#059669] px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                  {service.discount}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex flex-1 flex-col p-3">
              <h4 className="line-clamp-2 text-[14px] font-semibold leading-snug text-slate-900">
                {service.title}
              </h4>

              <div className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-slate-600">
                <span className="flex items-center gap-0.5 text-slate-700">
                  <Star className="h-3 w-3 fill-slate-700 text-slate-700" />
                  {service.rating || '4.8'}
                </span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                {service.isInstant ? (
                  <span className="flex items-center gap-0.5 text-[#059669]">
                    <Zap className="h-3 w-3 fill-[#059669]" />
                    Instant
                  </span>
                ) : (
                  <span className="text-slate-500">{service.reviews || '10k'}</span>
                )}
              </div>

              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-[14px] font-bold text-slate-900">₹{service.price}</span>
                {service.originalPrice && (
                  <span className="text-[11px] font-medium text-slate-400 line-through">
                    ₹{service.originalPrice}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  )
}

