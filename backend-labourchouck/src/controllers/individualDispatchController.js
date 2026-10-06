import mongoose from 'mongoose'
import { USER_ROLES } from '../constants/roles.js'
import {
  REQUEST_SOURCE,
  REQUEST_STATUS,
  ASSIGNMENT_STATUS,
  INDIVIDUAL_SEARCH_SECONDS,
  INDIVIDUAL_SEARCH_MIN_SECONDS,
  INDIVIDUAL_SEARCH_MAX_SECONDS,
} from '../constants/workforceConstants.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { Assignment } from '../models/Assignment.js'
import { Allocation } from '../models/Allocation.js'
import { User } from '../models/User.js'
import { SystemSettings } from '../models/SystemSettings.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { emitToUser, emitToRole, getIO } from '../utils/socket.js'
import { triggerNotification } from '../utils/notificationTrigger.js'
import { triggerBookingNotif } from '../utils/triggerBookingNotif.js'
import { newJobOfferNotif, searchExpiredUserNotif, bookingAdminAcceptedNotif } from '../utils/bookingNotificationCopy.js'
import { logAudit } from '../utils/auditLogger.js'

const ACTIVE_ASSIGNMENT_STATUSES = [ASSIGNMENT_STATUS.ACCEPTED, ASSIGNMENT_STATUS.ON_SITE, ASSIGNMENT_STATUS.IN_PROGRESS]

const TAB_STATUS_FILTERS = {
  awaiting: [REQUEST_STATUS.SEARCHING, REQUEST_STATUS.ADMIN_ACCEPTED],
  active: [
    REQUEST_STATUS.ACCEPTED,
    REQUEST_STATUS.CONFIRMED,
    REQUEST_STATUS.PLATFORM_FEE_PENDING,
    REQUEST_STATUS.ON_SITE,
    REQUEST_STATUS.IN_PROGRESS,
    REQUEST_STATUS.ASSIGNED,
  ],
  completed: [REQUEST_STATUS.COMPLETED],
  cancelled: [REQUEST_STATUS.CANCELLED, REQUEST_STATUS.REJECTED],
}

const SEARCH_EXPIRED_REASON = 'search_expired'

/** Admin-configured accept window (seconds) for new / retried individual bookings. */
export async function getIndividualSearchWindowSeconds() {
  const doc = await SystemSettings.findOne({ singletonId: 'SYSTEM_SETTINGS' }).select('individualAcceptWindowSeconds').lean()
  const secs = Number(doc?.individualAcceptWindowSeconds)
  if (!Number.isFinite(secs) || secs < INDIVIDUAL_SEARCH_MIN_SECONDS || secs > INDIVIDUAL_SEARCH_MAX_SECONDS) {
    return INDIVIDUAL_SEARCH_SECONDS
  }
  return secs
}

/** Extra per-tab conditions: expired bookings are cancelled ones whose search window ran out. */
const TAB_EXTRA_FILTERS = {
  expired: { status: REQUEST_STATUS.CANCELLED, cancelReason: SEARCH_EXPIRED_REASON },
  cancelled: { cancelReason: { $ne: SEARCH_EXPIRED_REASON } },
}

function distanceKmBetween(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some((v) => v == null || !Number.isFinite(Number(v)))) return null
  const R = 6371
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lng2 - lng1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10
}

/**
 * Notify every admin (socket + push) that an individual booking is waiting for manual worker assignment.
 */
