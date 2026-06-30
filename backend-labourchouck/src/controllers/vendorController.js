import mongoose from 'mongoose'
import { USER_ROLES } from '../constants/roles.js'
import {
  VENDOR_DOCUMENT_TYPE_LIST,
  VENDOR_DOCUMENT_TYPES,
} from '../constants/vendorVerification.js'
import { User } from '../models/User.js'
import { Allocation } from '../models/Allocation.js'
import { Assignment } from '../models/Assignment.js'
import { Invoice } from '../models/Invoice.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { Withdrawal } from '../models/Withdrawal.js'
import { REQUEST_SOURCE, REQUEST_STATUS, ASSIGNMENT_STATUS } from '../constants/workforceConstants.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { normalizeStoredMediaUrl } from '../utils/mediaUrl.js'
import {
  getVendorVerificationProgress,
  labelForVendorDocumentType,
  normalizeVendorProfilePatch,
  validateVendorProfileForSubmit,
} from '../utils/vendorVerification.js'
import { emitToCorporate, emitToRole } from '../utils/socket.js'

function requireApprovedVendor(user) {
  if (user.role !== USER_ROLES.CONTRACTOR) return 'Vendor account required'
  if (user.contractorProfile?.verificationStatus !== 'approved') {
    return 'Vendor must be verified before this action'
  }
  return null
}

export const getVendorMe = asyncHandler(async (req, res) => {
  const progress = getVendorVerificationProgress(req.user.contractorProfile || {})
  sendSuccess(res, {
    data: {
      user: req.user.toSafeObject(),
      verification: {
        checklist: progress.checklist,
        requiredDone: progress.requiredDone,
        requiredTotal: progress.requiredTotal,
        readyToSubmit: progress.readyToSubmit,
      },
    },
  })
})

export const patchVendorMe = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.CONTRACTOR) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }
  if (req.user.contractorProfile?.verificationStatus === 'approved') {
    return sendError(res, {
      message: 'Account verified — contact support to update business details',
      statusCode: HTTP_STATUS.FORBIDDEN,
    })
  }
  const patch = normalizeVendorProfilePatch(req.body)
  if (!req.user.contractorProfile) req.user.contractorProfile = {}
  Object.assign(req.user.contractorProfile, patch)
  await req.user.save()
  const progress = getVendorVerificationProgress(req.user.contractorProfile)
  sendSuccess(res, {
    data: {
      user: req.user.toSafeObject(),
      verification: {
        checklist: progress.checklist,
        requiredDone: progress.requiredDone,
        requiredTotal: progress.requiredTotal,
        readyToSubmit: progress.readyToSubmit,
      },
    },
  })
})

export const addVendorDocument = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.CONTRACTOR) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }
  if (req.user.contractorProfile?.verificationStatus === 'approved') {
    return sendError(res, {
      message: 'Account already verified — contact support to update documents',
      statusCode: HTTP_STATUS.FORBIDDEN,
    })
  }
  const { label, url, documentType } = req.body
  const docUrl = normalizeStoredMediaUrl(String(url ?? '').trim())
  if (!docUrl) {
    return sendError(res, { message: 'Valid document URL required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  const type = String(documentType ?? '').trim()
  if (!VENDOR_DOCUMENT_TYPE_LIST.includes(type)) {
    return sendError(res, {
      message: 'Select a valid document type',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_DOCUMENT_TYPE',
    })
  }
  if (!req.user.contractorProfile) req.user.contractorProfile = {}
  if (!req.user.contractorProfile.documents) req.user.contractorProfile.documents = []
  const existing = req.user.contractorProfile.documents.find(
    (d) => d.documentType === type && type !== VENDOR_DOCUMENT_TYPES.OTHER,
  )
  if (existing) {
    return sendError(res, {
      message: `A ${labelForVendorDocumentType(type)} is already uploaded — remove it first to replace`,
      statusCode: HTTP_STATUS.CONFLICT,
      code: 'DOCUMENT_TYPE_EXISTS',
    })
  }
  req.user.contractorProfile.documents.push({
    documentType: type,
    label: String(label ?? labelForVendorDocumentType(type)).trim(),
    url: docUrl,
    uploadedAt: new Date(),
  })
  if (req.user.contractorProfile.verificationStatus === 'rejected') {
    req.user.contractorProfile.verificationStatus = 'pending'
    req.user.contractorProfile.documentsSubmittedAt = undefined
    req.user.contractorProfile.reviewNote = undefined
  }
  await req.user.save()
  sendSuccess(res, { data: { user: req.user.toSafeObject() } })
})

export const submitVendorVerification = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.CONTRACTOR) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }
  if (req.user.contractorProfile?.documentsSubmittedAt) {
    return sendError(res, {
      message: 'Verification already submitted and is under review',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }
  const profile = req.user.contractorProfile || {}
  const validation = validateVendorProfileForSubmit(profile)
  if (!validation.ok) {
    return sendError(res, {
      message: validation.message,
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'VERIFICATION_INCOMPLETE',
      errors: validation.checklist?.filter((i) => i.required && !i.done).map((i) => i.id),
    })
  }
  if (!req.user.contractorProfile) req.user.contractorProfile = {}
  req.user.contractorProfile.verificationStatus = 'pending'
  req.user.contractorProfile.documentsSubmittedAt = new Date()
  req.user.contractorProfile.reviewNote = undefined
  await req.user.save()
  sendSuccess(res, {
    message: 'Verification submitted — our team will review your documents shortly',
    data: { user: req.user.toSafeObject() },
  })
})

