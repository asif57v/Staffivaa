import mongoose from 'mongoose'
import { USER_ROLES } from '../constants/roles.js'
import { REQUEST_STATUS, ASSIGNMENT_STATUS, REQUEST_SOURCE } from '../constants/workforceConstants.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { Allocation } from '../models/Allocation.js'
import { Assignment } from '../models/Assignment.js'
import { User } from '../models/User.js'
import { SystemPricing } from '../models/SystemPricing.js'
import { SystemSettings } from '../models/SystemSettings.js'
import {
  deductWalletBalance,
  refundWalletBalance,
  recordLabourPlatformFeeDeduction,
} from '../services/walletDeductionService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { emitRequestStatusUpdate, getIO, emitToUser } from '../utils/socket.js'
import { logAudit } from '../utils/auditLogger.js'
import { triggerNotification } from '../utils/notificationTrigger.js'
import { triggerBookingNotif } from '../utils/triggerBookingNotif.js'
import {
  workerFoundNotif,
  newJobOfferNotif,
  labourJobAcceptedNotif,
  labourOfferTakenNotif,
  workerCancelledUnpaidNotif,
  workerCancelledResearchNotif,
  labourReassignedNotif,
  previousAssignmentCancelledNotif,
} from '../utils/bookingNotificationCopy.js'

