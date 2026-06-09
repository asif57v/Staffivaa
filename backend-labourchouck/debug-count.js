import mongoose from 'mongoose'
import { User } from './src/models/User.js'
import 'dotenv/config'

async function run() {
  await mongoose.connect(process.env.MONGODB_URI)
  const users = await User.find({ role: 'labour' }).populate('labourProfile.categoryIds')
  
  users.forEach(u => {
    const cats = u.labourProfile?.categoryIds || []
    if (cats.length > 5) {
      console.log(`User ${u.phone} (${u._id}): ${cats.length} categories`)
      if (cats.length > 20) {
        console.log('Categories:', cats.map(c => c.name).join(', '))
      }
    }
  })
  
  process.exit(0)
}
run()