export async function notifyAdminsIndividualBookingPending(request, { clientName, reason = 'created' } = {}) {
  const windowSeconds = await getIndividualSearchWindowSeconds()
  const windowText = windowSeconds % 60 === 0 ? `${windowSeconds / 60} min` : `${windowSeconds} seconds`
  const requestId = request._id.toString()
  emitToRole('admin', 'individual_booking_pending', {
    requestId,
    reference: request.reference,
    clientName: clientName || 'Customer',
    locationText: request.locationText || '',
    reason,
  })

  const ref = request.reference || requestId.slice(-6)
  const title =
    reason === 'worker_cancelled'
      ? 'Booking needs re-assignment 🔁'
      : reason === 'retry'
        ? 'Customer is searching again 🔁'
        : 'New Individual Booking 🛠️'
  const body =
    reason === 'worker_cancelled'
      ? `Worker cancelled booking ${ref}. Please assign a new worker.`
      : reason === 'retry'
        ? `${clientName || 'A customer'} retried expired booking ${ref} (${request.locationText || 'location pending'}). Accept it within ${windowText}.`
        : `${clientName || 'A customer'} created booking ${ref} (${request.locationText || 'location pending'}). Accept it within ${windowText}, then assign a worker.`

  const admins = await User.find({ role: USER_ROLES.ADMIN, isActive: true }).select('_id').lean()
  for (const admin of admins) {
    triggerNotification({
      userId: admin._id,
      title,
      body,
      type: 'INDIVIDUAL_BOOKING_PENDING',
      relatedId: request._id,
      relatedModel: 'WorkforceRequest',
      url: '/admin/individual-bookings',
      recipientRole: 'admin',
    }).catch((err) => console.error('[Admin Notification Error]:', admin._id, err.message))
  }
}

/**
 * Sends the same NEW_ORDER ring (socket popup + FCM) a worker used to receive from the auto-broadcast.
 */
async function ringWorkerForOffer({ request, assignment, worker, clientName, category, baseRate }) {
  const distanceKm =
    distanceKmBetween(
      worker?.labourProfile?.locationLat,
      worker?.labourProfile?.locationLng,
      request.locationLat,
      request.locationLng,
    ) ?? request.distanceKm

  emitToUser('labour', assignment.labourId.toString(), 'assignment_assigned', {
    assignmentId: assignment._id.toString(),
    type: 'new_order',
    requestId: request._id.toString(),
    clientName: clientName || 'Customer',
    locationText: request.locationText || '',
    locationLat: request.locationLat,
    locationLng: request.locationLng,
    distanceKm,
    categoryName: category?.name || 'Worker',
    perDayRate: baseRate,
    startDate: request.startDate,
    shiftStart: request.shiftStart || '',
    shiftEnd: request.shiftEnd || '',
    timeoutSeconds: 60,
  })

  await triggerBookingNotif({
    userId: assignment.labourId,
    copy: newJobOfferNotif({
      customerName: clientName,
      categoryName: category?.name,
      locationText: request.locationText,
    }),
    relatedId: assignment._id,
    relatedModel: 'Assignment',
    requestId: request._id,
    fcmExtra: {
      clientName: clientName || 'Customer',
      locationText: request.locationText || '',
      locationLat: request.locationLat != null ? String(request.locationLat) : '',
      locationLng: request.locationLng != null ? String(request.locationLng) : '',
      distanceKm: distanceKm != null ? String(distanceKm) : '',
      categoryName: category?.name || 'Worker',
      perDayRate: String(baseRate),
      timeoutSeconds: '60',
    },
  })
}

