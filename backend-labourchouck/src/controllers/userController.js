import mongoose from 'mongoose'
import { User } from '../models/User.js'
import { LabourCategory } from '../models/LabourCategory.js'
import { LabourCategoryGroup, LABOUR_GROUP_KIND } from '../models/LabourCategoryGroup.js'
import { KYC_STATUS, ROLE_LIST, USER_ROLES } from '../constants/roles.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { populateLabourCategories } from '../utils/populateLabourCategories.js'
import { isValidAadhaarLength, maskAadhaarLast4, normalizeAadhaar } from '../utils/aadhaar.js'
import { normalizeStoredMediaUrl } from '../utils/mediaUrl.js'
import { sendNotificationToUser } from '../services/notificationService.js'
import { triggerNotification } from '../utils/notificationTrigger.js'
import { logAudit } from '../utils/auditLogger.js'

const MAX_KYC_IMAGE_CHARS = 750_000

function validateKycDataUrlImage(value, label) {
  if (typeof value !== 'string' || value.length < 80) {
    return `${label} image is missing or too small`
  }
  if (value.length > MAX_KYC_IMAGE_CHARS) {
    return `${label} image is too large — try a clearer photo under ~4MB before upload`
  }
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value)) {
    return `${label} must be a JPEG or PNG data URL from your camera or gallery`
  }
  return null
}

function labourHasKycVideo(lp) {
  return Boolean(lp?.kycVideoUrl?.trim())
}

function normalizePan(input) {
  return String(input ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10)
}

function isValidPan(normalized) {
  return /^[A-Z]{5}\d{4}[A-Z]$/.test(normalized)
}

function maskPan(normalized) {
  return `${normalized.slice(0, 5)} XXXX ${normalized.slice(-1)}`
}

function sanitizeKycVideoMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return undefined
  return {
    publicId: meta.publicId ? String(meta.publicId).slice(0, 512) : undefined,
    resourceType: meta.resourceType ? String(meta.resourceType).slice(0, 32) : undefined,
    format: meta.format ? String(meta.format).slice(0, 32) : undefined,
    bytes: Number.isFinite(Number(meta.bytes)) ? Number(meta.bytes) : undefined,
    duration: Number.isFinite(Number(meta.duration)) ? Number(meta.duration) : undefined,
    uploadedAt: meta.uploadedAt ? new Date(meta.uploadedAt) : undefined,
  }
}

/** PATCH /users/me — update basic profile fields (mobile-first parity with future app) */
export const updateMe = asyncHandler(async (req, res) => {
  const { fullName, email, profileImageUrl } = req.body
  const user = req.user

  if (fullName != null) user.fullName = String(fullName).trim()
  if (email !== undefined) user.email = email ? String(email).trim().toLowerCase() : ''

  if (profileImageUrl !== undefined) {
    const raw = profileImageUrl == null ? '' : String(profileImageUrl).trim()
    if (raw) {
      const httpsUrl = normalizeStoredMediaUrl(raw)
      if (httpsUrl) {
        user.profileImageUrl = httpsUrl
      } else if (/^data:image\//i.test(raw)) {
        const imgErr = validateKycDataUrlImage(raw, 'Profile photo')
        if (imgErr) {
          return sendError(res, {
            message: imgErr,
            statusCode: HTTP_STATUS.BAD_REQUEST,
            code: 'INVALID_PROFILE_IMAGE',
          })
        }
        user.profileImageUrl = raw
      } else {
        return sendError(res, {
          message: 'Upload profile photo via /uploads/media (profiles folder) or use a valid https:// URL',
          statusCode: HTTP_STATUS.BAD_REQUEST,
          code: 'INVALID_PROFILE_IMAGE',
        })
      }
    } else {
      user.profileImageUrl = null
    }
  }

  if (user.role === USER_ROLES.LABOUR && req.body.labourProfile) {
    user.labourProfile = user.labourProfile || {}
    if (req.body.labourProfile.skills !== undefined) {
      user.labourProfile.skills = req.body.labourProfile.skills
    }
    if (req.body.labourProfile.availabilityStatus !== undefined) {
      user.labourProfile.availabilityStatus = req.body.labourProfile.availabilityStatus
    }
    if (req.body.labourProfile.workRadius !== undefined) {
      user.labourProfile.workRadius = Number(req.body.labourProfile.workRadius)
    }
    if (req.body.labourProfile.locationLat !== undefined) {
      user.labourProfile.locationLat = Number(req.body.labourProfile.locationLat)
    }
    if (req.body.labourProfile.locationLng !== undefined) {
      user.labourProfile.locationLng = Number(req.body.labourProfile.locationLng)
    }
  }

  await user.save()
  await populateLabourCategories(user)
  return sendSuccess(res, {
    message: 'Profile updated',
    data: { user: user.toSafeObject() },
  })
})

