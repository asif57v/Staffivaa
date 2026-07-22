import { useState } from 'react'
import { Wallet as WalletIcon } from 'lucide-react'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { PageSkeleton } from '../../../components/ui/PageSkeleton.jsx'
import { useGetWalletBalanceQuery, useCreateRazorpayOrderMutation, useVerifyRazorpayPaymentMutation, useRequestWithdrawalMutation } from '../../../store/api/walletApi.js'
import { useAuth } from '../../../hooks/useAuth.js'

import { WalletBalanceCard } from '../../../pages/app/wallet/components/WalletBalanceCard.jsx'
import { TransactionCard } from '../../../pages/app/wallet/components/TransactionCard.jsx'
import { AddMoneyModal } from '../../../pages/app/wallet/components/AddMoneyModal.jsx'
import { WithdrawMoneyModal } from '../../../pages/app/wallet/components/WithdrawMoneyModal.jsx'

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

export function CorporateWalletPage() {
  const { user } = useAuth()
  
  const { data: walletData, isLoading, refetch } = useGetWalletBalanceQuery()
  const [createOrder] = useCreateRazorpayOrderMutation()
  const [verifyPayment] = useVerifyRazorpayPaymentMutation()
  const [requestWithdrawal] = useRequestWithdrawalMutation()
  
  const [isAddMoneyOpen, setIsAddMoneyOpen] = useState(false)
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const balance = walletData?.data?.balance || 0
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
    <div className="space-y-4">
      <PageSkeleton visible={isProcessing || isLoading} />
      
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Finance</p>
        <h2 className="text-lg font-extrabold text-slate-900">Wallet & Top-up</h2>
        <p className="mt-1 text-sm text-slate-600">Manage your corporate wallet balance.</p>
      </div>

      <div className="max-w-lg space-y-8">
        <WalletBalanceCard 
          balance={balance} 
          onAddMoney={() => setIsAddMoneyOpen(true)}
          onWithdraw={() => setIsWithdrawOpen(true)}
        />

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Recent Transactions</h3>
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
              <AppSurface className="text-center py-10">
                <div className="w-16 h-16 bg-[#FFC107]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <WalletIcon size={28} className="text-[#FFC107]" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-1 text-lg">No transactions found</h4>
                <p className="text-sm text-gray-500">Start by adding money to your wallet.</p>
              </AppSurface>
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
