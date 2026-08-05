import { useState } from 'react'
import { X, Landmark, Smartphone, ShieldCheck, Check } from 'lucide-react'

export function WithdrawMoneyModal({ isOpen, onClose, onProceed, balance, isProcessing }) {
  const [amount, setAmount] = useState('')
  const [payoutType, setPayoutType] = useState('bank_transfer') // 'bank_transfer' | 'upi'
  
  // Bank Details
  const [accountNumber, setAccountNumber] = useState('')
  const [ifscCode, setIfscCode] = useState('')
  const [accountHolderName, setAccountHolderName] = useState('')
  const [bankName, setBankName] = useState('')

  // UPI Details
  const [upiId, setUpiId] = useState('')
  const [upiHolderName, setUpiHolderName] = useState('')

  if (!isOpen) return null

  const handleFullWithdrawal = () => {
    setAmount(balance.toString())
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const numericAmount = Number(amount)
    if (numericAmount > balance) {
      alert('Withdrawal amount exceeds your current available wallet balance')
      return
    }
    if (numericAmount < 100) {
      alert('Minimum withdrawal amount is ₹100')
      return
    }

    if (payoutType === 'bank_transfer') {
      if (!accountNumber || !ifscCode || !accountHolderName) {
        alert('Please fill in all bank account details')
        return
      }
      onProceed({
        amount: numericAmount,
        payoutType: 'bank_transfer',
        bankDetails: {
          accountNumber,
          ifscCode,
          accountHolderName,
          bankName: bankName || 'Bank Account',
        },
      })
    } else {
      if (!upiId || !upiHolderName) {
        alert('Please fill in your UPI ID and Account Holder Name')
        return
      }
      onProceed({
        amount: numericAmount,
        payoutType: 'upi',
        upiDetails: {
          upiId,
          accountHolderName: upiHolderName,
        },
      })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" 
        onClick={isProcessing ? undefined : onClose}
      />
      
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden transform transition-all text-left max-h-[85vh] flex flex-col" style={{ marginBottom: 'calc(env(safe-area-inset-bottom, 0px) + 70px)' }}>
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 text-gray-900">
            <Landmark size={20} className="text-amber-500" />
            <h3 className="text-lg font-black">Request Wallet Withdrawal</h3>
          </div>
          <button 
            onClick={onClose} 
            disabled={isProcessing}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5 overflow-y-auto flex-1">
          {/* Amount Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                Withdrawal Amount
              </label>
              <button
                type="button"
                onClick={handleFullWithdrawal}
                className="text-xs font-extrabold text-indigo-600 hover:underline cursor-pointer"
              >
                Withdraw Full Balance (₹{balance.toLocaleString('en-IN')})
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-400">₹</span>
              <input 
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full pl-10 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-2xl font-black text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-all"
                required
                min="100"
                max={balance}
                disabled={isProcessing}
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-500 flex justify-between font-medium">
              <span>Available balance: ₹{balance.toLocaleString('en-IN')}</span>
              <span>Min. ₹100</span>
            </p>
          </div>

          {/* Payout Channel Selection */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
              Select Payout Channel
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPayoutType('bank_transfer')}
                className={`py-3 px-3 rounded-2xl border text-xs font-extrabold flex items-center justify-center space-x-2 transition cursor-pointer ${
                  payoutType === 'bank_transfer'
                    ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 shadow-xs'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Landmark size={16} />
                <span>Bank Account</span>
              </button>

              <button
                type="button"
                onClick={() => setPayoutType('upi')}
                className={`py-3 px-3 rounded-2xl border text-xs font-extrabold flex items-center justify-center space-x-2 transition cursor-pointer ${
                  payoutType === 'upi'
                    ? 'border-purple-600 bg-purple-50/80 text-purple-900 shadow-xs'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Smartphone size={16} />
                <span>UPI ID / VPA</span>
              </button>
            </div>
          </div>

          {/* Bank Transfer Inputs */}
          {payoutType === 'bank_transfer' ? (
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Account Holder Name
                </label>
                <input 
                  type="text"
                  placeholder="Name as per Bank Account"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-all"
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
                  placeholder="e.g. 918274639201"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-all"
                  required
                  disabled={isProcessing}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    IFSC Code
                  </label>
                  <input 
                    type="text"
                    placeholder="e.g. SBIN0001234"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold text-gray-900 uppercase focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-all"
                    required
                    disabled={isProcessing}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Bank Name
                  </label>
                  <input 
                    type="text"
                    placeholder="e.g. SBI"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-all"
                    disabled={isProcessing}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  UPI Virtual Address (VPA)
                </label>
                <input 
                  type="text"
                  placeholder="e.g. name@upi or 9876543210@paytm"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-400/50 transition-all"
                  required
                  disabled={isProcessing}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Account Holder Name
                </label>
                <input 
                  type="text"
                  placeholder="Name as per UPI Account"
                  value={upiHolderName}
                  onChange={(e) => setUpiHolderName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400/50 transition-all"
                  required
                  disabled={isProcessing}
                />
              </div>
            </div>
          )}

          <div className="pt-2 pb-2">
            <button 
              type="submit"
              disabled={!amount || Number(amount) < 100 || Number(amount) > balance || isProcessing}
              className="w-full py-4 bg-amber-400 text-slate-950 rounded-2xl font-black text-sm shadow-md hover:bg-amber-300 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {isProcessing ? 'Submitting Request...' : 'Submit Withdrawal Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