/** PATCH /users/me/labour-categories — worker trade + profile tags */
export const updateLabourCategories = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.LABOUR) {
    return sendError(res, {
      message: 'Only worker accounts use this step',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'FORBIDDEN',
    })
  }

  const { categoryIds } = req.body
  const unique = [...new Set(categoryIds.map((id) => String(id)))]

  const categories = await LabourCategory.find({
    _id: { $in: unique },
    isActive: true,
  }).populate({ path: 'group', select: 'kind isActive' })

  if (categories.length !== unique.length) {
    return sendError(res, {
      message: 'One or more categories are invalid or inactive',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_CATEGORIES',
    })
  }

  const hasTrade = categories.some((c) => c.group?.kind === LABOUR_GROUP_KIND.TRADE && c.group?.isActive !== false)
  if (!hasTrade) {
    return sendError(res, {
      message:
        'Choose at least one job type (for example plumber, electrician, or construction helper). Profile tags alone are not enough for worksite matching.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'TRADE_REQUIRED',
    })
  }

  req.user.labourProfile = req.user.labourProfile || {}
  req.user.labourProfile.categoryIds = unique
  await req.user.save()
  await populateLabourCategories(req.user)

  return sendSuccess(res, {
    message: 'Work categories saved',
    data: { user: req.user.toSafeObject() },
  })
})

/** GET /users/me — alias clarity for some clients */
export const getProfile = asyncHandler(async (req, res) => {
  await populateLabourCategories(req.user)
  return sendSuccess(res, { data: { user: req.user.toSafeObject() } })
})

/** POST /users/me/labour/kyc/submit — labour: Aadhaar/PAN numbers + recorded video → pending admin review */
export const submitLabourKycDocuments = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.LABOUR) {
    return sendError(res, {
      message: 'Only worker accounts can submit KYC here',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'FORBIDDEN',
    })
  }

  if (req.user.labourProfile?.kycStatus === KYC_STATUS.VERIFIED) {
    return sendError(res, {
      message: 'KYC is already approved',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'KYC_ALREADY_VERIFIED',
    })
  }

  const lp = req.user.labourProfile || {}
  const isVideoOnlyResubmit =
    lp.kycStatus === KYC_STATUS.FAILED && Boolean(lp.aadhaarMasked?.trim()) && Boolean(lp.panMasked?.trim())

  const normalizedAadhaar = normalizeAadhaar(req.body.aadhaar)
  const normalizedPan = normalizePan(req.body.pan)
  const hasAadhaarInput = normalizedAadhaar.length > 0
  const hasPanInput = normalizedPan.length > 0

  if (isVideoOnlyResubmit) {
    if (hasAadhaarInput && !isValidAadhaarLength(normalizedAadhaar)) {
      return sendError(res, {
        message: 'Enter a valid 12-digit Aadhaar number',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_AADHAAR',
      })
    }
    if (hasPanInput && !isValidPan(normalizedPan)) {
      return sendError(res, {
        message: 'Enter a valid PAN number',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_PAN',
      })
    }
  } else {
    if (!isValidAadhaarLength(normalizedAadhaar)) {
      return sendError(res, {
        message: 'Enter a valid 12-digit Aadhaar number',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_AADHAAR',
      })
    }
    if (!isValidPan(normalizedPan)) {
      return sendError(res, {
        message: 'Enter a valid PAN number',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_PAN',
      })
    }
  }

  const videoUrl = normalizeStoredMediaUrl(req.body.videoUrl)
  if (!videoUrl) {
    return sendError(res, {
      message: 'Record and upload a KYC video before submitting',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_KYC_VIDEO',
    })
  }

  req.user.labourProfile = req.user.labourProfile || {}
  req.user.labourProfile.kycStatus = KYC_STATUS.PENDING
  if (hasAadhaarInput) {
    req.user.labourProfile.aadhaarMasked = maskAadhaarLast4(normalizedAadhaar)
    req.user.labourProfile.aadhaarNumber = normalizedAadhaar
  }
  if (hasPanInput) {
    req.user.labourProfile.panMasked = maskPan(normalizedPan)
    req.user.labourProfile.panNumber = normalizedPan
  }
  req.user.labourProfile.kycVideoUrl = videoUrl
  req.user.labourProfile.kycVideoMeta = sanitizeKycVideoMeta(req.body.videoMeta)
  req.user.labourProfile.kycSubmittedAt = new Date()
  req.user.labourProfile.kycReviewNote = undefined

  await req.user.save()
  await populateLabourCategories(req.user)

  // Trigger Notification to admin
  await triggerNotification({
    userId: null,
    title: 'KYC Submitted',
    body: `New Labour KYC submitted by ${req.user.fullName || req.user.phone}`,
    type: 'KYC_SUBMITTED',
    relatedId: req.user._id,
    relatedModel: 'User',
  })

  return sendSuccess(res, {
    message: 'KYC video submitted — an admin will review your Aadhaar and PAN shortly.',
    data: { user: req.user.toSafeObject() },
  })
})

