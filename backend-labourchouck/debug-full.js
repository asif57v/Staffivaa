import mongoose from 'mongoose'
import { User } from './src/models/User.js'
import { WorkforceRequest } from './src/models/WorkforceRequest.js'
import { Assignment } from './src/models/Assignment.js'
import 'dotenv/config'

async function run() {
  await mongoose.connect(process.env.MONGODB_URI)
  
  const cookCategoryId = '6a1587c29b1b1036a69d043a'
  const cookUsers = await User.find({ 'labourProfile.categoryIds': new mongoose.Types.ObjectId(cookCategoryId) })
  console.log('Users with Cook/chef skill:', cookUsers.map(u => ({ id: u._id, phone: u.phone })))

  const latestReq = await WorkforceRequest.findOne().sort({ createdAt: -1 })
  console.log('\nLatest Request:', latestReq?._id, 'lines:', latestReq?.lines)

  if (latestReq) {
    const assignments = await Assignment.find({ requestId: latestReq._id })
    console.log(`\nAssignments for request ${latestReq._id}:`)
    assignments.forEach(a => console.log('Labour:', a.labourId, 'Category:', a.categoryId))
  }

  process.exit(0)
}
run()
