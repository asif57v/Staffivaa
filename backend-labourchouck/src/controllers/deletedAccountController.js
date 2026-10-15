import { User } from '../models/User.js'
import { DeletedAccount } from '../models/DeletedAccount.js'
import { DeletedAccountRecord } from '../models/DeletedAccountRecord.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { logAudit } from '../utils/auditLogger.js'
import { triggerNotification } from '../utils/notificationTrigger.js'
import { USER_ROLES } from '../constants/roles.js'
import { deleteAccount, DeleteAccountBlockedError, getDeletionBlockers } from '../services/deleteAccountService.js'

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function notifyAdminsOfDeletion(archive) {
  const who = archive.fullName || archive.phone || 'A user'
  triggerNotification({
    title: 'Account Deleted',
    body: `${who} (${archive.role}) account was deleted ${archive.deletedBy === 'admin' ? 'by admin' : 'by the user'}.`,
    type: 'ACCOUNT_DELETED',
    relatedId: archive._id,
    relatedModel: 'DeletedAccount',
    url: '/admin/deleted-accounts',
  }).catch((e) => console.error('[deleteAccount] admin notify failed:', e.message))
}

function handleDeleteError(res, err) {
  if (err instanceof DeleteAccountBlockedError) {
    return sendError(res, {
      message: err.reasons[0],
      statusCode: HTTP_STATUS.CONFLICT,
      code: 'DELETE_BLOCKED',
      errors: { reasons: err.reasons },
    })
  }
  if (err.code === 'NOT_FOUND') {
    return sendError(res, { message: err.message, statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }
  if (err.code === 'FORBIDDEN') {
    return sendError(res, { message: err.message, statusCode: HTTP_STATUS.FORBIDDEN, code: 'FORBIDDEN' })
  }
  if (err.code === 'ALREADY_DELETED') {
    return sendError(res, { message: err.message, statusCode: HTTP_STATUS.BAD_REQUEST, code: 'ALREADY_DELETED' })
  }
  throw err
}

/** Self: can this account be deleted right now? */
export const checkDeleteMyAccount = asyncHandler(async (req, res) => {
  if (req.user.role === USER_ROLES.ADMIN) {
    return sendError(res, { message: 'Admin accounts cannot be deleted', statusCode: HTTP_STATUS.FORBIDDEN, code: 'FORBIDDEN' })
  }
  const reasons = await getDeletionBlockers(req.user)
  return sendSuccess(res, { data: { canDelete: reasons.length === 0, reasons } })
})

/** Self: delete my account (archive + anonymize) */
export const deleteMyAccount = asyncHandler(async (req, res) => {
  if (req.body?.confirm !== 'DELETE') {
    return sendError(res, {
      message: 'Please confirm the deletion by typing DELETE',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'CONFIRM_REQUIRED',
    })
  }
  try {
    const archive = await deleteAccount({
      userId: req.user._id,
      deletedBy: 'self',
      reason: typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '',
      req,
    })
    await logAudit({
      action: `Account deleted by user (${archive.role})`,
      module: 'User Management',
      targetUser: archive.originalUserId,
      newValue: { deletedAccountId: archive._id },
      reason: archive.deleteReason,
      req,
    })
    notifyAdminsOfDeletion(archive)
    return sendSuccess(res, { message: 'Your account has been deleted' })
  } catch (err) {
    return handleDeleteError(res, err)
  }
})

/** Admin: delete a user's account (same archive flow). force=true skips pending-work checks */
export const deleteUserAccountAdmin = asyncHandler(async (req, res) => {
  const { reason, force } = req.body || {}
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return sendError(res, { message: 'Reason is required', statusCode: HTTP_STATUS.BAD_REQUEST, code: 'REASON_REQUIRED' })
  }
  try {
    const archive = await deleteAccount({
      userId: req.params.id,
      deletedBy: 'admin',
      admin: req.user,
      reason: reason.trim().slice(0, 500),
      req,
      force: force === true,
    })
    await logAudit({
      adminId: req.user._id,
      action: `Deleted account (${archive.role})`,
      module: 'User Management',
      targetUser: archive.originalUserId,
      newValue: { deletedAccountId: archive._id },
      reason: reason.trim(),
      req,
    })
    notifyAdminsOfDeletion(archive)
    return sendSuccess(res, { message: 'Account deleted and archived', data: { deletedAccountId: archive._id } })
  } catch (err) {
    return handleDeleteError(res, err)
  }
})

/** Admin: list archived (deleted) accounts */
export const listDeletedAccounts = asyncHandler(async (req, res) => {
  const { role, search, deletedBy, from, to, page = 1, limit = 20 } = req.query
  const filter = {}
  if (role && role !== 'all') filter.role = role
  if (deletedBy === 'self' || deletedBy === 'admin') filter.deletedBy = deletedBy
  if (from || to) {
    filter.deletedAt = {}
    if (from) filter.deletedAt.$gte = new Date(from)
    if (to) {
      const end = new Date(to)
      end.setHours(23, 59, 59, 999)
      filter.deletedAt.$lte = end
    }
  }
  const s = typeof search === 'string' ? search.trim().slice(0, 100) : ''
  if (s) {
    const rx = new RegExp(escapeRegex(s), 'i')
    filter.$or = [{ fullName: rx }, { phone: rx }, { email: rx }, { companyName: rx }]
  }

  const pg = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || 20))

  const [items, total, roleAgg] = await Promise.all([
    DeletedAccount.find(filter)
      .select('-userSnapshot')
      .sort({ deletedAt: -1 })
      .skip((pg - 1) * lim)
      .limit(lim)
      .lean(),
    DeletedAccount.countDocuments(filter),
    DeletedAccount.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
  ])
  const roleCounts = Object.fromEntries(roleAgg.map((r) => [r._id, r.count]))

  return sendSuccess(res, {
    data: { items, total, page: pg, limit: lim, pages: Math.ceil(total / lim) || 1, roleCounts },
  })
})

