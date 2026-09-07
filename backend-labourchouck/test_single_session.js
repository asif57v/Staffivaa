import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { User } from './src/models/User.js';
import { USER_ROLES } from './src/constants/roles.js';
import { signAccessToken, verifyAccessToken } from './src/services/tokenService.js';
import { protect } from './src/middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/staffivaa_test';

async function runTests() {
  console.log('===========================================================');
  console.log('🧪 RUNNING SINGLE ACTIVE SESSION ENFORCEMENT TEST SUITE');
  console.log('===========================================================\n');

  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ Connected to MongoDB:', mongoose.connection.name);
  } catch (err) {
    console.error('❌ Could not connect to MongoDB:', err);
    process.exit(1);
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

  // Helper to simulate running the Express `protect` middleware
  async function simulateProtectMiddleware(tokenString) {
    return new Promise((resolve) => {
      const req = {
        headers: {
          authorization: `Bearer ${tokenString}`,
        },
      };

      const res = {
        statusCode: 200,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          resolve({ ok: false, statusCode: this.statusCode, body: data });
        },
      };

      const next = (err) => {
        if (err) {
          resolve({ ok: false, statusCode: 500, error: err });
        } else {
          resolve({ ok: true, statusCode: 200, user: req.user, payload: req.tokenPayload });
        }
      };

      try {
        protect(req, res, next);
      } catch (err) {
        resolve({ ok: false, statusCode: 500, error: err });
      }
    });
  }

  const rolesToTest = [
    { role: USER_ROLES.INDIVIDUAL, phone: '9990000001', name: 'User Role Test' },
    { role: USER_ROLES.LABOUR, phone: '9990000002', name: 'Worker Role Test' },
    { role: USER_ROLES.CORPORATE, phone: '9990000003', name: 'Corporate Role Test' },
    { role: USER_ROLES.CONTRACTOR, phone: '9990000004', name: 'Vendor Role Test' },
    { role: USER_ROLES.ENTERPRISE, phone: '9990000005', name: 'Enterprise Role Test' },
  ];

  const createdUserIds = [];

  try {
    for (const testCase of rolesToTest) {
      console.log(`\n--- Testing Role: ${testCase.role.toUpperCase()} (${testCase.name}) ---`);

      // 1. Create or reset user
      await User.deleteOne({ phone: testCase.phone });
      const user = await User.create({
        phone: testCase.phone,
        role: testCase.role,
        fullName: testCase.name,
        isActive: true,
        isPhoneVerified: true,
      });
      createdUserIds.push(user._id);

      // 2. Initial Login: Device A
      const sessionA = crypto.randomUUID();
      user.activeSessionId = sessionA;
      user.lastLoginAt = new Date();
      await user.save();

      const tokenA = signAccessToken(user, sessionA);
      const decodedA = verifyAccessToken(tokenA);
      assert(decodedA.sid === sessionA, `Device A JWT carries sid=${sessionA.slice(0, 8)}...`);

      // Test Device A API Call -> Should succeed
      const resA1 = await simulateProtectMiddleware(tokenA);
      assert(resA1.ok === true && resA1.statusCode === 200, `Device A token is authorized for ${testCase.role}`);

      // 3. Sequential Login: Device B (e.g. mobile app or second browser)
      const sessionB = crypto.randomUUID();
      user.activeSessionId = sessionB;
      user.lastLoginAt = new Date();
      await user.save();

      const tokenB = signAccessToken(user, sessionB);

      // Test Device B API Call -> Should succeed
      const resB1 = await simulateProtectMiddleware(tokenB);
      assert(resB1.ok === true && resB1.statusCode === 200, `Device B token is authorized for ${testCase.role}`);

      // 4. Test Device A API Call AFTER Device B Login -> MUST BE REJECTED with SESSION_TERMINATED
      const resA2 = await simulateProtectMiddleware(tokenA);
      assert(
        resA2.ok === false &&
        resA2.statusCode === 401 &&
        resA2.body?.code === 'SESSION_TERMINATED',
        `Device A is immediately REJECTED (401 SESSION_TERMINATED) after Device B logged in`,
      );
      assert(
        resA2.body?.message?.includes('another device'),
        `Device A receives message: "${resA2.body?.message}"`,
      );

      // 5. Sequential Login: Device C (Web)
      const sessionC = crypto.randomUUID();
      user.activeSessionId = sessionC;
      user.lastLoginAt = new Date();
      await user.save();

      const tokenC = signAccessToken(user, sessionC);

      // Test Device C API Call -> Should succeed
      const resC1 = await simulateProtectMiddleware(tokenC);
      assert(resC1.ok === true && resC1.statusCode === 200, `Device C (Web) token is authorized`);

      // Test Device B API Call AFTER Device C Login -> MUST BE REJECTED with SESSION_TERMINATED
      const resB2 = await simulateProtectMiddleware(tokenB);
      assert(
        resB2.ok === false &&
        resB2.statusCode === 401 &&
        resB2.body?.code === 'SESSION_TERMINATED',
        `Device B is now also REJECTED (401 SESSION_TERMINATED) after Device C logged in`,
      );

      // 6. Voluntary Logout on Device C -> Invalidate all
      user.activeSessionId = null;
      user.activeSessionIds = [];
      await user.save();

      const resC2 = await simulateProtectMiddleware(tokenC);
      assert(
        resC2.ok === false && resC2.statusCode === 401,
        `After logout, Device C token is invalid`,
      );
    }

    // =========================================================
    // ADMIN ROLE: 2 CONCURRENT DEVICE SESSIONS ALLOWED
    // =========================================================
    console.log('\n--- Testing Role: ADMIN (2 Concurrent Devices Allowed) ---');
    const adminEmail = 'admin_session_test@staffivaa.com';
    const adminPhone = '9990000099';
    await User.deleteOne({ email: adminEmail });
    await User.deleteOne({ phone: adminPhone });
    const adminUser = await User.create({
      email: adminEmail,
      phone: adminPhone,
      role: USER_ROLES.ADMIN,
      fullName: 'Super Admin Test',
      isActive: true,
      activeSessionIds: [],
    });
    createdUserIds.push(adminUser._id);

    // 1. Admin Login: Device 1
    const adminSession1 = crypto.randomUUID();
    adminUser.activeSessionIds = [adminSession1];
    adminUser.activeSessionId = adminSession1;
    await adminUser.save();

    const adminToken1 = signAccessToken(adminUser, adminSession1);
    const resAdmin1_1 = await simulateProtectMiddleware(adminToken1);
    assert(resAdmin1_1.ok === true, 'Admin Device 1 is authorized on initial login');

    // 2. Admin Login: Device 2 (Simultaneous second device)
    const adminSession2 = crypto.randomUUID();
    let currentAdminSessions = [...adminUser.activeSessionIds];
    if (currentAdminSessions.length >= 2) {
      currentAdminSessions = currentAdminSessions.slice(currentAdminSessions.length - 1);
    }
    currentAdminSessions.push(adminSession2);
    adminUser.activeSessionIds = currentAdminSessions;
    adminUser.activeSessionId = adminSession2;
    await adminUser.save();

    const adminToken2 = signAccessToken(adminUser, adminSession2);
    const resAdmin2_1 = await simulateProtectMiddleware(adminToken2);
    assert(resAdmin2_1.ok === true, 'Admin Device 2 is authorized on second device login');

    // CRITICAL DUAL-SESSION CHECK: Admin Device 1 must STILL be authorized!
    const resAdmin1_2 = await simulateProtectMiddleware(adminToken1);
    assert(resAdmin1_2.ok === true, 'Admin Device 1 is STILL authorized while Device 2 is active (2 concurrent devices working!)');

    // 3. Admin Login: Device 3 (Exceeds max 2 -> Evicts oldest: Device 1)
    const adminSession3 = crypto.randomUUID();
    currentAdminSessions = [...adminUser.activeSessionIds];
    let evictedAdminSession = null;
    if (currentAdminSessions.length >= 2) {
      evictedAdminSession = currentAdminSessions[0]; // Device 1 session
      currentAdminSessions = currentAdminSessions.slice(currentAdminSessions.length - 1);
    }
    currentAdminSessions.push(adminSession3);
    adminUser.activeSessionIds = currentAdminSessions;
    adminUser.activeSessionId = adminSession3;
    await adminUser.save();

    assert(evictedAdminSession === adminSession1, 'Oldest admin session (Device 1) was evicted when 3rd device logged in');

    const adminToken3 = signAccessToken(adminUser, adminSession3);
    const resAdmin3_1 = await simulateProtectMiddleware(adminToken3);
    assert(resAdmin3_1.ok === true, 'Admin Device 3 is authorized');

    // Device 2 must STILL be authorized
    const resAdmin2_2 = await simulateProtectMiddleware(adminToken2);
    assert(resAdmin2_2.ok === true, 'Admin Device 2 is STILL authorized after Device 3 logged in');

    // Device 1 must now be REJECTED (evicted)
    const resAdmin1_3 = await simulateProtectMiddleware(adminToken1);
    assert(
      resAdmin1_3.ok === false &&
      resAdmin1_3.statusCode === 401 &&
      resAdmin1_3.body?.code === 'SESSION_TERMINATED',
      'Admin Device 1 is now REJECTED (401 SESSION_TERMINATED) because 3rd device evicted it',
    );

    // 4. Admin Device 2 Voluntary Logout (Selective device logout)
    adminUser.activeSessionIds = adminUser.activeSessionIds.filter((sid) => sid !== adminSession2);
    await adminUser.save();

    const resAdmin2_3 = await simulateProtectMiddleware(adminToken2);
    assert(resAdmin2_3.ok === false && resAdmin2_3.statusCode === 401, 'Admin Device 2 is invalid after selective logout');

    // Device 3 should STILL be active after Device 2 logged out
    const resAdmin3_2 = await simulateProtectMiddleware(adminToken3);
    assert(resAdmin3_2.ok === true, 'Admin Device 3 remains active after Device 2 logged out');

  } finally {
    // Cleanup test users
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
      console.log('\n🧹 Cleaned up test database records.');
    }
  }

  console.log('\n===========================================================');
  console.log(`🏁 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===========================================================');

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal error running session test suite:', err);
  process.exit(1);
});