/** GET /admin/workforce/individual-bookings?tab=awaiting|active|completed|cancelled|all&search= */
export const listIndividualBookingsAdmin = asyncHandler(async (req, res) => {
  const tab = String(req.query.tab || 'awaiting')
  const filter = { sourceType: REQUEST_SOURCE.INDIVIDUAL, dispatchMode: 'admin' }
  if (TAB_STATUS_FILTERS[tab]) filter.status = { $in: TAB_STATUS_FILTERS[tab] }
  if (TAB_EXTRA_FILTERS[tab]) Object.assign(filter, TAB_EXTRA_FILTERS[tab])

  const search = String(req.query.search || '').trim()
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    const clients = await User.find({ $or: [{ fullName: rx }, { phone: rx }] }).select('_id').limit(100).lean()
    filter.$or = [
      { reference: rx },
      { locationText: rx },
      { labourName: rx },
      { clientId: { $in: clients.map((c) => c._id) } },
    ]
  }

  const requests = await WorkforceRequest.find(filter)
    .sort({ createdAt: tab === 'awaiting' ? 1 : -1 })
    .limit(200)
    .populate('clientId', 'fullName phone profileImageUrl')
    .populate('lines.categoryId', 'name baseRate')
    .lean()

  const assignments = await Assignment.find({ requestId: { $in: requests.map((r) => r._id) } })
    .sort({ createdAt: -1 })
    .populate('labourId', 'fullName phone profileImageUrl')
    .lean()

  const byRequest = {}
  for (const a of assignments) {
    const key = a.requestId.toString()
    ;(byRequest[key] ||= []).push(a)
  }

  const baseCountFilter = { sourceType: REQUEST_SOURCE.INDIVIDUAL, dispatchMode: 'admin' }
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const [awaiting, active, expired] = await Promise.all([
    WorkforceRequest.countDocuments({ ...baseCountFilter, status: { $in: TAB_STATUS_FILTERS.awaiting } }),
    WorkforceRequest.countDocuments({ ...baseCountFilter, status: { $in: TAB_STATUS_FILTERS.active } }),
    WorkforceRequest.countDocuments({
      ...baseCountFilter,
      ...TAB_EXTRA_FILTERS.expired,
      searchExpiredAt: { $gte: startOfToday },
    }),
  ])

  sendSuccess(res, {
    data: {
      requests: requests.map((r) => ({ ...r, assignments: byRequest[r._id.toString()] || [] })),
      counts: { awaiting, active, expired },
      searchWindowSeconds: await getIndividualSearchWindowSeconds(),
    },
  })
})

/**
 * GET /admin/workforce/individual-bookings/:id/workers?categoryId=<id|all>&radiusKm=&search=
 * categoryId defaults to the booking's skill; `all=true` (legacy) is the same as categoryId=all.
 * radiusKm limits to workers whose saved location is within that distance of the booking.
 */
