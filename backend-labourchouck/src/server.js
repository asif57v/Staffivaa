import 'dotenv/config'
import http from 'http'
import app from './app.js'
import { connectDb } from './config/db.js'
import { initSocket } from './utils/socket.js'
import { startBookingExpirationJob } from './utils/bookingExpiration.js'

const port = Number(process.env.PORT) || 5000

async function main() {
  await connectDb()
  
  const server = http.createServer(app)
  initSocket(server)
  
  // Start background jobs
  startBookingExpirationJob()
  
  server.listen(port, () => {
    console.log(`LabourChowck API listening on :${port}`)
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
