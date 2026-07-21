import mongoose from 'mongoose';
import { Assignment } from './src/models/Assignment.js';
import { ASSIGNMENT_STATUS } from './src/constants/workforceConstants.js';

async function run() {
  await mongoose.connect('mongodb://localhost:27017/staffivaa-labourchouck', { useNewUrlParser: true, useUnifiedTopology: true });
  const zombies = await Assignment.find({
    status: { $in: [ASSIGNMENT_STATUS.ACCEPTED, ASSIGNMENT_STATUS.ON_SITE] }
  }).populate('requestId');
  
  const realZombies = zombies.filter(z => !z.requestId);
  console.log('Found zombies:', realZombies.length);
  
  for (let z of realZombies) {
    z.status = ASSIGNMENT_STATUS.DECLINED; // or CANCELLED if it exists
    await z.save();
    console.log('Fixed zombie:', z._id);
  }
  process.exit();
}
run().catch(console.error);
