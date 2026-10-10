import mongoose from 'mongoose'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess, sendError, HTTP_STATUS } from '../utils/apiResponse.js'
import { logAudit } from '../utils/auditLogger.js'
import { User } from '../models/User.js'
import { Notification } from '../models/Notification.js'
import { PushCampaign } from '../models/PushCampaign.js'
import { sendNotificationToUser } from '../services/notificationService.js'
import { normalizeRole, getRoleHomePath } from '../utils/roleUtils.js'

const TARGET_ROLES = ['individual', 'labour', 'corporate', 'contractor', 'enterprise']
const SEND_CONCURRENCY = 25

const buildRecipientQuery = (audience) => {
  const query = { isActive: true, accountStatus: { $nin: ['deleted', 'blocked'] } }
  if (audience.mode === 'ROLES') query.role = { $in: audience.roles }
  else if (audience.mode === 'INDIVIDUAL') query._id = { $in: audience.userIds }
  else query.role = { $in: TARGET_ROLES }
  return query
}

/** Validates + normalises the audience object from the request body. */
const parseAudience = (raw = {}) => {
  const mode = String(raw.mode || '').toUpperCase()
  if (!['ALL', 'ROLES', 'INDIVIDUAL'].includes(mode)) return { error: 'Invalid audience mode' }
  if (mode === 'ROLES') {
    const roles = [...new Set((raw.roles || []).map(normalizeRole))].filter((r) => TARGET_ROLES.includes(r))
    if (!roles.length) return { error: 'Select at least one role' }
    return { audience: { mode, roles, userIds: [] } }
  }
  if (mode === 'INDIVIDUAL') {
    const ids = [...new Set((raw.userIds || []).map(String))]
    if (!ids.length || !ids.every((id) => mongoose.isValidObjectId(id))) {
      return { error: 'Select at least one valid recipient' }
    }
    return { audience: { mode, roles: [], userIds: ids } }
  }
  return { audience: { mode, roles: [], userIds: [] } }
}

const parseAction = (raw = {}) => {
  const type = String(raw.type || 'NONE').toUpperCase()
  if (type === 'SCREEN' && raw.screen) return { type, screen: String(raw.screen).trim() }
  if (type === 'SKILL_BOOKING' && mongoose.isValidObjectId(raw.skillId)) return { type, skillId: raw.skillId }
  return { type: 'NONE' }
}

/** Route an app should open for a given recipient role + campaign action. */
const resolveRoute = (action, role) => {
  if (action.type === 'SCREEN') return action.screen
  if (action.type === 'SKILL_BOOKING' && action.skillId) {
    const id = String(action.skillId)
    if (role === 'individual') return `/app/booking/flow?step=details&categoryId=${id}`
    if (role === 'corporate') return `/corporate/requests/new?categoryId=${id}`
    if (role === 'enterprise') return `/enterprise/jobs/new?categoryId=${id}`
  }
  return ''
}

export const executeCampaign = async (campaignId) => {
  const campaign = await PushCampaign.findById(campaignId)
  if (!campaign) return
  try {
    const users = await User.find(buildRecipientQuery(campaign.audience)).select('_id role').lean()
    campaign.counts.targeted = users.length
    await campaign.save()

    let delivered = 0
    let failed = 0
    for (let i = 0; i < users.length; i += SEND_CONCURRENCY) {
      const chunk = users.slice(i, i + SEND_CONCURRENCY)
      const results = await Promise.all(
        chunk.map((u) =>
          sendNotificationToUser(u._id, campaign.title, campaign.body, {
            type: 'ADMIN_ANNOUNCEMENT',
            recipientRole: u.role,
            campaignId: String(campaign._id),
            route: resolveRoute(campaign.action, u.role),
            url: resolveRoute(campaign.action, u.role) || getRoleHomePath(u.role),
          }),
        ),
      )
      results.forEach((r) => (r?.success ? (delivered += 1) : (failed += 1)))
    }

    // In-app notification list entry for every targeted user (even without a device token).
    if (users.length) {
      await Notification.insertMany(
        users.map((u) => ({
          userId: u._id,
          title: campaign.title,
          body: campaign.body,
          type: 'ADMIN_ANNOUNCEMENT',
          relatedId: campaign._id,
          relatedModel: 'PushCampaign',
          recipientRole: u.role,
        })),
        { ordered: false },
      )
    }

    campaign.counts.delivered = delivered
    campaign.counts.failed = failed
    campaign.status = 'sent'
    campaign.sentAt = new Date()
    await campaign.save()
  } catch (err) {
    console.error('[AdminPush] Campaign failed:', err.message)
    campaign.status = 'failed'
    campaign.errorMessage = err.message
    await campaign.save()
  }
}

