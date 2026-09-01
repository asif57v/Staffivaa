import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Wallet as WalletIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { WalletBalanceCard } from './components/WalletBalanceCard'
import { TransactionCard } from './components/TransactionCard'
import { AddMoneyModal } from './components/AddMoneyModal'
import { WithdrawMoneyModal } from './components/WithdrawMoneyModal'
import { PageSkeleton } from '../../../components/ui/PageSkeleton'
import { useGetWalletBalanceQuery, useCreateWalletRechargeOrderMutation, useVerifyWalletRechargePaymentMutation, useRequestWithdrawalMutation, useRequestRefundMutation } from '../../../store/api/walletApi'
import { useAuth } from '../../../hooks/useAuth'
import { readLabourWalletPolicy } from '../../../lib/labourWalletPolicy.js'
import { loadRazorpayScript } from '../../../lib/razorpay.js'

export function WalletPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [isAddMoneyOpen, setIsAddMoneyOpen] = useState(false)
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false)
  const [txnFilter, setTxnFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const walletQueryParams = {
    ...(txnFilter !== 'all' ? { type: txnFilter } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  }

  const { data: walletData, isLoading, refetch } = useGetWalletBalanceQuery(walletQueryParams)
  const [createOrder] = useCreateWalletRechargeOrderMutation()
  const [verifyPayment] = useVerifyWalletRechargePaymentMutation()
  const [requestWithdrawal] = useRequestWithdrawalMutation()
  const [requestRefund, { isLoading: isRequestingRefund }] = useRequestRefundMutation()

  const balance = walletData?.balance || 0
  const pendingBalance = walletData?.pendingBalance || 0
  const totalWithdrawn = walletData?.totalWithdrawn || 0
  const lifetimeEarnings = walletData?.lifetimeEarnings || 0
  const transactions = walletData?.transactions || []
  const walletPolicy = readLabourWalletPolicy({ walletData, user })
  const { minimumRequired: minimumWalletRequired, isLowBalance: showLowBalanceBanner } = walletPolicy

  const handleWithdraw = async (details) => {
    setIsProcessing(true)
    try {
      await requestWithdrawal(details).unwrap()
      alert('Withdrawal request submitted successfully! It is now pending admin approval.')
      setIsWithdrawOpen(false)
      refetch()
    } catch (error) {
      console.error('Failed to request withdrawal:', error)
      alert(error?.data?.message || 'Failed to request withdrawal. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRequestRefund = async (bookingId) => {
    try {
      await requestRefund(bookingId).unwrap()
      alert('Refund requested successfully! It is pending admin approval.')
      refetch()
    } catch (error) {
      console.error('Failed to request refund:', error)
      alert(error?.data?.message || 'Failed to request refund.')
    }
  }

  const handleAddMoney = async (amount) => {
    setIsPaymentProcessing(true)
    setIsAddMoneyOpen(false)

    try {
      const isLoaded = await loadRazorpayScript()
      if (!isLoaded || !window.Razorpay) {
        toast.error('Failed to load Razorpay. Please check your internet connection.')
        setIsPaymentProcessing(false)
        return
      }

      const order = await createOrder({ amount }).unwrap()
      const orderId = order?.orderId
      const orderAmount = order?.amount
      const currency = order?.currency || 'INR'
      const razorpayKey = order?.key || order?.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID

      if (!orderId || !orderAmount || !razorpayKey) {
        throw new Error('Invalid payment order response from server')
      }

      const options = {
        key: razorpayKey,
        amount: String(orderAmount),
        currency,
        name: 'Staffivaa',
        description: 'Add Money to Wallet',
        image: '/favicon.svg',
        order_id: orderId,
        handler: async function (response) {
          try {
            setIsPaymentProcessing(true)
            await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amount,
            }).unwrap()

            toast.success(`₹${amount.toLocaleString('en-IN')} added to your wallet`)
            refetch()
          } catch (error) {
            console.error('Payment verification failed:', error)
            toast.error(error?.data?.message || 'Payment verification failed. If money was deducted, it will be refunded.')
          } finally {
            setIsPaymentProcessing(false)
          }
        },
        prefill: {
          name: user?.fullName || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        theme: {
          color: '#0f172a',
        },
        modal: {
          ondismiss: function () {
            setIsPaymentProcessing(false)
          },
        },
      }

      const rzp1 = new window.Razorpay(options)
      rzp1.on('payment.failed', function (response) {
        console.error('Payment Failed:', response.error)
        toast.error(response?.error?.description || 'Payment failed. Please try again.')
        setIsPaymentProcessing(false)
      })

      setIsPaymentProcessing(false)
      rzp1.open()
    } catch (error) {
      console.error('Failed to initiate payment:', error)
      toast.error(error?.data?.message || error?.message || 'Failed to initiate payment. Please try again.')
      setIsPaymentProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageSkeleton visible={(isProcessing && !isPaymentProcessing) || isLoading} />
      
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 px-4 py-3 -mx-4 -mt-2">
        <div className="flex items-center space-x-2.5">
          <button 
            onClick={() => navigate(-1)}
            className="p-1.5 -ml-1.5 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-800" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">My Staffivaa Wallet</h1>
            <p className="text-gray-500 text-xs mt-0.5">Manage your balance, salary credits, and withdrawals</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-2.5 pb-8 max-w-lg mx-auto space-y-6">
        <WalletBalanceCard 
          balance={balance}
          pendingBalance={pendingBalance}
          totalWithdrawn={totalWithdrawn}
          lifetimeEarnings={lifetimeEarnings} 
          onAddMoney={() => setIsAddMoneyOpen(true)}
          onWithdraw={() => setIsWithdrawOpen(true)}
        />

        {showLowBalanceBanner && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <p className="font-bold">Low wallet balance</p>
            <p className="mt-1 text-xs font-medium text-rose-800">
              Minimum ₹{Number(minimumWalletRequired).toLocaleString('en-IN')} required to accept bookings. Recharge to continue.
            </p>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Transaction History</h3>
            {transactions.length > 3 && (
              <button 
                onClick={() => setShowAll(!showAll)}
                className="text-brand font-bold text-sm hover:underline cursor-pointer active:opacity-80 transition"
              >
                {showAll ? 'Show Less' : `View All (${transactions.length})`}
              </button>
            )}
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All' },
              { id: 'recharge', label: 'Recharge' },
              { id: 'deduction', label: 'Platform Fee' },
              { id: 'credit', label: 'Credits' },
              { id: 'debit', label: 'Debits' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTxnFilter(f.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  txnFilter === f.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
            />
          </div>

          <div className="space-y-1">
            {transactions.length > 0 ? (
              (showAll ? transactions : transactions.slice(0, 3)).map(txn => (
                <TransactionCard key={txn._id || txn.transactionId} transaction={{
                  id: txn._id || txn.transactionId,
                  title: txn.source || 'Wallet Transaction',
                  amount: txn.amount,
                  type: txn.type.toLowerCase(),
                  status: txn.status.toLowerCase(),
                  date: new Date(txn.createdAt).toLocaleString(),
                  balanceAfter: txn.balanceAfter,
                  bookingRef: txn.bookingId?.reference,
                  isRefundEligible: txn.status === 'Pending' && txn.type === 'Refund' && txn.source?.includes('Refund Eligible'),
                  onRequestRefund: () => handleRequestRefund(txn.bookingId?._id || txn.bookingId),
                }} />
              ))
            ) : (
              <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 shadow-sm mt-4">
                <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <WalletIcon size={28} className="text-brand" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-1 text-lg">No transactions found</h4>
                <p className="text-sm text-gray-500">Start by adding money to your wallet.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AddMoneyModal 
        isOpen={isAddMoneyOpen} 
        onClose={() => setIsAddMoneyOpen(false)} 
        onProceed={handleAddMoney} 
      />
      
      <WithdrawMoneyModal
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        onProceed={handleWithdraw}
        balance={balance}
        isProcessing={isProcessing}
      />
    </div>
  )
}
