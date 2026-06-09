import mongoose from 'mongoose'
import { WorkforceRequest } from './src/models/WorkforceRequest.js'
import { Assignment } from './src/models/Assignment.js'
import 'dotenv/config'

async function run() {
  await mongoose.connect(process.env.MONGODB_URI)
  
  const latestReqs = await WorkforceRequest.find().sort({ createdAt: -1 }).limit(3)
  console.log('Latest Requests:')
  for (const r of latestReqs) {
    console.log(r._id, r.createdAt, r.status)
    const asgns = await Assignment.find({ requestId: r._id })
    console.log(`  Assignments: ${asgns.length}`)
    asgns.forEach(a => console.log(`    Labour: ${a.labourId}`))
  }

  process.exit(0)
}
run()