export const removeVendorDocument = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.CONTRACTOR) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }
  if (req.user.contractorProfile?.documentsSubmittedAt) {
    return sendError(res, {
      message: 'Cannot remove documents while verification is in review',
      statusCode: HTTP_STATUS.FORBIDDEN,
    })
  }
  const docId = req.params.docId
  if (!req.user.contractorProfile?.documents?.length) {
    return sendError(res, { message: 'Document not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  const before = req.user.contractorProfile.documents.length
  req.user.contractorProfile.documents = req.user.contractorProfile.documents.filter(
    (d) => String(d._id) !== String(docId),
  )
  if (req.user.contractorProfile.documents.length === before) {
    return sendError(res, { message: 'Document not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  await req.user.save()
  sendSuccess(res, { data: { user: req.user.toSafeObject() } })
})

export const listVendorCrew = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  const crew = await User.find({ vendorId: req.user._id, role: USER_ROLES.LABOUR })
    .select('fullName phone profileImageUrl labourProfile')
    .populate('labourProfile.categoryIds', 'name')
    .lean()
  sendSuccess(res, { data: { crew } })
})

export const linkVendorCrew = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  const { phone } = req.body
  const digits = String(phone ?? '').replace(/\D/g, '').slice(-10)
  if (digits.length !== 10) {
    return sendError(res, { message: 'Valid 10-digit phone required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  const worker = await User.findOne({ phone: digits, role: USER_ROLES.LABOUR })
  if (!worker) {
    return sendError(res, {
      message: 'Labour account not found — worker must register as labour first',
      statusCode: HTTP_STATUS.NOT_FOUND,
    })
  }
  worker.vendorId = req.user._id
  await worker.save()
  sendSuccess(res, { data: { worker: worker.toSafeObject() } })
})

export const getVendorDashboard = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  const vendorId = req.user._id
  const crewCount = await User.countDocuments({ vendorId, role: USER_ROLES.LABOUR })
  const openJobs = await Allocation.countDocuments({ vendorId, vendorAcceptedAt: { $exists: false } })
  const activeAssignments = await Assignment.countDocuments({
    vendorId,
    status: { $in: ['accepted', 'on_site'] },
  })
  sendSuccess(res, {
    data: {
      stats: { crewCount, openJobs, activeAssignments },
    },
  })
})

export const listVendorJobs = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  const allocations = await Allocation.find({ vendorId: req.user._id })
    .sort({ createdAt: -1 })
    .populate({
      path: 'requestId',
      select: 'reference status locationText startDate endDate lines scheduleType shiftStart shiftEnd clientId projectId',
      populate: [
        {
          path: 'lines.categoryId',
          select: 'name group',
        },
        {
          path: 'clientId',
          select: 'fullName corporateProfile.companyName',
        },
        {
          path: 'projectId',
          select: 'name',
        }
      ],
    })
    .lean()

  const allocationIds = allocations.map((a) => a._id)
  const allAssignments = await Assignment.find({ allocationId: { $in: allocationIds } })
    .populate('labourId', 'fullName phone')
    .populate('categoryId', 'name')
    .lean()

  const allocationsWithAssignments = allocations.map((a) => {
    return {
      ...a,
      assignments: allAssignments.filter((assign) => String(assign.allocationId) === String(a._id)),
    }
  })

  sendSuccess(res, { data: { allocations: allocationsWithAssignments } })
})

