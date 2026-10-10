import { Quotation } from '../models/Quotation.js'
import { SystemPricing } from '../models/SystemPricing.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { Allocation } from '../models/Allocation.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { emitToCorporate, emitToVendor, emitToRole } from '../utils/socket.js'
import { User } from '../models/User.js'
import { sendNotificationToUsers } from '../services/notificationService.js'
import CommissionService from '../services/CommissionService.js'
import { notifyCorporateClient } from '../utils/corporateNotifications.js'

export const submitQuotationVendor = asyncHandler(async (req, res) => {
  let requestId = req.body.requestId || req.params.id

  // If allocation ID passed instead of request ID
  const allocation = await Allocation.findById(requestId)
  if (allocation) {
    requestId = allocation.requestId
  }

  const request = await WorkforceRequest.findById(requestId)
  if (!request) {
    return sendError(res, { message: 'Workforce request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Ensure request is in accepted or assigned state
  if (!['accepted', 'allocated', 'assigned', 'quotation_unlocked'].includes(request.status)) {
    return sendError(res, { message: 'Cannot submit quotation for this request status', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  
  if (request.sourceType === 'corporate' && request.quotationUnlocked !== true) {
    return sendError(res, { message: 'Quotation cannot be submitted until both platform fees are paid', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const {
    labourRatePerWorker,
    numberOfWorkers,
    workingDays,
    transportationCharges,
    equipmentCharges,
    foodCharges,
    accommodationCharges,
    otherCharges,
    gstPercentage,
    discount,
    notes
  } = req.body

  if (labourRatePerWorker == null || numberOfWorkers == null || workingDays == null) {
    return sendError(res, {
      message: 'labourRatePerWorker, numberOfWorkers, and workingDays are required',
      statusCode: HTTP_STATUS.BAD_REQUEST
    })
  }

  // Calculate costs
  const labourCost = Number(labourRatePerWorker) * Number(numberOfWorkers) * Number(workingDays)
  const taxableCost = labourCost + 
                      (Number(transportationCharges) || 0) + 
                      (Number(equipmentCharges) || 0) + 
                      (Number(foodCharges) || 0) + 
                      (Number(accommodationCharges) || 0) + 
                      (Number(otherCharges) || 0) - 
                      (Number(discount) || 0)
                      
  const gstRate = gstPercentage !== undefined ? Number(gstPercentage) : 18
  const gst = Math.round(Math.max(0, taxableCost) * gstRate / 100)
  const grandTotal = taxableCost + gst

  let quotation = await Quotation.findOne({ requestId })

  const isCallerAdmin = req.user.role === 'admin'

  if (quotation) {
    // Save history of the current state before editing
    if (!quotation.revisions) quotation.revisions = []
    quotation.revisions.push({
      labourRatePerWorker: quotation.labourRatePerWorker,
      numberOfWorkers: quotation.numberOfWorkers,
      workingDays: quotation.workingDays,
      transportationCharges: quotation.transportationCharges,
      equipmentCharges: quotation.equipmentCharges,
      foodCharges: quotation.foodCharges,
      accommodationCharges: quotation.accommodationCharges,
      otherCharges: quotation.otherCharges,
      gstPercentage: quotation.gstPercentage,
      gst: quotation.gst,
      discount: quotation.discount,
      notes: quotation.notes,
      status: quotation.status,
      feedback: quotation.feedback,
      createdAt: quotation.updatedAt || new Date()
    })

    // Update fields
    quotation.labourRatePerWorker = Number(labourRatePerWorker)
    quotation.numberOfWorkers = Number(numberOfWorkers)
    quotation.workingDays = Number(workingDays)
    quotation.transportationCharges = Number(transportationCharges) || 0
    quotation.equipmentCharges = Number(equipmentCharges) || 0
    quotation.foodCharges = Number(foodCharges) || 0
    quotation.accommodationCharges = Number(accommodationCharges) || 0
    quotation.otherCharges = Number(otherCharges) || 0
    quotation.gstPercentage = gstRate
    quotation.gst = gst
    quotation.discount = Number(discount) || 0
    quotation.notes = notes
    quotation.labourCost = labourCost
    quotation.grandTotal = grandTotal
    
    // Legacy fields
    quotation.labourWage = labourCost
    quotation.vendorServiceCharge = Number(otherCharges) || 0
    quotation.transportation = Number(transportationCharges) || 0
    quotation.accommodation = Number(accommodationCharges) || 0
    quotation.food = Number(foodCharges) || 0

    if (isCallerAdmin) {
      quotation.adminId = req.user._id
      quotation.createdByRole = 'admin'
    }

    // Set status
    quotation.status = quotation.status === 'revision_requested' ? 'revised' : 'submitted'
  } else {
    // Create new
    let pricing = await SystemPricing.findOne()
    if (!pricing) {
      pricing = await SystemPricing.create({})
    }

    const pricingSnapshot = {
      platformFee: {
        type: pricing.corporate?.platformFee?.type || 'perWorkerPerDay',
        value: pricing.corporate?.platformFee?.value || 25,
        minFee: pricing.corporate?.platformFee?.minFee || 0,
        maxFee: pricing.corporate?.platformFee?.maxFee || 0
      },
      gst: {
        enabled: pricing.corporate?.gst?.enabled !== false,
        rate: pricing.corporate?.gst?.rate || 18
      },
      settlementRules: {
        corporateSettlementCycle: pricing.settlementRules?.corporateSettlementCycle || 'weekly',
        vendorSettlementDelay: pricing.settlementRules?.vendorSettlementDelay || 3,
        labourSalaryCycle: pricing.settlementRules?.labourSalaryCycle || 'weekly'
      }
    }

    quotation = new Quotation({
      requestId,
      vendorId: isCallerAdmin ? undefined : req.user._id,
      adminId: isCallerAdmin ? req.user._id : undefined,
      createdByRole: isCallerAdmin ? 'admin' : 'contractor',
      labourRatePerWorker: Number(labourRatePerWorker),
      numberOfWorkers: Number(numberOfWorkers),
      workingDays: Number(workingDays),
      transportationCharges: Number(transportationCharges) || 0,
      equipmentCharges: Number(equipmentCharges) || 0,
      foodCharges: Number(foodCharges) || 0,
      accommodationCharges: Number(accommodationCharges) || 0,
      otherCharges: Number(otherCharges) || 0,
      gstPercentage: gstRate,
      gst,
      discount: Number(discount) || 0,
      notes,
      labourCost,
      grandTotal,
      pricingSnapshot,
      status: 'submitted',
      // Legacy compatibility
      labourWage: labourCost,
      vendorServiceCharge: Number(otherCharges) || 0,
      transportation: Number(transportationCharges) || 0,
      accommodation: Number(accommodationCharges) || 0,
      food: Number(foodCharges) || 0
    })
  }

  await quotation.save()

  notifyCorporateClient(request, quotation.status === 'revised' ? 'quotation_revised' : 'quotation_received')

  // Emit socket update to Corporate
  emitToCorporate(request.clientId.toString(), 'vendor_submitted_quotation', {
    requestId: request._id.toString(),
    quotationId: quotation._id.toString(),
    status: quotation.status
  })

  sendSuccess(res, { data: { quotation } })
})

export const getQuotationForRequest = asyncHandler(async (req, res) => {
  let requestId = req.params.id

  const allocation = await Allocation.findById(requestId)
  if (allocation) {
    requestId = allocation.requestId
  }

  const quotation = await Quotation.findOne({ requestId })
    .populate('vendorId', 'fullName email contractorProfile.companyName contractorProfile.experience contractorProfile.rating')
    .populate('adminId', 'fullName email')
    .lean()
  
  if (!quotation) {
    return sendSuccess(res, { data: null })
  }

  sendSuccess(res, { data: { quotation } })
})

export const respondToQuotationCorporate = asyncHandler(async (req, res) => {
  const { action, feedback } = req.body // 'approve', 'reject', 'revision'
  const quotation = await Quotation.findOne({ requestId: req.params.id })
  if (!quotation) {
    return sendError(res, { message: 'Quotation not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const request = await WorkforceRequest.findById(quotation.requestId)
  if (!request) {
    return sendError(res, { message: 'Workforce request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (action === 'approve') {
    quotation.status = 'approved'
    
    // In new flow, fees are paid upfront. Once quotation is approved, project becomes active.
    request.status = 'project_active'
    request.labourCharge = quotation.grandTotal
    
    await request.save()

    // Trigger Commission Generation if applicable (only if vendor involved)
    if (quotation.vendorId && request.revenueModel === 'platform_fee_plus_commission' && request.commissionTrigger === 'after_quotation_accepted') {
      try {
        await CommissionService.generateCommission(request, quotation)
      } catch (err) {
        console.error('Failed to generate commission on quotation approval:', err)
      }
    }
  } else if (action === 'reject') {
    quotation.status = 'rejected'
    request.status = 'rejected'
    await request.save()
  } else if (action === 'revision') {
    quotation.status = 'revision_requested'
    quotation.feedback = feedback || ''
  } else {
    return sendError(res, { message: 'Invalid action', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  await quotation.save()

  // Emit socket event to Vendor (if vendor exists)
  if (quotation.vendorId) {
    emitToVendor(quotation.vendorId.toString(), 'corporate_responded_quotation', {
      requestId: request._id.toString(),
      quotationId: quotation._id.toString(),
      action,
      status: quotation.status,
      feedback: quotation.feedback,
    })
    emitToVendor(quotation.vendorId.toString(), 'request_status_update', {
      requestId: request._id.toString(),
      status: request.status,
      quotationStatus: quotation.status,
      feedback: quotation.feedback,
    })
  }

  // Always emit socket event to Admin role room so Admin panel updates in real-time
  emitToRole('admin', 'corporate_responded_quotation', {
    requestId: request._id.toString(),
    quotationId: quotation._id.toString(),
    action,
    status: quotation.status,
    feedback: quotation.feedback,
  })
  emitToRole('admin', 'request_status_update', {
    requestId: request._id.toString(),
    status: request.status,
    quotationStatus: quotation.status,
    feedback: quotation.feedback,
  })

  // Emit general request status updates to Corporate client
  emitToCorporate(request.clientId.toString(), 'request_status_update', {
    requestId: request._id.toString(),
    status: request.status,
    quotationStatus: quotation.status,
  })

  // Confirm to the corporate client that their response reached admin
  notifyCorporateClient(
    request,
    action === 'approve' ? 'quotation_accept_sent' : action === 'reject' ? 'quotation_reject_sent' : 'quotation_revision_sent',
  )

  // Send Notification to Admins
  try {
    const adminUsers = await User.find({ role: { $in: ['admin', 'superadmin'] } }).select('_id')
    const adminIds = adminUsers.map((a) => a._id)
    const clientName = request.clientId?.corporateProfile?.companyName || request.clientId?.fullName || 'Corporate Client'

    let notifTitle = 'Quotation Update'
    let notifBody = `${clientName} updated quotation for request ${request.reference}`
    if (action === 'revision') {
      notifTitle = 'Quotation Revision Requested'
      notifBody = `${clientName} requested price revision for ${request.reference}: "${quotation.feedback}"`
    } else if (action === 'approve') {
      notifTitle = 'Quotation Approved'
      notifBody = `${clientName} approved quotation for ${request.reference}. Project is now Active!`
    } else if (action === 'reject') {
      notifTitle = 'Quotation Rejected'
      notifBody = `${clientName} rejected quotation for ${request.reference}.`
    }

    sendNotificationToUsers(adminIds, notifTitle, notifBody, {
      requestId: request._id.toString(),
      recipientRole: 'admin',
      url: `/admin/client-requests`,
    }).catch(() => {})
  } catch (err) {
    console.error('Error sending admin notification on quotation response:', err)
  }

  sendSuccess(res, { data: { quotation, request } })
})

// Keep Admin compatibility endpoints
export const createQuotation = submitQuotationVendor

export const getQuotations = asyncHandler(async (req, res) => {
  const filter = {}
  if (req.query.requestId) filter.requestId = req.query.requestId
  if (req.query.vendorId) filter.vendorId = req.query.vendorId

  const quotations = await Quotation.find(filter)
    .populate('requestId')
    .populate('vendorId', 'fullName email')
    .sort({ createdAt: -1 })
    .lean()

  sendSuccess(res, { data: { quotations } })
})

export const approveQuotation = asyncHandler(async (req, res) => {
  const quotation = await Quotation.findById(req.params.id)
  if (!quotation) {
    return sendError(res, { message: 'Quotation not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  quotation.status = 'approved'
  await quotation.save()

  const pricing = await SystemPricing.findOne().lean()
  const corporateFeePercent = pricing?.corporate?.platformFee?.value || 5
  const vendorFeePercent = pricing?.vendor?.platformCommission?.value || 2
  
  const corporateFee = Math.round((quotation.grandTotal * corporateFeePercent) / 100)
  const vendorFee = Math.round((quotation.grandTotal * vendorFeePercent) / 100)

  const request = await WorkforceRequest.findByIdAndUpdate(quotation.requestId, {
    status: 'platform_fee_pending',
    labourCharge: quotation.grandTotal,
    userPlatformFee: corporateFee,
    labourPlatformFee: vendorFee,
    userPaymentStatus: 'pending',
    labourPaymentStatus: 'pending'
  }, { new: true })

  // Emit updates
  if (request) {
    emitToCorporate(request.clientId.toString(), 'request_status_update', {
      requestId: request._id.toString(),
      status: request.status
    })
    if (quotation.vendorId) {
      emitToVendor(quotation.vendorId.toString(), 'request_status_update', {
        requestId: request._id.toString(),
        status: request.status
      })
    }
    notifyCorporateClient(request, 'quotation_admin_approved')
  }

  sendSuccess(res, { data: { quotation } })
})

export const rejectQuotation = asyncHandler(async (req, res) => {
  const quotation = await Quotation.findById(req.params.id)
  if (!quotation) {
    return sendError(res, { message: 'Quotation not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  quotation.status = 'rejected'
  await quotation.save()
  
  const request = await WorkforceRequest.findByIdAndUpdate(quotation.requestId, {
    status: 'rejected'
  }, { new: true })

  if (request) {
    emitToCorporate(request.clientId.toString(), 'request_status_update', {
      requestId: request._id.toString(),
      status: request.status
    })
    if (quotation.vendorId) {
      emitToVendor(quotation.vendorId.toString(), 'request_status_update', {
        requestId: request._id.toString(),
        status: request.status
      })
    }
    notifyCorporateClient(request, 'quotation_admin_rejected')
  }

  sendSuccess(res, { data: { quotation } })
})
