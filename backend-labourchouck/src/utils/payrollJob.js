import { payrollService } from '../services/payroll.service.js'

let isRunning = false

export const startPayrollEngineJob = () => {
  // Run every hour instead of using cron (or keep simple interval of 24h: 24 * 60 * 60 * 1000)
  // For testing/demonstration, running it more frequently or once on startup is better.
  // We'll run it every 1 hour (60 * 60 * 1000)
  setInterval(async () => {
    if (isRunning) return
    isRunning = true
    try {
      console.log('[PayrollEngine] Starting daily payroll accrual & batch generation')
      
      // Step 1: Convert newly verified attendance to earnings ledgers
      const ledgers = await payrollService.accruePendingEarnings()
      console.log(`[PayrollEngine] Generated ${ledgers.length} new earnings ledgers.`)

      // Step 2: Group accrued ledgers into payout batches
      const batches = await payrollService.generatePayoutBatches()
      console.log(`[PayrollEngine] Generated ${batches.length} new payout batches pending approval.`)
      
    } catch (error) {
      console.error('[PayrollEngine] Job failed:', error)
    } finally {
      isRunning = false
    }
  }, 60 * 60 * 1000) // 1 hour interval
  
  console.log('Payroll Engine Job scheduled (Interval based).')
}
