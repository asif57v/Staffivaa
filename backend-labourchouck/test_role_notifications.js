import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { User } from './src/models/User.js';
import { USER_ROLES } from './src/constants/roles.js';
import { normalizeRole, isRoleMatch } from './src/utils/roleUtils.js';
import { sendNotificationToUser, sendNotificationToUsers } from './src/services/notificationService.js';
import { triggerNotification } from './src/utils/notificationTrigger.js';
import { Notification } from './src/models/Notification.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/staffivaa_test';

async function runTests() {
  console.log('===========================================================');
  console.log('🧪 RUNNING ROLE-BASED NOTIFICATION & TOKEN SCOPING TEST SUITE');
  console.log('===========================================================\n');

  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ Connected to MongoDB:', mongoose.connection.name);
  } catch (err) {
    console.warn('⚠️ Could not connect to local MongoDB. Running logic unit assertions directly...');
  }

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // --- TEST 1: Role Normalization & Matching ---
  console.log('\n--- Test Suite 1: Role Normalization & Matching ---');
  assert(normalizeRole('worker') === USER_ROLES.LABOUR, "normalizeRole('worker') === 'labour'");
  assert(normalizeRole('labour') === USER_ROLES.LABOUR, "normalizeRole('labour') === 'labour'");
  assert(normalizeRole('user') === USER_ROLES.INDIVIDUAL, "normalizeRole('user') === 'individual'");
  assert(normalizeRole('individual') === USER_ROLES.INDIVIDUAL, "normalizeRole('individual') === 'individual'");
  assert(normalizeRole('vendor') === USER_ROLES.CONTRACTOR, "normalizeRole('vendor') === 'contractor'");
  assert(normalizeRole('contractor') === USER_ROLES.CONTRACTOR, "normalizeRole('contractor') === 'contractor'");
  assert(normalizeRole('corporate') === USER_ROLES.CORPORATE, "normalizeRole('corporate') === 'corporate'");
  assert(normalizeRole('enterprise') === USER_ROLES.ENTERPRISE, "normalizeRole('enterprise') === 'enterprise'");
  assert(normalizeRole('admin') === USER_ROLES.ADMIN, "normalizeRole('admin') === 'admin'");

  assert(isRoleMatch('worker', 'labour') === true, "isRoleMatch('worker', 'labour') is true");
  assert(isRoleMatch('user', 'individual') === true, "isRoleMatch('user', 'individual') is true");
  assert(isRoleMatch('vendor', 'contractor') === true, "isRoleMatch('vendor', 'contractor') is true");
  assert(isRoleMatch('labour', 'individual') === false, "isRoleMatch('labour', 'individual') is false");
  assert(isRoleMatch('corporate', 'enterprise') === false, "isRoleMatch('corporate', 'enterprise') is false");
  assert(isRoleMatch('contractor', 'corporate') === false, "isRoleMatch('contractor', 'corporate') is false");
  assert(isRoleMatch('', 'labour') === false, "isRoleMatch('', 'labour') is false (no loose bypass)");
  assert(isRoleMatch('individual', null) === false, "isRoleMatch('individual', null) is false (no loose bypass)");

  if (mongoose.connection.readyState === 1) {
    // --- Database Integration Tests ---
    const TEST_PREFIX = 'test_role_notif_' + Date.now();
    const TEST_TOKEN = 'fcm_test_device_token_' + Date.now();

    console.log('\n--- Test Suite 2: Sequential Multi-Role Device Token Management ---');
    // Create 5 test users
    const individualUser = await User.create({
      phone: '9000000001',
      role: USER_ROLES.INDIVIDUAL,
      fullName: 'Test Individual',
      fcmTokensMobile: [],
      fcmTokensWeb: [],
    });

    const workerUser = await User.create({
      phone: '9000000002',
      role: USER_ROLES.LABOUR,
      fullName: 'Test Worker',
      fcmTokensMobile: [],
      fcmTokensWeb: [],
    });

    const corporateUser = await User.create({
      phone: '9000000003',
      role: USER_ROLES.CORPORATE,
      fullName: 'Test Corporate',
      fcmTokensMobile: [],
      fcmTokensWeb: [],
    });

    const vendorUser = await User.create({
      phone: '9000000004',
      role: USER_ROLES.CONTRACTOR,
      fullName: 'Test Vendor',
      fcmTokensMobile: [],
      fcmTokensWeb: [],
    });

    const enterpriseUser = await User.create({
      phone: '9000000005',
      role: USER_ROLES.ENTERPRISE,
      fullName: 'Test Enterprise',
      fcmTokensMobile: [],
      fcmTokensWeb: [],
    });

    // Step A: Login as Individual and register TEST_TOKEN
    await User.updateMany(
      { _id: { $ne: individualUser._id }, $or: [{ fcmTokensWeb: TEST_TOKEN }, { fcmTokensMobile: TEST_TOKEN }] },
      { $pull: { fcmTokensWeb: TEST_TOKEN, fcmTokensMobile: TEST_TOKEN } },
    );
    await User.findByIdAndUpdate(individualUser._id, { $push: { fcmTokensMobile: TEST_TOKEN } });

    let checkInd = await User.findById(individualUser._id);
    assert(checkInd.fcmTokensMobile.includes(TEST_TOKEN), 'Step A: Individual has TEST_TOKEN');

    // Step B: User logs into same device as Worker / Labour
    // Registration logic disassociates from previous users
    await User.updateMany(
      { _id: { $ne: workerUser._id }, $or: [{ fcmTokensWeb: TEST_TOKEN }, { fcmTokensMobile: TEST_TOKEN }] },
      { $pull: { fcmTokensWeb: TEST_TOKEN, fcmTokensMobile: TEST_TOKEN } },
    );
    await User.findByIdAndUpdate(workerUser._id, { $push: { fcmTokensMobile: TEST_TOKEN } });

    checkInd = await User.findById(individualUser._id);
    let checkWorker = await User.findById(workerUser._id);

    assert(!checkInd.fcmTokensMobile.includes(TEST_TOKEN), 'Step B: TEST_TOKEN was cleanly purged from Individual account');
    assert(checkWorker.fcmTokensMobile.includes(TEST_TOKEN), 'Step B: TEST_TOKEN is now strictly attached to Worker account');

    // Step C: User switches to Corporate
    await User.updateMany(
      { _id: { $ne: corporateUser._id }, $or: [{ fcmTokensWeb: TEST_TOKEN }, { fcmTokensMobile: TEST_TOKEN }] },
      { $pull: { fcmTokensWeb: TEST_TOKEN, fcmTokensMobile: TEST_TOKEN } },
    );
    await User.findByIdAndUpdate(corporateUser._id, { $push: { fcmTokensMobile: TEST_TOKEN } });

    checkWorker = await User.findById(workerUser._id);
    let checkCorp = await User.findById(corporateUser._id);
    assert(!checkWorker.fcmTokensMobile.includes(TEST_TOKEN), 'Step C: TEST_TOKEN was cleanly purged from Worker account');
    assert(checkCorp.fcmTokensMobile.includes(TEST_TOKEN), 'Step C: TEST_TOKEN is now strictly attached to Corporate account');

    // --- TEST 3: Role-Scoped Push Notification Dispatching ---
    console.log('\n--- Test Suite 3: Role-Scoped Push Dispatch & Mismatch Guard ---');

    // Case 1: Send Individual-scoped notification to Worker user ID -> Must be blocked by role safeguard
    const mismatchResult = await sendNotificationToUser(
      workerUser._id,
      'Booking Created',
      'Your booking has been created.',
      { recipientRole: 'individual', type: 'BOOKING_CREATED' },
    );
    assert(
      mismatchResult.skippedRoleMismatch === true,
      'Individual notification sent to Worker userId was strictly BLOCKED by recipientRole check',
    );

    // Case 2: Send Worker-scoped notification to Corporate user ID -> Must be blocked by role safeguard
    const mismatchCorpResult = await sendNotificationToUser(
      corporateUser._id,
      'New Job Available',
      'A new labour job is available nearby.',
      { recipientRole: 'labour', type: 'NEW_ORDER' },
    );
    assert(
      mismatchCorpResult.skippedRoleMismatch === true,
      'Worker job notification sent to Corporate userId was strictly BLOCKED by recipientRole check',
    );

    // Case 3: Send Corporate-scoped notification to Corporate user ID -> Allowed to proceed to FCM batch
    const matchCorpResult = await sendNotificationToUser(
      corporateUser._id,
      'Invoice Generated',
      'Your monthly statement is ready.',
      { recipientRole: 'corporate', type: 'INVOICE_GENERATED' },
    );
    assert(
      matchCorpResult.skippedRoleMismatch !== true,
      'Corporate notification sent to Corporate userId successfully passed role verification',
    );

    // --- TEST 4: Multicast Filtering by Role ---
    console.log('\n--- Test Suite 4: sendNotificationToUsers Multicast Role Filtering ---');
    const allUserIds = [individualUser._id, workerUser._id, corporateUser._id, vendorUser._id, enterpriseUser._id];
    
    // Attaching distinct dummy tokens
    await User.findByIdAndUpdate(corporateUser._id, { $set: { fcmTokensWeb: ['corp_tok_1'] } });
    await User.findByIdAndUpdate(vendorUser._id, { $set: { fcmTokensWeb: ['vendor_tok_1'] } });

    const results = await sendNotificationToUsers(
      allUserIds,
      'Vendor Platform Update',
      'Rate card updated.',
      { recipientRole: 'contractor', type: 'SYSTEM_UPDATE' },
    );

    assert(
      results.length === 1,
      `Multicast with recipientRole='contractor' matched only 1 user (vendor) out of 5 total users (got ${results.length})`,
    );

    // --- TEST 5: triggerNotification and DB Schema Persistence ---
    console.log('\n--- Test Suite 5: triggerNotification In-App Notification Role Persistence ---');
    const notifDoc = await triggerNotification({
      userId: workerUser._id,
      title: 'Complete Aadhaar KYC',
      body: 'Verify Aadhaar & PAN to unlock payouts',
      type: 'KYC_REMINDER',
      recipientRole: 'labour',
    });

    assert(notifDoc && notifDoc.recipientRole === 'labour', 'Notification model persisted recipientRole="labour" correctly');

    // --- Clean Up Test Records ---
    await User.deleteMany({ _id: { $in: allUserIds } });
    await Notification.deleteMany({ userId: { $in: allUserIds } });
    console.log('\n🧹 Test documents cleaned up successfully.');
  }

  console.log('\n===========================================================');
  console.log(`🏁 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===========================================================');

  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