/** Picks up due scheduled campaigns (called by the interval job in server.js). */
export const runDueScheduledCampaigns = async () => {
  for (;;) {
    const claimed = await PushCampaign.findOneAndUpdate(
      { status: 'scheduled', scheduledAt: { $lte: new Date() } },
      { $set: { status: 'sending' } },
      { new: true },
    )
    if (!claimed) return
    await executeCampaign(claimed._id)
  }
}

export const getRecipientsCount = asyncHandler(async (req, res) => {
  const { audience, error } = parseAudience(req.body)
  if (error) return sendError(res, { message: error, statusCode: HTTP_STATUS.BAD_REQUEST })
  const query = buildRecipientQuery(audience)
  const [total, withDevice] = await Promise.all([
    User.countDocuments(query),
    User.countDocuments({
      ...query,
      $or: [{ 'fcmTokensMobile.0': { $exists: true } }, { 'fcmTokensWeb.0': { $exists: true } }],
    }),
  ])
  return sendSuccess(res, { data: { total, withDevice } })
})

export const searchRecipients = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim()
  const filter = { role: { $in: TARGET_ROLES }, isActive: true }
  // Empty query lists users alphabetically so admin can browse by role.
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    const or = [{ fullName: rx }, { phone: rx }, { email: rx }]
    if (mongoose.isValidObjectId(q)) or.push({ _id: q })
    filter.$or = or
  }
  if (req.query.role && TARGET_ROLES.includes(normalizeRole(req.query.role))) {
    filter.role = normalizeRole(req.query.role)
  }
  const users = await User.find(filter).select('fullName phone email role').sort({ fullName: 1 }).limit(40).lean()
  return sendSuccess(res, { data: { users } })
})

export const sendCampaign = asyncHandler(async (req, res) => {
  const { title, body, scheduledAt } = req.body
  if (!String(title || '').trim() || !String(body || '').trim()) {
    return sendError(res, { message: 'Title and message are required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  if (String(title).trim().length > 65 || String(body).trim().length > 240) {
    return sendError(res, { message: 'Title max 65 and message max 240 characters', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  const { audience, error } = parseAudience(req.body.audience)
  if (error) return sendError(res, { message: error, statusCode: HTTP_STATUS.BAD_REQUEST })

  let when = null
  if (scheduledAt) {
    when = new Date(scheduledAt)
    if (Number.isNaN(when.getTime())) {
      return sendError(res, { message: 'Invalid schedule time', statusCode: HTTP_STATUS.BAD_REQUEST })
    }
    if (when.getTime() <= Date.now() + 30 * 1000) when = null // effectively "now"
  }

  const campaign = await PushCampaign.create({
    title: String(title).trim(),
    body: String(body).trim(),
    audience,
    action: parseAction(req.body.action),
    status: when ? 'scheduled' : 'sending',
    scheduledAt: when || undefined,
    sentBy: req.user._id,
  })

  await logAudit({
    adminId: req.user._id,
    action: when ? 'Scheduled push campaign' : 'Sent push campaign',
    module: 'Push Notifications',
    newValue: { campaignId: campaign._id, title: campaign.title, audience },
    req,
  })

  if (!when) {
    // Fire and forget so big audiences never block the request.
    executeCampaign(campaign._id).catch((e) => console.error('[AdminPush] execute error:', e.message))
  }

  return sendSuccess(res, {
    data: { campaign },
    statusCode: 202,
    message: when ? 'Notification scheduled' : 'Notification is being sent',
  })
})

export const getCampaigns = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const limit = Math.min(50, parseInt(req.query.limit) || 20)
  const [campaigns, total] = await Promise.all([
    PushCampaign.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('sentBy', 'fullName')
      .populate('action.skillId', 'name')
      .lean(),
    PushCampaign.countDocuments(),
  ])
  return sendSuccess(res, { data: { campaigns, total, page, limit } })
})

export const cancelScheduledCampaign = asyncHandler(async (req, res) => {
  const campaign = await PushCampaign.findOneAndDelete({ _id: req.params.id, status: 'scheduled' })
  if (!campaign) {
    return sendError(res, { message: 'Scheduled campaign not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  return sendSuccess(res, { message: 'Scheduled notification cancelled' })
})
