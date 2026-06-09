import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

export function AddMoneyModal({ isOpen, onClose, onProceed }) {
  const [amount, setAmount] = useState('')
  const quickAmounts = [100, 500, 1000, 2000]

  useEffect(() => {
    if (isOpen) {
      setAmount('')
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleProceed = () => {
    const val = parseInt(amount)
    if (val >= 10) {
      onProceed(val)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div 
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative bg-white w-full max-w-[430px] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl z-10 mx-auto"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900">Add Money to Wallet</h3>
            <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-500 active:scale-95 transition-transform">
              <X size={20} />
            </button>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-500 mb-2">Enter Amount</label>
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-400">₹</span>
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full text-4xl font-bold text-gray-900 bg-gray-50 rounded-2xl py-5 pl-12 pr-4 outline-none focus:ring-2 focus:ring-brand focus:bg-white transition-all"
                autoFocus
              />
            </div>
            {amount && parseInt(amount) < 10 && (
              <p className="text-red-500 text-sm mt-2 font-medium">Minimum amount is ₹10</p>
            )}
          </div>

          <div className="mb-8">
            <p className="text-sm font-medium text-gray-500 mb-3">Quick Select</p>
            <div className="grid grid-cols-4 gap-3">
              {quickAmounts.map(amt => (
                <button
                  key={amt}
                  onClick={() => setAmount(amt.toString())}
                  className={`py-3 rounded-xl font-bold border transition-all active:scale-95 flex items-center justify-center text-sm ${
                    amount === amt.toString() 
                      ? 'bg-brand border-brand text-black shadow-md shadow-brand/20' 
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
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
            className="w-full bg-surface-900 text-white font-bold py-4 rounded-2xl disabled:opacity-50 disabled:active:scale-100 active:scale-[0.98] transition-all flex justify-center items-center space-x-2 text-lg shadow-lg shadow-surface-900/20"
          >
            <span>Proceed to Pay</span>
            {amount && parseInt(amount) >= 10 && <span>₹{amount}</span>}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
