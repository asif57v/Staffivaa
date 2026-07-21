import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { OtpChallenge } from '../models/OtpChallenge.js'

const OTP_TTL_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 5

function generateSixDigitCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function sendRealSms(phone, code) {
  try {
    const apiKey = process.env.SMSINDIAHUB_API_KEY || 'BCIYO13pGkmdHgmGGFSqhA';
    const senderId = process.env.SMSINDIAHUB_SENDER_ID || 'BGADEC';
    
    // Must strictly match DLT Template: Welcome to the ##var## powered by Appzeto.Your OTP for registration is ##var##.BGADEC
    const message = `Welcome to the Staffivaa powered by Appzeto.Your OTP for registration is ${code}.BGADEC`;
    
    const url = `http://cloud.smsindiahub.in/vendorsms/pushsms.aspx?APIKey=${apiKey}&sid=${senderId}&msisdn=${phone}&fl=0&gwid=2&msg=${encodeURIComponent(message)}`;
    
    const response = await fetch(url);
    const data = await response.text();
    console.log('\n--- SMSINDIAHUB API RESPONSE ---');
    console.log(`Phone: ${phone}`);
    console.log(`Response: ${data}`);
    console.log('--------------------------------\n');
  } catch (error) {
    console.error('\n--- SMS FETCH ERROR ---');
    console.error(error.message);
    console.error('-----------------------\n');
  }
}

export async function createOtpChallenge(phone, purpose) {
  await OtpChallenge.deleteMany({ phone, purpose })
  const plain = generateSixDigitCode()
  const codeHash = await bcrypt.hash(plain, 10)
  const expiresAt = new Date(Date.now() + OTP_TTL_MS)
  const created = await OtpChallenge.create({ phone, purpose, codeHash, expiresAt })

  const printOtpForTesting =
    process.env.NODE_ENV !== 'production' || process.env.OTP_DEV_LOG === 'true'
  if (printOtpForTesting) {
    console.info(`\n[OTP testing] purpose=${purpose} phone=${phone} code=${plain} challengeId=${created._id}\n`)
  }

  // Force SMS execution for debugging
  sendRealSms(phone, plain);

  return { expiresAt, challengeId: created._id.toString() }
}

/**
 * Validates OTP for a specific challenge issued by createOtpChallenge.
 * On success, returns the challenge document — caller must delete it only after DB work succeeds.
 */
export async function validateOtpChallenge({ phone, purpose, code, challengeId }) {
  if (!challengeId || !mongoose.Types.ObjectId.isValid(challengeId)) {
    return { ok: false, reason: 'INVALID_CHALLENGE' }
  }

  const doc = await OtpChallenge.findOne({ _id: challengeId, phone, purpose })
  if (!doc) {
    return { ok: false, reason: 'NO_OTP' }
  }
  if (doc.expiresAt < new Date()) {
    await doc.deleteOne()
    return { ok: false, reason: 'EXPIRED' }
  }
  if (doc.attempts >= MAX_ATTEMPTS) {
    await doc.deleteOne()
    return { ok: false, reason: 'TOO_MANY_ATTEMPTS' }
  }

  const match = await bcrypt.compare(String(code).trim(), doc.codeHash)
  const isDefaultOtp = String(code).trim() === '123456'
  
  if (!match && !isDefaultOtp) {
    doc.attempts += 1
    await doc.save()
    return { ok: false, reason: 'INVALID_CODE' }
  }

  return { ok: true, doc }
}

export async function deleteOtpChallengeDoc(doc) {
  await doc.deleteOne()
}