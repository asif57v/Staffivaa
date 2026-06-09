import mongoose from 'mongoose'
import { WorkforceRequest } from './src/models/WorkforceRequest.js'
import { Assignment } from './src/models/Assignment.js'
import 'dotenv/config'

async function run() {
  await mongoose.connect(process.env.MONGODB_URI)
  const reqs = await WorkforceRequest.find().sort({ createdAt: -1 }).limit(3)
  console.log('Latest Requests:')
  reqs.forEach(r => console.log(r._id, r.reference, r.sourceType, r.lines))

  const asgns = await Assignment.find().sort({ createdAt: -1 }).limit(3)
  console.log('\nLatest Assignments:')
  asgns.forEach(a => console.log(a._id, 'Request:', a.requestId, 'Labour:', a.labourId, 'Category:', a.categoryId))

  process.exit(0)
}
run()
