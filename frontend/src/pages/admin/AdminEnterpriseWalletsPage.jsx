import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet, RefreshCw, Search, ShieldAlert, Lock, Unlock, PlusCircle,
  MinusCircle, Eye, ArrowUpRight, ArrowDownLeft, Loader2, X, CheckCircle2
} from 'lucide-react'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import {
  useGetAdminEnterpriseWalletsQuery,
  useToggleWalletFreezeStatusMutation,
  useAdjustEnterpriseWalletBalanceMutation,
  useGetAdminEnterpriseWalletTransactionsQuery,
} from '../../store/api/enterpriseWalletApi.js'
import toast from 'react-hot-toast'

// ─── Manual Adjustment Modal ──────────────────────────────────────────────────
function AdjustBalanceModal({ companyWallet, onClose }) {
  const [action, setAction] = useState('credit')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [adjustBalance, { isLoading }] = useAdjustEnterpriseWalletBalanceMutation()

  const company = companyWallet.enterpriseId || {}
  const companyName = company.enterpriseProfile?.companyName || company.fullName || 'Enterprise Company'

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await adjustBalance({
        enterpriseId: company._id,
        action,
        amount: Number(amount),
        reason,
      }).unwrap()

      toast.success(`Wallet balance ${action === 'credit' ? 'credited' : 'debited'} by ₹${Number(amount).toLocaleString('en-IN')}`)
      onClose()
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to adjust balance')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden my-8"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="text-[17px] font-extrabold text-slate-900">Adjust Wallet Balance</h3>
            <p className="text-[12px] font-medium text-slate-500 mt-0.5">Company: <span className="font-bold text-slate-800">{companyName}</span></p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAction('credit')}
              className={`p-3 rounded-xl border text-[13px] font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                action === 'credit'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              <PlusCircle className="h-4 w-4" /> Credit (+)
            </button>
            <button
              type="button"
              onClick={() => setAction('debit')}
              className={`p-3 rounded-xl border text-[13px] font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                action === 'debit'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              <MinusCircle className="h-4 w-4" /> Debit (-)
            </button>
          </div>

          <div>
            <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-1.5">
              Adjustment Amount (₹)
            </label>
            <input
              type="number"
              required
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 5000"
              className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-[14px] font-bold outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <div>
            <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-1.5">
              Mandatory Audit Reason
            </label>
            <textarea
              rows={3}
              required
              placeholder="Provide reason for balance adjustment..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-[13px] font-medium outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-[13px] font-bold text-slate-600 rounded-xl hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 bg-indigo-600 text-white text-[13px] font-extrabold rounded-xl shadow-md shadow-indigo-200 hover:bg-indigo-700 flex items-center gap-1.5 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Confirm Adjustment
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Main Admin Enterprise Wallets Page ───────────────────────────────────────
export function AdminEnterpriseWalletsPage() {
  const [search, setSearch] = useState('')
  const [selectedAdjustWallet, setSelectedAdjustWallet] = useState(null)
  const [activeTab, setActiveTab] = useState('wallets') // 'wallets' | 'transactions'

  const { data: walletsData, isLoading: loadingWallets, refetch: refetchWallets } = useGetAdminEnterpriseWalletsQuery()
  const { data: txnsData, isLoading: loadingTxns, refetch: refetchTxns } = useGetAdminEnterpriseWalletTransactionsQuery({ search })
  const [toggleFreeze, { isLoading: isToggling }] = useToggleWalletFreezeStatusMutation()

  const wallets = walletsData?.data || []
  const masterTxns = txnsData?.data?.transactions || []

  const filteredWallets = wallets.filter((w) => {
    if (!search) return true
    const q = search.toLowerCase()
    const name = w.enterpriseId?.enterpriseProfile?.companyName?.toLowerCase() || w.enterpriseId?.fullName?.toLowerCase() || ''
    const email = w.enterpriseId?.email?.toLowerCase() || ''
    return name.includes(q) || email.includes(q)
  })

  const handleToggleFreeze = async (enterpriseId, currentStatus) => {
    const nextStatus = currentStatus === 'frozen' ? 'active' : 'frozen'
    try {
      await toggleFreeze({ enterpriseId, status: nextStatus }).unwrap()
      toast.success(`Wallet ${nextStatus === 'frozen' ? 'frozen' : 'unfrozen'} successfully`)
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update status')
    }
  }

  return (
    <div className="w-full space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 md:text-xl">Enterprise Wallet Management</h2>
          <p className="mt-1 text-sm text-slate-600">Monitor company wallet balances, freeze status, manual adjustments & master transactions.</p>
        </div>
        <button
          onClick={() => { refetchWallets(); refetchTxns() }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-indigo-300"
        >
          <RefreshCw className="h-4 w-4 text-slate-500" /> Refresh
        </button>
      </div>

      {/* Search & Tabs Controls */}
      <GlassPanel className="p-4 md:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company name, email..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 border-b border-slate-200 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('wallets')}
            className={`pb-2 px-4 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'wallets' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'
            }`}
          >
            Company Wallets ({wallets.length})
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`pb-2 px-4 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'transactions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'
            }`}
          >
            Master Transactions ({masterTxns.length})
          </button>
        </div>
      </GlassPanel>

      {/* Tab 1: Company Wallets */}
      {activeTab === 'wallets' && (
        <GlassPanel className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Company Name</th>
                  <th className="px-4 py-3">Available Balance</th>
                  <th className="px-4 py-3">Total Recharged</th>
                  <th className="px-4 py-3">Total Spent</th>
                  <th className="px-4 py-3">Wallet Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingWallets && (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-slate-500">Loading wallets...</td>
                  </tr>
                )}

                {!loadingWallets && filteredWallets.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-slate-500">No enterprise company wallets found.</td>
                  </tr>
                )}

                {!loadingWallets &&
                  filteredWallets.map((w) => {
                    const company = w.enterpriseId || {}
                    const companyName = company.enterpriseProfile?.companyName || company.fullName || 'Enterprise'
                    const isFrozen = w.status === 'frozen'

                    return (
                      <tr key={company._id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-extrabold text-slate-900">{companyName}</p>
                          <p className="text-xs text-slate-500">{company.email}</p>
                        </td>
                        <td className="px-4 py-3 font-black text-indigo-600 text-[15px]">
                          ₹{(w.balance || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 font-bold text-emerald-600">
                          ₹{(w.totalRecharged || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 font-bold text-rose-600">
                          ₹{(w.totalSpent || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              isFrozen ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isFrozen ? 'FROZEN' : 'ACTIVE'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            onClick={() => setSelectedAdjustWallet(w)}
                            className="px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-colors"
                          >
                            Adjust Balance
                          </button>
                          <button
                            onClick={() => handleToggleFreeze(company._id, w.status)}
                            disabled={isToggling}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                              isFrozen
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                            }`}
                          >
                            {isFrozen ? 'Unfreeze' : 'Freeze'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </GlassPanel>
      )}

      {/* Tab 2: Master Transactions */}
      {activeTab === 'transactions' && (
        <GlassPanel className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Transaction ID</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingTxns && (
                  <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500">Loading transactions...</td></tr>
                )}

                {!loadingTxns && masterTxns.length === 0 && (
                  <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500">No master transactions recorded.</td></tr>
                )}

                {!loadingTxns &&
                  masterTxns.map((t) => (
                    <tr key={t._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-slate-800 text-[12px]">{t.transactionId}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {t.enterpriseId?.enterpriseProfile?.companyName || t.enterpriseId?.fullName || 'Company'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-800">
                          {t.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-extrabold text-slate-900">₹{t.amount?.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          t.status === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{new Date(t.createdAt).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </GlassPanel>
      )}

      {/* Adjust Balance Modal */}
      <AnimatePresence>
        {selectedAdjustWallet && (
          <AdjustBalanceModal
            companyWallet={selectedAdjustWallet}
            onClose={() => setSelectedAdjustWallet(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
