import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../src/models/User.js';

dotenv.config();

async function syncAllWorkersTokens() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  // Find a user who has active web tokens
  const usersWithTokens = await User.find({
    $or: [
      { 'fcmTokensWeb.0': { $exists: true } },
      { 'fcmTokensMobile.0': { $exists: true } }
    ]
  }).select('_id fullName role fcmTokensWeb fcmTokensMobile');

  console.log('Users with tokens currently in DB:');
  const validWebTokens = [];
  const validMobileTokens = [];
  usersWithTokens.forEach(u => {
    console.log(`- ${u.fullName} (${u.role}): web=${u.fcmTokensWeb?.length || 0}, mobile=${u.fcmTokensMobile?.length || 0}`);
    if (u.fcmTokensWeb?.length) validWebTokens.push(...u.fcmTokensWeb);
    if (u.fcmTokensMobile?.length) validMobileTokens.push(...u.fcmTokensMobile);
  });

  const uniqueWebTokens = [...new Set(validWebTokens)];
  const uniqueMobileTokens = [...new Set(validMobileTokens)];

  console.log('\nUnique Web Tokens available:', uniqueWebTokens.length);
  console.log('Unique Mobile Tokens available:', uniqueMobileTokens.length);

  // Sync these tokens to all labour workers so they all receive real-time notifications during testing
  const allWorkers = await User.find({ role: 'labour' });
  console.log(`\nSyncing available tokens to all ${allWorkers.length} labour workers:`);

  for (const w of allWorkers) {
    await User.updateOne(
      { _id: w._id },
      {
        $addToSet: {
          fcmTokensWeb: { $each: uniqueWebTokens },
          fcmTokensMobile: { $each: uniqueMobileTokens }
        }
      }
    );
    console.log(`✅ Synced tokens to worker: ${w.fullName} (${w.phone})`);
  }

  await mongoose.disconnect();
  console.log('\nAll workers updated successfully!');
  process.exit(0);
}

syncAllWorkersTokens().catch(err => {
  console.error(err);
  process.exit(1);
});
