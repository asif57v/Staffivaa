import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: './.env' })

async function run() {
  const uri = process.env.MONGODB_URI
  console.log('Connecting to:', uri)
  await mongoose.connect(uri)
  console.log('Connected!')

  const conn = mongoose.connection
  const doc = await conn.db.collection('systempricings').findOne()
  console.log('Pricing Document:', JSON.stringify(doc, null, 2))

  await mongoose.disconnect()
}

run().catch(console.error)
