import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Wallet as WalletIcon } from 'lucide-react'
import { WalletBalanceCard } from './components/WalletBalanceCard'
import { TransactionCard } from './components/TransactionCard'
import { AddMoneyModal } from './components/AddMoneyModal'
import { WithdrawMoneyModal } from './components/WithdrawMoneyModal'
import { PageSkeleton } from '../../../components/ui/PageSkeleton'
import { useGetWalletBalanceQuery, useCreateRazorpayOrderMutation, useVerifyRazorpayPaymentMutation, useRequestWithdrawalMutation, useRequestRefundMutation } from '../../../store/api/walletApi'
import { useAuth } from '../../../hooks/useAuth'

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export function WalletPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [isAddMoneyOpen, setIsAddMoneyOpen] = useState(false)
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [txnFilter, setTxnFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const walletQueryParams = {
    ...(txnFilter !== 'all' ? { type: txnFilter } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  }

  const { data: walletData, isLoading, refetch } = useGetWalletBalanceQuery(walletQueryParams)
  const [createOrder] = useCreateRazorpayOrderMutation()
  const [verifyPayment] = useVerifyRazorpayPaymentMutation()
  const [requestWithdrawal] = useRequestWithdrawalMutation()
  const [requestRefund, { isLoading: isRequestingRefund }] = useRequestRefundMutation()

  const balance = walletData?.data?.balance || 0
  const pendingBalance = walletData?.data?.pendingBalance || 0
  const totalWithdrawn = walletData?.data?.totalWithdrawn || 0
  const lifetimeEarnings = walletData?.data?.lifetimeEarnings || 0
  const transactions = walletData?.data?.transactions || []

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
    setIsProcessing(true)
    setIsAddMoneyOpen(false)

    try {
      const isLoaded = await loadRazorpayScript()
      if (!isLoaded) {
        alert('Failed to load Razorpay SDK. Are you online?')
        setIsProcessing(false)
        return
      }

      // Create Order
      const res = await createOrder({ amount }).unwrap()
      const { orderId, amount: orderAmount, currency, key } = res.data

      const options = {
        key: key,
        amount: orderAmount.toString(),
        currency: currency,
        name: 'Staffivaa',
        description: 'Add Money to Wallet',
        image: '/favicon.svg',
        order_id: orderId,
        handler: async function (response) {
          try {
            setIsProcessing(true)
            await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amount: amount
            }).unwrap()
            
            // Payment successful, RTK query invalidates 'Wallet' tag automatically, but we can also refetch
            refetch()
          } catch (error) {
            console.error('Payment verification failed:', error)
            alert('Payment verification failed. If money was deducted, it will be refunded.')
          } finally {
            setIsProcessing(false)
          }
        },
        prefill: {
          name: user?.fullName || '',
          email: user?.email || '',
          contact: user?.phone || ''
        },
        theme: {
          color: '#0f172a'
        },
        modal: {
          ondismiss: function() {
            setIsProcessing(false)
          }
        }
      }

      const rzp1 = new window.Razorpay(options)
      rzp1.on('payment.failed', function (response) {
        console.error('Payment Failed:', response.error)
        setIsProcessing(false)
      })
      rzp1.open()
      
    } catch (error) {
      console.error('Failed to initiate payment:', error)
      alert(error?.data?.message || 'Failed to initiate payment. Please try again.')
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageSkeleton visible={isProcessing || isLoading} />
      
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