/** Admin: full archived profile + counts of every archived record type */
export const getDeletedAccount = asyncHandler(async (req, res) => {
  const doc = await DeletedAccount.findById(req.params.id).lean()
  if (!doc) {
    return sendError(res, { message: 'Archived account not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }
  const archivedCounts = await DeletedAccountRecord.aggregate([
    { $match: { deletedAccountId: doc._id, modelName: { $ne: '__KycImages' } } },
    { $group: { _id: '$modelName', count: { $sum: 1 } } },
  ])
  const hasKycImages = !!(await DeletedAccountRecord.exists({ deletedAccountId: doc._id, modelName: '__KycImages' }))

  await logAudit({
    adminId: req.user._id,
    action: 'Viewed deleted account archive',
    module: 'Deleted Accounts',
    targetUser: doc.originalUserId,
    req,
  })

  return sendSuccess(res, {
    data: {
      account: doc,
      archivedCounts: Object.fromEntries(archivedCounts.map((c) => [c._id, c.count])),
      hasKycImages,
    },
  })
})

/** Admin: paginated archived related records of one model (e.g. WalletTransaction) */
export const getDeletedAccountRecords = asyncHandler(async (req, res) => {
  const { model, page = 1, limit = 25 } = req.query
  if (!model || typeof model !== 'string') {
    return sendError(res, { message: 'model is required', statusCode: HTTP_STATUS.BAD_REQUEST, code: 'MODEL_REQUIRED' })
  }
  if (model === '__KycImages') {
    return sendError(res, { message: 'Use the KYC endpoint', statusCode: HTTP_STATUS.BAD_REQUEST, code: 'INVALID_MODEL' })
  }
  const pg = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || 25))
  const filter = { deletedAccountId: req.params.id, modelName: model }
  const [items, total] = await Promise.all([
    DeletedAccountRecord.find(filter).sort({ originalCreatedAt: -1 }).skip((pg - 1) * lim).limit(lim).lean(),
    DeletedAccountRecord.countDocuments(filter),
  ])
  return sendSuccess(res, {
    data: { items: items.map((i) => i.data), total, page: pg, limit: lim, pages: Math.ceil(total / lim) || 1 },
  })
})

/** Admin: archived KYC document images (audit logged) */
export const getDeletedAccountKyc = asyncHandler(async (req, res) => {
  const rec = await DeletedAccountRecord.findOne({ deletedAccountId: req.params.id, modelName: '__KycImages' }).lean()
  const doc = await DeletedAccount.findById(req.params.id).select('originalUserId').lean()
  if (!doc) {
    return sendError(res, { message: 'Archived account not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }
  await logAudit({
    adminId: req.user._id,
    action: 'Viewed archived KYC documents',
    module: 'Deleted Accounts',
    targetUser: doc.originalUserId,
    req,
  })
  return sendSuccess(res, { data: { images: rec?.data || {} } })
})
