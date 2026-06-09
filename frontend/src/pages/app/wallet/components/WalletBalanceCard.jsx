import { Wallet, Plus, History } from 'lucide-react'
import { motion } from 'framer-motion'

export function WalletBalanceCard({ balance, onAddMoney }) {
  return (
    <div className="w-full">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-surface-900 to-surface-950 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-white/5"
      >
        {/* Decorator circles */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-40 h-40 bg-brand opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-32 h-32 bg-brand opacity-5 rounded-full blur-2xl"></div>
        
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-5">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md border border-white/10">
              <Wallet size={22} className="text-brand" />
            </div>
            <span className="font-medium text-gray-300 tracking-wide text-sm uppercase">Available Balance</span>
          </div>
          
          <div className="mb-8">
            <h2 className="text-4xl font-bold tracking-tight text-white flex items-center">
              <span className="text-brand mr-1">₹</span>
              {balance.toLocaleString('en-IN')}
            </h2>
          </div>
          
          <div className="flex space-x-4">
            <button 
              onClick={onAddMoney}
              className="flex-1 bg-brand text-black font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-brand/20 flex items-center justify-center space-x-2 active:scale-95 transition-all"
            >
              <Plus size={20} strokeWidth={2.5} />
              <span>Add Money</span>
            </button>
            
            <button 
              className="flex-1 bg-white/10 text-white font-semibold py-3.5 px-4 rounded-xl backdrop-blur-md flex items-center justify-center space-x-2 active:scale-95 transition-all border border-white/10 hover:bg-white/20"
            >
              <History size={18} />
              <span>History</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
