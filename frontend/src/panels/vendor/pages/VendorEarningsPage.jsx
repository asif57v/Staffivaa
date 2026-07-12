import { useState } from 'react'
import { createPortal } from 'react-dom'
import { IndianRupee, Wallet, Landmark, ArrowUpRight, AlertCircle, CheckCircle2, Clock, PauseCircle, Activity, LayoutDashboard, History, FileText, ChevronRight } from 'lucide-react'
import { AppEmptyState } from '../../../components/app/AppEmptyState.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import {
  useGetVendorSettlementsQuery,
  useGetVendorWalletSummaryQuery,
  useGetVendorWalletActivityQuery,
  useGetVendorWithdrawalsQuery,
  useRequestVendorWithdrawalMutation
} from '../../../store/api/workforceApi.js'
import { VendorSettlementDrawer } from '../components/VendorSettlementDrawer.jsx'

function formatMoney(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function SummaryCard({ title, value, icon: Icon, color, bg }) {
  return (
    <AppSurface className={`relative overflow-hidden p-5 border-none shadow-sm transition-transform hover:-translate-y-1 ${bg}`}>
      <div className="absolute right-[-10px] top-[-10px] opacity-[0.05] pointer-events-none">
        <Icon size={100} />
      </div>
      <div className="relative z-10 flex flex-col h-full justify-between gap-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">{title}</p>
          <div className={`p-2 rounded-xl ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="text-[22px] font-black text-slate-900 tracking-tight">{value}</p>
      </div>
    </AppSurface>
  )
}

export function VendorEarningsPage() {
  const { data: summaryData, isLoading: loadingSummary, refetch: refetchSummary } = useGetVendorWalletSummaryQuery()
  const { data: settlementsData, isLoading: loadingSettlements, refetch: refetchSettlements } = useGetVendorSettlementsQuery()
  const { data: activityData, isLoading: loadingActivity, refetch: refetchActivity } = useGetVendorWalletActivityQuery()
  const { data: withdrawalsData, isLoading: loadingWithdrawals, refetch: refetchWithdrawals } = useGetVendorWithdrawalsQuery()
  
  const [requestWithdrawal, { isLoading: isWithdrawing }] = useRequestVendorWithdrawalMutation()

  const summary = summaryData || {}
  const settlements = settlementsData?.settlements || []
  const activities = activityData?.transactions || []
  const withdrawals = withdrawalsData?.withdrawals || []

  const [activeTab, setActiveTab] = useState('settlements')
  const [selectedSettlementId, setSelectedSettlementId] = useState(null)
  
  const [showModal, setShowModal] = useState(false)
  const [amount, setAmount] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [bankName, setBankName] = useState('')
  const [ifscCode, setIfscCode] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const handleWithdraw = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    const val = Number(amount)
    if (!val || val <= 0) {
      setErrorMsg('Please enter a valid positive withdrawal amount.')
      return
    }
    if (val > (summary.availableBalance || 0)) {
      setErrorMsg('Requested amount exceeds your available wallet balance.')
      return
    }
    if (!accountHolder || !accountNumber || !bankName || !ifscCode) {
      setErrorMsg('All bank details are required.')
      return
    }
    if (accountNumber.length < 9 || accountNumber.length > 18) {
      setErrorMsg('Bank Account Number must be between 9 and 18 digits.')
      return
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
      setErrorMsg('Please enter a valid 11-character IFSC Code.')
      return
    }

    try {
      await requestWithdrawal({
        amount: val,
        bankDetails: {
          accountHolderName: accountHolder,
          accountNumber,
          bankName,
          ifscCode
        }
      }).unwrap()
      
      setSuccessMsg('Withdrawal request submitted successfully!')
      setAmount('')
      refetchSummary()
      refetchActivity()
      refetchWithdrawals()
      setTimeout(() => {
        setShowModal(false)
        setSuccessMsg('')
      }, 2000)
    } catch (err) {
      setErrorMsg(err?.data?.message || 'Failed to submit withdrawal request.')
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10 px-4 pt-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Enterprise Wallet</h2>
          <p className="text-xs font-semibold text-slate-500 mt-1">Manage your payouts, settlements, and lifetime earnings.</p>
        </div>
      </div>

      {/* Top Main Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        
        <AppSurface className="col-span-1 sm:col-span-2 lg:col-span-2 xl:col-span-2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-[24px] p-6 shadow-xl border-none relative overflow-hidden flex flex-col justify-between group">
          <div className="absolute right-[-20px] bottom-[-20px] opacity-10 transition-transform duration-700 group-hover:scale-110">
            <Wallet size={160} />
          </div>
          <div className="relative z-10 flex justify-between items-center mb-6">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-2 uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse"></span>
              Available Balance
            </span>
          </div>
          <div className="relative z-10">
            {loadingSummary ? (
              <div className="h-10 w-48 bg-slate-800 animate-pulse rounded-lg mb-2"></div>
            ) : (
              <h3 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-2">{formatMoney(summary.availableBalance)}</h3>
            )}
            <p className="text-[11px] text-slate-400 font-medium">Cleared payouts ready for transfer</p>
          </div>
          <div className="relative z-10 mt-6 border-t border-slate-700/50 pt-5">
            <button
              onClick={() => {
                setErrorMsg('')
                setSuccessMsg('')
                setShowModal(true)
              }}
              disabled={!summary.availableBalance || summary.availableBalance <= 0}
              className="w-full sm:w-auto px-8 flex items-center justify-center gap-2 rounded-full bg-white text-slate-900 font-black text-sm py-3 transition hover:bg-slate-100 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-white/20"
            >
              Withdraw Funds <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        </AppSurface>

        <SummaryCard 
          title="Pending Settlement" 
          value={loadingSummary ? '...' : formatMoney(summary.pendingSettlement)} 
          icon={Clock} 
          bg="bg-gradient-to-br from-amber-50 to-white"
          color="bg-amber-100 text-amber-600" 
        />
        
        <SummaryCard 
          title="On Hold" 
          value={loadingSummary ? '...' : formatMoney(summary.onHoldSettlement)} 
          icon={PauseCircle} 
          bg="bg-gradient-to-br from-rose-50 to-white"
          color="bg-rose-100 text-rose-600" 
        />
        
        <SummaryCard 
          title="Lifetime Earnings" 
          value={loadingSummary ? '...' : formatMoney(summary.lifetimeEarnings)} 
          icon={IndianRupee} 
          bg="bg-gradient-to-br from-emerald-50 to-white"
          color="bg-emerald-100 text-emerald-600" 
        />

        <SummaryCard 
          title="Total Withdrawn" 
          value={loadingSummary ? '...' : formatMoney(summary.totalWithdrawn)} 
          icon={Landmark} 
          bg="bg-white"
          color="bg-slate-100 text-slate-600" 
        />

        <SummaryCard 
          title="Total Settlements" 
          value={loadingSummary ? '...' : summary.totalSettlements} 
          icon={FileText} 
          bg="bg-white"
          color="bg-blue-100 text-blue-600" 
        />

        <SummaryCard 
          title="Active Projects" 
          value={loadingSummary ? '...' : summary.activeProjects} 
          icon={Activity} 
          bg="bg-white"
          color="bg-purple-100 text-purple-600" 
        />

      </div>

      {/* Tabs */}
      <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1 w-full max-w-sm">
        <button
          onClick={() => setActiveTab('settlements')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'settlements' 
              ? 'bg-white text-slate-900 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <History className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />
          Settlement History
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'activity' 
              ? 'bg-white text-slate-900 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <LayoutDashboard className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />
          Wallet Activity
        </button>
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {activeTab === 'settlements' && (
          <div className="space-y-3 animate-fade-in">
            {loadingSettlements ? (
              <div className="text-sm font-semibold text-slate-400 p-6 text-center">Loading settlements...</div>
            ) : settlements.length === 0 ? (
              <AppEmptyState
                icon={FileText}
                title="No Settlements Found"
                subtitle="Your completed projects and settlements will appear here."
              />
            ) : (
              settlements.map((s) => (
                <AppSurface 
                  key={s._id} 
                  onClick={() => setSelectedSettlementId(s._id)}
                  className="p-0 border-slate-200 hover:border-slate-300 transition-all cursor-pointer group flex items-stretch overflow-hidden"
                >
                  <div className={`w-1.5 shrink-0 ${
                    s.status === 'settlement_completed' ? 'bg-emerald-400' :
                    s.status === 'settlement_on_hold' ? 'bg-rose-400' :
                    'bg-amber-400'
                  }`} />
                  <div className="flex-1 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-extrabold text-slate-900">{s.projectName}</p>
                        {s.milestone && (
                          <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-widest border border-slate-200">
                            {s.milestone}
                          </span>
                        )}
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                           s.status === 'settlement_completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                           s.status === 'settlement_on_hold' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                           'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {s.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-[11px] font-bold text-slate-500">{s.corporateName} • {s.workerCount} Workers • {s.durationDays} Days</p>
                    </div>
                    <div className="flex items-center gap-4 sm:text-right">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Net Settlement</p>
                        <p className="text-base font-black text-slate-900">{formatMoney(s.financials?.netSettlement)}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-600 transition-colors" />
                    </div>
                  </div>
                </AppSurface>
              ))
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-6 animate-fade-in">
            {/* Withdrawals Section */}
            {withdrawals.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Withdrawals</h3>
                {withdrawals.map((w) => (
                  <AppSurface key={w._id} className="p-4 flex items-center justify-between gap-3 border-l-4 border-l-red-400 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center">
                        <ArrowUpRight className="h-5 w-5 text-red-500" />
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-slate-900">Transfer to Bank</p>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {new Date(w.createdAt).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-slate-900">- {formatMoney(w.amount)}</p>
                      <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded mt-0.5 ${
                        w.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                        w.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {w.status}
                      </span>
                    </div>
                  </AppSurface>
                ))}
              </div>
            )}

            {/* General Ledger */}
            <div className="space-y-3">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Ledger</h3>
              {loadingActivity ? (
                <div className="text-sm font-semibold text-slate-400 p-6 text-center">Loading ledger entries...</div>
              ) : activities.length === 0 ? (
                <AppEmptyState
                  icon={Activity}
                  title="No Wallet Activity"
                  subtitle="Transactions will appear here when projects are settled."
                />
              ) : (
                activities.map((tx) => (
                  <AppSurface key={tx._id} className="p-4 flex items-center justify-between gap-3 border-l-4 border-l-emerald-400 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-slate-900">{tx.source || 'Project Settlement'}</p>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {new Date(tx.createdAt).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-emerald-600">+ {formatMoney(tx.amount)}</p>
                      <span className="inline-block text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded mt-0.5">
                        Settled
                      </span>
                    </div>
                  </AppSurface>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Withdrawal Form Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-slide-up max-h-[90dvh] overflow-y-auto no-scrollbar">
            
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Landmark className="h-6 w-6 text-slate-900" /> Withdraw Funds
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-1">Available: {formatMoney(summary.availableBalance)}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm font-bold text-emerald-800 flex flex-col items-center justify-center gap-3 text-center py-8">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <span>{successMsg}</span>
              </div>
            )}

            {!successMsg && (
              <form onSubmit={handleWithdraw} className="space-y-5 text-left">
                
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-2">Withdrawal Amount (₹)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400">₹</span>
                    <input
                      type="number"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-white rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-2xl font-black text-slate-900 outline-none focus:ring-2 focus:ring-slate-900 transition-all placeholder:text-slate-300"
                      placeholder="0"
                      max={summary.availableBalance}
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setAmount(summary.availableBalance)}
                    className="text-[10px] font-bold text-blue-600 mt-2 hover:underline"
                  >
                    Withdraw Max Amount
                  </button>
                </div>

                <div>
                  <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 pl-1">Bank Details</p>
                  <div className="space-y-3">
                    <input
                      type="text"
                      required
                      placeholder="Account Holder Name"
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                      className="w-full bg-slate-50 rounded-xl border border-transparent focus:border-slate-300 focus:bg-white py-3 px-4 text-sm font-bold text-slate-900 outline-none transition-all placeholder:text-slate-400 placeholder:font-medium"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Bank Account Number"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                      maxLength={18}
                      minLength={9}
                      className="w-full bg-slate-50 rounded-xl border border-transparent focus:border-slate-300 focus:bg-white py-3 px-4 text-sm font-bold text-slate-900 outline-none transition-all placeholder:text-slate-400 placeholder:font-medium tracking-wider"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Bank Name"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full bg-slate-50 rounded-xl border border-transparent focus:border-slate-300 focus:bg-white py-3 px-4 text-sm font-bold text-slate-900 outline-none transition-all placeholder:text-slate-400 placeholder:font-medium"
                    />
                    <input
                      type="text"
                      required
                      placeholder="IFSC Code"
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      maxLength={11}
                      minLength={11}
                      className="w-full bg-slate-50 rounded-xl border border-transparent focus:border-slate-300 focus:bg-white py-3 px-4 text-sm font-black text-slate-900 outline-none transition-all placeholder:text-slate-400 placeholder:font-medium uppercase tracking-widest"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isWithdrawing}
                    className="w-full rounded-full bg-slate-900 hover:bg-slate-800 text-white font-black text-sm py-4 transition-all active:scale-[0.98] disabled:opacity-50 disabled:scale-100 shadow-xl shadow-slate-900/20"
                  >
                    {isWithdrawing ? 'Processing...' : 'Confirm Withdrawal'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      <VendorSettlementDrawer 
        settlementId={selectedSettlementId} 
        onClose={() => setSelectedSettlementId(null)} 
      />

    </div>
  )
}
