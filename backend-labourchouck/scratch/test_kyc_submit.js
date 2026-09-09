import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { User } from '../src/models/User.js';
import { USER_ROLES, KYC_STATUS } from '../src/constants/roles.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGODB_URI;

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to DB');

  let labour = await User.findOne({ role: USER_ROLES.LABOUR });
  if (!labour) {
    console.log('No labour user found');
    await mongoose.disconnect();
    return;
  }

  console.log('Testing with labour user:', labour.phone);

  // Test updating labourProfile
  labour.labourProfile = labour.labourProfile || {};
  labour.labourProfile.kycStatus = KYC_STATUS.PENDING;
  labour.labourProfile.aadhaarNumber = '535656565656';
  labour.labourProfile.aadhaarMasked = 'XXXX XXXX 5656';
  labour.labourProfile.panNumber = 'FJCJCHFJFJ';
  labour.labourProfile.panMasked = 'FJCJC XXXX J';
  labour.labourProfile.kycFrontImageUrl = '';
  labour.labourProfile.kycBackImageUrl = '';
  labour.labourProfile.kycSelfieUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
  labour.labourProfile.kycPanImageUrl = '';
  labour.labourProfile.kycPhotos = [
    { label: 'Worker Selfie', url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg', type: 'selfie', uploadedAt: new Date() }
  ];
  labour.labourProfile.kycSubmittedAt = new Date();

  await labour.save();
  console.log('Successfully saved KYC without front/back/video!');

  const safe = labour.toSafeObject();
  console.log('Safe labourProfile:', safe.labourProfile);

  await mongoose.disconnect();
}

run().catch(console.error);