export const createAllocationAdmin = asyncHandler(async (req, res) => {
  const { requestId, vendorId, labourIds, notes } = req.body
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    return sendError(res, { message: 'Invalid requestId', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  const request = await WorkforceRequest.findById(requestId)
  if (!request) return sendError(res, { message: 'Request not found', statusCode: HTTP_STATUS.NOT_FOUND })

  let allocation = await Allocation.findOne({ requestId })
  if (!allocation) {
    allocation = await Allocation.create({
      requestId,
      adminId: req.user._id,
      vendorId: vendorId && mongoose.Types.ObjectId.isValid(vendorId) ? vendorId : undefined,
      notes,
    })
  } else {
    if (vendorId) allocation.vendorId = vendorId
    if (notes != null) allocation.notes = notes
    allocation.adminId = req.user._id
    await allocation.save()
  }

  const ids = Array.isArray(labourIds) ? labourIds.filter((id) => mongoose.Types.ObjectId.isValid(id)) : []
  const assignments = []
  for (const labourId of ids) {
    const labour = await User.findOne({ _id: labourId, role: USER_ROLES.LABOUR, isActive: true })
    if (!labour) continue
    const existing = await Assignment.findOne({
      allocationId: allocation._id,
      labourId,
      status: { $nin: [ASSIGNMENT_STATUS.REPLACED, ASSIGNMENT_STATUS.DECLINED] },
    })
    if (existing) continue
    const line = request.lines?.[0]
    const assignment = await Assignment.create({
      allocationId: allocation._id,
      requestId: request._id,
      labourId,
      vendorId: labour.vendorId || allocation.vendorId,
      categoryId: line?.categoryId,
      status: ASSIGNMENT_STATUS.OFFERED,
    })
    assignments.push(assignment)
    emitToUser('labour', labourId.toString(), 'assignment_assigned', { assignmentId: assignment._id.toString() })
    
    await triggerNotification({
      userId: labourId,
      title: 'New Job Assigned',
      body: 'You have been assigned to a new job. Please check your schedule.',
      type: 'LABOUR_ASSIGNED',
      relatedId: assignment._id,
      relatedModel: 'Assignment'
    })
  }

  if (request.status === REQUEST_STATUS.PENDING_REVIEW || request.status === REQUEST_STATUS.CONFIRMED) {
    request.status = REQUEST_STATUS.ALLOCATING
    await request.save()
  }
  if (assignments.length) {
    request.status = REQUEST_STATUS.ASSIGNED
    await request.save()
  }

  // Log allocation creation audit
  await logAudit({
    adminId: req.user._id,
    action: 'Create Allocation',
    newValue: { requestId, vendorId, assignedLabourCount: assignments.length },
    module: 'Operations',
    req
  })

  sendSuccess(res, { data: { allocation, assignments } }, HTTP_STATUS.CREATED)
})

export const replaceAssignmentAdmin = asyncHandler(async (req, res) => {
  const { newLabourId, reason } = req.body
  const old = await Assignment.findById(req.params.id)
  if (!old) return sendError(res, { message: 'Assignment not found', statusCode: HTTP_STATUS.NOT_FOUND })
  old.status = ASSIGNMENT_STATUS.REPLACED
  old.replaceReason = reason
  old.replacedBy = req.user._id
  await old.save()

  const labour = await User.findOne({ _id: newLabourId, role: USER_ROLES.LABOUR })
  if (!labour) return sendError(res, { message: 'Labour not found', statusCode: HTTP_STATUS.NOT_FOUND })

  const assignment = await Assignment.create({
    allocationId: old.allocationId,
    requestId: old.requestId,
    labourId: newLabourId,
    vendorId: labour.vendorId,
    categoryId: old.categoryId,
    status: ASSIGNMENT_STATUS.OFFERED,
    replacedAssignmentId: old._id,
  })
  
  emitToUser('labour', newLabourId.toString(), 'assignment_assigned', { assignmentId: assignment._id.toString() })
  await triggerBookingNotif({
    userId: newLabourId,
    copy: labourReassignedNotif(),
    relatedId: assignment._id,
    relatedModel: 'Assignment',
    url: '/app/jobs',
  }).catch(() => {})
  emitToUser('labour', old.labourId.toString(), 'assignment_cancelled', { assignmentId: old._id.toString() })
  triggerBookingNotif({
    userId: old.labourId,
    copy: previousAssignmentCancelledNotif(),
    relatedId: old._id,
    relatedModel: 'Assignment',
    url: '/app/jobs',
  }).catch(() => {})
  
  sendSuccess(res, { data: { assignment, replaced: old } })
})

export const listLabourAssignments = asyncHandler(async (req, res) => {
  const filter = { labourId: req.user._id }
  if (req.query.status) filter.status = req.query.status
  const assignments = await Assignment.find(filter)
    .sort({ createdAt: -1 })
    .populate({
      path: 'requestId',
      populate: [
        { path: 'clientId', select: 'fullName phone corporateProfile companyName' },
        { path: 'lines.categoryId', select: 'name' },
        { path: 'projectId', select: 'name' },
        { path: 'siteId', select: 'address' }
      ]
    })
    .populate('vendorId', 'fullName contractorProfile')
    .populate('categoryId', 'name')
    .lean()

  const now = new Date()
  const validAssignments = assignments.filter(a => {
    if (!a.requestId) return false
    
    // If the assignment is merely an open OFFER, we must strictly check request validity
    if (a.status === ASSIGNMENT_STATUS.OFFERED) {
      const reqStatus = String(a.requestId.status || '').toLowerCase()
      if (reqStatus === 'cancelled' || reqStatus === 'rejected') return false
      
      // If it's an individual request searching for labour, it must not be expired
      if (reqStatus === 'searching') {
        if (a.requestId.expiresAt && new Date(a.requestId.expiresAt) <= now) {
          return false
        }
      }
      
      // If the request has already been accepted by someone else or moved forward
      const validOfferStatuses = [
        'searching',
        'allocating',
        'assigned',
        'confirmed',
        'pending_review',
        'offered'
      ]
      if (!validOfferStatuses.includes(reqStatus)) {
        return false
      }
    }
    
    return true
  })

  // Refresh unpaid labour platform fees from live admin pricing
  try {
    const pricing = await SystemPricing.findOne().lean()
    const { computeLabourPlatformFee, estimateRequestLabourCost } = await import('../utils/platformFeePricing.js')
    const updates = []
    for (const a of validAssignments) {
      const req = a.requestId
      if (!req || typeof req !== 'object') continue
      if (req.labourPaymentStatus === 'paid') continue
      if (!['platform_fee_pending', 'accepted', 'confirmed'].includes(req.status)) continue

      const liveFee = computeLabourPlatformFee(pricing, {
        distanceKm: req.distanceKm || 0,
        estimatedTotalLabourCost: estimateRequestLabourCost(req),
      })
      if (Number(req.labourPlatformFee) !== liveFee) {
        req.labourPlatformFee = liveFee
        updates.push(WorkforceRequest.updateOne({ _id: req._id }, { $set: { labourPlatformFee: liveFee } }))
      }
    }
    if (updates.length) await Promise.all(updates)
  } catch (err) {
    console.error('Failed to refresh live labour platform fees:', err.message)
  }

  const [settingsDoc, labourUser] = await Promise.all([
    SystemSettings.findOne({ singletonId: 'SYSTEM_SETTINGS' }).select('minimumLabourWalletBalance').lean(),
    User.findById(req.user._id).select('walletBalance isWalletFrozen').lean(),
  ])

  const minimumRequired = settingsDoc?.minimumLabourWalletBalance ?? 0
  const balance = labourUser?.walletBalance ?? 0
  const gateAmount = minimumRequired

  sendSuccess(res, {
    data: {
      assignments: validAssignments,
      walletPolicy: {
        balance,
        minimumRequired,
        requiredBalance: gateAmount,
        isFrozen: Boolean(labourUser?.isWalletFrozen),
        canAcceptBookings:
          !labourUser?.isWalletFrozen &&
          (minimumRequired <= 0 || balance >= minimumRequired),
      },
    },
  })
})

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2-lat1); 
  const dLon = deg2rad(lon2-lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

async function resolveDistanceKmForRequest(request, labourLat, labourLng) {
  let distanceKm = 8.5
  let reqLat = request.locationLat
  let reqLng = request.locationLng

  if ((!reqLat || !reqLng) && request.locationText) {
    try {
      const apiKey = 'AIzaSyCV6QreLE4QR76xie0BI3B9y2wY4awcPP8'
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(request.locationText)}&key=${apiKey}`
      const mapRes = await fetch(url)
      const data = await mapRes.json()
      if (data?.results?.length > 0) {
        reqLat = data.results[0].geometry.location.lat
        reqLng = data.results[0].geometry.location.lng
        request.locationLat = reqLat
        request.locationLng = reqLng
      }
    } catch (err) {
      console.error('Backend Geocoding failed:', err.message)
    }
  }

  if (reqLat && reqLng && labourLat && labourLng) {
    distanceKm = getDistanceFromLatLonInKm(reqLat, reqLng, labourLat, labourLng)
  }

  return Math.round(distanceKm * 10) / 10
}

export const respondToAssignment = asyncHandler(async (req, res) => {
  const { action, labourLat, labourLng } = req.body
  const assignment = await Assignment.findOne({ _id: req.params.id, labourId: req.user._id })
  if (!assignment) return sendError(res, { message: 'Not found', statusCode: HTTP_STATUS.NOT_FOUND })
  if (action === 'accept') {
    if (assignment.status !== ASSIGNMENT_STATUS.OFFERED) {
      return sendError(res, {
        message: 'This job offer is no longer available.',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'OFFER_UNAVAILABLE',
      })
    }

    const labourUser = await User.findById(req.user._id)
    if (labourUser && labourUser.labourProfile?.availabilityStatus === 'offline') {
      labourUser.labourProfile.availabilityStatus = 'available'
      await labourUser.save()
    }

    const activeAssignments = await Assignment.find({
      labourId: req.user._id,
      status: { $in: [ASSIGNMENT_STATUS.ACCEPTED, ASSIGNMENT_STATUS.ON_SITE] },
      _id: { $ne: req.params.id }
    }).populate('requestId');

    const hasRealActive = activeAssignments.some(a => a.requestId != null);

    if (hasRealActive) {
      return sendError(res, { message: 'You already have an active job. Please complete or cancel it before accepting a new one.', statusCode: HTTP_STATUS.BAD_REQUEST });
    }

    const existingRequest = await WorkforceRequest.findById(assignment.requestId)
    if (!existingRequest) {
      return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
    }

    const distanceKm = await resolveDistanceKmForRequest(existingRequest, labourLat, labourLng)
    const pricing = await SystemPricing.findOne().lean()
    const { computeLabourPlatformFee, estimateRequestLabourCost } = await import('../utils/platformFeePricing.js')
    const estimatedTotalLabourCost = estimateRequestLabourCost(existingRequest)
    const labourFee = computeLabourPlatformFee(pricing, {
      distanceKm,
      estimatedTotalLabourCost,
    })

    const settingsDoc = await SystemSettings.findOne({ singletonId: 'SYSTEM_SETTINGS' }).lean()
    const minimumRequired = settingsDoc?.minimumLabourWalletBalance ?? 0
    const walletBalance = Number(labourUser?.walletBalance) || 0
    const gateAmount = Math.max(Number(minimumRequired) || 0, Number(labourFee) || 0)

    if (labourUser?.isWalletFrozen) {
      return sendError(res, {
        message: 'Your wallet is frozen. Contact support to accept bookings.',
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: 'WALLET_FROZEN',
      })
    }

    if (gateAmount > 0 && walletBalance < gateAmount) {
      return sendError(res, {
        message: `Insufficient wallet balance. You need at least ₹${gateAmount.toLocaleString('en-IN')} to accept this job.`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INSUFFICIENT_WALLET_BALANCE',
        errors: {
          balance: walletBalance,
          minimumRequired,
          platformFee: labourFee,
          requiredBalance: gateAmount,
        },
      })
    }

    let feeDeduction = null
    if (labourFee > 0) {
      feeDeduction = await deductWalletBalance({ userId: req.user._id, amount: labourFee })
      if (!feeDeduction.success) {
        return sendError(res, {
          message: 'Insufficient wallet balance. Recharge to accept bookings.',
          statusCode: HTTP_STATUS.BAD_REQUEST,
          code: 'INSUFFICIENT_WALLET_BALANCE',
          errors: {
            balance: walletBalance,
            minimumRequired,
            platformFee: labourFee,
          },
        })
      }
    }

    assignment.status = ASSIGNMENT_STATUS.ACCEPTED
    assignment.acceptedAt = new Date()

    const isIndividual = existingRequest.sourceType === REQUEST_SOURCE.INDIVIDUAL
    const isUserPaid =
      isIndividual ||
      existingRequest.userPaymentStatus === 'paid' ||
      existingRequest.paymentStatus === 'paid'
    const isLabourPaid = labourFee === 0 || Boolean(feeDeduction?.success)

    let nextStatus = REQUEST_STATUS.PLATFORM_FEE_PENDING
    let nextLifecycle = isUserPaid ? 'partial' : 'none'
    if (isLabourPaid && isUserPaid) {
      nextStatus = REQUEST_STATUS.CONFIRMED
      nextLifecycle = 'completed'
    }

    const requestUpdate = {
      status: nextStatus,
      labourId: req.user._id,
      labourName: req.user.fullName,
      labourPhone: req.user.phone,
      acceptedAt: new Date(),
      acceptedBy: req.user._id,
      platformFeePendingAt: new Date(),
      platformFeePaymentLifecycle: nextLifecycle,
      distanceKm,
      labourPlatformFee: labourFee,
    }

    if (isLabourPaid) {
      requestUpdate.labourPaymentStatus = 'paid'
    }
    if (isIndividual) {
      requestUpdate.userPaymentStatus = 'paid'
      requestUpdate.userPlatformFee = 0
    }

    if (labourLat != null && labourLng != null) {
      requestUpdate.currentLocation = {
        lat: Number(labourLat),
        lng: Number(labourLng),
        heading: 0,
        speed: 0,
        updatedAt: new Date(),
      }
    }

    const acceptableRequestStatuses = [
      REQUEST_STATUS.SEARCHING,
      REQUEST_STATUS.ALLOCATING,
      REQUEST_STATUS.ASSIGNED,
      REQUEST_STATUS.PENDING_REVIEW,
    ]

    let request = await WorkforceRequest.findOneAndUpdate(
      {
        _id: assignment.requestId,
        status: { $in: acceptableRequestStatuses },
        $or: [{ labourId: null }, { labourId: { $exists: false } }],
        $and: [
          {
            $or: [
              { status: { $ne: REQUEST_STATUS.SEARCHING } },
              { expiresAt: { $gt: new Date() } },
              { expiresAt: { $exists: false } },
            ],
          },
        ],
      },
      { $set: requestUpdate },
      { new: true },
    )

    if (!request) {
      if (feeDeduction?.success && feeDeduction.amount > 0) {
        await refundWalletBalance({ userId: req.user._id, amount: feeDeduction.amount })
      }
      return sendError(res, {
        message: 'This job was already taken by another worker or has expired. Please wait for the next offer.',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'BOOKING_UNAVAILABLE',
      })
    }

    if (feeDeduction?.success && feeDeduction.amount > 0) {
      await recordLabourPlatformFeeDeduction({
        userId: req.user._id,
        userName: labourUser?.fullName || req.user.fullName,
        bookingId: request._id,
        amount: feeDeduction.amount,
        balanceAfter: feeDeduction.balanceAfter,
      })
    }

    const reqRef = request.reference || request._id.toString().slice(-6)
    let categoryName = 'job'
    try {
      const LabourCategory = mongoose.model('LabourCategory')
      const catId = assignment.categoryId || request.lines?.[0]?.categoryId
      if (catId) {
        const catDoc = await LabourCategory.findById(catId).select('name').lean()
        if (catDoc?.name) categoryName = catDoc.name
      }
    } catch {
      /* ignore */
    }

    const otherOffers = await Assignment.find({
      requestId: request._id,
      status: ASSIGNMENT_STATUS.OFFERED,
      labourId: { $ne: req.user._id },
    }).select('_id labourId').lean()

    if (otherOffers.length) {
      await Assignment.updateMany(
        { _id: { $in: otherOffers.map((o) => o._id) } },
        { $set: { status: ASSIGNMENT_STATUS.CANCELLED } },
      )
      for (const offer of otherOffers) {
        emitToUser('labour', offer.labourId.toString(), 'assignment_cancelled', {
          assignmentId: offer._id.toString(),
          reason: 'taken_by_other',
          requestId: request._id.toString(),
        })
        triggerBookingNotif({
          userId: offer.labourId,
          copy: labourOfferTakenNotif(),
          relatedId: offer._id,
          relatedModel: 'Assignment',
          requestId: request._id,
        }).catch(() => {})
      }
    }

    try {
      const io = getIO()
      io.emit('bookingAcceptedGlobal', { requestId: request._id.toString() })
      emitToUser('individual', request.clientId?.toString(), 'request_updated', { requestId: request._id.toString() })

      if (request.clientId) {
        triggerBookingNotif({
          userId: request.clientId,
          copy: workerFoundNotif(req.user.fullName),
          relatedId: request._id,
          relatedModel: 'WorkforceRequest',
          requestId: request._id,
        }).catch((err) => console.error('[Notification Error]:', err.message))
      }

      triggerBookingNotif({
        userId: req.user._id,
        copy: labourJobAcceptedNotif({
          categoryName,
          reference: reqRef,
          platformFee: labourFee,
        }),
        relatedId: assignment._id,
        relatedModel: 'Assignment',
        requestId: request._id,
      }).catch((err) => console.error('[Notification Error]:', err.message))

      emitToUser('labour', req.user._id.toString(), 'assignment_accepted', { assignmentId: assignment._id.toString() })
      io.to(`request_${request._id.toString()}`).emit('bookingAccepted', {
        status: request.status,
        labourId: request.labourId,
        labourName: request.labourName,
        labourPhone: request.labourPhone,
        acceptedAt: request.acceptedAt,
        distanceKm: request.distanceKm,
        labourPlatformFee: request.labourPlatformFee,
        labourPaymentStatus: request.labourPaymentStatus,
        estimatedArrival: '30 mins',
      })
    } catch (err) {
      console.error('Socket emit error:', err)
    }
  } else if (action === 'decline') {
    assignment.status = ASSIGNMENT_STATUS.DECLINED
    emitToUser('labour', req.user._id.toString(), 'assignment_rejected', { assignmentId: assignment._id.toString() })
    emitRequestStatusUpdate(assignment.requestId.toString(), {
      event: 'status_changed',
      assignmentStatus: assignment.status,
      updatedAt: new Date()
    })
  } else if (action === 'cancel') {
    if (![ASSIGNMENT_STATUS.ACCEPTED, ASSIGNMENT_STATUS.ON_SITE].includes(assignment.status)) {
      return sendError(res, { message: 'Can only cancel active assignments.', statusCode: HTTP_STATUS.BAD_REQUEST })
    }
    assignment.status = ASSIGNMENT_STATUS.CANCELLED
    assignment.cancelledAt = new Date()

    const request = await WorkforceRequest.findById(assignment.requestId)
    if (request) {
      const isUserPaid = request.userPaymentStatus === 'paid' || request.paymentStatus === 'paid'
      const isLabourPaid = request.labourPaymentStatus === 'paid'

      // Neither party paid → cancel the whole booking (no re-search)
      if (!isUserPaid && !isLabourPaid) {
        request.status = REQUEST_STATUS.CANCELLED
        request.cancelReason = 'labour_cancelled_unpaid'
        request.labourId = null
        request.labourName = null
        request.labourPhone = null
        request.acceptedAt = null
        request.acceptedBy = null
        request.platformFeePendingAt = null
        request.platformFeePaymentLifecycle = 'none'
        await request.save()

        await Assignment.updateMany(
          { requestId: request._id, _id: { $ne: assignment._id } },
          { $set: { status: ASSIGNMENT_STATUS.CANCELLED } },
        )

        const cancelPayload = {
          requestId: request._id.toString(),
          reference: request.reference || null,
          fullCancel: true,
          reason: 'labour_cancelled_unpaid',
          message: 'Worker cancelled the booking.',
        }

        try {
          const io = getIO()
          const clientId = request.clientId?.toString()
          io.to(`request_${request._id.toString()}`).emit('booking_cancelled', cancelPayload)
          io.to(`request_${request._id.toString()}`).emit('bookingCancelledByLabour', cancelPayload)
          if (clientId) {
            emitToUser('individual', clientId, 'booking_cancelled', cancelPayload)
            emitToUser('individual', clientId, 'bookingCancelledByLabour', cancelPayload)
            emitToUser('individual', clientId, 'request_cancelled', cancelPayload)
            triggerBookingNotif({
              userId: clientId,
              copy: workerCancelledUnpaidNotif(),
              relatedId: request._id,
              relatedModel: 'WorkforceRequest',
              requestId: request._id,
            }).catch(() => {})
          }
          emitRequestStatusUpdate(request._id.toString(), {
            requestStatus: REQUEST_STATUS.CANCELLED,
            event: 'status_changed',
            assignmentStatus: assignment.status,
            fullCancel: true,
            updatedAt: new Date(),
          })
        } catch (err) {
          console.error('Socket emit error on unpaid labour cancel:', err)
        }

        await assignment.save()
        const updatedRequest = await WorkforceRequest.findById(assignment.requestId).lean()
        return sendSuccess(res, { data: { assignment: assignment.toObject(), request: updatedRequest } })
      }

      request.status = REQUEST_STATUS.SEARCHING
      request.labourId = null
      request.labourName = null
      request.labourPhone = null
      request.acceptedAt = null
      request.acceptedBy = null
      request.platformFeePendingAt = null
      request.labourPaymentStatus = 'pending'
      request.labourRazorpayOrderId = null
      
      // Extend expiration timer by 10 minutes so listLabourAssignments does not filter it out
      request.expiresAt = new Date(Date.now() + 10 * 60 * 1000)
      
      if (isUserPaid) {
        request.platformFeePaymentLifecycle = 'partial'
      } else {
        request.platformFeePaymentLifecycle = 'none'
      }
      await request.save()

      // --- RE-BROADCAST REAL-TIME SEARCH TO ALL NEARBY WORKERS ---
      const categoryId = request.lines?.[0]?.categoryId
      const clientUser = await User.findById(request.clientId).select('fullName').lean()
      
      // Fetch candidate workers (excluding cancelling worker initially)
      let candidates = await User.find({
        role: USER_ROLES.LABOUR,
        _id: { $ne: req.user._id },
        $or: [
          ...(categoryId ? [{ 'labourProfile.categoryIds': categoryId }, { 'labourProfile.categoryIds': categoryId.toString() }] : []),
          { 'labourProfile.categoryIds': { $size: 0 } },
          { 'labourProfile.categoryIds': { $exists: false } }
        ]
      }).limit(50)

      // Fallback 1: If no candidate matched skill query, grab all other labour workers
      if (!candidates || candidates.length === 0) {
        candidates = await User.find({
          role: USER_ROLES.LABOUR,
          _id: { $ne: req.user._id }
        }).limit(50)
      }

      // Fallback 2: If STILL no candidate (e.g. single worker testing environment), include all labour workers
      if (!candidates || candidates.length === 0) {
        candidates = await User.find({
          role: USER_ROLES.LABOUR
        }).limit(50)
      }

      let matchingWorkers = []
      if (request.locationLat && request.locationLng && candidates.length > 0) {
        matchingWorkers = candidates.filter(w => {
          if (!w.labourProfile || w.labourProfile.locationLat == null || w.labourProfile.locationLng == null) {
            return false
          }
          const radius = Number(w.labourProfile.workRadius) || 15
          const R = 6371
          const dLat = (w.labourProfile.locationLat - request.locationLat) * (Math.PI / 180)
          const dLon = (w.labourProfile.locationLng - request.locationLng) * (Math.PI / 180)
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(request.locationLat * (Math.PI / 180)) * Math.cos(w.labourProfile.locationLat * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
          const distanceKm = R * c
          const isWithinRadius = distanceKm <= radius
          console.log(
            `[ReallocationMatching] Worker ${w._id} distance: ${distanceKm.toFixed(2)} km, workRadius: ${radius} km -> ${isWithinRadius ? 'MATCHED' : 'OUT_OF_RADIUS'}`
          )
          return isWithinRadius
        })
      } else {
        matchingWorkers = candidates
      }

      if (matchingWorkers.length > 0) {
        await Assignment.deleteMany({ requestId: request._id, status: { $ne: ASSIGNMENT_STATUS.CANCELLED } })

        let allocation = await Allocation.findOne({ requestId: request._id })
        if (!allocation) {
          allocation = await Allocation.create({ requestId: request._id, notes: 'Re-allocated on worker cancellation' })
        }

        const LabourCategory = mongoose.model('LabourCategory')
        const category = categoryId ? await LabourCategory.findById(categoryId) : null
        const baseRate = category?.baseRate || 800

        const assignmentsToCreate = matchingWorkers.map((w) => ({
          allocationId: allocation._id,
          requestId: request._id,
          labourId: w._id,
          categoryId: categoryId || undefined,
          status: ASSIGNMENT_STATUS.OFFERED,
          perDayRate: baseRate,
        }))

        const createdAssignments = await Assignment.insertMany(assignmentsToCreate)

        createdAssignments.forEach((newAss) => {
          emitToUser('labour', newAss.labourId.toString(), 'assignment_assigned', {
            assignmentId: newAss._id.toString(),
            type: 'new_order',
            requestId: request._id.toString(),
            clientName: clientUser?.fullName || 'Customer',
            locationText: request.locationText || '',
            categoryName: category?.name || 'Worker',
            perDayRate: baseRate,
            startDate: request.startDate,
            shiftStart: request.shiftStart || '',
            shiftEnd: request.shiftEnd || '',
            timeoutSeconds: 90
          })
          triggerBookingNotif({
            userId: newAss.labourId,
            copy: newJobOfferNotif({
              customerName: clientUser?.fullName,
              categoryName: category?.name,
              locationText: request.locationText,
            }),
            relatedId: newAss._id,
            relatedModel: 'Assignment',
            requestId: request._id,
          }).catch(err => console.error('[Notification Error]:', err.message));
        })

        try {
          const io = getIO()
          io.emit('bookingAcceptedGlobal', { requestId: request._id.toString() })
        } catch (err) {}
      }

      try {
        const io = getIO()
        const reSearchPayload = {
          requestId: request._id.toString(),
          fullCancel: false,
          message: 'The assigned worker had to cancel. We are finding a new worker for you immediately.',
        }
        io.to(`request_${request._id.toString()}`).emit('bookingCancelledByLabour', reSearchPayload)
        emitToUser('individual', request.clientId?.toString(), 'bookingCancelledByLabour', reSearchPayload)
        emitToUser('individual', request.clientId?.toString(), 'request_updated', { requestId: request._id.toString() })
        if (request.clientId) {
          triggerBookingNotif({
            userId: request.clientId,
            copy: workerCancelledResearchNotif(),
            relatedId: request._id,
            relatedModel: 'WorkforceRequest',
            requestId: request._id,
          }).catch(() => {})
        }
        emitRequestStatusUpdate(request._id.toString(), {
          requestStatus: REQUEST_STATUS.SEARCHING,
          event: 'status_changed',
          assignmentStatus: assignment.status,
          updatedAt: new Date()
        })
      } catch (err) {
        console.error('Socket emit error:', err)
      }
    }
  } else {
    return sendError(res, { message: 'Invalid action', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  await assignment.save()
  const updatedRequest = await WorkforceRequest.findById(assignment.requestId).lean();
  sendSuccess(res, { data: { assignment: assignment.toObject(), request: updatedRequest } })
})
