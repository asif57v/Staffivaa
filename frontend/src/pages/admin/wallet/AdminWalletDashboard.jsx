import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Wallet, IndianRupee, ArrowDownRight, ArrowUpRight, 
  Building2, ArrowRightLeft, Clock, FileText, Download, Users, Briefcase, Truck, Building 
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { 
  useGetWalletSummaryQuery, 
  useGetTransactionsQuery,
  useGetWalletReportsQuery 
} from '../../../store/api/adminWalletApi.js'

export function AdminWalletDashboard() {
  const [activeTab, setActiveTab] = useState('ledger')
  const [page, setPage] = useState(1)
  
  // Filters
  const [search, setSearch] = useState('')
  const [payerType, setPayerType] = useState('')
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  
  const { data: summaryData, isLoading: loadingSummary } = useGetWalletSummaryQuery()
  const { data: txData, isLoading: loadingTx } = useGetTransactionsQuery({ page, limit: 10, search, payerType, status, type })
  const { data: reportsData } = useGetWalletReportsQuery()

  const summary = summaryData?.data || {
    availableBalance: 0,
    totalRevenue: 0,
    pendingSettlements: 0,
    platformEarnings: 0,
    userRevenue: 0,
    labourRevenue: 0,
    vendorRevenue: 0,
    corporateRevenue: 0,
  }

  const transactions = txData?.data?.transactions || []
  const pagination = txData?.data?.pagination || { page: 1, pages: 1 }

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0)
  }

  const exportToCSV = () => {
    if (!transactions.length) return;
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
    link.setAttribute("download", `wallet_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed': return 'text-emerald-600 bg-emerald-50 ring-emerald-500/20'
      case 'Pending': return 'text-amber-600 bg-amber-50 ring-amber-500/20'
      case 'Failed': return 'text-rose-600 bg-rose-50 ring-rose-500/20'
      default: return 'text-slate-600 bg-slate-50 ring-slate-500/20'
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

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Admin Wallet</h1>
          <p className="mt-1.5 text-sm font-medium text-slate-500">Central financial ledger and revenue management</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50 transition">
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Wallet className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold uppercase tracking-wider text-slate-500">Available Balance</p>
          </div>
          <p className="text-3xl font-black text-slate-900">{loadingSummary ? '...' : formatMoney(summary.availableBalance)}</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <IndianRupee className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold uppercase tracking-wider text-slate-500">Total Revenue</p>
          </div>
          <p className="text-3xl font-black text-slate-900">{loadingSummary ? '...' : formatMoney(summary.totalRevenue)}</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold uppercase tracking-wider text-slate-500">Pending Settlements</p>
          </div>
          <p className="text-3xl font-black text-slate-900">{loadingSummary ? '...' : formatMoney(summary.pendingSettlements)}</p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-[#FFD100] to-[#FFB300] p-5 shadow-sm ring-1 ring-[#FFD100]/50 text-slate-900">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
              <Building2 className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold uppercase tracking-wider text-slate-800">Platform Earnings</p>
          </div>
          <p className="text-3xl font-black">{loadingSummary ? '...' : formatMoney(summary.platformEarnings)}</p>
        </div>
        
        {/* Detail Cards */}
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Users className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold uppercase tracking-wider text-slate-500">User Earnings</p>
          </div>
          <p className="text-2xl font-black text-slate-900">{loadingSummary ? '...' : formatMoney(summary.userRevenue)}</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <Briefcase className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold uppercase tracking-wider text-slate-500">Labour Earnings</p>
          </div>
          <p className="text-2xl font-black text-slate-900">{loadingSummary ? '...' : formatMoney(summary.labourRevenue)}</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Truck className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold uppercase tracking-wider text-slate-500">Vendor Earnings</p>
          </div>
          <p className="text-2xl font-black text-slate-900">{loadingSummary ? '...' : formatMoney(summary.vendorRevenue)}</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <Building className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold uppercase tracking-wider text-slate-500">Corporate Earnings</p>
          </div>
          <p className="text-2xl font-black text-slate-900">{loadingSummary ? '...' : formatMoney(summary.corporateRevenue)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-200">
        {['ledger', 'reports', 'withdrawals'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-bold uppercase tracking-wide transition relative ${
              activeTab === tab ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab === 'ledger' ? 'Transaction Ledger' : tab === 'reports' ? 'Reports & Analytics' : 'Withdrawals'}
            {activeTab === tab && (
              <motion.div layoutId="walletTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFD100]" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'ledger' && (
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/50 overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-400" />
                Recent Transactions
              </h2>
            </div>
            
            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div className="md:col-span-2">
                <input 
                  type="text" 
                  placeholder="Search Name, Txn ID, Razorpay ID..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[#FFD100] focus:ring-1 focus:ring-[#FFD100] outline-none transition"
                />
              </div>
              <select 
                value={payerType} 
                onChange={e => setPayerType(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[#FFD100] focus:ring-1 focus:ring-[#FFD100] outline-none bg-white text-slate-700"
              >
                <option value="">All Users</option>
                <option value="user">User</option>
                <option value="labour">Labour</option>
                <option value="vendor">Vendor</option>
                <option value="corporate">Corporate</option>
              </select>
              <select 
                value={type} 
                onChange={e => setType(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[#FFD100] focus:ring-1 focus:ring-[#FFD100] outline-none bg-white text-slate-700"
              >
                <option value="">All Types</option>
                <option value="Credit">Credit</option>
                <option value="Debit">Debit</option>
                <option value="Withdrawal">Withdrawal</option>
                <option value="Refund">Refund</option>
              </select>
              <select 
                value={status} 
                onChange={e => setStatus(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[#FFD100] focus:ring-1 focus:ring-[#FFD100] outline-none bg-white text-slate-700"
              >
                <option value="">All Statuses</option>
                <option value="Completed">Completed</option>
                <option value="Pending">Pending</option>
                <option value="Failed">Failed</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/50 text-slate-500 font-bold uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-5 py-3 font-semibold">Transaction ID</th>
                  <th className="px-5 py-3 font-semibold">Date & Time</th>
                  <th className="px-5 py-3 font-semibold">Type & Source</th>
                  <th className="px-5 py-3 font-semibold">Client / Booking</th>
                  <th className="px-5 py-3 font-semibold text-right">Amount</th>
                  <th className="px-5 py-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingTx ? (
                  <tr><td colSpan="6" className="px-5 py-8 text-center text-slate-500">Loading transactions...</td></tr>
                ) : transactions.length === 0 ? (
                  <tr><td colSpan="6" className="px-5 py-8 text-center text-slate-500">No transactions found</td></tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx._id} className="hover:bg-slate-50/50 transition">
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className="font-mono text-xs font-semibold text-slate-600">{tx.transactionId}</span>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="text-slate-900 font-medium">{new Date(tx.createdAt).toLocaleDateString()}</div>
                        <div className="text-xs text-slate-500">{new Date(tx.createdAt).toLocaleTimeString()}</div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-bold text-slate-700">
                          {getTypeIcon(tx.type)} {tx.type}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{tx.source}</div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="text-slate-900 font-medium">{tx.payerName || tx.clientId?.fullName || '—'}</div>
                        <div className="text-xs text-slate-500">{tx.bookingId?.reference || '—'}</div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-right">
                        <span className={`font-black ${['Credit'].includes(tx.type) ? 'text-emerald-600' : 'text-slate-900'}`}>
                          {['Credit'].includes(tx.type) ? '+' : '-'}{formatMoney(tx.amount)}
                        </span>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-bold ring-1 ring-inset ${getStatusColor(tx.status)}`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-sm text-slate-500 font-medium">Page {pagination.page} of {pagination.pages}</span>
              <div className="flex gap-2">
                <button 
                  disabled={pagination.page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-50"
                >
                  Previous
                </button>
                <button 
                  disabled={pagination.page === pagination.pages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/50">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Revenue Overview</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <span className="text-slate-600 font-medium">Today</span>
                <span className="font-black text-slate-900">{formatMoney(reportsData?.data?.cards?.todayRevenue || 0)}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <span className="text-slate-600 font-medium">This Week</span>
                <span className="font-black text-slate-900">{formatMoney(reportsData?.data?.cards?.weeklyRevenue || 0)}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <span className="text-slate-600 font-medium">This Month</span>
                <span className="font-black text-slate-900">{formatMoney(reportsData?.data?.cards?.monthlyRevenue || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">This Year</span>
                <span className="font-black text-slate-900">{formatMoney(reportsData?.data?.cards?.yearlyRevenue || 0)}</span>
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/50 flex flex-col justify-center items-center text-center col-span-1 md:col-span-2 lg:col-span-1">
             <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 self-start">Revenue Trend (6 Months)</h3>
             <div className="w-full h-64">
               {reportsData?.data?.charts?.revenueTrend ? (
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={reportsData.data.charts.revenueTrend.slice().reverse()}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                     <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} tickFormatter={(val) => `₹${val/1000}k`} />
                     <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} formatter={(value) => [formatMoney(value), 'Revenue']} />
                     <Bar dataKey="revenue" fill="#FFD100" radius={[4, 4, 0, 0]} maxBarSize={40} />
                   </BarChart>
                 </ResponsiveContainer>
               ) : (
                 <div className="w-full h-full flex items-center justify-center text-slate-400">Loading chart...</div>
               )}
             </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/50 flex flex-col justify-center items-center text-center col-span-1 md:col-span-2 lg:col-span-2">
             <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 self-start">Revenue by Payer Type</h3>
             <div className="w-full h-64 flex items-center justify-center">
               {reportsData?.data?.charts?.revenueByPayerType ? (
                 <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                     <Pie
                       data={reportsData.data.charts.revenueByPayerType}
                       cx="50%"
                       cy="50%"
                       innerRadius={60}
                       outerRadius={80}
                       paddingAngle={5}
                       dataKey="value"
                     >
                       {reportsData.data.charts.revenueByPayerType.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={['#8b5cf6', '#f97316', '#14b8a6', '#6366f1'][index % 4]} />
                       ))}
                     </Pie>
                     <RechartsTooltip formatter={(value) => formatMoney(value)} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                     <Legend verticalAlign="bottom" height={36}/>
                   </PieChart>
                 </ResponsiveContainer>
               ) : (
                 <div className="w-full h-full flex items-center justify-center text-slate-400">No data available</div>
               )}
             </div>
          </div>
        </div>
      )}

      {activeTab === 'withdrawals' && (
        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200/50 text-center">
           <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-4 text-amber-500 mx-auto">
             <ArrowUpRight className="w-8 h-8" />
           </div>
           <h3 className="text-lg font-bold text-slate-900 mb-2">Withdrawal System</h3>
           <p className="text-slate-500 font-medium max-w-sm mx-auto mb-6">Request withdrawals from the platform earnings. Connect your bank account to initiate payouts.</p>
           <button className="bg-slate-900 text-white rounded-xl px-6 py-2.5 font-bold hover:bg-slate-800 transition shadow-sm">
             Request Withdrawal
           </button>
        </div>
      )}
    </div>
  )
}
