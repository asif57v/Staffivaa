import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, PlusCircle } from 'lucide-react'

export function ExtraWorkModal({ isOpen, onClose, onSubmit, isLoading }) {
  const [workType, setWorkType] = useState('')
  const [description, setDescription] = useState('')
  const [extraAmount, setExtraAmount] = useState('')
  const [extraTime, setExtraTime] = useState('')

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen])

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      workType,
      description,
      extraAmount: Number(extraAmount),
      extraTime: Number(extraTime),
    })
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[85vh] overflow-hidden"
          >
            {/* Header */}
            <div className="shrink-0 p-5 sm:p-6 pb-4 border-b border-slate-100 flex items-center justify-between bg-white z-10 relative">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <PlusCircle className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 leading-tight">Request Extra Work</h2>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">Ask for additional services.</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 transition shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Form */}
            <div className="overflow-y-auto no-scrollbar p-5 sm:p-6 space-y-5 bg-slate-50/50">
              <form id="extra-work-form" onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Work Type / Title</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Paint another wall"
                    className="w-full rounded-2xl border-slate-200 bg-white p-3.5 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand transition"
                    value={workType}
                    onChange={(e) => setWorkType(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Description</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Briefly describe what needs to be done..."
                    className="w-full rounded-2xl border-slate-200 bg-white p-3.5 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand transition resize-none"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Extra Time</label>
                    <div className="relative">
                      <input
                        required
                        type="number"
                        min="1"
                        placeholder="2"
                        className="w-full rounded-2xl border-slate-200 bg-white p-3.5 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand pr-12 transition"
                        value={extraTime}
                        onChange={(e) => setExtraTime(e.target.value)}
                      />
                      <span className="absolute right-4 top-3.5 text-xs font-bold text-slate-400">hrs</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Offered Amount</label>
                    <div className="relative">
                      <span className="absolute left-4 top-3.5 text-sm font-bold text-slate-400">₹</span>
                      <input
                        required
                        type="number"
                        min="10"
                        placeholder="500"
                        className="w-full rounded-2xl border-slate-200 bg-white p-3.5 pl-8 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand transition"
                        value={extraAmount}
                        onChange={(e) => setExtraAmount(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Sticky Footer */}
            <div className="shrink-0 p-4 border-t border-slate-100 bg-white rounded-b-3xl sm:rounded-b-3xl relative z-10 pb-[max(1rem,env(safe-area-inset-bottom,1rem))]">
              <button
                type="submit"
                form="extra-work-form"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] p-4 text-sm font-bold text-white transition-all disabled:opacity-70 shadow-lg shadow-slate-900/20"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Send Request'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