export const listEligibleWorkersAdmin = asyncHandler(async (req, res) => {
  const request = await WorkforceRequest.findById(req.params.id).lean()
  if (!request) return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })

  const bookingCategoryId = request.lines?.[0]?.categoryId
  const rawCategory = String(req.query.categoryId || '').trim()
  const showAll = String(req.query.all) === 'true' || rawCategory === 'all'
  const categoryId = showAll
    ? null
    : mongoose.Types.ObjectId.isValid(rawCategory)
      ? new mongoose.Types.ObjectId(rawCategory)
      : bookingCategoryId
  const radiusKm = Number(req.query.radiusKm) > 0 ? Number(req.query.radiusKm) : null
  const search = String(req.query.search || '').trim()

  const filter = { role: USER_ROLES.LABOUR, isActive: true }
  const and = []
  if (radiusKm && request.locationLat != null && request.locationLng != null) {
    and.push({ 'labourProfile.locationLat': { $ne: null } }, { 'labourProfile.locationLng': { $ne: null } })
  }
  if (categoryId) {
    and.push({
      $or: [
        { 'labourProfile.categoryIds': categoryId },
        { 'labourProfile.categoryIds': categoryId.toString() },
        { 'labourProfile.categoryIds': { $size: 0 } },
        { 'labourProfile.categoryIds': { $exists: false } },
      ],
    })
  }
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    and.push({ $or: [{ fullName: rx }, { phone: rx }] })
  }
  if (and.length) filter.$and = and

  const LabourCategory = mongoose.model('LabourCategory')
  const [allWorkers, settingsDoc, categories] = await Promise.all([
    User.find(filter)
      .select('fullName phone profileImageUrl walletBalance isWalletFrozen labourProfile')
      .limit(500)
      .lean(),
    SystemSettings.findOne({ singletonId: 'SYSTEM_SETTINGS' }).select('minimumLabourWalletBalance').lean(),
    LabourCategory.find({ isActive: true }).select('name').sort({ sortOrder: 1, name: 1 }).lean(),
  ])

  const workers = radiusKm
    ? allWorkers.filter((w) => {
        const d = distanceKmBetween(
          w.labourProfile?.locationLat,
          w.labourProfile?.locationLng,
          request.locationLat,
          request.locationLng,
        )
        return d != null && d <= radiusKm
      })
    : allWorkers

  const workerIds = workers.map((w) => w._id)
  const [busy, existingForRequest] = await Promise.all([
    Assignment.find({ labourId: { $in: workerIds }, status: { $in: ACTIVE_ASSIGNMENT_STATUSES } })
      .select('labourId requestId')
      .lean(),
    Assignment.find({ requestId: request._id, labourId: { $in: workerIds } })
      .sort({ createdAt: -1 })
      .select('labourId status')
      .lean(),
  ])
  const busySet = new Set(busy.filter((a) => String(a.requestId) !== String(request._id)).map((a) => String(a.labourId)))
  const offerStatus = {}
  for (const a of existingForRequest) {
    if (!offerStatus[String(a.labourId)]) offerStatus[String(a.labourId)] = a.status
  }

  const minimumRequired = settingsDoc?.minimumLabourWalletBalance ?? 0
  const catIdStr = bookingCategoryId ? bookingCategoryId.toString() : null

  const items = workers
    .map((w) => {
      const lp = w.labourProfile || {}
      const distanceKm = distanceKmBetween(lp.locationLat, lp.locationLng, request.locationLat, request.locationLng)
      const workRadius = Number(lp.workRadius) || 15
      const catIds = (lp.categoryIds || []).map(String)
      const balance = Number(w.walletBalance) || 0
      return {
        _id: w._id,
        fullName: w.fullName,
        phone: w.phone,
        profileImageUrl: w.profileImageUrl,
        kycStatus: lp.kycStatus || 'pending',
        availabilityStatus: lp.availabilityStatus || 'offline',
        distanceKm,
        workRadius,
        withinRadius: distanceKm != null ? distanceKm <= workRadius : null,
        skillMatch: catIdStr ? catIds.includes(catIdStr) : false,
        walletBalance: balance,
        isWalletFrozen: Boolean(w.isWalletFrozen),
        walletOk: !w.isWalletFrozen && (minimumRequired <= 0 || balance >= minimumRequired),
        hasActiveJob: busySet.has(String(w._id)),
        offerStatus: offerStatus[String(w._id)] || null,
      }
    })
    .sort((a, b) => {
      if (a.skillMatch !== b.skillMatch) return a.skillMatch ? -1 : 1
      const da = a.distanceKm ?? Number.POSITIVE_INFINITY
      const db = b.distanceKm ?? Number.POSITIVE_INFINITY
      return da - db
    })

  sendSuccess(res, {
    data: {
      workers: items,
      minimumWalletBalance: minimumRequired,
      bookingCategoryId: bookingCategoryId ? bookingCategoryId.toString() : null,
      categories: categories.map((c) => ({ _id: c._id.toString(), name: c.name })),
    },
  })
})

/**
 * POST /admin/workforce/individual-bookings/:id/accept
 * Admin accepts a pending (searching) booking. Only valid while the search window is still open; stops the timer
 * (admin_accepted bookings are never picked up by the expiry job) and unlocks worker assignment.
 */
