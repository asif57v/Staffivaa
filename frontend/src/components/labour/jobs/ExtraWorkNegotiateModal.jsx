import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, Edit3 } from 'lucide-react'

export function ExtraWorkNegotiateModal({ isOpen, onClose, onSubmit, isLoading, initialAmount, initialTime }) {
  const [revisedAmount, setRevisedAmount] = useState(initialAmount || '')
  const [revisedTime, setRevisedTime] = useState(initialTime || '')

  if (!isOpen) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(Number(revisedAmount), Number(revisedTime))
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-0">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="relative w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6"
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <Edit3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Negotiate Work</h2>
              <p className="text-xs font-semibold text-slate-500">Propose a new price or time.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Revised Time</label>
                <div className="relative">
                  <input
                    required
                    type="number"
                    min="1"
                    className="w-full rounded-xl border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 pr-12"
                    value={revisedTime}
                    onChange={(e) => setRevisedTime(e.target.value)}
                  />
                  <span className="absolute right-3 top-3 text-xs font-bold text-slate-400">hours</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Revised Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-sm font-bold text-slate-400">₹</span>
                  <input
                    required
                    type="number"
                    min="1"
                    className="w-full rounded-xl border-slate-200 bg-slate-50 p-3 pl-8 text-sm font-semibold text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    value={revisedAmount}
                    onChange={(e) => setRevisedAmount(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-6 flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 p-4 text-sm font-bold text-white transition disabled:opacity-70"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Send Proposal'}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
