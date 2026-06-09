import mongoose from 'mongoose'
import { User } from './src/models/User.js'
import 'dotenv/config'

async function run() {
  await mongoose.connect(process.env.MONGODB_URI)
  const labours = await User.find({ role: 'labour' })
  labours.forEach(l => {
    console.log(`User ${l.phone} (ID: ${l._id}):`, l.labourProfile?.categoryIds)
  })
  process.exit(0)
}
run()
