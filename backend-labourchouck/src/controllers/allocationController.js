import mongoose from 'mongoose'
import { USER_ROLES } from '../constants/roles.js'
import { REQUEST_STATUS, ASSIGNMENT_STATUS } from '../constants/workforceConstants.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { Allocation } from '../models/Allocation.js'
import { Assignment } from '../models/Assignment.js'
import { User } from '../models/User.js'
import { SystemPricing } from '../models/SystemPricing.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { emitRequestStatusUpdate, getIO, emitToUser } from '../utils/socket.js'
import { sendNotificationToUser } from '../services/notificationService.js'
import { logAudit } from '../utils/auditLogger.js'
import { triggerNotification } from '../utils/notificationTrigger.js'

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
  sendNotificationToUser(newLabourId.toString(), 'New Job Assigned', 'You have been reassigned to a new job.', { url: '/app/jobs' })
  emitToUser('labour', old.labourId.toString(), 'assignment_cancelled', { assignmentId: old._id.toString() })
  sendNotificationToUser(old.labourId.toString(), 'Job Cancelled', 'Your previous assignment has been cancelled.', { url: '/app/jobs' })
  
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
      if (a.requestId.status === REQUEST_STATUS.CANCELLED) return false
      
      // If it's an individual request searching for labour, it must not be expired
      if (a.requestId.status === REQUEST_STATUS.SEARCHING) {
        if (a.requestId.expiresAt && new Date(a.requestId.expiresAt) <= now) {
          return false
        }
      }
      
      // If the request has already been accepted by someone else or moved forward
      const validOfferStatuses = [
        REQUEST_STATUS.SEARCHING, 
        REQUEST_STATUS.ALLOCATING, 
        REQUEST_STATUS.ASSIGNED, 
        REQUEST_STATUS.CONFIRMED, 
        REQUEST_STATUS.PENDING_REVIEW
      ]
      if (!validOfferStatuses.includes(a.requestId.status)) {
        return false
      }
    }
    
    return true
  })

  sendSuccess(res, { data: { assignments: validAssignments } })
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

