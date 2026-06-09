import mongoose from 'mongoose'
import { User } from './src/models/User.js'
import { LabourCategory } from './src/models/LabourCategory.js'
import 'dotenv/config'

async function run() {
  await mongoose.connect(process.env.MONGODB_URI)
  const user = await User.findOne({ phone: '9999999999' }).populate('labourProfile.categoryIds')
  console.log('User 9999999999 categories:')
  user.labourProfile.categoryIds.forEach(c => console.log(c.name))
  process.exit(0)
}
run()
