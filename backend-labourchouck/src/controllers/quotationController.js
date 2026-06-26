import { Quotation } from '../models/Quotation.js'
import { SystemPricing } from '../models/SystemPricing.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

export const createQuotation = asyncHandler(async (req, res) => {
  const {
    requestId,
    labourWage,
    vendorServiceCharge,
    transportation,
    accommodation,
    food,
    safetyEquipment,
    otherCharges
  } = req.body

  if (!requestId || labourWage == null || vendorServiceCharge == null) {
    return sendError(res, {
      message: 'requestId, labourWage, and vendorServiceCharge are required',
      statusCode: HTTP_STATUS.BAD_REQUEST
    })
  }

  // Load active System Pricing settings
  let pricing = await SystemPricing.findOne()
  if (!pricing) {
    pricing = await SystemPricing.create({})
  }

  // Create Snapshot
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

  const quotation = await Quotation.create({
    requestId,
    vendorId: req.user._id,
    labourWage: Number(labourWage),
    vendorServiceCharge: Number(vendorServiceCharge),
    transportation: Number(transportation) || 0,
    accommodation: Number(accommodation) || 0,
    food: Number(food) || 0,
    safetyEquipment: Number(safetyEquipment) || 0,
    otherCharges: Number(otherCharges) || 0,
    pricingSnapshot,
    status: 'pending'
  })

  sendSuccess(res, { data: { quotation }, statusCode: HTTP_STATUS.CREATED })
})

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
    return sendError(res, {
      message: 'Quotation not found',
      statusCode: HTTP_STATUS.NOT_FOUND
    })
  }

  quotation.status = 'approved'
  await quotation.save()

  // Update workforce request status or attach quotation details if needed
  await WorkforceRequest.findByIdAndUpdate(quotation.requestId, {
    status: 'allocated', // update status representing allocated
    labourCharge: quotation.labourWage,
    userPlatformFee: 0 // platform fee is handled in billing or snapshot
  })

  sendSuccess(res, { data: { quotation } })
})
export const rejectQuotation = asyncHandler(async (req, res) => {
  const quotation = await Quotation.findById(req.params.id)
  if (!quotation) {
    return sendError(res, {
      message: 'Quotation not found',
      statusCode: HTTP_STATUS.NOT_FOUND
    })
  }
  quotation.status = 'rejected'
  await quotation.save()
  sendSuccess(res, { data: { quotation } })
})
