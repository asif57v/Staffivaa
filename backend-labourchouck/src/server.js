import 'dotenv/config'
import http from 'http'
import app from './app.js'
import { connectDb } from './config/db.js'
import { initSocket } from './utils/socket.js'
import { startBookingExpirationJob } from './utils/bookingExpiration.js'
import { startCorporatePaymentCheckJob } from './utils/corporatePaymentScheduler.js'
import { startPayrollEngineJob } from './utils/payrollJob.js'
import { startCommissionOverdueJob } from './utils/commissionJob.js'
import { runPaymentSchedulerChecks } from './utils/paymentScheduler.js'
import { initializeFirebaseAdmin } from './config/firebase.js'
import { seedDefaultLegalPages } from './controllers/legalController.js'

import { autoClosePastAttendanceRecords } from './controllers/attendanceController.js'

const port = Number(process.env.PORT) || 5000

async function main() {
  await connectDb()
  initializeFirebaseAdmin()
  seedDefaultLegalPages().catch((err) => console.error('[Legal Seeder Error]:', err.message))
  
  const server = http.createServer(app)
  initSocket()
  
  // Start background jobs
  startBookingExpirationJob()
  startCorporatePaymentCheckJob()
  startPayrollEngineJob()
  startCommissionOverdueJob()
  
  // Run Attendance Auto-Close on startup and every 15 minutes to automatically close past shifts
  autoClosePastAttendanceRecords().catch((err) => console.error('[Attendance Auto-Close Startup Error]:', err.message))
  setInterval(() => {
    autoClosePastAttendanceRecords().catch((err) => console.error('[Attendance Auto-Close Error]:', err.message))
  }, 15 * 60 * 1000)
  
  // Run Payment Scheduler every 15 minutes
  runPaymentSchedulerChecks().catch((err) => console.error('[Payment Scheduler Startup Error]:', err.message))
  setInterval(() => {
    runPaymentSchedulerChecks().catch((err) => console.error('[Payment Scheduler Error]:', err.message))
  }, 15 * 60 * 1000)
  
  server.listen(port, () => {
    console.log(`LabourChowck API listening on :${port}`)
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

