import { ArrowDownLeft, ArrowUpRight, Clock } from 'lucide-react'

export function TransactionCard({ transaction }) {
  const isCredit = transaction.type === 'credit'
  
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between mb-3 active:scale-[0.98] transition-transform">
      <div className="flex items-center space-x-4">
        <div className={`p-3 rounded-full ${isCredit ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
          {isCredit ? <ArrowDownLeft size={20} strokeWidth={2.5} /> : <ArrowUpRight size={20} strokeWidth={2.5} />}
        </div>
        <div>
          <h4 className="font-semibold text-gray-900">{transaction.title}</h4>
          <div className="flex items-center text-xs text-gray-500 mt-1 space-x-1">
            <Clock size={12} />
            <span>{transaction.date}</span>
            <span className="mx-1">•</span>
            <span className={`font-medium ${transaction.status === 'success' || transaction.status === 'completed' ? 'text-green-600' : 'text-orange-500'}`}>
              {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
            </span>
          </div>
          {transaction.isRefundEligible && (
            <button
              onClick={(e) => { e.stopPropagation(); transaction.onRequestRefund?.() }}
              className="mt-2 text-xs font-bold bg-brand text-slate-900 px-3 py-1.5 rounded hover:bg-brand/90 transition-colors"
            >
              Request Refund
            </button>
          )}
        </div>
      </div>
      <div className="text-right flex flex-col items-end">
        <span className={`font-bold text-lg ${isCredit ? 'text-green-600' : 'text-gray-900'}`}>
          {isCredit || transaction.type === 'refund' ? '+' : '-'}₹{transaction.amount}
        </span>
      </div>
    </div>
  )
}
