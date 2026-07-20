import cron from 'node-cron'
import CommissionService from '../services/CommissionService.js'

export function startCommissionOverdueJob() {
  // Run every midnight
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('Running commission overdue check...')
      const count = await CommissionService.markOverdueCommissions()
      console.log(`Marked ${count} commissions as overdue.`)
    } catch (err) {
      console.error('Error running commission overdue job:', err)
    }
  })
}
