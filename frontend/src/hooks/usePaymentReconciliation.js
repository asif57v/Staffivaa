import { useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useLazyGetPaymentStatusQuery } from '../store/api/paymentApi.js'

const PENDING_PAYMENT_KEY = 'staffivaa_pending_payment'

export function usePaymentReconciliation({ onPaymentSuccess, onPaymentFailed } = {}) {
  const [triggerGetStatus] = useLazyGetPaymentStatusQuery()

  const savePendingPayment = useCallback((paymentInfo) => {
    try {
      sessionStorage.setItem(
        PENDING_PAYMENT_KEY,
        JSON.stringify({
          ...paymentInfo,
          savedAt: Date.now(),
        })
      )
    } catch (e) {
      console.warn('Failed to save pending payment to sessionStorage', e)
    }
  }, [])

  const clearPendingPayment = useCallback(() => {
    try {
      sessionStorage.removeItem(PENDING_PAYMENT_KEY)
    } catch (e) {}
  }, [])

  const getPendingPayment = useCallback(() => {
    try {
      const data = sessionStorage.getItem(PENDING_PAYMENT_KEY)
      if (!data) return null
      const parsed = JSON.parse(data)
      // Discard pending payments older than 2 hours
      if (Date.now() - parsed.savedAt > 2 * 60 * 60 * 1000) {
        clearPendingPayment()
        return null
      }
      return parsed
    } catch (e) {
      return null
    }
  }, [clearPendingPayment])

  const checkStatus = useCallback(
    async (orderIdToVerify) => {
      const targetOrderId = orderIdToVerify || getPendingPayment()?.orderId
      if (!targetOrderId) return null

      try {
        const result = await triggerGetStatus(targetOrderId, false).unwrap()
        if (result?.status === 'SUCCESS') {
          clearPendingPayment()
          toast.success('Your payment was successfully verified!')
          if (onPaymentSuccess) onPaymentSuccess(result)
          return result
        } else if (result?.status === 'FAILED' || result?.status === 'EXPIRED') {
          clearPendingPayment()
          toast.error(result.failureReason || 'Payment did not complete or expired.')
          if (onPaymentFailed) onPaymentFailed(result)
          return result
        }
        return result
      } catch (err) {
        console.warn('[PaymentReconciliation] Check status error:', err?.message)
        return null
      }
    },
    [getPendingPayment, triggerGetStatus, clearPendingPayment, onPaymentSuccess, onPaymentFailed]
  )

  // Auto-check pending payment on component mount or when user reconnects to the internet
  useEffect(() => {
    const pending = getPendingPayment()
    if (pending?.orderId) {
      checkStatus(pending.orderId)
    }

    const handleOnline = () => {
      const activePending = getPendingPayment()
      if (activePending?.orderId) {
        console.log('[PaymentReconciliation] Reconnected online! Reconciling pending order:', activePending.orderId)
        checkStatus(activePending.orderId)
      }
    }

    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [getPendingPayment, checkStatus])

  return {
    savePendingPayment,
    clearPendingPayment,
    getPendingPayment,
    checkStatus,
  }
}
