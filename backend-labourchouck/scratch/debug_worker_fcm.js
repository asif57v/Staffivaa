import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../src/models/User.js';
import { initializeFirebaseAdmin } from '../src/config/firebase.js';
import { sendNotificationToUser } from '../src/services/notificationService.js';

dotenv.config();

async function debugWorkerFcm() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');
  initializeFirebaseAdmin();

  const labourUsers = await User.find({ role: 'labour' }).select('_id fullName phone fcmTokensWeb fcmTokensMobile labourProfile');
  console.log(`Found ${labourUsers.length} labour users in DB:`);

  for (const worker of labourUsers) {
    console.log(`\nWorker: ${worker.fullName} (${worker.phone}) - ID: ${worker._id}`);
    console.log(`  fcmTokensWeb:`, worker.fcmTokensWeb);
    console.log(`  fcmTokensMobile:`, worker.fcmTokensMobile);
    
    const tokens = [...(worker.fcmTokensWeb || []), ...(worker.fcmTokensMobile || [])];
    if (tokens.length > 0) {
      console.log(`  Sending test FCM to ${worker.fullName}...`);
      const result = await sendNotificationToUser(
        worker._id.toString(),
        'Debug Push Test',
        'Testing FCM push delivery directly from debug script',
        { type: 'NEW_ORDER' }
      );
      console.log(`  Result for ${worker.fullName}:`, result);
    } else {
      console.log(`  ❌ NO FCM TOKENS FOUND for ${worker.fullName}`);
    }
  }

  await mongoose.disconnect();
}

debugWorkerFcm().catch(console.error);
