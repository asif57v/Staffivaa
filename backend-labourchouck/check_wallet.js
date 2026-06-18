import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/staffivaa');
  const db = mongoose.connection.useDb('staffivaa');
  const wallet = await db.collection('wallets').findOne({ singletonId: 'ADMIN_WALLET' });
  console.log('Wallet Data:', JSON.stringify(wallet, null, 2));
  process.exit(0);
}

run().catch(console.error);