export const acceptVendorJob = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  const allocation = await Allocation.findOne({ _id: req.params.id, vendorId: req.user._id })
  if (!allocation) return sendError(res, { message: 'Job not found', statusCode: HTTP_STATUS.NOT_FOUND })
  allocation.vendorAcceptedAt = new Date()
  allocation.deployedAt = new Date()
  await allocation.save()

  // Notify corporate
  const request = await WorkforceRequest.findById(allocation.requestId)
  if (request && request.sourceType === REQUEST_SOURCE.CORPORATE) {
    emitToCorporate(request.clientId.toString(), 'vendor_accepted_job', { requestId: request._id.toString(), allocationId: allocation._id.toString() })
  }

  sendSuccess(res, { data: { allocation } })
})

export const listVendorSettlements = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  const invoices = await Invoice.find({ vendorId: req.user._id }).sort({ createdAt: -1 }).lean()
  sendSuccess(res, { data: { invoices } })
})

export const listVendorMarketplaceRequests = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  const requests = await WorkforceRequest.find({
    sourceType: REQUEST_SOURCE.CORPORATE,
    status: {
      $in: [REQUEST_STATUS.PENDING_REVIEW, REQUEST_STATUS.ALLOCATING, REQUEST_STATUS.SEARCHING, REQUEST_STATUS.APPROVED],
    },
    declinedBy: { $ne: req.user._id },
  })
    .sort({ createdAt: -1 })
    .populate('clientId', 'fullName corporateProfile.companyName')
    .populate('lines.categoryId', 'name group')
    .lean()

  sendSuccess(res, { data: { requests } })
})

