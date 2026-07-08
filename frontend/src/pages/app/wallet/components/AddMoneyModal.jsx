import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, IndianRupee } from 'lucide-react'

export function AddMoneyModal({ isOpen, onClose, onProceed }) {
  const [amount, setAmount] = useState('')
  const quickAmounts = [100, 500, 1000, 2000]

  useEffect(() => {
    if (isOpen) {
      setAmount('')
    }
  }, [isOpen])

  if (typeof document === 'undefined') return null

  const handleProceed = () => {
    const val = parseInt(amount)
    if (val >= 10) {
      onProceed(val)
    }
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm pointer-events-auto"
            onClick={onClose}
          />
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative bg-white w-full max-w-[430px] rounded-t-[2.5rem] sm:rounded-3xl p-6 sm:p-8 shadow-2xl z-10 mx-auto pointer-events-auto border-t border-slate-100/50"
          >
            {/* Drag Handle for mobile feel */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-200 rounded-full sm:hidden" />

            <div className="flex justify-between items-center mb-7 mt-2 sm:mt-0">
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Add to Wallet</h3>
              <button 
                onClick={onClose} 
                className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-500 active:scale-95 transition-all"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="mb-7">
              <label className="block text-[13px] font-bold text-slate-500 mb-2.5 uppercase tracking-wide">Amount</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0f172a] transition-colors">
                  <IndianRupee size={24} strokeWidth={2.5} />
                </div>
                <input 
                  type="number" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full text-4xl font-black text-slate-900 bg-slate-50/50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-4 focus:ring-[#0f172a]/10 focus:border-[#0f172a] focus:bg-white transition-all placeholder:text-slate-300"
                  autoFocus
                />
              </div>
              {amount && parseInt(amount) < 10 && (
                <motion.p 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className="text-rose-500 text-sm mt-2.5 font-semibold flex items-center gap-1"
                >
                  Minimum amount is ₹10
                </motion.p>
              )}
            </div>

            <div className="mb-8">
              <div className="grid grid-cols-4 gap-2.5">
                {quickAmounts.map(amt => (
                  <button
                    key={amt}
                    onClick={() => setAmount(amt.toString())}
                    className={`py-3 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center text-[13px] border ${
                      amount === amt.toString() 
                        ? 'bg-[#0f172a] border-[#0f172a] text-white shadow-[0_4px_12px_rgba(15,23,42,0.2)]' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    +₹{amt}
                  </button>
                ))}
              </div>
            </div>

            <button 
              onClick={handleProceed}
              disabled={!amount || parseInt(amount) < 10}
              className="w-full bg-brand hover:bg-yellow-400 text-black font-extrabold py-4 rounded-2xl disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:active:scale-100 active:scale-[0.98] transition-all flex justify-center items-center gap-2 text-[17px] shadow-[0_4px_20px_rgba(255,193,7,0.3)] disabled:shadow-none"
            >
              <span>Proceed to Pay</span>
              {amount && parseInt(amount) >= 10 && (
                <span className="flex items-center bg-black/10 px-2 py-0.5 rounded-lg text-sm">
                  ₹{amount}
                </span>
              )}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