export const acceptIndividualBookingAdmin = asyncHandler(async (req, res) => {
  const existing = await WorkforceRequest.findById(req.params.id).select('sourceType dispatchMode status labourId').lean()
  if (!existing) return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  if (existing.sourceType !== REQUEST_SOURCE.INDIVIDUAL || existing.dispatchMode !== 'admin') {
    return sendError(res, { message: 'Only individual bookings can be accepted here.', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  if (existing.status === REQUEST_STATUS.ADMIN_ACCEPTED) {
    return sendError(res, {
      message: 'This booking is already accepted. Assign a worker.',
      statusCode: HTTP_STATUS.CONFLICT,
      code: 'BOOKING_ALREADY_ACCEPTED',
    })
  }
  if (existing.status === REQUEST_STATUS.CANCELLED) {
    return sendError(res, {
      message: 'This booking has expired or was cancelled.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'BOOKING_EXPIRED',
    })
  }
  if (existing.status !== REQUEST_STATUS.SEARCHING || existing.labourId) {
    return sendError(res, { message: 'This booking is no longer pending.', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const now = new Date()
  // Conditional update: wins/loses atomically against a double click, another admin, or the expiry job.
  const request = await WorkforceRequest.findOneAndUpdate(
    {
      _id: existing._id,
      status: REQUEST_STATUS.SEARCHING,
      labourId: null,
      $or: [
        { searchExpiresAt: { $gt: now } },
        // Bookings created before searchExpiresAt existed: window starts at creation.
        { searchExpiresAt: null, createdAt: { $gt: new Date(now.getTime() - INDIVIDUAL_SEARCH_SECONDS * 1000) } },
      ],
    },
    {
      $set: { status: REQUEST_STATUS.ADMIN_ACCEPTED, adminAcceptedAt: now, adminAcceptedBy: req.user._id },
      $unset: { searchExpiresAt: '', expiresAt: '' },
    },
    { new: true },
  )
  if (!request) {
    return sendError(res, {
      message: 'This booking expired or is no longer pending.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'BOOKING_EXPIRED',
    })
  }

  const requestId = request._id.toString()
  const payload = {
    requestId,
    reference: request.reference || null,
    status: REQUEST_STATUS.ADMIN_ACCEPTED,
    adminAcceptedAt: request.adminAcceptedAt,
    message: 'Admin is assigning a worker',
  }
  try {
    const io = getIO()
    io.to(`request_${requestId}`).emit('bookingAdminAccepted', payload)
    if (request.clientId) {
      emitToUser('individual', request.clientId.toString(), 'bookingAdminAccepted', payload)
      emitToUser('individual', request.clientId.toString(), 'request_updated', { requestId })
    }
  } catch (err) {
    console.error('Socket emit error on admin accept:', err)
  }
  emitToRole('admin', 'individual_booking_updated', { requestId, reason: 'admin_accepted' })

  if (request.clientId) {
    triggerBookingNotif({
      userId: request.clientId,
      copy: bookingAdminAcceptedNotif(),
      relatedId: request._id,
      relatedModel: 'WorkforceRequest',
      requestId: request._id,
    }).catch((err) => console.error('[Notification Error]:', err.message))
  }

  await logAudit({
    adminId: req.user._id,
    action: 'ACCEPT_INDIVIDUAL_BOOKING',
    module: 'workforce',
    newValue: { requestId: request._id },
    req,
  }).catch(() => {})

  sendSuccess(res, { data: { request }, message: 'Booking accepted. You can now assign a worker.' })
})

/**
 * POST /admin/workforce/individual-bookings/:id/extend  { seconds }
 * Adds time to a pending (searching) booking's accept window. The expiry job reads searchExpiresAt, so it
 * respects the new deadline automatically. Rejected once admin accepted or the window already ran out.
 */
export const extendIndividualBookingTimerAdmin = asyncHandler(async (req, res) => {
  const seconds = Math.round(Number(req.body?.seconds))
  if (!Number.isFinite(seconds) || seconds < 10 || seconds > INDIVIDUAL_SEARCH_MAX_SECONDS) {
    return sendError(res, {
      message: `Enter extra time between 10 seconds and ${INDIVIDUAL_SEARCH_MAX_SECONDS / 60} minutes.`,
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  const existing = await WorkforceRequest.findById(req.params.id).select('sourceType dispatchMode status labourId searchExpiresAt createdAt').lean()
  if (!existing) return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  if (existing.sourceType !== REQUEST_SOURCE.INDIVIDUAL || existing.dispatchMode !== 'admin') {
    return sendError(res, { message: 'Only individual bookings can be extended here.', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  if (existing.status !== REQUEST_STATUS.SEARCHING || existing.labourId) {
    return sendError(res, {
      message: existing.status === REQUEST_STATUS.ADMIN_ACCEPTED
        ? 'Booking is already accepted, so it has no timer.'
        : 'Only pending bookings can be extended.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'BOOKING_NOT_PENDING',
    })
  }

  const now = Date.now()
  // Legacy bookings without searchExpiresAt: window started at creation.
  const currentEnd = existing.searchExpiresAt
    ? new Date(existing.searchExpiresAt).getTime()
    : new Date(existing.createdAt).getTime() + INDIVIDUAL_SEARCH_SECONDS * 1000
  if (currentEnd <= now) {
    return sendError(res, {
      message: 'This booking has already expired.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'BOOKING_EXPIRED',
    })
  }
  // Cap the remaining time so repeated extends cannot exceed the max window.
  const nextEnd = new Date(Math.min(currentEnd + seconds * 1000, now + INDIVIDUAL_SEARCH_MAX_SECONDS * 1000))

  // Conditional on the deadline we read, so a concurrent extend/accept/expire is not clobbered.
  const request = await WorkforceRequest.findOneAndUpdate(
    {
      _id: existing._id,
      status: REQUEST_STATUS.SEARCHING,
      labourId: null,
      searchExpiresAt: existing.searchExpiresAt ? existing.searchExpiresAt : null,
    },
    { $set: { searchExpiresAt: nextEnd } },
    { new: true },
  )
  if (!request) {
    return sendError(res, {
      message: 'Booking changed or expired. Please refresh.',
      statusCode: HTTP_STATUS.CONFLICT,
      code: 'BOOKING_CHANGED',
    })
  }

  const requestId = request._id.toString()
  const payload = { requestId, reference: request.reference || null, searchExpiresAt: nextEnd.toISOString() }
  try {
    getIO().to(`request_${requestId}`).emit('bookingSearchExtended', payload)
    if (request.clientId) {
      emitToUser('individual', request.clientId.toString(), 'bookingSearchExtended', payload)
    }
  } catch (err) {
    console.error('Socket emit error on timer extend:', err)
  }
  emitToRole('admin', 'individual_booking_updated', { requestId, reason: 'timer_extended' })

  await logAudit({
    adminId: req.user._id,
    action: 'EXTEND_INDIVIDUAL_BOOKING_TIMER',
    module: 'workforce',
    newValue: { requestId: request._id, addedSeconds: seconds, searchExpiresAt: nextEnd },
    req,
  }).catch(() => {})

  sendSuccess(res, { data: { request }, message: 'Time added.' })
})

/** POST /admin/workforce/individual-bookings/:id/assign  { labourIds: string[] } */
export const assignWorkersToIndividualBookingAdmin = asyncHandler(async (req, res) => {
  const request = await WorkforceRequest.findById(req.params.id)
  if (!request) return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  if (request.sourceType !== REQUEST_SOURCE.INDIVIDUAL) {
    return sendError(res, { message: 'Only individual bookings can be assigned here.', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  if (request.status === REQUEST_STATUS.SEARCHING && !request.labourId) {
    return sendError(res, {
      message: 'Accept this booking first, then assign a worker.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'BOOKING_NOT_ADMIN_ACCEPTED',
    })
  }
  if (request.status !== REQUEST_STATUS.ADMIN_ACCEPTED || request.labourId) {
    return sendError(res, {
      message: 'This booking already has a worker or is no longer open for assignment.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  const labourIds = [...new Set((Array.isArray(req.body.labourIds) ? req.body.labourIds : []).map(String))].filter((id) =>
    mongoose.Types.ObjectId.isValid(id),
  )
  if (!labourIds.length) {
    return sendError(res, { message: 'Select at least one worker.', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const workers = await User.find({ _id: { $in: labourIds }, role: USER_ROLES.LABOUR, isActive: true })
  if (!workers.length) {
    return sendError(res, { message: 'No valid active workers selected.', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const categoryId = request.lines?.[0]?.categoryId
  const LabourCategory = mongoose.model('LabourCategory')
  const category = categoryId ? await LabourCategory.findById(categoryId) : null
  const baseRate = category?.baseRate || 800
  const client = await User.findById(request.clientId).select('fullName').lean()

  let allocation = await Allocation.findOne({ requestId: request._id })
  if (!allocation) {
    allocation = await Allocation.create({
      requestId: request._id,
      adminId: req.user._id,
      notes: 'Manually assigned by admin for individual booking',
    })
  } else if (!allocation.adminId) {
    allocation.adminId = req.user._id
    await allocation.save()
  }

  // Admin-dispatched bookings never auto-expire; an expiresAt in the past would block worker acceptance.
  request.expiresAt = undefined
  request.adminDispatchedAt = new Date()
  request.adminDispatchedBy = req.user._id
  await request.save()

  const offered = []
  for (const worker of workers) {
    // Re-ring an existing open offer instead of duplicating it.
    let assignment = await Assignment.findOne({
      requestId: request._id,
      labourId: worker._id,
      status: ASSIGNMENT_STATUS.OFFERED,
    })
    if (assignment) {
      assignment.offeredAt = new Date()
      await assignment.save()
    } else {
      assignment = await Assignment.create({
        allocationId: allocation._id,
        requestId: request._id,
        labourId: worker._id,
        categoryId,
        status: ASSIGNMENT_STATUS.OFFERED,
        perDayRate: baseRate,
      })
    }
    offered.push(assignment)

    try {
      await ringWorkerForOffer({ request, assignment, worker, clientName: client?.fullName, category, baseRate })
    } catch (err) {
      console.error('[AdminDispatch] Ring failed for worker', worker._id.toString(), err.message)
    }
  }

  console.log(`[AdminDispatch] Admin ${req.user._id} offered request ${request._id} to ${offered.length} worker(s)`)

  emitToRole('admin', 'individual_booking_updated', { requestId: request._id.toString() })

  await logAudit({
    adminId: req.user._id,
    action: 'ASSIGN_INDIVIDUAL_BOOKING',
    module: 'workforce',
    newValue: { requestId: request._id, labourIds: workers.map((w) => w._id) },
    req,
  }).catch(() => {})

  sendSuccess(res, {
    data: { assignments: offered },
    message: `Job offer sent to ${offered.length} worker${offered.length > 1 ? 's' : ''}.`,
  })
})

/** POST /admin/workforce/individual-bookings/assignments/:assignmentId/withdraw */
export const withdrawIndividualOfferAdmin = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.assignmentId)
  if (!assignment) return sendError(res, { message: 'Offer not found', statusCode: HTTP_STATUS.NOT_FOUND })
  if (assignment.status !== ASSIGNMENT_STATUS.OFFERED) {
    return sendError(res, { message: 'Only pending offers can be withdrawn.', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  assignment.status = ASSIGNMENT_STATUS.CANCELLED
  await assignment.save()

  emitToUser('labour', assignment.labourId.toString(), 'assignment_cancelled', {
    assignmentId: assignment._id.toString(),
    requestId: assignment.requestId.toString(),
    reason: 'withdrawn_by_admin',
  })
  emitToRole('admin', 'individual_booking_updated', { requestId: assignment.requestId.toString() })

  sendSuccess(res, { data: { assignment }, message: 'Offer withdrawn.' })
})

/**
 * Expires admin-dispatched individual bookings whose search window passed without a worker.
 * The booking is kept (cancelled + cancelReason search_expired) so admins can see it in the Expired tab,
 * and the customer can reopen it with "Try again".
 */
export async function expireIndividualSearches() {
  const due = await WorkforceRequest.find({
    sourceType: REQUEST_SOURCE.INDIVIDUAL,
    dispatchMode: 'admin',
    status: REQUEST_STATUS.SEARCHING,
    labourId: null,
    $or: [
      { searchExpiresAt: { $lte: new Date() } },
      // Bookings created before searchExpiresAt existed: window starts at creation.
      { searchExpiresAt: null, createdAt: { $lte: new Date(Date.now() - INDIVIDUAL_SEARCH_SECONDS * 1000) } },
    ],
  })
    .select('_id reference clientId')
    .lean()

  for (const booking of due) {
    // Conditional update so a worker accepting at the same moment wins.
    const expired = await WorkforceRequest.findOneAndUpdate(
      { _id: booking._id, status: REQUEST_STATUS.SEARCHING, labourId: null },
      { $set: { status: REQUEST_STATUS.CANCELLED, cancelReason: SEARCH_EXPIRED_REASON, searchExpiredAt: new Date() } },
      { new: true },
    )
    if (!expired) continue

    const openOffers = await Assignment.find({ requestId: booking._id, status: ASSIGNMENT_STATUS.OFFERED })
      .select('_id labourId')
      .lean()
    if (openOffers.length) {
      await Assignment.updateMany(
        { _id: { $in: openOffers.map((a) => a._id) } },
        { $set: { status: ASSIGNMENT_STATUS.CANCELLED } },
      )
      for (const offer of openOffers) {
        emitToUser('labour', offer.labourId.toString(), 'assignment_cancelled', {
          assignmentId: offer._id.toString(),
          requestId: booking._id.toString(),
          reason: SEARCH_EXPIRED_REASON,
        })
      }
    }

    const payload = {
      requestId: booking._id.toString(),
      reference: booking.reference || null,
      status: 'expired',
      reason: SEARCH_EXPIRED_REASON,
      message: 'No worker found in time',
    }
    if (booking.clientId) {
      emitToUser('individual', booking.clientId.toString(), 'bookingExpired', payload)
      const copy = searchExpiredUserNotif(booking.reference)
      triggerNotification({
        userId: booking.clientId,
        title: copy.title,
        body: copy.body,
        type: copy.type,
        relatedId: booking._id,
        relatedModel: 'WorkforceRequest',
        url: '/app/bookings',
      }).catch(() => {})
    }
    emitToRole('admin', 'individual_booking_updated', { requestId: booking._id.toString(), reason: SEARCH_EXPIRED_REASON })
    console.log(`[IndividualBooking] Search expired for ${booking.reference || booking._id}`)
  }
}

/**
 * POST /workforce/requests/:id/retry-search (customer)
 * Reopens an expired search (or extends a still-open one) for another accept window and re-alerts admins.
 */
export const retryIndividualSearch = asyncHandler(async (req, res) => {
  const request = await WorkforceRequest.findById(req.params.id)
  if (!request || String(request.clientId) !== String(req.user._id)) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  if (request.sourceType !== REQUEST_SOURCE.INDIVIDUAL || request.labourId) {
    return sendError(res, { message: 'This booking cannot be retried.', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const isExpired = request.status === REQUEST_STATUS.CANCELLED && request.cancelReason === SEARCH_EXPIRED_REASON
  if (!isExpired && request.status !== REQUEST_STATUS.SEARCHING) {
    return sendError(res, { message: 'This booking is no longer active.', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  request.status = REQUEST_STATUS.SEARCHING
  request.cancelReason = undefined
  request.searchExpiredAt = undefined
  const windowSeconds = await getIndividualSearchWindowSeconds()
  request.searchExpiresAt = new Date(Date.now() + windowSeconds * 1000)
  await request.save()

  notifyAdminsIndividualBookingPending(request, { clientName: req.user.fullName, reason: 'retry' }).catch((err) =>
    console.error('[Admin Notification Error]:', err.message),
  )
  emitToRole('admin', 'individual_booking_updated', { requestId: request._id.toString() })

  sendSuccess(res, {
    data: { request, searchWindowSeconds: windowSeconds },
    message: 'Searching again',
  })
})