export const respondToAssignment = asyncHandler(async (req, res) => {
  const { action, labourLat, labourLng } = req.body
  const assignment = await Assignment.findOne({ _id: req.params.id, labourId: req.user._id })
  if (!assignment) return sendError(res, { message: 'Not found', statusCode: HTTP_STATUS.NOT_FOUND })
  if (action === 'accept') {
    const activeAssignments = await Assignment.find({
      labourId: req.user._id,
      status: { $in: [ASSIGNMENT_STATUS.ACCEPTED, ASSIGNMENT_STATUS.ON_SITE] },
      _id: { $ne: req.params.id }
    }).populate('requestId');

    const hasRealActive = activeAssignments.some(a => a.requestId != null);

    if (hasRealActive) {
      return sendError(res, { message: 'You already have an active job. Please complete or cancel it before accepting a new one.', statusCode: HTTP_STATUS.BAD_REQUEST });
    }

    assignment.status = ASSIGNMENT_STATUS.ACCEPTED
    assignment.acceptedAt = new Date()

    let request = await WorkforceRequest.findOneAndUpdate(
      {
        _id: assignment.requestId,
        status: REQUEST_STATUS.SEARCHING,
        $or: [
          { expiresAt: { $gt: new Date() } },
          { expiresAt: { $exists: false } }
        ]
      },
      {
        $set: {
          status: REQUEST_STATUS.PLATFORM_FEE_PENDING,
          labourId: req.user._id,
          labourName: req.user.fullName,
          labourPhone: req.user.phone,
          acceptedAt: new Date(),
          acceptedBy: req.user._id,
          platformFeePendingAt: new Date(),
          platformFeePaymentLifecycle: 'none'
        }
      },
      { new: true }
    )

    if (!request) {
      return sendError(res, { message: 'Booking already accepted or expired', statusCode: HTTP_STATUS.BAD_REQUEST })
    }

    if (request) {
      let distanceKm = 8.5; // Fallback if no location data available
      let reqLat = request.locationLat;
      let reqLng = request.locationLng;

      // Geocode on backend if missing
      if ((!reqLat || !reqLng) && request.locationText) {
        try {
          const apiKey = "AIzaSyCV6QreLE4QR76xie0BI3B9y2wY4awcPP8"; // Frontend map key from .env
          const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(request.locationText)}&key=${apiKey}`;
          const mapRes = await fetch(url);
          const data = await mapRes.json();
          if (data && data.results && data.results.length > 0) {
            reqLat = data.results[0].geometry.location.lat;
            reqLng = data.results[0].geometry.location.lng;
            request.locationLat = reqLat;
            request.locationLng = reqLng;
          }
        } catch (err) {
          console.error("Backend Geocoding failed:", err.message);
        }
      }

      if (reqLat && reqLng && labourLat && labourLng) {
         distanceKm = getDistanceFromLatLonInKm(reqLat, reqLng, labourLat, labourLng);
      }
      
      // Round distance to 1 decimal place
      distanceKm = Math.round(distanceKm * 10) / 10;
      
      const pricing = await SystemPricing.findOne().lean()
      let labourFee = 20
      const pf = pricing?.labour?.platformFee
      if (pf) {
        if (pf.type === 'distance') {
          const slabs = pf.slabs || []
          const sortedSlabs = [...slabs].sort((a, b) => Number(a.minDistance || 0) - Number(b.minDistance || 0))
          let matchedFee = null
          for (const slab of sortedSlabs) {
            const min = Number(slab.minDistance || 0)
            const max = slab.maxDistance !== null && slab.maxDistance !== undefined && slab.maxDistance !== '' ? Number(slab.maxDistance) : Infinity
            if (distanceKm >= min && distanceKm < max) {
              matchedFee = Number(slab.fee || 0)
              break
            }
          }
          if (matchedFee !== null) {
            labourFee = matchedFee
          } else {
            labourFee = 0
          }
        } else if (pf.type === 'percentage') {
          let estimatedTotalLabourCost = 800
          if (request.lines && request.lines.length > 0) {
            try {
              const { LabourCategory } = await import('../models/LabourCategory.js')
              const categories = await LabourCategory.find({ _id: { $in: request.lines.map(l => l.categoryId) } }).lean()
              const categoryMap = {}
              categories.forEach(c => {
                categoryMap[c._id.toString()] = c.pricePerDay || c.pricePerHour * 8 || 800
              })
              let estimatedLabourCostPerDay = 0
              request.lines.forEach((l) => {
                const qty = l.quantity || 1
                const rate = categoryMap[l.categoryId.toString()] || 800
                estimatedLabourCostPerDay += qty * rate
              })
              let totalDurationInDays = 1
              if (request.startDate && request.endDate) {
                const diffTime = Math.abs(new Date(request.endDate) - new Date(request.startDate))
                totalDurationInDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
              }
              estimatedTotalLabourCost = estimatedLabourCostPerDay * totalDurationInDays
            } catch (err) {
              console.error('Error calculating request cost for percentage fee:', err.message)
            }
          }
          labourFee = Math.round((estimatedTotalLabourCost * (pf.value ?? 10)) / 100)
        } else {
          labourFee = pf.value ?? 20
        }
      }

      request.distanceKm = distanceKm;
      request.labourPlatformFee = labourFee;
      
      await request.save()

      try {
        const io = getIO()
        io.emit('bookingAcceptedGlobal', { requestId: request._id.toString() })
        emitToUser('individual', request.clientId?.toString(), 'request_updated', { requestId: request._id.toString() })
        sendNotificationToUser(request.clientId?.toString(), 'Worker Found!', `${req.user.fullName} has accepted your job request.`, { url: `/app/booking/${request._id}` })
        emitToUser('labour', req.user._id.toString(), 'assignment_accepted', { assignmentId: assignment._id.toString() })
        io.to(`request_${request._id.toString()}`).emit('bookingAccepted', {
          status: request.status,
          labourId: request.labourId,
          labourName: request.labourName,
          labourPhone: request.labourPhone,
          acceptedAt: request.acceptedAt,
          distanceKm: request.distanceKm,
          labourPlatformFee: request.labourPlatformFee,
          estimatedArrival: '30 mins' // Add a dummy ETA or omit it
        })
      } catch (err) {
        console.error('Socket emit error:', err)
      }
    }
  } else if (action === 'decline') {
    assignment.status = ASSIGNMENT_STATUS.DECLINED
    emitToUser('labour', req.user._id.toString(), 'assignment_rejected', { assignmentId: assignment._id.toString() })
    emitRequestStatusUpdate(assignment.requestId.toString(), {
      event: 'status_changed',
      assignmentStatus: assignment.status,
      updatedAt: new Date()
    })
  } else {
    return sendError(res, { message: 'Invalid action', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  await assignment.save()
  const updatedRequest = await WorkforceRequest.findById(assignment.requestId).lean();
  sendSuccess(res, { data: { assignment: assignment.toObject(), request: updatedRequest } })
})
