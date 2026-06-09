import 'dotenv/config'
import mongoose from 'mongoose'
import { User } from './src/models/User.js'

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/staffivaa')
  await User.deleteMany({ email: 'admin@labourchowck.local' })
  await User.deleteMany({ email: 'admin@Staffivaa.com' })
  await User.deleteMany({ phone: '9888888888' })
  await User.deleteMany({ phone: '8999999999' })
  console.log('Cleaned DB');
  process.exit(0);
}
run();
