import { useState } from 'react'
import { createPortal } from 'react-dom'
import { IndianRupee, Wallet, Landmark, ArrowUpRight, AlertCircle, CheckCircle2 } from 'lucide-react'
import { AppEmptyState } from '../../../components/app/AppEmptyState.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import {
  useGetVendorSettlementsQuery,
  useGetVendorWalletQuery,
  useRequestVendorWithdrawalMutation
} from '../../../store/api/workforceApi.js'

function formatMoney(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

export function VendorEarningsPage() {
  const { data: settlementsData, isLoading: loadingSettlements, isError: isErrorSettlements } = useGetVendorSettlementsQuery()
  const { data: walletData, isLoading: loadingWallet, isError: isErrorWallet, refetch: refetchWallet } = useGetVendorWalletQuery()
  const [requestWithdrawal, { isLoading: isWithdrawing }] = useRequestVendorWithdrawalMutation()

  const walletBalance = walletData?.walletBalance ?? 0
  const withdrawals = walletData?.withdrawals ?? []
  const transactions = walletData?.transactions ?? []

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
    if (val > walletBalance) {
      setErrorMsg('Requested amount exceeds your available wallet balance.')
      return
    }
    if (!accountHolder || !accountNumber || !bankName || !ifscCode) {
      setErrorMsg('All bank details are required.')
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
      refetchWallet()
      setTimeout(() => {
        setShowModal(false)
        setSuccessMsg('')
      }, 2000)
    } catch (err) {
      setErrorMsg(err?.data?.message || 'Failed to submit withdrawal request.')
    }
  }

  return (
    <div className="space-y-6 max-w-md mx-auto pb-10">
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Payouts & Ledger</p>
        <h2 className="text-xl font-extrabold text-slate-900">Earnings & Wallet</h2>
      </div>

      {/* Available Balance Card */}
      <AppSurface className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white rounded-[24px] p-6 shadow-xl border-none relative overflow-hidden">
        <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10">
          <Wallet size={120} />
        </div>
        <div className="relative z-10 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
              <Wallet className="h-4 w-4 text-yellow-400" /> Available Balance
            </span>
            <span className="bg-white/10 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
              Secure Wallet
            </span>
          </div>
          <div>
            <h3 className="text-3xl font-black tracking-tight text-white">{formatMoney(walletBalance)}</h3>
            <p className="text-[11px] text-slate-400 font-semibold mt-1">Cleared payouts ready for transfer</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setErrorMsg('')
              setSuccessMsg('')
              setShowModal(true)
            }}
            disabled={walletBalance <= 0}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-yellow-400 text-slate-950 font-black text-sm py-3 transition hover:bg-yellow-300 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/10"
          >
            <ArrowUpRight className="h-4 w-4" /> Withdraw to Bank Account
          </button>
        </div>
      </AppSurface>

      {/* Settlements/Transactions list */}
      <div className="space-y-3">
        <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
          <Landmark className="h-4 w-4 text-slate-500" /> Transaction Ledger
        </h4>

        {loadingSettlements || loadingWallet ? (
          <AppSurface>
            <p className="text-sm text-slate-500">Loading ledger entries…</p>
          </AppSurface>
        ) : null}

        {isErrorSettlements || isErrorWallet ? (
          <AppSurface className="border-rose-200/90 bg-rose-50/40">
            <p className="text-sm font-semibold text-rose-800">Could not load transactions.</p>
          </AppSurface>
        ) : null}

        {!loadingSettlements && !loadingWallet && transactions.length === 0 && withdrawals.length === 0 && (
          <AppEmptyState
            icon={IndianRupee}
            title="Ledger is empty"
            subtitle="Cleared payments will display here after projects are settled."
          />
        )}

        <div className="space-y-2">
          {/* Render withdrawals */}
          {withdrawals.map((w) => (
            <AppSurface key={w._id} className="flex items-center justify-between gap-3 border-l-4 border-l-red-400">
              <div>
                <p className="text-sm font-bold text-slate-950">Withdrawal Request</p>
                <p className="text-[10px] text-slate-400 font-semibold">{new Date(w.createdAt).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'})}</p>
                <span className={`inline-block text-[9px] font-black uppercase px-1.5 py-0.5 rounded mt-1 ${
                  w.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                  w.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {w.status}
                </span>
              </div>
              <p className="text-sm font-extrabold text-red-600">- {formatMoney(w.amount)}</p>
            </AppSurface>
          ))}

          {/* Render regular settlements */}
          {transactions.map((tx) => (
            <AppSurface key={tx._id} className="flex items-center justify-between gap-3 border-l-4 border-l-emerald-400">
              <div>
                <p className="text-sm font-bold text-slate-950">{tx.source || 'Project Settlement'}</p>
                <p className="text-[10px] text-slate-400 font-semibold">{new Date(tx.createdAt).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'})}</p>
                <span className="inline-block text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded mt-1">
                  Settled
                </span>
              </div>
              <p className="text-sm font-extrabold text-emerald-600">+ {formatMoney(tx.amount)}</p>
            </AppSurface>
          ))}
        </div>
      </div>

      {/* Withdrawal Form Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[24px] p-6 shadow-2xl space-y-4 animate-slide-up max-h-[90dvh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                <Landmark className="h-5 w-5 text-yellow-500" /> Withdraw Funds
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-start gap-1.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-start gap-1.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleWithdraw} className="space-y-3 text-left">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Withdrawal Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="0"
                  max={walletBalance}
                />
              </div>

              <div className="border-t border-slate-100 pt-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Recipient Bank Details</p>
                
                <div className="space-y-2">
                  <input
                    type="text"
                    required
                    placeholder="Account Holder Name"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-medium text-slate-800 outline-none focus:ring-1 focus:ring-yellow-400"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Bank Account Number"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-medium text-slate-800 outline-none focus:ring-1 focus:ring-yellow-400"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Bank Name"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-medium text-slate-800 outline-none focus:ring-1 focus:ring-yellow-400"
                  />
                  <input
                    type="text"
                    required
                    placeholder="IFSC Code"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-yellow-400 uppercase"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isWithdrawing}
                className="w-full rounded-xl bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs py-3 mt-4 transition active:scale-[0.98] disabled:opacity-50"
              >
                {isWithdrawing ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
