import { IndianRupee } from 'lucide-react'
import { AppEmptyState } from '../../../components/app/AppEmptyState.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { useGetVendorSettlementsQuery } from '../../../store/api/workforceApi.js'

function formatMoney(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

export function VendorEarningsPage() {
  const { data, isLoading, isError } = useGetVendorSettlementsQuery()
  const invoices = data?.invoices ?? []

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Payouts</p>
        <h2 className="text-lg font-extrabold text-slate-900">Earnings</h2>
      </div>

      {isLoading ? (
        <AppSurface>
          <p className="text-sm text-slate-500">Loading settlements…</p>
        </AppSurface>
      ) : null}

      {isError ? (
        <AppSurface className="border-rose-200/90 bg-rose-50/40">
          <p className="text-sm font-semibold text-rose-800">Could not load settlements.</p>
        </AppSurface>
      ) : null}

      {!isLoading && !isError && invoices.length === 0 ? (
        <AppEmptyState
          icon={IndianRupee}
          title="No settlements yet"
          subtitle="Vendor invoices appear after jobs complete and billing runs."
        />
      ) : null}

      <ul className="space-y-2">
        {invoices.map((inv) => (
          <li key={inv._id}>
            <AppSurface className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900">{inv.invoiceNumber || 'Settlement'}</p>
                <p className="text-xs capitalize text-slate-500">{inv.status}</p>
              </div>
              <p className="text-sm font-extrabold text-slate-900">{formatMoney(inv.totalAmount)}</p>
            </AppSurface>
          </li>
        ))}
      </ul>
    </div>
  )
}
