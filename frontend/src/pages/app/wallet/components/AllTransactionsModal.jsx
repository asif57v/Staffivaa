import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Wallet as WalletIcon, ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { TransactionCard } from './TransactionCard'

export function AllTransactionsModal({ isOpen, onClose, transactions = [], handleRequestRefund }) {
  const [filter, setFilter] = useState('ALL') // 'ALL' | 'CREDIT' | 'DEBIT'

  if (typeof document === 'undefined' || !isOpen) return null

  const filteredTransactions = transactions.filter(txn => {
    if (filter === 'CREDIT') return txn.type?.toLowerCase() === 'credit'
    if (filter === 'DEBIT') return txn.type?.toLowerCase() === 'debit' || txn.type?.toLowerCase() === 'withdrawal'
    return true
  })

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm pointer-events-auto"
          onClick={onClose}
        />
        <motion.div 
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative bg-white w-full max-w-[500px] max-h-[85vh] sm:max-h-[80vh] rounded-t-[2.5rem] sm:rounded-3xl p-6 shadow-2xl z-10 mx-auto pointer-events-auto flex flex-col border-t border-slate-100/50"
        >
          {/* Drag Handle for mobile */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-200 rounded-full sm:hidden" />

          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-slate-100 mt-2 sm:mt-0 shrink-0">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">All Transactions</h3>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">Total {transactions.length} record{transactions.length !== 1 ? 's' : ''} found</p>
            </div>
            <button 
              onClick={onClose} 
              className="p-2.5 bg-slate-100/80 hover:bg-slate-200/80 rounded-full text-slate-600 active:scale-95 transition-all"
            >
              <X size={20} className="stroke-[2.5]" />
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex gap-2 my-4 shrink-0 overflow-x-auto no-scrollbar">
            {[
              { id: 'ALL', label: 'All History' },
              { id: 'CREDIT', label: 'Credits (+)', icon: ArrowDownRight },
              { id: 'DEBIT', label: 'Debits (-)', icon: ArrowUpRight },
            ].map((tab) => {
              const Icon = tab.icon
              const isActive = filter === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    isActive 
                      ? 'bg-slate-900 text-white shadow-md' 
                      : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'
                  }`}
                >
                  {Icon && <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#FFD100]' : 'text-slate-500'}`} />}
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Transaction List */}
          <div className="overflow-y-auto space-y-2 flex-1 pr-1 pb-4">
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map(txn => (
                <TransactionCard 
                  key={txn._id || txn.transactionId || Math.random()} 
                  transaction={{
                    id: txn._id || txn.transactionId,
                    title: txn.source || 'Wallet Transaction',
                    amount: txn.amount,
                    type: (txn.type || '').toLowerCase(),
                    status: (txn.status || '').toLowerCase(),
                    date: new Date(txn.createdAt).toLocaleString(),
                    isRefundEligible: txn.status === 'Pending' && txn.type === 'Refund' && txn.source?.includes('Refund Eligible'),
                    onRequestRefund: () => handleRequestRefund?.(txn.bookingId)
                  }} 
                />
              ))
            ) : (
              <div className="text-center py-12 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 mt-2">
                <div className="w-14 h-14 bg-slate-200/60 rounded-full flex items-center justify-center mx-auto mb-3">
                  <WalletIcon size={24} className="text-slate-400" />
                </div>
                <h4 className="font-bold text-slate-700 mb-1">No matching transactions</h4>
                <p className="text-xs text-slate-500">There are no {filter.toLowerCase()} records in your wallet.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  )
}
