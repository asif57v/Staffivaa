import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../src/models/User.js';
import { initializeFirebaseAdmin } from '../src/config/firebase.js';
import { triggerBookingNotif } from '../src/utils/triggerBookingNotif.js';
import { newJobOfferNotif } from '../src/utils/bookingNotificationCopy.js';

dotenv.config();

async function testBookingNotification() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');
  initializeFirebaseAdmin();

  // Find a labour user who has tokens
  const workers = await User.find({ role: 'labour' }).select('_id fullName phone fcmTokensWeb fcmTokensMobile');
  console.log('Workers in DB:');
  for (const w of workers) {
    const totalTokens = (w.fcmTokensWeb?.length || 0) + (w.fcmTokensMobile?.length || 0);
    console.log(`- ${w.fullName} (${w.phone}) - ID: ${w._id} - Total Tokens: ${totalTokens}`);
  }

  const activeWorker = workers.find(w => (w.fcmTokensWeb?.length || 0) + (w.fcmTokensMobile?.length || 0) > 0);
  if (!activeWorker) {
    console.log('❌ No worker found with FCM tokens!');
    await mongoose.disconnect();
    return;
  }

  console.log(`\nTesting newJobOfferNotif push for worker: ${activeWorker.fullName} (${activeWorker._id})`);
  const copy = newJobOfferNotif({
    customerName: 'Test Customer',
    categoryName: 'Electrician',
    locationText: 'Noida Sector 62',
  });

  console.log('Notification copy:', copy);

  const res = await triggerBookingNotif({
    userId: activeWorker._id,
    copy,
    relatedId: new mongoose.Types.ObjectId(),
    relatedModel: 'Assignment',
    requestId: new mongoose.Types.ObjectId(),
  });

  console.log('triggerBookingNotif result:', res?._id ? 'Notification doc created' : res);

  // Wait 3 seconds for Firebase response
  await new Promise((r) => setTimeout(r, 3000));

  await mongoose.disconnect();
  console.log('Done test');
  process.exit(0);
}

testBookingNotification().catch((err) => {
  console.error(err);
  process.exit(1);
});
