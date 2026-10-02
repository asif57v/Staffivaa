import mongoose from 'mongoose'
import { USER_ROLES } from '../constants/roles.js'
import { REQUEST_SOURCE, REQUEST_STATUS, ASSIGNMENT_STATUS } from '../constants/workforceConstants.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { Assignment } from '../models/Assignment.js'
import { Allocation } from '../models/Allocation.js'
import { User } from '../models/User.js'
import { SystemSettings } from '../models/SystemSettings.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { emitToUser, emitToRole } from '../utils/socket.js'
import { triggerNotification } from '../utils/notificationTrigger.js'
import { triggerBookingNotif } from '../utils/triggerBookingNotif.js'
import { newJobOfferNotif } from '../utils/bookingNotificationCopy.js'
import { logAudit } from '../utils/auditLogger.js'

const ACTIVE_ASSIGNMENT_STATUSES = [ASSIGNMENT_STATUS.ACCEPTED, ASSIGNMENT_STATUS.ON_SITE, ASSIGNMENT_STATUS.IN_PROGRESS]

const TAB_STATUS_FILTERS = {
  awaiting: [REQUEST_STATUS.SEARCHING],
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
  const requestId = request._id.toString()
  emitToRole('admin', 'individual_booking_pending', {
    requestId,
    reference: request.reference,
    clientName: clientName || 'Customer',
    locationText: request.locationText || '',
    reason,
  })

  const title = reason === 'worker_cancelled' ? 'Booking needs re-assignment 🔁' : 'New Individual Booking 🛠️'
  const body =
    reason === 'worker_cancelled'
      ? `Worker cancelled booking ${request.reference || requestId.slice(-6)}. Please assign a new worker.`
      : `${clientName || 'A customer'} created booking ${request.reference || requestId.slice(-6)} (${request.locationText || 'location pending'}). Assign a worker.`

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
  const [awaiting, active] = await Promise.all([
    WorkforceRequest.countDocuments({ ...baseCountFilter, status: { $in: TAB_STATUS_FILTERS.awaiting } }),
    WorkforceRequest.countDocuments({ ...baseCountFilter, status: { $in: TAB_STATUS_FILTERS.active } }),
  ])

  sendSuccess(res, {
    data: {
      requests: requests.map((r) => ({ ...r, assignments: byRequest[r._id.toString()] || [] })),
      counts: { awaiting, active },
    },
  })
})

/** GET /admin/workforce/individual-bookings/:id/workers?all=true&search= */
export const listEligibleWorkersAdmin = asyncHandler(async (req, res) => {
  const request = await WorkforceRequest.findById(req.params.id).lean()
  if (!request) return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })

  const categoryId = request.lines?.[0]?.categoryId
  const showAll = String(req.query.all) === 'true'
  const search = String(req.query.search || '').trim()

  const filter = { role: USER_ROLES.LABOUR, isActive: true }
  const and = []
  if (!showAll && categoryId) {
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

  const [workers, settingsDoc] = await Promise.all([
    User.find(filter)
      .select('fullName phone profileImageUrl walletBalance isWalletFrozen labourProfile')
      .limit(300)
      .lean(),
    SystemSettings.findOne({ singletonId: 'SYSTEM_SETTINGS' }).select('minimumLabourWalletBalance').lean(),
  ])

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
  const catIdStr = categoryId ? categoryId.toString() : null

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

  sendSuccess(res, { data: { workers: items, minimumWalletBalance: minimumRequired } })
})

/** POST /admin/workforce/individual-bookings/:id/assign  { labourIds: string[] } */
export const assignWorkersToIndividualBookingAdmin = asyncHandler(async (req, res) => {
  const request = await WorkforceRequest.findById(req.params.id)
  if (!request) return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  if (request.sourceType !== REQUEST_SOURCE.INDIVIDUAL) {
    return sendError(res, { message: 'Only individual bookings can be assigned here.', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  if (request.status !== REQUEST_STATUS.SEARCHING || request.labourId) {
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
