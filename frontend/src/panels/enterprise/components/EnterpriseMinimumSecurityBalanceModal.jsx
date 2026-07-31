import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldAlert, Wallet, ArrowRight, X, AlertTriangle, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function EnterpriseMinimumSecurityBalanceModal({ isOpen, onClose, securityData }) {
  const navigate = useNavigate()

  if (!isOpen || !securityData) return null

  const requiredBalance = securityData.requiredBalance || 20000
  const currentBalance = securityData.currentBalance || 0
  const difference = securityData.difference || (requiredBalance - currentBalance)

  const handleRechargeClick = () => {
    onClose()
    navigate('/enterprise/wallet')
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 my-8"
        >
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 p-6 text-white relative">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                <ShieldAlert className="h-7 w-7 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-black leading-tight">Minimum Security Wallet Balance Required</h3>
                <p className="text-xs text-amber-100 font-medium mt-0.5">Mandatory security deposit validation before job posting</p>
              </div>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-5">
            <p className="text-xs sm:text-sm font-medium text-slate-700 leading-relaxed">
              To create a new job, your enterprise account must maintain a minimum refundable security wallet balance of{' '}
              <span className="font-extrabold text-slate-900">₹{requiredBalance.toLocaleString('en-IN')}</span>.
            </p>

            {/* Financial Breakdown Card */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200/60">
                <span className="font-bold text-slate-500 flex items-center gap-1.5">
                  <Wallet className="h-4 w-4 text-slate-400" /> Current Wallet Balance
                </span>
                <span className={`font-extrabold text-sm ${currentBalance < requiredBalance ? 'text-amber-600' : 'text-emerald-600'}`}>
                  ₹{currentBalance.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200/60">
                <span className="font-bold text-slate-500 flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-indigo-500" /> Required Minimum Balance
                </span>
                <span className="font-extrabold text-sm text-slate-900">
                  ₹{requiredBalance.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 text-amber-950">
                <span className="font-extrabold uppercase tracking-wide flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600" /> Shortfall to Recharge
                </span>
                <span className="font-black text-base text-rose-600">
                  ₹{difference.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 font-medium">
              Please recharge at least <span className="font-bold text-slate-800">₹{difference.toLocaleString('en-IN')}</span> to continue creating new job requirements. The security deposit stays safely in your wallet.
            </p>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRechargeClick}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold shadow-md shadow-amber-200 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Recharge Wallet <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
