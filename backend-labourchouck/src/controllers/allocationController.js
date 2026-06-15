import mongoose from 'mongoose'
import { USER_ROLES } from '../constants/roles.js'
import { REQUEST_STATUS, ASSIGNMENT_STATUS } from '../constants/workforceConstants.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { Allocation } from '../models/Allocation.js'
import { Assignment } from '../models/Assignment.js'
import { User } from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { emitRequestStatusUpdate, getIO } from '../utils/socket.js'

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
  }

  if (request.status === REQUEST_STATUS.PENDING_REVIEW || request.status === REQUEST_STATUS.CONFIRMED) {
    request.status = REQUEST_STATUS.ALLOCATING
    await request.save()
  }
  if (assignments.length) {
    request.status = REQUEST_STATUS.ASSIGNED
    await request.save()
  }

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
        { path: 'clientId', select: 'fullName phone corporateProfile' },
        { path: 'lines.categoryId', select: 'name' },
        { path: 'projectId', select: 'name' },
        { path: 'siteId', select: 'address' }
      ]
    })
    .populate('vendorId', 'fullName contractorProfile')
    .populate('categoryId', 'name')
    .lean()
  sendSuccess(res, { data: { assignments } })
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
    assignment.status = ASSIGNMENT_STATUS.ACCEPTED
    assignment.acceptedAt = new Date()

    const request = await WorkforceRequest.findById(assignment.requestId)
    if (request && request.status !== REQUEST_STATUS.SEARCHING) {
      return sendError(res, { message: 'Booking already accepted by another labour', statusCode: HTTP_STATUS.BAD_REQUEST })
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
      
      let labourFee = 0;
      if (distanceKm <= 2) labourFee = 20;
      else if (distanceKm <= 5) labourFee = 15;
      else if (distanceKm <= 10) labourFee = 10;
      else if (distanceKm <= 15) labourFee = 5;
      else labourFee = 0;

      request.distanceKm = distanceKm;
      request.labourPlatformFee = labourFee;
      
      // Update status to PLATFORM_FEE_PENDING to indicate fees are due
      request.status = REQUEST_STATUS.PLATFORM_FEE_PENDING;
      request.labourId = req.user._id
      request.labourName = req.user.fullName
      request.labourPhone = req.user.phone
      request.acceptedAt = new Date()
      await request.save()

      try {
        const io = getIO()
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
    emitRequestStatusUpdate(assignment.requestId.toString(), {
      event: 'status_changed',
      assignmentStatus: assignment.status,
      updatedAt: new Date()
    })
  } else {
    return sendError(res, { message: 'Invalid action', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  await assignment.save()
  const updatedRequest = await WorkforceRequest.findById(assignment.requestId);
  sendSuccess(res, { data: { assignment, request: updatedRequest } })
})
