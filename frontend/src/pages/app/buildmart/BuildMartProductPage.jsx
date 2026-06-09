import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft,
  BadgeCheck,
  ChevronRight,
  MessageCircle,
  Phone,
  ShieldCheck,
  Star,
  Truck,
} from 'lucide-react'
import { BuildMartImageCarousel } from '../../../components/buildmart/BuildMartImageCarousel.jsx'
import { BuildMartVariantPicker } from '../../../components/buildmart/BuildMartVariantPicker.jsx'
import { BuildMartProductCard } from '../../../components/buildmart/BuildMartProductCard.jsx'
import { BuildMartRequestQuoteSheet } from '../../../components/buildmart/BuildMartRequestQuoteSheet.jsx'
import {
  formatBuildMartPrice,
  getBuildMartProduct,
  getRelatedProducts,
} from '../../../data/buildmartCatalog.js'
import { AppBadge } from '../../../components/app-ui/data-display/AppBadge.jsx'

const AVAILABILITY = {
  in_stock: { label: 'In stock', variant: 'emerald' },
  limited: { label: 'Limited stock', variant: 'amber' },
  preorder: { label: 'Pre-order', variant: 'sky' },
}

export function BuildMartProductPage() {
  const { productId } = useParams()
  const reduce = useReducedMotion()
  const product = getBuildMartProduct(productId)
  const [variantId, setVariantId] = useState(product?.variants[0]?.id)
  const [quoteOpen, setQuoteOpen] = useState(false)

  const variant = useMemo(
    () => product?.variants.find((v) => v.id === variantId) ?? product?.variants[0],
    [product, variantId],
  )

  const related = useMemo(() => getRelatedProducts(product?.relatedIds ?? []), [product])

  if (!product) return <Navigate to="/app/buildmart" replace />

  const avail = AVAILABILITY[product.availability] || AVAILABILITY.in_stock

  return (
    <motion.div
      className="buildmart-gradient-soft -mx-4 space-y-5 px-4 pb-36"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <Link
        to="/app/buildmart"
        className="inline-flex items-center gap-2 text-sm font-bold text-bm-terracotta"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to BuildMart
      </Link>

      <BuildMartImageCarousel images={product.images} productName={product.name} />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <AppBadge variant={avail.variant}>{avail.label}</AppBadge>
          <span className="text-xs font-bold text-slate-500">{product.brand}</span>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{product.name}</h1>
        <p className="text-sm leading-relaxed text-slate-600">{product.description}</p>
      </div>

      <section className="rounded-3xl border border-orange-100/90 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-extrabold text-slate-900">Choose variant</h2>
        <div className="mt-3">
          <BuildMartVariantPicker
            variants={product.variants}
            selectedId={variant?.id}
            onSelect={setVariantId}
          />
        </div>
      </section>

      {variant ? (
        <section className="space-y-3 rounded-3xl border border-orange-100/90 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-900">Pricing</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <PriceTile label="Retail" value={formatBuildMartPrice(variant.retailPrice, variant.unit)} />
            <PriceTile
              label="Contractor"
              value={formatBuildMartPrice(variant.contractorPrice, variant.unit)}
              highlight
            />
            {variant.bulkPrice ? (
              <PriceTile label="Bulk" value={formatBuildMartPrice(variant.bulkPrice, variant.unit)} />
            ) : null}
          </div>
          {variant.moq ? (
            <p className="text-xs font-semibold text-slate-500">
              MOQ: {variant.moq} {variant.unit}
              {variant.moq > 1 ? 's' : ''}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200/80 bg-white p-4">
        <h2 className="text-sm font-extrabold text-slate-900">Specifications</h2>
        <dl className="mt-3 divide-y divide-slate-100">
          {product.specs.map((s) => (
            <motion.div
              key={s.label}
              className="flex justify-between gap-4 py-2.5 text-sm"
              initial={reduce ? false : { opacity: 0, x: -6 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <dt className="font-medium text-slate-500">{s.label}</dt>
              <dd className="text-right font-bold text-slate-900">{s.value}</dd>
            </motion.div>
          ))}
        </dl>
      </section>

      <section className="flex gap-3 rounded-3xl border border-slate-200/80 bg-white p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-bm-orange">
          <Truck className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-extrabold text-slate-900">Delivery</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{product.deliveryInfo}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/80 bg-white p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-slate-900">{product.supplier.name}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
              {product.supplier.rating} · {product.supplier.city}
            </p>
            <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
              BuildMart verified supplier
            </p>
          </div>
        </div>
      </section>

      {related.length > 0 ? (
        <section>
          <h2 className="mb-3 text-base font-extrabold text-slate-900">Related products</h2>
          <motion.div className="grid gap-4">
            {related.map((p, i) => (
              <BuildMartProductCard key={p.id} product={p} index={i} />
            ))}
          </motion.div>
        </section>
      ) : null}

      <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 mx-auto max-w-lg px-4">
        <motion.div
          className="flex gap-2 rounded-2xl border border-orange-200/80 bg-white/95 p-2 shadow-[0_12px_40px_-12px_rgba(232,93,42,0.35)] backdrop-blur-md"
          initial={reduce ? false : { y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <button
            type="button"
            onClick={() => setQuoteOpen(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl buildmart-gradient py-3.5 text-sm font-extrabold text-white buildmart-glow"
          >
            Request Quote
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setQuoteOpen(true)}
            className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 px-3 py-3.5 text-xs font-bold text-slate-700"
          >
            <Phone className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden xs:inline sm:inline">Contact</span>
          </button>
          <button
            type="button"
            onClick={() => setQuoteOpen(true)}
            className="flex items-center justify-center rounded-xl border border-slate-200 px-4 py-3.5 text-slate-700"
            aria-label="Contact supplier via quote"
          >
            <MessageCircle className="h-5 w-5" aria-hidden />
          </button>
        </motion.div>
      </div>

      <BuildMartRequestQuoteSheet
        open={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        product={product}
        variant={variant}
      />
    </motion.div>
  )
}

function PriceTile({ label, value, highlight }) {
  return (
    <div
      className={`rounded-2xl px-3 py-2.5 ring-1 ${
        highlight
          ? 'bg-gradient-to-br from-orange-50 to-amber-50 ring-orange-200/80'
          : 'bg-slate-50 ring-slate-200/80'
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 text-sm font-extrabold ${highlight ? 'text-bm-terracotta' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  )
}
