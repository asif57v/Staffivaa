import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Wallet, IndianRupee, ArrowDownRight, ArrowUpRight, 
  Building2, ArrowRightLeft, Clock, FileText, Download, 
  Users, Briefcase, Truck, Building, TrendingUp, Search, 
  RefreshCw, SlidersHorizontal 
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { 
  useGetWalletSummaryQuery, 
  useGetTransactionsQuery,
  useGetWalletReportsQuery 
} from '../../../store/api/adminWalletApi.js'
import toast from 'react-hot-toast'

const SEGMENT_METADATA = {
  platform: {
    title: 'Platform Economics',
    subtitle: 'Track convenience fees, commissions, and direct platform earnings.',
    color: '#FFB300',
    statsLabel: 'Earnings',
    distName: 'Earnings Source'
  },
  user: {
    title: 'User Payment Volume',
    subtitle: 'Track booking deposits and service payments from individual clients.',
    color: '#8b5cf6',
    statsLabel: 'Deposits',
    distName: 'Payment Method'
  },
  corporate: {
    title: 'Corporate Billing Analytics',
    subtitle: 'Track contract advance deposits and project milestones payments.',
    color: '#3b82f6',
    statsLabel: 'Billing',
    distName: 'Project Category'
  },
  vendor: {
    title: 'Vendor Settlement Hub',
    subtitle: 'Track vendor registrations, commissions, and weekly settlement transfers.',
    color: '#10b981',
    statsLabel: 'Settlements',
    distName: 'Settlement Channel'
  },
  labour: {
    title: 'Labour Payout ledger',
    subtitle: 'Track worker verification fees and bank account withdrawals.',
    color: '#f97316',
    statsLabel: 'Payouts',
    distName: 'Payout Type'
  }
}

