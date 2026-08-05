import { Wallet, Plus, Landmark, Clock, ArrowUpRight, TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'

export function WalletBalanceCard({ balance, pendingBalance = 0, totalWithdrawn = 0, lifetimeEarnings = 0, onAddMoney, onWithdraw }) {
  return (
    <div className="w-full space-y-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-indigo-900/50"
      >
        {/* Decorator circles */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-40 h-40 bg-amber-400 opacity-15 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-32 h-32 bg-indigo-500 opacity-10 rounded-full blur-2xl"></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md border border-white/10">
                <Wallet size={22} className="text-amber-400" />
              </div>
              <span className="font-bold text-slate-300 tracking-wide text-xs uppercase">Available Wallet Balance</span>
            </div>
            <span className="text-[10px] font-black text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-800/50">
              Staffivaa Wallet
            </span>
          </div>
          
          <div className="mb-6">
            <h2 className="text-4xl font-black tracking-tight text-white flex items-center">
              <span className="text-amber-400 mr-1">₹</span>
              {balance.toLocaleString('en-IN')}
            </h2>
          </div>
          
          <div className="flex space-x-3">
            <button 
              onClick={onWithdraw}
              className="flex-1 bg-amber-400 text-slate-950 font-black py-3.5 px-4 rounded-2xl shadow-lg shadow-amber-400/20 flex items-center justify-center space-x-2 active:scale-95 transition-all cursor-pointer"
            >
              <Landmark size={18} />
              <span>Withdraw Funds</span>
            </button>

            <button 
              onClick={onAddMoney}
              className="flex-1 bg-white/10 text-white font-extrabold py-3.5 px-4 rounded-2xl backdrop-blur-md flex items-center justify-center space-x-2 active:scale-95 transition-all border border-white/10 hover:bg-white/20 cursor-pointer"
            >
              <Plus size={18} strokeWidth={2.5} />
              <span>Add Money</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Wallet Summary KPI Deck */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[9px] font-black text-amber-600 uppercase tracking-wider flex items-center gap-1">
            <Clock className="h-3 w-3" /> Pending
          </span>
          <p className="text-[15px] font-black text-slate-900">₹{pendingBalance.toLocaleString('en-IN')}</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[9px] font-black text-rose-600 uppercase tracking-wider flex items-center gap-1">
            <ArrowUpRight className="h-3 w-3" /> Withdrawn
          </span>
          <p className="text-[15px] font-black text-slate-900">₹{totalWithdrawn.toLocaleString('en-IN')}</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> Lifetime
          </span>
          <p className="text-[15px] font-black text-slate-900">₹{lifetimeEarnings.toLocaleString('en-IN')}</p>
        </div>
      </div>
    </div>
  )
}
