import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { WorkforceRequest } from '../src/models/WorkforceRequest.js';
import { Assignment } from '../src/models/Assignment.js';
import { User } from '../src/models/User.js';

dotenv.config();

async function inspectRequest() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const req = await WorkforceRequest.findOne({ reference: /IR-MT1CWPMF/i });
  if (!req) {
    console.log('❌ Request IR-MT1CWPMF not found in DB!');
    // List latest 3 requests
    const latest = await WorkforceRequest.find().sort({ createdAt: -1 }).limit(3);
    console.log('Latest 3 requests in DB:');
    latest.forEach(r => console.log(`- Ref: ${r.reference}, ID: ${r._id}, Client: ${r.clientId}, Status: ${r.status}, CreatedAt: ${r.createdAt}`));
    await mongoose.disconnect();
    return;
  }

  console.log('\n--- Found WorkforceRequest ---');
  console.log('Ref:', req.reference);
  console.log('ID:', req._id);
  console.log('ClientId:', req.clientId);
  console.log('Status:', req.status);
  console.log('Lines:', JSON.stringify(req.lines));
  console.log('Location:', req.locationText, 'Lat:', req.locationLat, 'Lng:', req.locationLng);
  console.log('CreatedAt:', req.createdAt);

  const assignments = await Assignment.find({ requestId: req._id });
  console.log(`\n--- Found ${assignments.length} Assignments for this Request ---`);
  for (const a of assignments) {
    console.log(`\nAssignment ID: ${a._id}`);
    console.log(`Labour ID: ${a.labourId}`);
    console.log(`Status: ${a.status}`);
    
    const workerUser = await User.findById(a.labourId);
    if (workerUser) {
      console.log(`Worker Name: ${workerUser.fullName}`);
      console.log(`Worker Phone: ${workerUser.phone}`);
      console.log(`Worker Role: ${workerUser.role}`);
      console.log(`fcmTokensWeb (${workerUser.fcmTokensWeb?.length || 0}):`, workerUser.fcmTokensWeb);
      console.log(`fcmTokensMobile (${workerUser.fcmTokensMobile?.length || 0}):`, workerUser.fcmTokensMobile);
    } else {
      console.log(`❌ Worker User NOT found for ID ${a.labourId}`);
    }
  }

  await mongoose.disconnect();
  console.log('\nDone inspection');
  process.exit(0);
}

inspectRequest().catch((err) => {
  console.error(err);
  process.exit(1);
});
