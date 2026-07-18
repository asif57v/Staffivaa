import { Quotation } from '../models/Quotation.js'
import { SystemPricing } from '../models/SystemPricing.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { Allocation } from '../models/Allocation.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { emitToCorporate, emitToVendor } from '../utils/socket.js'

export const submitQuotationVendor = asyncHandler(async (req, res) => {
  const { requestId } = req.body

  const request = await WorkforceRequest.findById(requestId)
  if (!request) {
    return sendError(res, { message: 'Workforce request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Ensure request is in accepted or assigned state
  if (!['accepted', 'allocated', 'assigned'].includes(request.status)) {
    return sendError(res, { message: 'Cannot submit quotation for this request status', statusCode: HTTP_STATUS.BAD_REQUEST })
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
      vendorId: req.user._id,
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
    const pricing = await SystemPricing.findOne().lean()
    
    // Calculate platform fees based on pricing type (fixed or percentage)
    const corporateFeeType = pricing?.corporate?.platformFee?.type || 'percentage'
    const corporateFeeValue = pricing?.corporate?.platformFee?.value || 5
    const vendorFeeType = pricing?.vendor?.platformCommission?.type || 'percentage'
    const vendorFeeValue = pricing?.vendor?.platformCommission?.value || 2
    
    const corporateFee = corporateFeeType === 'fixed' 
      ? corporateFeeValue 
      : Math.round((quotation.grandTotal * corporateFeeValue) / 100)
      
    const vendorFee = vendorFeeType === 'fixed'
      ? vendorFeeValue
      : Math.round((quotation.grandTotal * vendorFeeValue) / 100)
    
    quotation.status = 'approved'
    
    request.status = 'platform_fee_pending'
    request.labourCharge = quotation.grandTotal
    request.userPlatformFee = corporateFee
    request.labourPlatformFee = vendorFee
    request.userPaymentStatus = 'pending'
    request.labourPaymentStatus = 'pending'
    
    await request.save()
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

  // Emit socket event to Vendor
  emitToVendor(quotation.vendorId.toString(), 'corporate_responded_quotation', {
    requestId: request._id.toString(),
    quotationId: quotation._id.toString(),
    action,
    status: quotation.status
  })

  // Emit general request status updates
  emitToCorporate(request.clientId.toString(), 'request_status_update', {
    requestId: request._id.toString(),
    status: request.status
  })
  
  emitToVendor(quotation.vendorId.toString(), 'request_status_update', {
    requestId: request._id.toString(),
    status: request.status
  })

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
    emitToVendor(quotation.vendorId.toString(), 'request_status_update', {
      requestId: request._id.toString(),
      status: request.status
    })
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
    emitToVendor(quotation.vendorId.toString(), 'request_status_update', {
      requestId: request._id.toString(),
      status: request.status
    })
  }

  sendSuccess(res, { data: { quotation } })
})
