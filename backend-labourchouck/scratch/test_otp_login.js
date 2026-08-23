import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { User } from '../src/models/User.js';
import { createOtpChallenge } from '../src/services/otpService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/staffivaa_test';

async function test() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to DB');

  const phone = '7869549428';
  let user = await User.findOne({ phone });
  console.log('User found:', user ? { _id: user._id, phone: user.phone, role: user.role } : 'None');

  const res = await createOtpChallenge(phone, 'login');
  console.log('createOtpChallenge result:', res);

  await mongoose.disconnect();
}

test().catch(console.error);