export function AdminWalletDashboard() {
  const [activeTab, setActiveTab] = useState('platform') // platform, user, corporate, vendor, labour
  const [page, setPage] = useState(1)
  
  // Filters
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')

  // Reset page and filters when active tab changes
  useEffect(() => {
    setPage(1)
    setSearch('')
    setType('')
    setStatus('')
  }, [activeTab])
  
  const { data: summaryData, isLoading: loadingSummary, refetch: refetchSummary } = useGetWalletSummaryQuery()
  const { data: reportsData, isLoading: loadingReports, refetch: refetchReports } = useGetWalletReportsQuery()
  
  // Pass correct query filters to getTransactions query based on active tab
  const { data: txData, isLoading: loadingTx, refetch: refetchTx } = useGetTransactionsQuery({ 
    page, 
    limit: 10, 
    search, 
    payerType: activeTab === 'platform' ? '' : activeTab, 
    status, 
    type 
  })

  const summary = summaryData?.data || {
    availableBalance: 0,
    totalRevenue: 0,
    pendingSettlements: 0,
    totalCredits: 0,
    totalDebits: 0,
    totalRefunds: 0,
  }

  const transactions = txData?.data?.transactions || []
  const pagination = txData?.data?.pagination || { page: 1, pages: 1 }

  // Safe reference to active segment reports
  const activeSegmentReports = reportsData?.data?.segments?.[activeTab] || {
    stats: { today: 0, weekly: 0, monthly: 0, lastMonth: 0 },
    trend: [
      { name: 'Month 1', value: 0 },
      { name: 'Month 2', value: 0 },
      { name: 'Month 3', value: 0 },
      { name: 'Month 4', value: 0 },
      { name: 'Month 5', value: 0 },
      { name: 'Month 6', value: 0 }
    ],
    distribution: [
      { name: 'No data', value: 1 }
    ]
  }

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0)
  }

  const exportToCSV = () => {
    if (!transactions.length) {
      toast.error('No transactions available to export.')
      return
    }
    const headers = ['Transaction ID', 'Date', 'Type', 'Source', 'Payer Name', 'Client/Booking', 'Amount', 'Status'];
    const rows = transactions.map(tx => [
      tx.transactionId,
      new Date(tx.createdAt).toLocaleString(),
      tx.type,
      tx.source,
      tx.payerName || 'System',
      tx.clientId?.fullName || tx.bookingId?.reference || '',
      tx.amount,
      tx.status
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `wallet_${activeTab}_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Ledger exported successfully!')
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed': return 'text-emerald-600 bg-emerald-50 border border-emerald-200/50'
      case 'Pending': return 'text-amber-600 bg-amber-50 border border-amber-200/50'
      case 'Failed': return 'text-rose-600 bg-rose-50 border border-rose-200/50'
      default: return 'text-slate-600 bg-slate-50 border border-slate-200/50'
    }
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'Credit': return <ArrowDownRight className="w-4 h-4 text-emerald-500" />
      case 'Debit': 
      case 'Withdrawal':
      case 'Settlement': return <ArrowUpRight className="w-4 h-4 text-rose-500" />
      default: return <ArrowRightLeft className="w-4 h-4 text-slate-500" />
    }
  }

  const triggerRefresh = () => {
    refetchSummary()
    refetchReports()
    refetchTx()
    toast.success('Wallet dashboard synced')
  }

  const activeMeta = SEGMENT_METADATA[activeTab]

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <Wallet className="h-8 w-8 text-yellow-500" />
            Financial Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-medium">
            Monitor Available Balance, Platform Commissions, settlements, payouts, and transaction ledgers.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button 
            onClick={triggerRefresh}
            className="flex items-center justify-center h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 active:scale-95 shadow-sm"
            title="Sync Dashboard"
          >
            <RefreshCw className="h-4.5 w-4.5" />
          </button>
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
          >
            <Download className="h-4 w-4 text-slate-500" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Main Top KPIs Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Available Balance */}
        <div className="rounded-2xl bg-white p-5 border border-slate-100/90 shadow-sm flex flex-col justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Wallet className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-slate-500 truncate">Available Balance</p>
              <p className="text-[24px] font-black text-slate-900 mt-1 tracking-tight">
                {loadingSummary ? '...' : formatMoney(summary.availableBalance)}
              </p>
              <div className="flex items-center gap-1 mt-1 text-[11px] font-bold text-emerald-600">
                <span>↑ 12.5%</span>
                <span className="text-slate-400 font-medium">vs yesterday</span>
              </div>
            </div>
          </div>
        </div>

        {/* Total Volume */}
        <div className="rounded-2xl bg-white p-5 border border-slate-100/90 shadow-sm flex flex-col justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-slate-500 truncate">Total Volume</p>
              <p className="text-[24px] font-black text-slate-900 mt-1 tracking-tight">
                {loadingSummary ? '...' : formatMoney(summary.totalRevenue)}
              </p>
              <div className="flex items-center gap-1 mt-1 text-[11px] font-bold text-emerald-600">
                <span>↑ 18.7%</span>
                <span className="text-slate-400 font-medium">vs yesterday</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Settlements */}
        <div className="rounded-2xl bg-white p-5 border border-slate-100/90 shadow-sm flex flex-col justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Clock className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-slate-500 truncate">Pending Settlements</p>
              <p className="text-[24px] font-black text-slate-900 mt-1 tracking-tight">
                {loadingSummary ? '...' : formatMoney(summary.pendingSettlements)}
              </p>
              <div className="flex items-center gap-1 mt-1 text-[11px] font-bold text-rose-600">
                <span>↓ 3.4%</span>
                <span className="text-slate-400 font-medium">vs yesterday</span>
              </div>
            </div>
          </div>
        </div>

        {/* Total Payouts */}
        <div className="rounded-2xl bg-white p-5 border border-slate-100/90 shadow-sm flex flex-col justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <ArrowUpRight className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-slate-500 truncate">Total Payouts / Debits</p>
              <p className="text-[24px] font-black text-slate-900 mt-1 tracking-tight">
                {loadingSummary ? '...' : formatMoney(summary.totalDebits)}
              </p>
              <div className="flex items-center gap-1 mt-1 text-[11px] font-bold text-slate-500">
                <span>— 0%</span>
                <span className="text-slate-400 font-medium">vs yesterday</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODULE SELECTOR TABS */}
      <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-none gap-1 bg-slate-50/50 p-1.5 rounded-2xl">
        {[
          { id: 'platform', label: 'Platform Economics', icon: Building2 },
          { id: 'user', label: 'User Payments', icon: Users },
          { id: 'corporate', label: 'Corporate Billing', icon: Briefcase },
          { id: 'vendor', label: 'Vendor Settlements', icon: Truck },
          { id: 'labour', label: 'Labour Payouts', icon: Building }
        ].map((tab) => {
          const Icon = tab.icon
          const isSelected = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 whitespace-nowrap rounded-xl px-5 py-3 text-sm font-bold transition-all relative ${
                isSelected
                  ? 'bg-white text-slate-950 shadow-sm border border-slate-100'
                  : 'text-slate-500 hover:bg-white/40 hover:text-slate-800'
              }`}
            >
              <Icon className={`h-4.5 w-4.5 ${isSelected ? 'text-yellow-500' : 'text-slate-400'}`} />
              {tab.label}
              {isSelected && (
                <motion.div
                  layoutId="activeWalletSegmentBar"
                  className="absolute bottom-[-6px] left-0 right-0 h-0.5 bg-yellow-400"
                />
              )}
            </button>
          )
        })}
      </div>

      {/* ACTIVE TAB METADATA CARD */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-slate-950 flex items-center gap-2">
            <span 
              className="h-2.5 w-2.5 rounded-full" 
              style={{ backgroundColor: activeMeta.color }}
            />
            {activeMeta.title}
          </h2>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">{activeMeta.subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Analytics Category</p>
          <span 
            className="inline-flex rounded-lg px-2.5 py-1 text-[11px] font-bold mt-1"
            style={{ backgroundColor: `${activeMeta.color}15`, color: activeMeta.color }}
          >
            {activeTab.toUpperCase()}
          </span>
        </div>
      </div>

      {/* SEGMENT SUB-DASHBOARD (KPIs + Charts side-by-side) */}
      <div className="space-y-6">
        {/* KPI Mini-row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { id: 'today', label: `Today's ${activeMeta.statsLabel}`, value: activeSegmentReports.stats.today },
            { id: 'weekly', label: `This Week`, value: activeSegmentReports.stats.weekly },
            { id: 'monthly', label: `This Month`, value: activeSegmentReports.stats.monthly },
            { id: 'lastMonth', label: `Last Month`, value: activeSegmentReports.stats.lastMonth }
          ].map((stat) => (
            <div key={stat.id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
              <p className="text-xl font-black text-slate-950 mt-1">
                {loadingReports ? '...' : formatMoney(stat.value)}
              </p>
            </div>
          ))}
        </div>

        {/* Charts Middle-row (Trend Area Chart + Donut Breakdown Chart) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trend Area Chart (2/3 width) */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="h-4.5 w-4.5 text-slate-400" />
                6-Month performance trend
              </h3>
              <span className="text-[10px] font-bold text-slate-400">INR VOLUME</span>
            </div>
            
            <div className="h-72 w-full">
              {loadingReports ? (
                <div className="flex h-full items-center justify-center text-slate-400 text-xs font-semibold">
                  Aggregating trend chart...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activeSegmentReports.trend}>
                    <defs>
                      <linearGradient id="colorSegment" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={activeMeta.color} stopOpacity={0.4}/>
                        <stop offset="95%" stopColor={activeMeta.color} stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickFormatter={(val) => `₹${val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}`}
                    />
                    <RechartsTooltip 
                      cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px -2px rgb(0 0 0 / 0.05)' }} 
                      formatter={(value) => [formatMoney(value), activeMeta.statsLabel]} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke={activeMeta.color} 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#colorSegment)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Distribution Donut (1/3 width) */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm flex flex-col justify-between">
            <div className="border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                {activeMeta.distName}
              </h3>
            </div>

            <div className="h-56 w-full flex items-center justify-center relative">
              {loadingReports ? (
                <div className="text-slate-400 text-xs font-semibold">Aggregating breakdown...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={activeSegmentReports.distribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {activeSegmentReports.distribution.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={['#8b5cf6', '#3b82f6', '#10b981', '#f97316', '#ec4899', '#f59e0b'][index % 6]} 
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value) => formatMoney(value)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3">
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 justify-center text-xs font-semibold text-slate-500">
                {activeSegmentReports.distribution.map((entry, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <span 
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: ['#8b5cf6', '#3b82f6', '#10b981', '#f97316', '#ec4899', '#f59e0b'][index % 6] }}
                    />
                    <span>{entry.name || 'Other'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM TRANSACTION LEDGER (Search, Filter, Table) */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          {/* Card Header & Search filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileText className="h-4.5 w-4.5 text-slate-400" />
              Segment Transaction Ledger
            </h3>
            
            <div className="flex flex-wrap gap-2.5 items-center">
              {/* Search filter input */}
              <div className="relative">
                <Search className="absolute top-2.5 left-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Txn ID, name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-xl border border-slate-200 pl-9 pr-3.5 py-1.5 text-xs font-semibold outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 w-44 sm:w-56"
                />
              </div>

              {/* Sliders filter indicators */}
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="rounded-xl border border-slate-200 py-1.5 px-3.5 text-xs font-semibold outline-none bg-white text-slate-600"
              >
                <option value="">All Types</option>
                <option value="Credit">Credit</option>
                <option value="Debit">Debit</option>
                <option value="Refund">Refund</option>
                <option value="Settlement">Settlement</option>
                <option value="Withdrawal">Withdrawal</option>
              </select>

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-xl border border-slate-200 py-1.5 px-3.5 text-xs font-semibold outline-none bg-white text-slate-600"
              >
                <option value="">All Statuses</option>
                <option value="Completed">Completed</option>
                <option value="Pending">Pending</option>
                <option value="Failed">Failed</option>
              </select>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/50 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3.5">Transaction ID</th>
                  <th className="px-5 py-3.5">Date & Time</th>
                  <th className="px-5 py-3.5">Type & Source</th>
                  <th className="px-5 py-3.5">Client / Booking</th>
                  <th className="px-5 py-3.5 text-right">Amount</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {loadingTx ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-8 text-center text-slate-400 text-xs">
                      Loading transaction records...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-8 text-center text-slate-400 text-xs">
                      No matching transaction ledger records.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx._id} className="hover:bg-slate-50/40 transition">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="font-mono text-xs font-semibold text-slate-500">{tx.transactionId}</span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="text-slate-900">{new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{new Date(tx.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          {getTypeIcon(tx.type)}
                          {tx.type}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-semibold">{tx.source}</div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="text-slate-900 font-semibold">{tx.payerName || tx.clientId?.fullName || '—'}</div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">{tx.bookingId?.reference || '—'}</div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-right">
                        <span className={`font-black text-sm ${['Credit'].includes(tx.type) ? 'text-emerald-600' : 'text-slate-900'}`}>
                          {['Credit'].includes(tx.type) ? '+' : '-'}{formatMoney(tx.amount)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-center">
                        <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${getStatusColor(tx.status)}`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination */}
          {!loadingTx && pagination.pages > 1 && (
            <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Page {pagination.page} of {pagination.pages}</span>
              <div className="flex gap-2">
                <button 
                  disabled={pagination.page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition active:scale-95 disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  Previous
                </button>
                <button 
                  disabled={pagination.page === pagination.pages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition active:scale-95 disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
