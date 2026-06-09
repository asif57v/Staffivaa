import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Wallet as WalletIcon } from 'lucide-react'
import { WalletBalanceCard } from './components/WalletBalanceCard'
import { TransactionCard } from './components/TransactionCard'
import { AddMoneyModal } from './components/AddMoneyModal'
import { PageSkeleton } from '../../../components/ui/PageSkeleton'

// Dummy Data
const INITIAL_TRANSACTIONS = [
  { id: 1, title: 'Money Added', amount: 1000, type: 'credit', status: 'success', date: 'Today, 10:30 AM' },
  { id: 2, title: 'Money Added', amount: 500, type: 'credit', status: 'success', date: 'Yesterday, 02:15 PM' },
  { id: 3, title: 'Booking Payment', amount: 200, type: 'debit', status: 'success', date: '2 days ago' },
]

export function WalletPage() {
  const navigate = useNavigate()
  const [balance, setBalance] = useState(2500)
  const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS)
  const [isAddMoneyOpen, setIsAddMoneyOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleAddMoney = (amount) => {
    setIsProcessing(true)
    setIsAddMoneyOpen(false)
    
    // Simulate network request
    setTimeout(() => {
      setBalance(prev => prev + amount)
      const newTransaction = {
        id: Date.now(),
        title: 'Money Added via UPI',
        amount: amount,
        type: 'credit',
        status: 'success',
        date: 'Just now'
      }
      setTransactions([newTransaction, ...transactions])
      setIsProcessing(false)
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageSkeleton visible={isProcessing} />
      
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
                <TransactionCard key={txn.id} transaction={txn} />
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
