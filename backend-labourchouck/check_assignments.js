import mongoose from 'mongoose';
import { Assignment } from './src/models/Assignment.js';
import { Allocation } from './src/models/Allocation.js';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffivaa').then(async () => {
  const allocation = await Allocation.findById('6a5c9fc3b0d7dac72b4725e9');
  console.log('Allocation found:', !!allocation);
  if (allocation) {
    const assignments = await Assignment.find({ allocationId: allocation._id });
    console.log('Assignments count:', assignments.length);
    if (assignments.length > 0) {
      console.log('Sample assignment:', assignments[0]);
    }
    
    // Also check for any assignment with that requestId
    const anyAssignments = await Assignment.find({ requestId: allocation.requestId });
    console.log('Assignments for requestId:', anyAssignments.length);
  }
  process.exit(0);
}).catch(console.error);
