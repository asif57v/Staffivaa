import { useState, useMemo } from 'react'
import {
  FileText,
  Search,
  Filter,
  DollarSign,
  Banknote,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  ChevronRight,
  Wallet,
  Lock
} from 'lucide-react'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppSurface } from '../../components/app-ui/cards/AppSurface.jsx'
import { useGetAdminRequestsQuery } from '../../store/api/workforceApi.js'
import { AdminSettlementDrawer } from './AdminSettlementDrawer.jsx'

function formatMoney(n) {
  if (n == null) return '₹0'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function formatDate(dStr) {
  if (!dStr) return '—'
  return new Date(dStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function AdminBillingPage() {
  const [selectedSettlementId, setSelectedSettlementId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const { data: requestsData, isLoading } = useGetAdminRequestsQuery()
  const requests = requestsData?.requests || []
  
  // Isolate only Corporate projects as they generate settlements
  const corporateRequests = requests.filter(r => r.sourceType === 'corporate')

  // Calculate Dashboard KPIs natively
  const kpis = useMemo(() => {
    let moneyInEscrow = 0
    let corpPaymentsReceived = 0
    let pendingVendorSettlementsCount = 0
    let platformRevenue = 0
    let completedSettlementsCount = 0
    let overdueSettlementsCount = 0

    const now = new Date()

    corporateRequests.forEach(req => {
      // Calculate estimated totals
      const duration = (req.endDate && req.startDate) 
        ? Math.max(1, Math.ceil(Math.abs(new Date(req.endDate) - new Date(req.startDate)) / (1000 * 60 * 60 * 24)) + 1)
        : 1
      
      const assumedLabourRatePerDay = 800
      let totalWorkers = 0
      req.lines?.forEach(l => { totalWorkers += (l.quantity || 1) })
      
      const totalLabourCost = totalWorkers * assumedLabourRatePerDay * duration
      const corpPlatformFee = req.userPlatformFee || 0
      const vendorPlatformFee = req.labourPlatformFee || 0
      const gstAmount = Math.round(corpPlatformFee * (req.userGstRate || 18) / 100)
      const grandTotal = totalLabourCost + corpPlatformFee + gstAmount
      const advanceAmount = Math.round(grandTotal * 0.3)

      if (req.finalPaymentStatus === 'paid') {
        corpPaymentsReceived += grandTotal
        platformRevenue += (corpPlatformFee + vendorPlatformFee)
        completedSettlementsCount += 1
      } else if (req.advancePaymentStatus === 'paid') {
        corpPaymentsReceived += advanceAmount
        moneyInEscrow += advanceAmount
        if (req.status === 'completed' || req.status === 'settlement_pending') {
          pendingVendorSettlementsCount += 1
        }
      } else {
        // Not paid
        const startDate = new Date(req.startDate)
        const dueDate = new Date(startDate.getTime() - 48 * 60 * 60 * 1000)
        if (now > dueDate) {
          overdueSettlementsCount += 1
        }
      }
    })

    return {
      moneyInEscrow,
      corpPaymentsReceived,
      pendingVendorSettlementsCount,
      platformRevenue,
      completedSettlementsCount,
      overdueSettlementsCount
    }
  }, [corporateRequests])

  // Process rows for the Settlement Queue
  const settlements = useMemo(() => {
    return corporateRequests.map(req => {
      const duration = (req.endDate && req.startDate) 
        ? Math.max(1, Math.ceil(Math.abs(new Date(req.endDate) - new Date(req.startDate)) / (1000 * 60 * 60 * 24)) + 1)
        : 1
      const totalWorkers = req.lines?.reduce((sum, l) => sum + (l.quantity || 1), 0) || 1
      const assumedLabourRatePerDay = 800
      const totalLabourCost = totalWorkers * assumedLabourRatePerDay * duration
      
      const corpPlatformFee = req.userPlatformFee || 0
      const vendorPlatformFee = req.labourPlatformFee || 0
      const gstAmount = Math.round(corpPlatformFee * (req.userGstRate || 18) / 100)
      const grandTotal = totalLabourCost + corpPlatformFee + gstAmount
      
      const netPayable = totalLabourCost - vendorPlatformFee
      let alreadyPaid = 0
      let pendingAmount = netPayable

      if (req.status === 'settlement_completed' || req.finalPaymentStatus === 'paid') {
        alreadyPaid = netPayable
        pendingAmount = 0
      }

      const isAdvancePaid = req.advancePaymentStatus === 'paid'
      
      // Determine Settlement Status
      let stStatus = 'Pending'
      if (req.status === 'settlement_completed') stStatus = 'Completed'
      else if (req.status === 'completed' || req.status === 'settlement_pending') stStatus = 'Awaiting Release'
      else if (!isAdvancePaid) {
        const dueDate = new Date(new Date(req.startDate).getTime() - 48 * 60 * 60 * 1000)
        if (new Date() > dueDate) stStatus = 'Overdue'
        else stStatus = 'Awaiting Corporate Advance'
      } else if (req.status === 'project_active') {
        stStatus = 'Project Active'
      }

      return {
        id: req._id,
        reference: req.reference,
        corporate: req.clientId?.corporateProfile?.companyName || req.clientId?.fullName || 'Client',
        projectName: req.projectId?.name || 'Project Site',
        grossAmount: grandTotal,
        platformFee: corpPlatformFee + vendorPlatformFee,
        gst: gstAmount,
        netPayable,
        alreadyPaid,
        pendingAmount,
        expectedReleaseDate: req.endDate || req.startDate,
        stStatus,
        reqStatus: req.status
      }
    })
  }, [corporateRequests])

  const filteredSettlements = settlements.filter(s => {
    let matchTerm = true
    if (searchTerm) {
      const t = searchTerm.toLowerCase()
      matchTerm = s.reference.toLowerCase().includes(t) || s.corporate.toLowerCase().includes(t) || s.projectName.toLowerCase().includes(t)
    }

    let matchStatus = true
    if (statusFilter !== 'all') {
      if (statusFilter === 'completed' && s.stStatus !== 'Completed') matchStatus = false
      if (statusFilter === 'pending' && s.stStatus !== 'Awaiting Release') matchStatus = false
      if (statusFilter === 'overdue' && s.stStatus !== 'Overdue') matchStatus = false
    }

    return matchTerm && matchStatus
  })

  return (
    <div className="w-full bg-[#f8fafc] min-h-screen text-slate-800 pb-8 space-y-6">
      
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Finance & Settlements</h1>
          <p className="text-xs text-slate-500 font-semibold mt-1">Enterprise dashboard for vendor payouts and escrow management.</p>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <KPICard title="Money in Escrow" value={formatMoney(kpis.moneyInEscrow)} icon={Lock} color="indigo" />
        <KPICard title="Corp. Payments Received" value={formatMoney(kpis.corpPaymentsReceived)} icon={Wallet} color="emerald" />
        <KPICard title="Platform Revenue" value={formatMoney(kpis.platformRevenue)} icon={TrendingUp} color="sky" />
        <KPICard title="Pending Settlements" value={kpis.pendingVendorSettlementsCount} icon={Clock} color="amber" />
        <KPICard title="Completed Settlements" value={kpis.completedSettlementsCount} icon={CheckCircle2} color="teal" />
        <KPICard title="Overdue Advances" value={kpis.overdueSettlementsCount} icon={AlertCircle} color="rose" />
      </div>

      {/* Main Settlement Queue Section */}
      <AppSurface className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-4 justify-between bg-white">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-extrabold text-slate-900">Settlement Queue</h2>
            <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
              {filteredSettlements.length} Records
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search vendor, corporate, ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50 w-[250px] transition"
              />
            </div>
            
            <div className="flex items-center gap-1.5 border border-slate-200 bg-slate-50 p-1 rounded-xl">
              <FilterBtn label="All" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
              <FilterBtn label="Pending" active={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')} />
              <FilterBtn label="Completed" active={statusFilter === 'completed'} onClick={() => setStatusFilter('completed')} />
              <FilterBtn label="Overdue" active={statusFilter === 'overdue'} onClick={() => setStatusFilter('overdue')} />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto flex-1">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-slate-500 flex flex-col items-center">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-500 mb-3" />
              Loading settlement records...
            </div>
          ) : filteredSettlements.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <FileText className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="text-sm font-bold text-slate-900">No Settlements Found</h3>
              <p className="text-xs text-slate-500 font-medium">Try adjusting your search or filter criteria.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-3">Settlement ID</th>
                  <th className="px-5 py-3">Corporate Client</th>
                  <th className="px-5 py-3 text-right">Gross Amount</th>
                  <th className="px-5 py-3 text-right">Net Payable</th>
                  <th className="px-5 py-3 text-center">Expected Date</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80 text-xs font-semibold text-slate-700">
                {filteredSettlements.map((s) => (
                  <tr 
                    key={s.id} 
                    onClick={() => setSelectedSettlementId(s.id)}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-slate-900">{s.reference}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-slate-900 truncate max-w-[150px]">{s.corporate}</p>
                      <p className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">{s.projectName}</p>
                    </td>
                    <td className="px-5 py-3.5 text-right font-black text-slate-900">
                      {formatMoney(s.grossAmount)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <p className="font-black text-indigo-600">{formatMoney(s.netPayable)}</p>
                      <p className="text-[9px] text-slate-400 font-medium mt-0.5">Pending: {formatMoney(s.pendingAmount)}</p>
                    </td>
                    <td className="px-5 py-3.5 text-center text-slate-500">
                      {formatDate(s.expectedReleaseDate)}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={s.stStatus} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-400 group-hover:text-indigo-600 transition">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </AppSurface>

      {/* Side Drawer Component */}
      <AdminSettlementDrawer 
        requestId={selectedSettlementId} 
        onClose={() => setSelectedSettlementId(null)} 
        onNext={() => {
          const idx = filteredSettlements.findIndex(s => s.id === selectedSettlementId)
          if (idx >= 0 && idx < filteredSettlements.length - 1) setSelectedSettlementId(filteredSettlements[idx + 1].id)
        }}
        onPrev={() => {
          const idx = filteredSettlements.findIndex(s => s.id === selectedSettlementId)
          if (idx > 0) setSelectedSettlementId(filteredSettlements[idx - 1].id)
        }}
        hasNext={filteredSettlements.findIndex(s => s.id === selectedSettlementId) < filteredSettlements.length - 1}
        hasPrev={filteredSettlements.findIndex(s => s.id === selectedSettlementId) > 0}
      />

    </div>
  )
}

function KPICard({ title, value, icon: Icon, color }) {
  const colorMap = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    sky: 'bg-sky-50 text-sky-600 border-sky-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    teal: 'bg-teal-50 text-teal-600 border-teal-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-start gap-3 transition hover:shadow-md">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border ${colorMap[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{title}</p>
        <p className="text-base font-black text-slate-900 mt-0.5">{value}</p>
      </div>
    </div>
  )
}

function FilterBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition ${
        active ? 'bg-white shadow-sm text-slate-900 border border-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 border border-transparent'
      }`}
    >
      {label}
    </button>
  )
}

function StatusBadge({ status }) {
  let c = 'bg-slate-50 text-slate-600 border-slate-200'
  
  if (status === 'Completed') c = 'bg-emerald-50 text-emerald-700 border-emerald-200'
  else if (status === 'Awaiting Release') c = 'bg-indigo-50 text-indigo-700 border-indigo-200'
  else if (status === 'Overdue') c = 'bg-rose-50 text-rose-700 border-rose-200'
  else if (status === 'Awaiting Corporate Advance') c = 'bg-amber-50 text-amber-700 border-amber-200'
  else if (status === 'Project Active') c = 'bg-sky-50 text-sky-700 border-sky-200'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider ${c}`}>
      {status}
    </span>
  )
}
