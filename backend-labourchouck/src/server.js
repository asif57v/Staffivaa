import 'dotenv/config'
import http from 'http'
import app from './app.js'
import { connectDb } from './config/db.js'
import { initSocket } from './utils/socket.js'
import { startBookingExpirationJob } from './utils/bookingExpiration.js'
import { startCorporatePaymentCheckJob } from './utils/corporatePaymentScheduler.js'
import { startPayrollEngineJob } from './utils/payrollJob.js'
import { initializeFirebaseAdmin } from './config/firebase.js'

const port = Number(process.env.PORT) || 5000

async function main() {
  await connectDb()
  initializeFirebaseAdmin()
  
  const server = http.createServer(app)
  initSocket()
  
  // Start background jobs
  startBookingExpirationJob()
  startCorporatePaymentCheckJob()
  startPayrollEngineJob()
  
  server.listen(port, () => {
    console.log(`LabourChowck API listening on :${port}`)
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