/** PATCH /users/:id/labour-kyc-review — admin approve / reject labour KYC */
export const reviewLabourKyc = asyncHandler(async (req, res) => {
  const { decision, note } = req.body
  const user = await User.findById(req.params.id)
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }
  if (user.role !== USER_ROLES.LABOUR) {
    return sendError(res, {
      message: 'KYC review applies to labour accounts only',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_ROLE',
    })
  }

  user.labourProfile = user.labourProfile || {}

  if (decision === 'approved') {
    if (!user.labourProfile.kycSubmittedAt || !labourHasKycVideo(user.labourProfile)) {
      return sendError(res, {
        message: 'This worker has not submitted a KYC video yet',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'NO_KYC_SUBMISSION',
      })
    }
    user.labourProfile.kycStatus = KYC_STATUS.VERIFIED
    user.labourProfile.kycReviewNote = undefined
  } else {
    user.labourProfile.kycStatus = KYC_STATUS.FAILED
    user.labourProfile.kycReviewNote = typeof note === 'string' ? note.trim().slice(0, 500) : ''
  }

  await user.save()
  
  // Send database-backed notification to the worker
  if (decision === 'approved') {
    await triggerNotification({
      userId: user._id,
      title: 'KYC Verified!',
      body: 'Your Aadhaar/PAN KYC has been approved. You are ready to receive jobs.',
      type: 'KYC_APPROVED',
      relatedId: user._id,
      relatedModel: 'User'
    })
  } else {
    await triggerNotification({
      userId: user._id,
      title: 'Action Required',
      body: 'Your KYC was rejected. Please review and re-submit your documents.',
      type: 'KYC_REJECTED',
      relatedId: user._id,
      relatedModel: 'User'
    })
  }
  
  // Log Admin Audit Trail
  await logAudit({
    adminId: req.user._id,
    action: decision === 'approved' ? 'KYC Approved' : 'KYC Rejected',
    previousValue: { kycStatus: 'pending' },
    newValue: { kycStatus: user.labourProfile.kycStatus, kycReviewNote: user.labourProfile.kycReviewNote },
    module: 'Labour KYC',
    req
  })

  await populateLabourCategories(user)

  return sendSuccess(res, {
    message: decision === 'approved' ? 'KYC approved for this worker' : 'KYC marked as rejected',
    data: { user: user.toSafeObject({ includeLabourKycImages: true }) },
  })
})

