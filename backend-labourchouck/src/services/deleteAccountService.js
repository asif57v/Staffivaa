import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import mongoose from 'mongoose'
import { User } from '../models/User.js'
import { DeletedAccount } from '../models/DeletedAccount.js'
import { DeletedAccountRecord } from '../models/DeletedAccountRecord.js'
import { Withdrawal } from '../models/Withdrawal.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { Assignment } from '../models/Assignment.js'
import { EnterpriseWallet } from '../models/EnterpriseWallet.js'
import { USER_ROLES } from '../constants/roles.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MAX_RECORDS_PER_MODEL = 5000
/** Models whose rows are purely personal/transient: removed after archiving */
const PURGE_MODELS = new Set(['Notification', 'LocationLog', 'AttendanceOTP'])
/** Models never archived (they are the archive itself / the user) */
const SKIP_MODELS = new Set(['User', 'DeletedAccount', 'DeletedAccountRecord', 'AuditLog'])
const TERMINAL_REQUEST_STATUSES = ['completed', 'cancelled', 'rejected', 'refunded', 'settlement_completed']
const INACTIVE_ASSIGNMENT_STATUSES = ['completed', 'replaced', 'cancelled', 'declined']

let modelsLoaded = false
async function loadAllModels() {
  if (modelsLoaded) return
  const dir = path.join(__dirname, '..', 'models')
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.js')) {
      try {
        await import(pathToFileURL(path.join(dir, f)).href)
      } catch (err) {
        console.error('[deleteAccount] could not load model', f, err.message)
      }
    }
  }
  modelsLoaded = true
}

function refsToUser(schemaPath) {
  const o = schemaPath.options || {}
  if (o.ref === 'User') return true
  if (Array.isArray(o.type) && o.type[0]?.ref === 'User') return true
  if (schemaPath.caster?.options?.ref === 'User') return true
  if (schemaPath.$embeddedSchemaType?.options?.ref === 'User') return true
  return false
}

/** Walks a schema (including sub-document schemas) collecting paths that ref User */
function collectRefPaths(schema, prefix, out, depth = 0) {
  if (depth > 3) return
  schema.eachPath((p, sp) => {
    if (refsToUser(sp)) out.push(prefix + p)
    else if (sp.schema) collectRefPaths(sp.schema, prefix + p + '.', out, depth + 1)
  })
}

/** Every path in every model that references User */
function findUserRefPaths() {
  const result = []
  for (const name of mongoose.modelNames()) {
    if (SKIP_MODELS.has(name)) continue
    const model = mongoose.model(name)
    const paths = []
    collectRefPaths(model.schema, '', paths)
    if (paths.length) result.push({ name, model, paths })
  }
  return result
}

export class DeleteAccountBlockedError extends Error {
  constructor(reasons) {
    super(reasons[0])
    this.reasons = reasons
    this.code = 'DELETE_BLOCKED'
  }
}

/** Returns a list of human readable reasons that stop the account from being deleted */
export async function getDeletionBlockers(user) {
  const reasons = []
  const uid = user._id

  if ((user.walletBalance || 0) > 0) {
    reasons.push(`Wallet balance of ₹${user.walletBalance} is remaining. Please withdraw it before deleting your account.`)
  }
  if (user.role === USER_ROLES.ENTERPRISE) {
    const ew = await EnterpriseWallet.findOne({ enterpriseId: uid }).select('balance').lean()
    if ((ew?.balance || 0) > 0) {
      reasons.push(`Enterprise wallet balance of ₹${ew.balance} is remaining. Please settle it with admin first.`)
    }
  }

  const pendingWithdrawals = await Withdrawal.countDocuments({
    requestedBy: uid,
    status: { $in: ['Pending', 'Processing', 'Approved', 'Hold'] },
  })
  if (pendingWithdrawals > 0) reasons.push('You have a pending withdrawal request. Wait until it is completed.')

  const activeRequests = await WorkforceRequest.countDocuments({
    status: { $nin: TERMINAL_REQUEST_STATUSES },
    $or: [{ clientId: uid }, { labourId: uid }, { acceptedBy: uid }],
  })
  if (activeRequests > 0) reasons.push('You have active bookings/requests. Complete or cancel them first.')

  const activeAssignments = await Assignment.countDocuments({
    status: { $nin: INACTIVE_ASSIGNMENT_STATUSES },
    $or: [{ labourId: uid }, { vendorId: uid }],
  })
  if (activeAssignments > 0) reasons.push('You have active work assignments. Complete them first.')

  if (user.role === USER_ROLES.CONTRACTOR) {
    const crew = await User.countDocuments({ vendorId: uid, accountStatus: { $ne: 'deleted' } })
    if (crew > 0) reasons.push(`${crew} worker(s) are linked to your vendor account. Remove or transfer them first.`)
  }
  return reasons
}

