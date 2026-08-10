import { Wallet, Plus, Landmark, Clock, ArrowUpRight, TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'

export function WalletBalanceCard({ balance, pendingBalance = 0, totalWithdrawn = 0, lifetimeEarnings = 0, onAddMoney, onWithdraw }) {
  return (
    <div className="w-full space-y-3.5">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden border border-indigo-900/50"
      >
        {/* Decorator circles */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-40 h-40 bg-amber-400 opacity-15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-32 h-32 bg-indigo-500 opacity-10 rounded-full blur-2xl pointer-events-none"></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md border border-white/10">
                <Wallet size={18} className="text-amber-400" />
              </div>
              <span className="font-extrabold text-slate-300 tracking-wide text-[10px] sm:text-xs uppercase">Available Balance</span>
            </div>
            <span className="text-[9px] font-black text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/50">
              Staffivaa Wallet
            </span>
          </div>
          
          <div className="mb-5">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-baseline truncate">
              <span className="text-amber-400 mr-1 text-2xl sm:text-3xl">₹</span>
              <span>{balance.toLocaleString('en-IN')}</span>
            </h2>
          </div>
          
          <div className="grid grid-cols-2 gap-2.5">
            <button 
              onClick={onWithdraw}
              className="w-full bg-amber-400 text-slate-950 font-black py-2.5 sm:py-3 px-3 rounded-2xl shadow-lg shadow-amber-400/20 flex items-center justify-center space-x-1.5 active:scale-95 transition-all cursor-pointer text-xs sm:text-sm whitespace-nowrap"
            >
              <Landmark size={16} className="shrink-0" />
              <span className="truncate">Withdraw Funds</span>
            </button>

            <button 
              onClick={onAddMoney}
              className="w-full bg-white/10 text-white font-extrabold py-2.5 sm:py-3 px-3 rounded-2xl backdrop-blur-md flex items-center justify-center space-x-1.5 active:scale-95 transition-all border border-white/10 hover:bg-white/20 cursor-pointer text-xs sm:text-sm whitespace-nowrap"
            >
              <Plus size={16} strokeWidth={2.5} className="shrink-0" />
              <span className="truncate">Add Money</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Wallet Summary KPI Deck */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white p-2.5 sm:p-3.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-0.5 overflow-hidden">
          <span className="text-[8px] sm:text-[9px] font-black text-amber-600 uppercase tracking-wider flex items-center gap-0.5 truncate">
            <Clock className="h-2.5 w-2.5 shrink-0" /> Pending
          </span>
          <p className="text-[13px] sm:text-[15px] font-black text-slate-900 truncate">₹{pendingBalance.toLocaleString('en-IN')}</p>
        </div>

        <div className="bg-white p-2.5 sm:p-3.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-0.5 overflow-hidden">
          <span className="text-[8px] sm:text-[9px] font-black text-rose-600 uppercase tracking-wider flex items-center gap-0.5 truncate">
            <ArrowUpRight className="h-2.5 w-2.5 shrink-0" /> Withdrawn
          </span>
          <p className="text-[13px] sm:text-[15px] font-black text-slate-900 truncate">₹{totalWithdrawn.toLocaleString('en-IN')}</p>
        </div>

        <div className="bg-white p-2.5 sm:p-3.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-0.5 overflow-hidden">
          <span className="text-[8px] sm:text-[9px] font-black text-emerald-600 uppercase tracking-wider flex items-center gap-0.5 truncate">
            <TrendingUp className="h-2.5 w-2.5 shrink-0" /> Lifetime
          </span>
          <p className="text-[13px] sm:text-[15px] font-black text-slate-900 truncate">₹{lifetimeEarnings.toLocaleString('en-IN')}</p>
        </div>
      </div>
    </div>
  )
}