const MAX_SEARCH_LEN = 80
const MAX_PAGE_SIZE = 100

function buildSearchOrClause(searchTrim) {
  const esc = searchTrim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const or = [{ fullName: new RegExp(esc, 'i') }, { email: new RegExp(esc, 'i') }]
  const digits = searchTrim.replace(/\D/g, '')
  if (digits.length >= 2) {
    or.push({ phone: { $regex: digits } })
  }
  return { $or: or }
}

const KYC_PENDING_CONDITIONS = [
  { labourProfile: { $exists: false } },
  { 'labourProfile.kycStatus': { $exists: false } },
  { 'labourProfile.kycStatus': null },
  { 'labourProfile.kycStatus': KYC_STATUS.PENDING },
]

function mergeAnd(base, extraClauses) {
  const next = { ...base }
  const existing = Array.isArray(next.$and) ? [...next.$and] : []
  next.$and = [...existing, ...extraClauses]
  return next
}

/** Admin: list users with search, role, active/inactive, optional labour KYC filter, pagination */
export const listUsers = asyncHandler(async (req, res) => {
  const { search, role, status, kycStatus, page = 1, limit = 20 } = req.query
  const q = {}
  const andParts = []

  if (role) {
    if (!ROLE_LIST.includes(role)) {
      return sendError(res, {
        message: 'Invalid role filter',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_ROLE',
      })
    }
  }

  if (status === 'active') { q.isActive = true }
  else if (status === 'inactive') { q.isActive = false }
  else if (status && status !== 'all') {
    q.accountStatus = status
  }

  const searchTrim = typeof search === 'string' ? search.trim() : ''
  if (searchTrim.length > MAX_SEARCH_LEN) {
    return sendError(res, {
      message: `Search must be at most ${MAX_SEARCH_LEN} characters`,
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'SEARCH_TOO_LONG',
    })
  }

  if (searchTrim) {
    andParts.push(buildSearchOrClause(searchTrim))
  }

  const kycRaw = typeof kycStatus === 'string' ? kycStatus.trim().toLowerCase() : ''
  const kycKey = kycRaw === '' || kycRaw === 'all' ? 'all' : kycRaw
  if (kycKey !== 'all' && !Object.values(KYC_STATUS).includes(kycKey)) {
    return sendError(res, {
      message: 'kycStatus must be all, pending, verified, or failed',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_KYC_STATUS',
    })
  }

  if (kycKey !== 'all') {
    if (role && role !== USER_ROLES.LABOUR) {
      return sendError(res, {
        message: 'KYC filter applies to labour accounts only — use role=labour or omit role.',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'KYC_REQUIRES_LABOUR',
      })
    }
    q.role = USER_ROLES.LABOUR
    if (kycKey === KYC_STATUS.PENDING) {
      andParts.push({ $or: KYC_PENDING_CONDITIONS })
    } else if (kycKey === KYC_STATUS.VERIFIED) {
      andParts.push({ 'labourProfile.kycStatus': KYC_STATUS.VERIFIED })
    } else if (kycKey === KYC_STATUS.FAILED) {
      andParts.push({ 'labourProfile.kycStatus': KYC_STATUS.FAILED })
    }
  } else if (role) {
    q.role = role
  }

  if (andParts.length) {
    q.$and = andParts
  }

  const pg = Math.max(1, Number(page) || 1)
  const lim = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(limit) || 20))
  const skip = (pg - 1) * lim

  let labourKycCounts = null
  if (q.role === USER_ROLES.LABOUR) {
    const statsBase = { role: USER_ROLES.LABOUR }
    if (q.isActive !== undefined) statsBase.isActive = q.isActive
    if (searchTrim) {
      statsBase.$and = [buildSearchOrClause(searchTrim)]
    }
    const [pending, verified, failed, labourTotal] = await Promise.all([
      User.countDocuments(mergeAnd(statsBase, [{ $or: KYC_PENDING_CONDITIONS }])),
      User.countDocuments(mergeAnd(statsBase, [{ 'labourProfile.kycStatus': KYC_STATUS.VERIFIED }])),
      User.countDocuments(mergeAnd(statsBase, [{ 'labourProfile.kycStatus': KYC_STATUS.FAILED }])),
      User.countDocuments(statsBase),
    ])
    labourKycCounts = { pending, verified, failed, total: labourTotal }
  }

  const [items, total] = await Promise.all([
    User.find(q)
      .select('-passwordHash')
      .populate({ path: 'labourProfile.categoryIds', select: 'name slug isActive' })
      .sort({ lastLoginAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .lean(),
    User.countDocuments(q),
  ])

  const itemsOut = items.map((u) => {
    if (!u.labourProfile) return u
    const lp = { ...u.labourProfile }
    delete lp.kycFrontImageDataUrl
    delete lp.kycBackImageDataUrl
    return { ...u, labourProfile: lp }
  })

  return sendSuccess(res, {
    data: {
      items: itemsOut,
      total,
      page: pg,
      limit: lim,
      pages: Math.max(1, Math.ceil(total / lim)),
      labourKycCounts,
    },
  })
})

