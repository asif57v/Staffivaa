import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function stripQuotes(value) {
  if (!value || typeof value !== 'string') return value
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function normalizePrivateKey(raw) {
  if (!raw) return null
  let key = stripQuotes(String(raw))
  // dotenv / hosting often stores literal \n
  key = key.replace(/\\n/g, '\n')
  // Some editors paste with real CRLF already — keep as-is
  if (!key.includes('BEGIN PRIVATE KEY')) {
    throw new Error('FIREBASE_PRIVATE_KEY does not look like a PEM private key')
  }
  return key
}

function resolveServiceAccountPath(rawPath) {
  const cleaned = stripQuotes(rawPath || '')
  if (!cleaned) return null

  // Absolute or relative path to a JSON file
  if (cleaned.toLowerCase().endsWith('.json') && fs.existsSync(cleaned)) {
    return cleaned
  }

  // Path points to a directory — pick the Firebase admin SDK JSON inside it
  if (fs.existsSync(cleaned) && fs.statSync(cleaned).isDirectory()) {
    const match = fs
      .readdirSync(cleaned)
      .find((name) => /firebase.*\.json$/i.test(name) || /adminsdk.*\.json$/i.test(name))
    if (match) return path.join(cleaned, match)
  }

  return null
}

function resolveDefaultLocalJson() {
  try {
    const match = fs
      .readdirSync(__dirname)
      .find((name) => /firebase.*\.json$/i.test(name) || /adminsdk.*\.json$/i.test(name))
    if (match) return path.join(__dirname, match)
  } catch {
    /* ignore */
  }
  return null
}

export const initializeFirebaseAdmin = () => {
  try {
    if (getApps().length > 0) return

    let credentialConfig
    const servicePath =
      resolveServiceAccountPath(process.env.FIREBASE_SERVICE_ACCOUNT_PATH) ||
      resolveDefaultLocalJson()

    if (servicePath) {
      credentialConfig = cert(servicePath)
      console.log(`Firebase Admin SDK using service account file: ${servicePath}`)
    } else {
      const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY)
      if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
        throw new Error(
          'Firebase credentials missing. Set FIREBASE_SERVICE_ACCOUNT_PATH to a .json file, or PROJECT_ID + CLIENT_EMAIL + PRIVATE_KEY.',
        )
      }
      credentialConfig = cert({
        projectId: stripQuotes(process.env.FIREBASE_PROJECT_ID),
        clientEmail: stripQuotes(process.env.FIREBASE_CLIENT_EMAIL),
        privateKey,
      })
      console.log('Firebase Admin SDK using FIREBASE_* environment variables')
    }

    initializeApp({
      credential: credentialConfig,
    })

    console.log('Firebase Admin SDK initialized successfully.')
  } catch (err) {
    console.error('Failed to initialize Firebase Admin SDK:', err.message)
  }
}

export { getMessaging, getApps }
