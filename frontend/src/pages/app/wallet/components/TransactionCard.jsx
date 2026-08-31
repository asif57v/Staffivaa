import { ArrowDownLeft, ArrowUpRight, Clock } from 'lucide-react'

export function TransactionCard({ transaction }) {
  const isCredit = transaction.type === 'credit'
  
  return (
    <div className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-xs border border-gray-100 flex items-center justify-between mb-2.5 active:scale-[0.98] transition-transform gap-2.5 overflow-hidden">
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        <div className={`p-2.5 rounded-2xl shrink-0 ${isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {isCredit ? <ArrowDownLeft size={18} strokeWidth={2.5} /> : <ArrowUpRight size={18} strokeWidth={2.5} />}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate leading-snug">{transaction.title}</h4>
          <div className="flex flex-wrap items-center text-[10px] sm:text-xs text-slate-500 mt-0.5 gap-1">
            <span className="flex items-center gap-1 font-medium text-slate-400">
              <Clock size={11} className="shrink-0" />
              <span>{transaction.date}</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className={`font-black uppercase tracking-wider text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-md ${
              transaction.status === 'success' || transaction.status === 'completed' 
                ? 'bg-emerald-50 text-emerald-700' 
                : 'bg-amber-50 text-amber-700'
            }`}>
              {transaction.status}
            </span>
            {transaction.bookingRef ? (
              <>
                <span className="text-slate-300">•</span>
                <span className="font-semibold text-slate-500">#{transaction.bookingRef}</span>
              </>
            ) : null}
          </div>
          {transaction.balanceAfter != null && (
            <p className="mt-1 text-[10px] font-semibold text-slate-500">
              Balance after: ₹{Number(transaction.balanceAfter).toLocaleString('en-IN')}
            </p>
          )}
          {transaction.isRefundEligible && (
            <button
              onClick={(e) => { e.stopPropagation(); transaction.onRequestRefund?.() }}
              className="mt-1.5 text-[10px] font-bold bg-amber-400 text-slate-950 px-2.5 py-1 rounded-lg hover:bg-amber-500 transition-colors"
            >
              Request Refund
            </button>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <span className={`font-black text-sm sm:text-base ${isCredit ? 'text-emerald-600' : 'text-slate-900'}`}>
          {isCredit || transaction.type === 'refund' ? '+' : '-'}₹{Number(transaction.amount || 0).toLocaleString('en-IN')}
        </span>
      </div>
    </div>
  )
}
