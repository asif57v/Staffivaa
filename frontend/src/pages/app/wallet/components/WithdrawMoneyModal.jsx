import { useState } from 'react'
import { X, Landmark } from 'lucide-react'

export function WithdrawMoneyModal({ isOpen, onClose, onProceed, balance, isProcessing }) {
  const [amount, setAmount] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [ifscCode, setIfscCode] = useState('')
  const [accountHolderName, setAccountHolderName] = useState('')

  if (!isOpen) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (Number(amount) > balance) {
      alert('Amount exceeds your current balance')
      return
    }
    if (Number(amount) < 100) {
      alert('Minimum withdrawal amount is ₹100')
      return
    }
    onProceed({
      amount: Number(amount),
      bankDetails: {
        accountNumber,
        ifscCode,
        accountHolderName
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" 
        onClick={isProcessing ? undefined : onClose}
      />
      
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden transform transition-all">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-gray-900">
            <Landmark size={20} className="text-[#FFC107]" />
            <h3 className="text-lg font-bold">Withdraw Funds</h3>
          </div>
          <button 
            onClick={onClose} 
            disabled={isProcessing}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Amount to withdraw
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-400">₹</span>
              <input 
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full pl-10 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-2xl font-bold text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#FFC107]/20 focus:border-[#FFC107]/50 transition-all"
                required
                min="100"
                max={balance}
                disabled={isProcessing}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500 flex justify-between">
              <span>Available balance: ₹{balance.toLocaleString('en-IN')}</span>
              <span>Min. ₹100</span>
            </p>
          </div>

          <div className="space-y-3 pt-2 border-t border-gray-100">
             <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Account Holder Name
                </label>
                <input 
                  type="text"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FFC107]/20 focus:border-[#FFC107]/50 transition-all"
                  required
                  disabled={isProcessing}
                />
             </div>
             
             <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Account Number
                </label>
                <input 
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FFC107]/20 focus:border-[#FFC107]/50 transition-all"
                  required
                  disabled={isProcessing}
                />
             </div>
             
             <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  IFSC Code
                </label>
                <input 
                  type="text"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FFC107]/20 focus:border-[#FFC107]/50 transition-all uppercase"
                  required
                  disabled={isProcessing}
                />
             </div>
          </div>

          <button 
            type="submit"
            disabled={!amount || Number(amount) < 100 || Number(amount) > balance || !accountNumber || !ifscCode || !accountHolderName || isProcessing}
            className="w-full py-4 bg-[#FFC107] text-slate-900 rounded-2xl font-bold text-base shadow-sm hover:shadow active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {isProcessing ? 'Processing...' : 'Submit Request'}
          </button>
        </form>
      </div>
    </div>
  )
}
