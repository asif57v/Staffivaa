import mongoose from 'mongoose'
import { USER_ROLES, CORPORATE_STATUS } from '../constants/roles.js'
import {
  REQUEST_SOURCE,
  REQUEST_STATUS,
  SCHEDULE_TYPE,
  ASSIGNMENT_STATUS,
} from '../constants/workforceConstants.js'
import { WorkforceRequest, generateRequestReference } from '../models/WorkforceRequest.js'
import { Assignment } from '../models/Assignment.js'
import { Allocation } from '../models/Allocation.js'
import { User } from '../models/User.js'
import { ExtraWorkRequest } from '../models/ExtraWorkRequest.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { emitToUser } from '../utils/socket.js'

function parseLines(lines) {
  if (!Array.isArray(lines) || !lines.length) return null
  return lines
    .map((l) => ({
      categoryId: l.categoryId,
      quantity: Math.max(1, Number(l.quantity) || 1),
    }))
    .filter((l) => mongoose.Types.ObjectId.isValid(l.categoryId))
}

export const createRequest = asyncHandler(async (req, res) => {
  const user = req.user
  let sourceType = REQUEST_SOURCE.INDIVIDUAL
  if (user.role === USER_ROLES.CORPORATE) {
    if (user.corporateProfile?.status !== CORPORATE_STATUS.APPROVED) {
      return sendError(res, {
        message: 'Corporate account must be approved',
        statusCode: HTTP_STATUS.FORBIDDEN,
      })
    }
    sourceType = REQUEST_SOURCE.CORPORATE
  } else if (user.role !== USER_ROLES.INDIVIDUAL) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const {
    projectId,
    siteId,
    scheduleType,
    startDate,
    endDate,
    shiftStart,
    shiftEnd,
    lines,
    locationText,
    notes,
    billingMode,
    bookingType,
  } = req.body

  const parsedLines = parseLines(lines)
  if (!parsedLines?.length) {
    return sendError(res, { message: 'At least one skill line required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  if (!startDate) {
    return sendError(res, { message: 'Start date required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Calculate dynamic platform fee based on duration
  let totalDurationInDays = 1;
  if (endDate && startDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24))
    totalDurationInDays = Math.max(1, diffDays + 1)
  }

  let calculatedFee = 20;
  if (totalDurationInDays === 1) calculatedFee = 20;
  else if (totalDurationInDays <= 3) calculatedFee = 30;
  else if (totalDurationInDays <= 7) calculatedFee = 50;
  else calculatedFee = 100;

  const request = await WorkforceRequest.create({
    reference: generateRequestReference(sourceType === REQUEST_SOURCE.CORPORATE ? 'CR' : 'IR'),
    sourceType,
    clientId: user._id,
    projectId: projectId && mongoose.Types.ObjectId.isValid(projectId) ? projectId : undefined,
    siteId: siteId && mongoose.Types.ObjectId.isValid(siteId) ? siteId : undefined,
    scheduleType: Object.values(SCHEDULE_TYPE).includes(scheduleType) ? scheduleType : SCHEDULE_TYPE.DAILY,
    startDate: new Date(startDate),
    endDate: endDate ? new Date(endDate) : undefined,
    shiftStart,
    shiftEnd,
    lines: parsedLines,
    locationText,
    locationLat: Number.isFinite(Number(req.body.locationLat)) ? Number(req.body.locationLat) : undefined,
    locationLng: Number.isFinite(Number(req.body.locationLng)) ? Number(req.body.locationLng) : undefined,
    notes,
    billingMode,
    bookingType,
    userPlatformFee: calculatedFee,
    labourPlatformFee: calculatedFee,
    status: sourceType === REQUEST_SOURCE.INDIVIDUAL ? REQUEST_STATUS.SEARCHING : REQUEST_STATUS.ALLOCATING,
    ...(sourceType === REQUEST_SOURCE.INDIVIDUAL && { expiresAt: new Date(Date.now() + 3 * 60 * 1000) }),
  })

  // Send offers to matching workers (for INDIVIDUAL requests)
  if (sourceType === REQUEST_SOURCE.INDIVIDUAL && parsedLines?.length > 0) {
    const categoryId = parsedLines[0].categoryId
    // Assign to workers with matching skills
    const workers = await User.find({
      role: USER_ROLES.LABOUR,
      'labourProfile.categoryIds': categoryId,
      'labourProfile.availabilityStatus': 'available',
    }).limit(50)

    if (workers.length > 0) {
      const allocation = await Allocation.create({
        requestId: request._id,
        notes: 'Auto-allocated by skill match for individual booking',
      })

      const LabourCategory = mongoose.model('LabourCategory')
      const category = await LabourCategory.findById(categoryId)
      const baseRate = category?.baseRate || 800

      const assignmentsToCreate = workers.map((worker) => ({
        allocationId: allocation._id,
        requestId: request._id,
        labourId: worker._id,
        categoryId,
        status: ASSIGNMENT_STATUS.OFFERED,
        perDayRate: baseRate,
      }))

      const createdAssignments = await Assignment.insertMany(assignmentsToCreate)
      // Keep status as SEARCHING until a worker accepts

      // Notify all matching workers instantly
      createdAssignments.forEach((assignment) => {
        emitToUser('labour', assignment.labourId.toString(), 'assignment_assigned', { assignmentId: assignment._id.toString() })
      })
    }
  }

  emitToUser('individual', user._id.toString(), 'request_created', { requestId: request._id.toString() })

  sendSuccess(res, { data: { request } }, HTTP_STATUS.CREATED)
})

export const listMyRequests = asyncHandler(async (req, res) => {
  const filter = { clientId: req.user._id }
  if (req.query.status) filter.status = req.query.status
  const requests = await WorkforceRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('projectId', 'name')
    .populate('lines.categoryId', 'name group')
    .lean()
  sendSuccess(res, { data: { requests } })
})

export const getRequest = asyncHandler(async (req, res) => {
  const request = await WorkforceRequest.findById(req.params.id)
    .populate('projectId', 'name')
    .populate('clientId', 'fullName corporateProfile.companyName')
    .populate('lines.categoryId', 'name baseRate')
    .lean()
  if (!request) return sendError(res, { message: 'Not found', statusCode: HTTP_STATUS.NOT_FOUND })

  const isOwner = request.clientId && String(request.clientId._id || request.clientId) === String(req.user._id)
  const isAdmin = req.user.role === USER_ROLES.ADMIN
  if (!isOwner && !isAdmin) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const allocation = await Allocation.findOne({ requestId: request._id })
    .populate('vendorId', 'fullName phone email contractorProfile.companyName contractorProfile.businessAddress')
    .lean()
  const assignments = await Assignment.find({ requestId: request._id })
    .populate('labourId', 'fullName phone profileImageUrl labourProfile.kycStatus corporateProfile.registeredAddress contractorProfile.businessAddress')
    .lean()
    
  // Calculate a basic payment summary based on lines
  let serviceCost = request.labourCharge || 0;
  if (!serviceCost) {
    request.lines?.forEach(line => {
      const rate = line.categoryId?.baseRate || 800 // default 800
      serviceCost += rate * (line.quantity || 1)
    })
  }

  const extraWorkRequests = await ExtraWorkRequest.find({ bookingId: request._id, status: 'accepted' }).lean()
  let extraCost = 0
  extraWorkRequests.forEach(ew => {
    extraCost += ew.revisedAmount != null ? ew.revisedAmount : ew.extraAmount
  })
  
  let totalDurationInDays = 1;
  if (request.endDate && request.startDate) {
    const start = new Date(request.startDate)
    const end = new Date(request.endDate)
    const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24))
    totalDurationInDays = Math.max(1, diffDays + 1)
  }

  let platformFee = 20;
  if (totalDurationInDays === 1) platformFee = 20;
  else if (totalDurationInDays <= 3) platformFee = 30;
  else if (totalDurationInDays <= 7) platformFee = 50;
  else platformFee = 100;

  const totalLabourCost = allocation?.totalLabourCost || 0;
  const grandTotal = totalLabourCost + platformFee + extraCost;

  const userPlatformFee = request.userPlatformFee || platformFee;
  const labourPlatformFee = request.labourPlatformFee || 0;
  
  const paymentSummary = {
    serviceCost,
    extraCost,
    userPlatformFee,
    labourPlatformFee,
    totalDurationInDays,
    totalLabourCost,
    platformFee,
    grandTotal,
    totalAmount: grandTotal
  }

  sendSuccess(res, { data: { request, allocation, assignments, paymentSummary } })
})

export const listAdminRequests = asyncHandler(async (req, res) => {
  const filter = {}
  if (req.query.status) filter.status = req.query.status
  if (req.query.sourceType) filter.sourceType = req.query.sourceType
  const requests = await WorkforceRequest.find(filter)
    .sort({ createdAt: 1 })
    .limit(200)
    .populate('clientId', 'fullName phone role corporateProfile companyName')
    .lean()
  sendSuccess(res, { data: { requests } })
})

export const patchRequestStatusAdmin = asyncHandler(async (req, res) => {
  const { status, adminNote } = req.body
  const request = await WorkforceRequest.findById(req.params.id)
  if (!request) return sendError(res, { message: 'Not found', statusCode: HTTP_STATUS.NOT_FOUND })
  if (!Object.values(REQUEST_STATUS).includes(status)) {
    return sendError(res, { message: 'Invalid status', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  request.status = status
  if (adminNote != null) request.adminNote = String(adminNote).trim()
  request.reviewedBy = req.user._id
  request.reviewedAt = new Date()
  await request.save()
  
  emitToUser('individual', request.clientId?.toString(), 'request_updated', { requestId: request._id.toString() })
  
  sendSuccess(res, { data: { request } })
})
