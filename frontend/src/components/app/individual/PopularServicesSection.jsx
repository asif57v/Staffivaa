import { motion, useReducedMotion } from 'framer-motion'
import { Star, Zap } from 'lucide-react'

const POPULAR_SERVICES = [
  {
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
    id: 'electrician',
    title: 'Switch & wire repair',
    image: '/service_electrician.png',
    rating: '4.91',
    reviews: '22k',
    price: 99,
    originalPrice: 149,
    discount: '33% OFF',
    isInstant: true,
  }
]

export function PopularServicesSection({ onBook }) {
  const reduce = useReducedMotion()

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

      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-4 scrollbar-none [&::-webkit-scrollbar]:hidden">
        {POPULAR_SERVICES.map((service, idx) => (
          <motion.div
            key={service.id}
            initial={reduce ? false : { opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: Math.min(idx * 0.1, 0.4) }}
            className="group relative flex w-[160px] min-w-[160px] cursor-pointer snap-start flex-col overflow-hidden rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] ring-1 ring-slate-100 transition-all hover:shadow-[0_8px_16px_rgba(0,0,0,0.08)] active:scale-[0.97]"
            onClick={() => onBook?.(service)}
          >
            {/* Image Container */}
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
              <img
                src={service.image}
                alt={service.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              {service.discount && (
                <div className="absolute left-0 top-0 rounded-br-lg bg-[#059669] px-2 py-1 text-[10px] font-bold text-white shadow-sm">
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
                  {service.rating}
                </span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                {service.isInstant ? (
                  <span className="flex items-center gap-0.5 text-[#059669]">
                    <Zap className="h-3 w-3 fill-[#059669]" />
                    Instant
                  </span>
                ) : (
                  <span className="text-slate-500">{service.reviews}</span>
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
          </motion.div>
        ))}
      </div>
    </motion.section>
  )
}
