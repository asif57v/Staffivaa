import { useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { useLazyGetPaymentStatusQuery } from '../store/api/paymentApi.js'

const PENDING_PAYMENT_KEY = 'staffivaa_pending_payment'

export function usePaymentReconciliation({ onPaymentSuccess, onPaymentFailed } = {}) {
  const [triggerGetStatus] = useLazyGetPaymentStatusQuery()

  // Use refs to store callbacks so checkStatus reference remains completely stable
  // and does not cause infinite re-render loops when parent passes inline functions.
  const successCallbackRef = useRef(onPaymentSuccess)
  const failedCallbackRef = useRef(onPaymentFailed)
  useEffect(() => {
    successCallbackRef.current = onPaymentSuccess
    failedCallbackRef.current = onPaymentFailed
  }, [onPaymentSuccess, onPaymentFailed])

  const isCheckingRef = useRef(false)
  const lastCheckTimestampRef = useRef({})

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

      // Throttle: avoid checking the exact same order if checked in the last 4 seconds
      const now = Date.now()
      const lastCheck = lastCheckTimestampRef.current[targetOrderId] || 0
      if (now - lastCheck < 4000 && !orderIdToVerify) {
        return null
      }

      if (isCheckingRef.current) return null
      isCheckingRef.current = true
      lastCheckTimestampRef.current[targetOrderId] = now

      try {
        const result = await triggerGetStatus(targetOrderId, false).unwrap()
        if (result?.status === 'SUCCESS') {
          clearPendingPayment()
          toast.success('Your payment was successfully verified!')
          if (successCallbackRef.current) successCallbackRef.current(result)
          return result
        } else if (result?.status === 'FAILED' || result?.status === 'EXPIRED') {
          clearPendingPayment()
          toast.error(result.failureReason || 'Payment did not complete or expired.')
          if (failedCallbackRef.current) failedCallbackRef.current(result)
          return result
        }
        return result
      } catch (err) {
        console.warn('[PaymentReconciliation] Check status error:', err?.message)
        return null
      } finally {
        isCheckingRef.current = false
      }
    },
    [getPendingPayment, triggerGetStatus, clearPendingPayment]
  )

  // Auto-check pending payment ONLY ONCE on mount or when user reconnects to the internet
  const hasMountedRef = useRef(false)
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      const pending = getPendingPayment()
      if (pending?.orderId) {
        checkStatus(pending.orderId)
      }
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