/**
 * Archive + anonymize an account. Used by both self-delete and admin delete.
 * - Full snapshot (profile + every related record) -> DeletedAccount / DeletedAccountRecord
 * - Personal/transient rows (notifications, location logs, OTPs) are purged
 * - Financial/operational rows stay (accounting) but point to an anonymized "Deleted User" tombstone
 * - The User document keeps its _id but loses all PII, credentials, sessions and its phone number
 *   (so the number can register again and populate() never crashes)
 */
export async function deleteAccount({ userId, deletedBy = 'self', admin = null, reason = '', req = null, force = false }) {
  await loadAllModels()

  const user = await User.findById(userId).select('+passwordHash')
  if (!user) {
    const e = new Error('User not found')
    e.code = 'NOT_FOUND'
    throw e
  }
  if (user.role === USER_ROLES.ADMIN) {
    const e = new Error('Admin accounts cannot be deleted')
    e.code = 'FORBIDDEN'
    throw e
  }
  if (user.accountStatus === 'deleted') {
    const e = new Error('Account is already deleted')
    e.code = 'ALREADY_DELETED'
    throw e
  }

  if (!force) {
    const blockers = await getDeletionBlockers(user)
    if (blockers.length) throw new DeleteAccountBlockedError(blockers)
  }

  // ---- 1. Snapshot ----
  const userObj = user.toObject()
  delete userObj.passwordHash
  const kycImages = {}
  if (userObj.labourProfile) {
    for (const k of ['kycFrontImageDataUrl', 'kycBackImageDataUrl']) {
      if (userObj.labourProfile[k]) {
        kycImages[k] = userObj.labourProfile[k]
        delete userObj.labourProfile[k]
      }
    }
  }

  const archive = await DeletedAccount.create({
    originalUserId: user._id,
    role: user.role,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    companyName:
      user.enterpriseProfile?.companyName || user.corporateProfile?.companyName || user.contractorProfile?.businessName || undefined,
    profileImageUrl: user.profileImageUrl,
    registeredAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    statusBeforeDeletion: user.accountStatus,
    walletBalanceAtDeletion: user.walletBalance || 0,
    deletedBy,
    deletedByUserId: admin?._id,
    deletedByName: admin ? admin.fullName || admin.email : undefined,
    deleteReason: reason || undefined,
    ipAddress: req?.ip || req?.headers?.['x-forwarded-for'] || '',
    userAgent: req?.headers?.['user-agent'] || '',
    userSnapshot: userObj,
  })

  if (Object.keys(kycImages).length) {
    await DeletedAccountRecord.create({
      deletedAccountId: archive._id,
      modelName: '__KycImages',
      originalId: user._id,
      data: kycImages,
      originalCreatedAt: user.createdAt,
    })
  }

  // ---- 2. Archive related records (schema-driven: every model that references User) ----
  const relatedCounts = {}
  const refModels = findUserRefPaths()
  for (const { name, model, paths } of refModels) {
    try {
      const filter = { $or: paths.map((p) => ({ [p]: user._id })) }
      const total = await model.countDocuments(filter)
      if (!total) continue
      const docs = await model.find(filter).sort({ createdAt: -1 }).limit(MAX_RECORDS_PER_MODEL).lean()
      if (docs.length) {
        await DeletedAccountRecord.insertMany(
          docs.map((d) => ({
            deletedAccountId: archive._id,
            modelName: name,
            originalId: d._id,
            data: d,
            originalCreatedAt: d.createdAt,
          })),
          { ordered: false },
        )
      }
      relatedCounts[name] = total
      if (PURGE_MODELS.has(name)) await model.deleteMany(filter)
    } catch (err) {
      console.error(`[deleteAccount] archive failed for ${name}:`, err.message)
      relatedCounts[name] = `error: ${err.message}`
    }
  }
  archive.relatedCounts = relatedCounts
  await archive.save()

  // ---- 3. Anonymize the live user (tombstone) ----
  const tombstonePhone = `x${String(user._id).slice(-9)}`
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        fullName: 'Deleted User',
        phone: tombstonePhone,
        isActive: false,
        accountStatus: 'deleted',
        deletedAt: new Date(),
        isPhoneVerified: false,
        walletBalance: 0,
        fcmTokensWeb: [],
        fcmTokensMobile: [],
        activeSessionId: null,
        activeSessionIds: [],
        adminNotes: [],
      },
      $unset: {
        email: '',
        passwordHash: '',
        profileImageUrl: '',
        labourProfile: '',
        corporateProfile: '',
        enterpriseProfile: '',
        contractorProfile: '',
        bankAccountDetails: '',
        upiDetails: '',
        razorpayContactId: '',
        razorpayFundAccountId: '',
        lastLoginDevice: '',
        lastLoginIp: '',
        vendorId: '',
      },
    },
  )

  return archive
}
