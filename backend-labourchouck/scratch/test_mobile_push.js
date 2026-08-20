import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../src/models/User.js';
import { initializeFirebaseAdmin, getMessaging } from '../src/config/firebase.js';

dotenv.config();

async function testMobilePush() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');
  initializeFirebaseAdmin();

  // Find all users with mobile tokens
  const users = await User.find({ 'fcmTokensMobile.0': { $exists: true } }).select('fullName role phone fcmTokensMobile');
  console.log(`Found ${users.length} users with mobile tokens in DB:`);

  const allMobileTokens = [];
  users.forEach(u => {
    console.log(`- ${u.fullName} (${u.role}, ${u.phone}): ${u.fcmTokensMobile.length} mobile token(s)`);
    u.fcmTokensMobile.forEach(t => console.log(`   Token: ${t.slice(0, 30)}...`));
    allMobileTokens.push(...u.fcmTokensMobile);
  });

  const uniqueMobileTokens = [...new Set(allMobileTokens)];
  console.log(`\nTesting multicast to ${uniqueMobileTokens.length} unique mobile token(s)...`);

  if (uniqueMobileTokens.length === 0) {
    console.log('❌ No mobile tokens to test!');
    await mongoose.disconnect();
    return;
  }

  // Test standard mobile FCM payload
  const message = {
    notification: {
      title: '🚨 Test Mobile Job Alert',
      body: 'New booking created! Test notification to verify mobile delivery.',
    },
    data: {
      type: 'NEW_ORDER',
      title: '🚨 Test Mobile Job Alert',
      body: 'New booking created! Test notification to verify mobile delivery.',
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    },
    android: {
      priority: 'high',
      notification: {
        title: '🚨 Test Mobile Job Alert',
        body: 'New booking created! Test notification to verify mobile delivery.',
        defaultSound: true,
        defaultVibrateTimings: true,
        priority: 'max',
        visibility: 'public',
      },
    },
    apns: {
      headers: { 'apns-priority': '10' },
      payload: {
        aps: {
          alert: {
            title: '🚨 Test Mobile Job Alert',
            body: 'New booking created! Test notification to verify mobile delivery.',
          },
          sound: 'default',
          'content-available': 1,
        },
      },
    },
    tokens: uniqueMobileTokens,
  };

  const response = await getMessaging().sendEachForMulticast(message);
  console.log('\n--- Multicast Response ---');
  console.log(`Success Count: ${response.successCount}`);
  console.log(`Failure Count: ${response.failureCount}`);

  response.responses.forEach((r, idx) => {
    if (r.success) {
      console.log(`✅ Token ${idx + 1} (${uniqueMobileTokens[idx].slice(0, 25)}...): MessageId = ${r.messageId}`);
    } else {
      console.log(`❌ Token ${idx + 1} (${uniqueMobileTokens[idx].slice(0, 25)}...): Error =`, r.error?.code, r.error?.message);
    }
  });

  await mongoose.disconnect();
  console.log('\nDone test.');
  process.exit(0);
}

testMobilePush().catch((err) => {
  console.error(err);
  process.exit(1);
});