/** Admin: get one user (includes KYC document data URLs for review) */
export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .select('+labourProfile.aadhaarNumber +labourProfile.panNumber')
    .populate({ path: 'adminNotes.addedBy', select: 'fullName email profileImageUrl role' })
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }
  await populateLabourCategories(user)
  return sendSuccess(res, { data: { user: user.toSafeObject({ includeLabourKycImages: true }) } })
})

function displayNameFromFullName(fullName) {
  const t = (fullName || '').trim()
  if (!t) return 'Worker'
  const parts = t.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0]
  const last = parts[parts.length - 1]
  const initial = last[0]?.toUpperCase() || ''
  return initial ? `${parts[0]} ${initial}.` : parts[0]
}

function escapeRegexForMongo(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function tradeCategoriesFromPopulatedUser(leanUser) {
  const raw = leanUser.labourProfile?.categoryIds
  if (!Array.isArray(raw)) return []
  const out = []
  for (const c of raw) {
    if (!c || typeof c !== 'object' || !c._id) continue
    if (c.isActive === false) continue
    const g = c.group
    if (!g || typeof g !== 'object') continue
    if (g.kind !== LABOUR_GROUP_KIND.TRADE || g.isActive === false) continue
    out.push({
      _id: String(c._id),
      name: c.name,
      subtitle: c.subtitle || '',
      groupId: g._id ? String(g._id) : '',
      groupName: g.name || '',
    })
  }
  return out
}

function labourToPublicCard(leanUser) {
  const trades = tradeCategoriesFromPopulatedUser(leanUser)
  const kyc = leanUser.labourProfile?.kycStatus
  return {
    id: String(leanUser._id),
    displayName: displayNameFromFullName(leanUser.fullName),
    kycVerified: kyc === KYC_STATUS.VERIFIED,
    kycStatus: typeof kyc === 'string' ? kyc : KYC_STATUS.PENDING,
    tradeCategories: trades,
  }
}

function labourToPublicDetail(leanUser) {
  const base = labourToPublicCard(leanUser)
  const created = leanUser.createdAt ? new Date(leanUser.createdAt) : null
  return {
    ...base,
    memberSinceYear: created && !Number.isNaN(created.getTime()) ? created.getFullYear() : null,
  }
}

/** GET /users/discover/labours — app users browse workers (trade categories only; no phone/email) */
export const listDiscoverLabours = asyncHandler(async (req, res) => {
  const groupIdRaw = typeof req.query.groupId === 'string' ? req.query.groupId.trim() : ''
  const categoryIdRaw = typeof req.query.categoryId === 'string' ? req.query.categoryId.trim() : ''
  const qRaw = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : ''
  const lim = Math.min(50, Math.max(1, Number(req.query.limit) || 24))

  const filter = {
    role: USER_ROLES.LABOUR,
    isActive: true,
    'labourProfile.categoryIds.0': { $exists: true },
  }

  if (qRaw) {
    filter.fullName = { $regex: escapeRegexForMongo(qRaw), $options: 'i' }
  }

  if (categoryIdRaw) {
    if (!mongoose.isValidObjectId(categoryIdRaw)) {
      return sendError(res, {
        message: 'Invalid category id',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_CATEGORY',
      })
    }
    const cat = await LabourCategory.findOne({ _id: categoryIdRaw, isActive: true })
      .populate({ path: 'group', select: 'kind isActive' })
      .lean()
    if (!cat || cat.group?.kind !== LABOUR_GROUP_KIND.TRADE || cat.group?.isActive === false) {
      return sendSuccess(res, { data: { items: [] } })
    }
    filter['labourProfile.categoryIds'] = new mongoose.Types.ObjectId(categoryIdRaw)
  } else if (groupIdRaw) {
    if (!mongoose.isValidObjectId(groupIdRaw)) {
      return sendError(res, {
        message: 'Invalid group id',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_GROUP',
      })
    }
    const group = await LabourCategoryGroup.findById(groupIdRaw).lean()
    if (!group || group.kind !== LABOUR_GROUP_KIND.TRADE || !group.isActive) {
      return sendSuccess(res, { data: { items: [] } })
    }
    const catIds = await LabourCategory.find({ group: groupIdRaw, isActive: true }).distinct('_id')
    if (!catIds.length) {
      return sendSuccess(res, { data: { items: [] } })
    }
    filter['labourProfile.categoryIds'] = { $in: catIds }
  }

  const items = await User.find(filter)
    .select('fullName labourProfile.kycStatus labourProfile.categoryIds createdAt')
    .populate({
      path: 'labourProfile.categoryIds',
      match: { isActive: true },
      select: 'name subtitle isActive group',
      populate: { path: 'group', select: 'name kind isActive' },
    })
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(lim)
    .lean()

  const cards = items.map((u) => labourToPublicCard(u)).filter((c) => c.tradeCategories.length > 0)

  return sendSuccess(res, { data: { items: cards } })
})

/** GET /users/discover/labours/:id — public worker detail for homeowner app */
export const getDiscoverLabour = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    _id: req.params.id,
    role: USER_ROLES.LABOUR,
    isActive: true,
    'labourProfile.categoryIds.0': { $exists: true },
  })
    .select('fullName labourProfile.kycStatus labourProfile.categoryIds createdAt')
    .populate({
      path: 'labourProfile.categoryIds',
      match: { isActive: true },
      select: 'name subtitle isActive group',
      populate: { path: 'group', select: 'name kind isActive' },
    })
    .lean()

  if (!user) {
    return sendError(res, { message: 'Worker not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }

  const detail = labourToPublicDetail(user)
  if (!detail.tradeCategories.length) {
    return sendError(res, { message: 'Worker not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }

  return sendSuccess(res, { data: { labour: detail } })
})

/** POST /users/me/fcm-token — save FCM token for push notifications */
export const saveFcmToken = asyncHandler(async (req, res) => {
  const { token, deviceType } = req.body
  if (!token || typeof token !== 'string') {
    return sendError(res, {
      message: 'FCM token is required',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_TOKEN'
    })
  }

  // Determine platform classification by deviceType from client
  let targetField = 'fcmTokensMobile'; // default to mobile if not specified
  if (deviceType === 'web') {
    targetField = 'fcmTokensWeb';
  } else if (deviceType === 'mobile' || deviceType === 'android' || deviceType === 'ios') {
    targetField = 'fcmTokensMobile';
  } else {
    // Fallback if client doesn't send deviceType
    const isApp = req.user.role !== 'admin';
    targetField = isApp ? 'fcmTokensMobile' : 'fcmTokensWeb';
  }

  // Remove this token from all other users first to prevent wrong device routing
  await User.updateMany(
    { _id: { $ne: req.user._id } },
    { 
      $pull: { 
        fcmTokensWeb: token, 
        fcmTokensMobile: token 
      } 
    }
  )

  // Retrieve user document to mutate token array safely (using lean to bypass version tracking)
  const user = await User.findById(req.user._id).lean()
  if (!user) {
    return sendError(res, {
      message: 'User not found',
      statusCode: HTTP_STATUS.NOT_FOUND
    })
  }

  let tokens = user[targetField] || []
  
  // Prevent duplicate and place at the end (most recent)
  tokens = tokens.filter(t => t !== token)
  tokens.push(token)

  // Cap at 5 most recent tokens to prevent database array bloat
  if (tokens.length > 5) {
    tokens.shift()
  }

  await User.updateOne(
    { _id: req.user._id },
    { $set: { [targetField]: tokens } }
  )

  const isMobileField = targetField === 'fcmTokensMobile'
  return sendSuccess(res, { 
    message: `FCM Token saved successfully for ${isMobileField ? 'app' : 'web'} platform`,
    data: {
      role: req.user.role,
      platform: isMobileField ? 'app' : 'web'
    }
  })
})

/** POST /users/me/fcm-token/remove — remove FCM token on logout */
export const removeFcmToken = asyncHandler(async (req, res) => {
  const { token } = req.body
  
  if (!token || typeof token !== 'string') {
    return sendError(res, {
      message: 'FCM token is required',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_TOKEN'
    })
  }

  // Remove the token from both arrays
  await User.updateOne(
    { _id: req.user._id },
    { 
      $pull: { 
        fcmTokensWeb: token, 
        fcmTokensMobile: token 
      } 
    }
  )

  return sendSuccess(res, { 
    message: 'FCM Token removed successfully'
  })
})

/** Admin: update user status (active, suspended, blocked, etc.) */
export const patchUserStatusAdmin = asyncHandler(async (req, res) => {
  const { status, reason } = req.body
  const validStatuses = ['active', 'pending_verification', 'on_hold', 'suspended', 'blocked', 'deleted']
  if (!validStatuses.includes(status)) {
    return sendError(res, { message: 'Invalid status', statusCode: HTTP_STATUS.BAD_REQUEST, code: 'INVALID_STATUS' })
  }
  if (!reason || typeof reason !== 'string') {
    return sendError(res, { message: 'Reason is required for status change', statusCode: HTTP_STATUS.BAD_REQUEST, code: 'REASON_REQUIRED' })
  }

  const user = await User.findById(req.params.id)
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }

  const oldStatus = user.accountStatus || 'active'
  user.accountStatus = status

  if (['active', 'pending_verification', 'on_hold'].includes(status)) {
    user.isActive = true
  } else {
    user.isActive = false
  }

  if (status === 'deleted') {
    user.deletedAt = new Date()
  } else {
    user.deletedAt = undefined
  }

  await user.save()

  await logAudit({
    adminId: req.user._id,
    action: `Changed status to ${status}`,
    previousValue: { accountStatus: oldStatus },
    newValue: { accountStatus: status },
    module: 'User Management',
    targetUser: user._id,
    reason: reason,
    req
  })

  const populatedUser = await User.findById(user._id).populate({ path: 'adminNotes.addedBy', select: 'fullName email profileImageUrl role' })
  await populateLabourCategories(populatedUser)
  return sendSuccess(res, { message: 'User status updated', data: { user: populatedUser.toSafeObject() } })
})

/** Admin: Add internal note */
export const addAdminNote = asyncHandler(async (req, res) => {
  const { text } = req.body
  if (!text || typeof text !== 'string') {
    return sendError(res, { message: 'Note text is required', statusCode: HTTP_STATUS.BAD_REQUEST, code: 'INVALID_NOTE' })
  }

  const user = await User.findById(req.params.id)
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }

  user.adminNotes = user.adminNotes || []
  user.adminNotes.push({
    text: text.trim(),
    addedBy: req.user._id,
    addedAt: new Date()
  })

  await user.save()

  await logAudit({
    adminId: req.user._id,
    action: 'Added Internal Note',
    previousValue: null,
    newValue: { note: text.trim() },
    module: 'User Management',
    targetUser: user._id,
    req
  })

  const populatedUser = await User.findById(user._id).populate({ path: 'adminNotes.addedBy', select: 'fullName email profileImageUrl role' })
  await populateLabourCategories(populatedUser)
  return sendSuccess(res, { message: 'Note added', data: { user: populatedUser.toSafeObject() } })
})

/** Admin: update user wallet (freeze/unfreeze or adjust balance) */
export const updateUserWalletAdmin = asyncHandler(async (req, res) => {
  const { action, amount, reason } = req.body
  
  if (!reason || typeof reason !== 'string') {
    return sendError(res, { message: 'Reason is required', statusCode: HTTP_STATUS.BAD_REQUEST, code: 'REASON_REQUIRED' })
  }

  const user = await User.findById(req.params.id)
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }

  const oldWallet = {
    balance: user.walletBalance || 0,
    frozen: user.isWalletFrozen || false
  }

  if (action === 'freeze') {
    user.isWalletFrozen = true
  } else if (action === 'unfreeze') {
    user.isWalletFrozen = false
  } else if (action === 'add') {
    if (typeof amount !== 'number' || amount <= 0) {
      return sendError(res, { message: 'Invalid amount', statusCode: HTTP_STATUS.BAD_REQUEST })
    }
    user.walletBalance = (user.walletBalance || 0) + amount
  } else if (action === 'deduct') {
    if (typeof amount !== 'number' || amount <= 0) {
      return sendError(res, { message: 'Invalid amount', statusCode: HTTP_STATUS.BAD_REQUEST })
    }
    user.walletBalance = Math.max(0, (user.walletBalance || 0) - amount)
  } else {
    return sendError(res, { message: 'Invalid action', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  await user.save()

  await logAudit({
    adminId: req.user._id,
    action: `Wallet ${action}`,
    previousValue: oldWallet,
    newValue: { balance: user.walletBalance, frozen: user.isWalletFrozen },
    module: 'Wallet Management',
    targetUser: user._id,
    reason: reason,
    req
  })

  const populatedUser = await User.findById(user._id).populate({ path: 'adminNotes.addedBy', select: 'fullName email profileImageUrl role' })
  await populateLabourCategories(populatedUser)
  return sendSuccess(res, { message: `Wallet updated successfully`, data: { user: populatedUser.toSafeObject() } })
})

/** Admin: get user timeline (audit logs) */
export const getUserTimelineAdmin = asyncHandler(async (req, res) => {
  const { AuditLog } = await import('../models/AuditLog.js')
  const logs = await AuditLog.find({ targetUser: req.params.id })
    .populate({ path: 'admin', select: 'fullName email role profileImageUrl' })
    .sort({ createdAt: -1 })
    .lean()
  return sendSuccess(res, { data: { logs } })
})

/** Vendor: Update service radius and location */
export const updateVendorRadius = asyncHandler(async (req, res) => {
  const user = req.user
  if (user.role !== USER_ROLES.CONTRACTOR) {
    return sendError(res, { message: 'Only vendors can update their service radius', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const { serviceRadius, currentLatitude, currentLongitude, currentAddress } = req.body

  user.contractorProfile = user.contractorProfile || {}
  
  if (serviceRadius !== undefined) {
    user.contractorProfile.serviceRadius = serviceRadius === null ? null : Number(serviceRadius)
    user.contractorProfile.serviceRadiusUpdatedAt = new Date()
  }

  if (currentLatitude !== undefined && currentLongitude !== undefined) {
    user.contractorProfile.currentLatitude = Number(currentLatitude)
    user.contractorProfile.currentLongitude = Number(currentLongitude)
    user.contractorProfile.locationPoint = {
      type: 'Point',
      coordinates: [Number(currentLongitude), Number(currentLatitude)]
    }
  }

  if (currentAddress !== undefined) {
    user.contractorProfile.currentAddress = String(currentAddress).trim()
  }

  await user.save()

  // Trigger push notification to vendor to confirm update
  sendNotificationToUser(
    user._id.toString(),
    'Service Area Updated',
    `Your service area and location have been successfully updated.`,
    { url: '/vendor/profile' }
  )

  const safeUser = user.toSafeObject()
  return sendSuccess(res, { message: 'Service radius updated successfully', data: { user: safeUser } })
})