export const acceptVendorMarketplaceRequest = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  const request = await WorkforceRequest.findOne({
    _id: req.params.id,
    sourceType: REQUEST_SOURCE.CORPORATE,
    status: {
      $in: [REQUEST_STATUS.PENDING_REVIEW, REQUEST_STATUS.ALLOCATING, REQUEST_STATUS.SEARCHING],
    },
  })

  if (!request) {
    return sendError(res, { message: 'Request not available or already accepted', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Create allocation
  const allocation = await Allocation.create({
    requestId: request._id,
    vendorId: req.user._id,
    vendorAcceptedAt: new Date(),
    notes: 'Vendor accepted directly from marketplace',
  })

  // Update request status to accepted
  request.status = REQUEST_STATUS.ACCEPTED
  await request.save()

  // Notify corporate
  emitToCorporate(request.clientId.toString(), 'vendor_accepted_request', { requestId: request._id.toString(), vendorId: req.user._id.toString() })
  emitToRole('contractor', 'vendor_accepted_request_global', { requestId: request._id.toString() })

  sendSuccess(res, { data: { allocation } })
})

export const declineVendorMarketplaceRequest = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  const request = await WorkforceRequest.findOne({
    _id: req.params.id,
    sourceType: REQUEST_SOURCE.CORPORATE,
    status: {
      $in: [REQUEST_STATUS.PENDING_REVIEW, REQUEST_STATUS.ALLOCATING, REQUEST_STATUS.SEARCHING, REQUEST_STATUS.APPROVED],
    },
  })

  if (!request) {
    return sendError(res, { message: 'Request not available', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (!request.declinedBy) {
    request.declinedBy = []
  }

  if (!request.declinedBy.includes(req.user._id)) {
    request.declinedBy.push(req.user._id)
    await request.save()
  }

  emitToCorporate(request.clientId.toString(), 'vendor_declined_request', { requestId: request._id.toString(), vendorId: req.user._id.toString() })

  sendSuccess(res, { data: { message: 'Request declined' } })
})

export const assignWorkforce = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  const { assignments } = req.body // Array of { labourId, categoryId }
  const allocationId = req.params.id

  const allocation = await Allocation.findOne({ _id: allocationId, vendorId: req.user._id })
  if (!allocation) {
    return sendError(res, { message: 'Allocation not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const request = await WorkforceRequest.findById(allocation.requestId)
  if (!request) {
    return sendError(res, { message: 'Request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
    return sendError(res, { message: 'Assignments data is required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Map requested skills quantity
  const requestedSkills = {}
  request.lines.forEach((line) => {
    requestedSkills[line.categoryId.toString()] = line.quantity
  })

  // Count assigned skills
  const assignedSkills = {}
  for (const assignment of assignments) {
    const { categoryId } = assignment
    assignedSkills[categoryId] = (assignedSkills[categoryId] || 0) + 1
  }

  // Validate counts
  for (const [categoryId, reqQty] of Object.entries(requestedSkills)) {
    const assignedQty = assignedSkills[categoryId] || 0
    if (assignedQty !== reqQty) {
      return sendError(res, { message: `Mismatch in required workers for category.`, statusCode: HTTP_STATUS.BAD_REQUEST })
    }
  }

  // Validate perDayRate
  let sumOfRates = 0
  for (const assignment of assignments) {
    if (!assignment.perDayRate || isNaN(assignment.perDayRate) || assignment.perDayRate <= 0) {
      return sendError(res, { message: 'Valid perDayRate is required for all assigned workers', statusCode: HTTP_STATUS.BAD_REQUEST })
    }
    sumOfRates += Number(assignment.perDayRate)
  }

  // Calculate project duration
  let projectDurationInDays = 1
  if (request.endDate && request.startDate) {
    const start = new Date(request.startDate)
    const end = new Date(request.endDate)
    const diffTime = Math.abs(end - start)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    projectDurationInDays = Math.max(1, diffDays + 1)
  }

  const totalLabourCost = sumOfRates * projectDurationInDays

  // Create assignments
  const assignmentDocs = assignments.map((assignment) => ({
    allocationId: allocation._id,
    requestId: request._id,
    labourId: assignment.labourId,
    vendorId: req.user._id,
    categoryId: assignment.categoryId,
    perDayRate: Number(assignment.perDayRate),
    status: ASSIGNMENT_STATUS.ACCEPTED,
    acceptedAt: new Date(),
  }))

  await Assignment.insertMany(assignmentDocs)

  // Update allocation cost
  allocation.totalLabourCost = totalLabourCost
  await allocation.save()

  // Update request status to ASSIGNED
  request.status = REQUEST_STATUS.ASSIGNED
  await request.save()

  if (request.sourceType === REQUEST_SOURCE.CORPORATE) {
    emitToCorporate(request.clientId.toString(), 'vendor_assigned_workforce', { requestId: request._id.toString(), allocationId: allocation._id.toString() })
  }

  sendSuccess(res, { data: { message: 'Workforce assigned successfully', totalLabourCost } })
})

export const getVendorWallet = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  const user = await User.findById(req.user._id).select('walletBalance').lean()
  const transactions = await WalletTransaction.find({ labourId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()
  const withdrawals = await Withdrawal.find({ requestedBy: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()

  sendSuccess(res, {
    data: {
      walletBalance: user?.walletBalance || 0,
      transactions,
      withdrawals
    }
  })
})

export const requestVendorWithdrawal = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  const { amount, bankDetails } = req.body
  if (!amount || amount <= 0) {
    return sendError(res, { message: 'Invalid withdrawal amount', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const user = await User.findById(req.user._id)
  if (!user || user.walletBalance < amount) {
    return sendError(res, { message: 'Insufficient wallet balance', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  user.walletBalance -= amount
  await user.save()

  const withdrawal = await Withdrawal.create({
    amount,
    bankDetails,
    requestedBy: req.user._id,
    status: 'Pending'
  })

  await WalletTransaction.create({
    transactionId: `WD-VND-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    payerId: req.user._id,
    payerName: req.user.fullName || 'Vendor',
    payerType: 'vendor',
    labourId: req.user._id,
    type: 'Withdrawal',
    source: 'Vendor Wallet Withdrawal Request',
    amount,
    status: 'Pending'
  })

  sendSuccess(res, { data: { withdrawal, walletBalance: user.walletBalance } })
})
