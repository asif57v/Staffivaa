import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Wallet as WalletIcon } from 'lucide-react'
import { WalletBalanceCard } from './components/WalletBalanceCard'
import { TransactionCard } from './components/TransactionCard'
import { AddMoneyModal } from './components/AddMoneyModal'
import { PageSkeleton } from '../../../components/ui/PageSkeleton'
import { useGetWalletBalanceQuery, useCreateRazorpayOrderMutation, useVerifyRazorpayPaymentMutation } from '../../../store/api/walletApi'
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
  
  const { data: walletData, isLoading, refetch } = useGetWalletBalanceQuery()
  const [createOrder] = useCreateRazorpayOrderMutation()
  const [verifyPayment] = useVerifyRazorpayPaymentMutation()
  
  const [isAddMoneyOpen, setIsAddMoneyOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const balance = walletData?.data?.balance || 0
  const transactions = walletData?.data?.transactions || []

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
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100 px-4 py-4 pt-8">
        <div className="flex items-center space-x-3 mb-2">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <ArrowLeft size={24} className="text-gray-900" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">My Wallet</h1>
        </div>
        <p className="text-gray-500 text-sm pl-11 -mt-2">Manage your balance and transactions</p>
      </div>

      <div className="px-4 pt-6 pb-8 max-w-lg mx-auto space-y-8">
        <WalletBalanceCard 
          balance={balance} 
          onAddMoney={() => setIsAddMoneyOpen(true)}
          onHistory={() => {}}
        />

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Recent Transactions</h3>
            {transactions.length > 0 && (
              <button className="text-brand font-semibold text-sm hover:underline">View All</button>
            )}
          </div>

          <div className="space-y-1">
            {transactions.length > 0 ? (
              transactions.map(txn => (
                <TransactionCard key={txn._id || txn.transactionId} transaction={{
                  id: txn._id || txn.transactionId,
                  title: txn.source || 'Wallet Transaction',
                  amount: txn.amount,
                  type: txn.type.toLowerCase(),
                  status: txn.status.toLowerCase(),
                  date: new Date(txn.createdAt).toLocaleString()
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
    </div>
  )
}
