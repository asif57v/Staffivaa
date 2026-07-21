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
import { SystemPricing } from '../models/SystemPricing.js'
import { Offer } from '../models/Offer.js'
import { Quotation } from '../models/Quotation.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { emitToUser, emitToRole, emitToCorporate, emitToVendor } from '../utils/socket.js'
import { sendNotificationToUser } from '../services/notificationService.js'
import { logAudit } from '../utils/auditLogger.js'
import CommissionService from '../services/CommissionService.js'
import { triggerNotification } from '../utils/notificationTrigger.js'
import { SystemSettings } from '../models/SystemSettings.js'
import LocationMatchingService from '../services/LocationMatchingService.js'

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
    vendorSearchRadius,
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

  // Calculate dynamic platform fee based on duration and backend settings
  let totalDurationInDays = 1;
  if (endDate && startDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24))
    totalDurationInDays = Math.max(1, diffDays + 1)
  }

  // Load backend pricing configuration
  let pricing = await SystemPricing.findOne()
  if (!pricing) {
    pricing = await SystemPricing.create({})
  }
  
  // Load system settings for revenue config snapshot
  let settings = await SystemSettings.findOne({ singletonId: 'SYSTEM_SETTINGS' })
  if (!settings) {
    settings = await SystemSettings.create({ singletonId: 'SYSTEM_SETTINGS' })
  }

  // Estimate total labor cost to compute percentage fees
  const LabourCategory = mongoose.model('LabourCategory')
  const categoryIds = parsedLines.map((l) => l.categoryId)
  const categories = await LabourCategory.find({ _id: { $in: categoryIds } }).lean()
  const categoryMap = {}
  categories.forEach((c) => {
    categoryMap[c._id.toString()] = c.baseRate || 800
  })

  let totalWorkers = 0
  let estimatedLabourCostPerDay = 0
  parsedLines.forEach((l) => {
    const qty = l.quantity || 1
    const rate = categoryMap[l.categoryId.toString()] || 800
    totalWorkers += qty
    estimatedLabourCostPerDay += qty * rate
  })
  const estimatedTotalLabourCost = estimatedLabourCostPerDay * totalDurationInDays

  let userPlatformFee = 20
  let userGstRate = 18
  let convFee = 0
  let platformFeeType = 'fixed'
  let platformFeeValue = 20

  if (sourceType === REQUEST_SOURCE.INDIVIDUAL) {
    const pfConfig = pricing.userBooking.platformFee
    platformFeeType = pfConfig.type || 'percentage'
    platformFeeValue = pfConfig.value || 10
    
    if (pfConfig.status === 'disabled') {
      userPlatformFee = 0
    } else {
      if (platformFeeType === 'percentage') {
        userPlatformFee = (estimatedTotalLabourCost * platformFeeValue) / 100
      } else {
        userPlatformFee = platformFeeValue
      }
      // Bounding
      if (pfConfig.minFee !== undefined && userPlatformFee < pfConfig.minFee) {
        userPlatformFee = pfConfig.minFee
      }
      if (pfConfig.maxFee !== undefined && userPlatformFee > pfConfig.maxFee) {
        userPlatformFee = pfConfig.maxFee
      }
    }

    if (pricing.userBooking.gst?.enabled) {
      userGstRate = pricing.userBooking.gst.rate || 18
    } else {
      userGstRate = 0
    }

    if (pricing.userBooking.convenienceFee?.enabled) {
      convFee = pricing.userBooking.convenienceFee.amount || 20
    }


  } else {
    // Corporate
    const pfConfig = pricing.corporate.platformFee
    platformFeeType = pfConfig.type || 'perWorkerPerDay'
    platformFeeValue = pfConfig.value || 25

    if (platformFeeType === 'percentage') {
      userPlatformFee = (estimatedTotalLabourCost * platformFeeValue) / 100
    } else if (platformFeeType === 'fixed') {
      userPlatformFee = platformFeeValue
    } else if (platformFeeType === 'perWorker') {
      userPlatformFee = platformFeeValue * totalWorkers
    } else if (platformFeeType === 'perWorkerPerDay') {
      userPlatformFee = platformFeeValue * totalWorkers * totalDurationInDays
    }

    // Bounding
    if (pfConfig.minFee !== undefined && pfConfig.minFee > 0 && userPlatformFee < pfConfig.minFee) {
      userPlatformFee = pfConfig.minFee
    }
    if (pfConfig.maxFee !== undefined && pfConfig.maxFee > 0 && userPlatformFee > pfConfig.maxFee) {
      userPlatformFee = pfConfig.maxFee
    }

    if (pricing.corporate.gst?.enabled) {
      userGstRate = pricing.corporate.gst.rate || 18
    } else {
      userGstRate = 0
    }
    
    if (pricing.corporate.convenienceFee?.enabled) {
      convFee = pricing.corporate.convenienceFee.amount || 20
    }
  }

  // Check for dynamic category offers (applies to both Individual and Corporate)
  let appliedOfferId = null
  let originalPlatformFee = userPlatformFee
  
  if (userPlatformFee > 0 && Array.isArray(parsedLines) && parsedLines.length > 0) {
    const primaryCategoryId = parsedLines[0].categoryId
    
    const activeOffer = await Offer.findOne({
      isActive: true,
      discountPercentage: { $gt: 0 },
      $or: [
        { categories: { $size: 0 } },
        { categories: primaryCategoryId.toString() }
      ],
      $expr: {
        $or: [
          { $eq: ['$maxUsageLimit', 0] },
          { $lt: ['$currentUsageCount', '$maxUsageLimit'] }
        ]
      }
    })

    if (activeOffer) {
      const discountValue = (userPlatformFee * activeOffer.discountPercentage) / 100
      userPlatformFee = Math.max(0, userPlatformFee - discountValue)
      appliedOfferId = activeOffer._id
    }
  }

  let labourPlatformFeeValue = 20
  if (pricing?.labour?.platformFee) {
    const pf = pricing.labour.platformFee
    if (pf.type === 'percentage') {
      labourPlatformFeeValue = (estimatedTotalLabourCost * (pf.value ?? 10)) / 100
    } else {
      labourPlatformFeeValue = pf.value ?? 20
    }
  }

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
    locationPoint: (Number.isFinite(Number(req.body.locationLat)) && Number.isFinite(Number(req.body.locationLng))) 
      ? { type: 'Point', coordinates: [Number(req.body.locationLng), Number(req.body.locationLat)] } 
      : undefined,
    vendorSearchRadius: Number.isFinite(Number(vendorSearchRadius)) ? Number(vendorSearchRadius) : undefined,
    notes,
    billingMode,
    bookingType,
    labourCharge: Math.round(estimatedTotalLabourCost),
    userPlatformFee: Math.round(userPlatformFee),
    labourPlatformFee: Math.round(labourPlatformFeeValue),
    userGstRate,
    convenienceFee: convFee,
    platformFeeType,
    platformFeeValue,
    appliedOfferId: appliedOfferId || undefined,
    originalPlatformFee: originalPlatformFee || undefined,
    workers: [],
    
    // Inject Commission Snapshot Config from SystemSettings
    revenueModel: settings.revenueModel,
    commissionEnabled: settings.commissionEnabled,
    commissionType: settings.commissionType,
    commissionValue: settings.commissionValue,
    commissionTrigger: settings.commissionTrigger,
    commissionDueDays: settings.commissionDueDays,

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
      // Filter by radius: location MUST be available
      let matchingWorkers = [];
      if (request.locationLat && request.locationLng) {
        matchingWorkers = workers.filter(w => {
          if (!w.labourProfile || !w.labourProfile.locationLat || !w.labourProfile.locationLng) {
            return false; // Skip if worker has no location set
          }
          const radius = w.labourProfile.workRadius || 15; // default 15km
          
          const R = 6371; // Radius of the earth in km
          const dLat = (w.labourProfile.locationLat - request.locationLat) * (Math.PI/180);
          const dLon = (w.labourProfile.locationLng - request.locationLng) * (Math.PI/180);
          const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(request.locationLat * (Math.PI/180)) * Math.cos(w.labourProfile.locationLat * (Math.PI/180)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distance = R * c;
          
          return distance <= radius;
        });
      }

      if (matchingWorkers.length > 0) {
        const allocation = await Allocation.create({
          requestId: request._id,
          notes: 'Auto-allocated by skill and distance match for individual booking',
        })

        const LabourCategory = mongoose.model('LabourCategory')
        const category = await LabourCategory.findById(categoryId)
        const baseRate = category?.baseRate || 800

        const assignmentsToCreate = matchingWorkers.map((worker) => ({
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
        sendNotificationToUser(assignment.labourId.toString(), 'New Job Available!', 'A new job matching your skills is available. Tap to view.', { url: '/app/jobs' })
      })
      }
    }
  }

  emitToUser('individual', user._id.toString(), 'request_created', { requestId: request._id.toString() })
  if (sourceType === REQUEST_SOURCE.CORPORATE) {
    if (settings?.radiusConfig?.enableRadiusMatching) {
      console.log(`[LocationMatching] Finding eligible vendors for request ${request._id}`)
      const eligibleVendorIds = await LocationMatchingService.findEligibleVendors(request, settings.radiusConfig)
      
      console.log(`[LocationMatching] Found ${eligibleVendorIds.length} eligible vendors. Dispatching sockets...`)
      for (const vId of eligibleVendorIds) {
        emitToVendor(vId, 'corporate_request_created', { requestId: request._id.toString() })
      }
    } else {
      console.log(`[Socket] Emitting corporate_request_created to contractor and vendor roles (radius matching disabled)`)
      emitToRole('contractor', 'corporate_request_created', { requestId: request._id.toString() })
      emitToRole('vendor', 'corporate_request_created', { requestId: request._id.toString() })
    }
  }

  sendSuccess(res, { data: { request } }, HTTP_STATUS.CREATED)
})

export const listMyRequests = asyncHandler(async (req, res) => {
  const filter = { clientId: req.user._id }
  if (req.query.status) filter.status = req.query.status
  if (req.query.projectId) filter.projectId = req.query.projectId
  if (req.query.siteId) filter.siteId = req.query.siteId
  const requests = await WorkforceRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('projectId', 'name')
    .populate('siteId', 'name')
    .populate('lines.categoryId', 'name group')
    .lean()
  sendSuccess(res, { data: { requests } })
})

export const getRequest = asyncHandler(async (req, res) => {
  const request = await WorkforceRequest.findById(req.params.id)
    .populate('projectId', 'name')
    .populate('siteId', 'name')
    .populate('clientId', 'fullName corporateProfile.companyName')
    .populate('lines.categoryId', 'name baseRate')
    .lean()
  if (!request) return sendError(res, { message: 'Not found', statusCode: HTTP_STATUS.NOT_FOUND })

  const allocation = await Allocation.findOne({ requestId: request._id })
    .populate('vendorId', 'fullName phone email contractorProfile.companyName contractorProfile.businessAddress')
    .lean()
  const assignments = await Assignment.find({ requestId: request._id })
    .populate('labourId', 'fullName phone profileImageUrl labourProfile.kycStatus corporateProfile.registeredAddress contractorProfile.businessAddress')
    .lean()

  const quotation = await Quotation.findOne({ requestId: request._id }).lean()

  const isOwner = request.clientId && String(request.clientId._id || request.clientId) === String(req.user._id)
  const isAdmin = req.user.role === USER_ROLES.ADMIN
  const isAllocatedVendor = allocation && allocation.vendorId && String(allocation.vendorId._id || allocation.vendorId) === String(req.user._id)

  if (!isOwner && !isAdmin && !isAllocatedVendor) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }
    
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

  // Use quotation's grand total as the totalLabourCost if quotation is approved
  let totalLabourCost = allocation?.totalLabourCost || 0;
  if (quotation && quotation.status === 'approved') {
    totalLabourCost = quotation.grandTotal;
  }

  const userPlatformFee = request.userPlatformFee !== undefined ? request.userPlatformFee : platformFee;
  const labourPlatformFee = request.labourPlatformFee !== undefined ? request.labourPlatformFee : 0;
  const convenienceFee = request.convenienceFee !== undefined ? request.convenienceFee : 0;
  const gstRate = request.sourceType === 'individual' ? 0 : (request.userGstRate !== undefined ? request.userGstRate : 18);
  const gstAmount = Math.round((userPlatformFee * gstRate) / 100);
  const grandTotal = totalLabourCost + userPlatformFee + gstAmount + convenienceFee + extraCost;
  
  const { SystemPricing } = await import('../models/SystemPricing.js')
  const pricingDoc = await SystemPricing.findOne().lean()
  const advancePercentage = pricingDoc?.corporate?.advancePercentage || 30
  const advanceAmount = Math.round((grandTotal * advancePercentage) / 100)
  const remainingAmount = grandTotal - advanceAmount

  const paymentSummary = {
    serviceCost,
    extraCost,
    userPlatformFee,
    labourPlatformFee,
    convenienceFee,
    gstRate,
    gstAmount,
    totalDurationInDays,
    totalLabourCost,
    platformFee,
    grandTotal,
    advancePercentage,
    advanceAmount,
    remainingAmount,
    totalAmount: grandTotal
  }

  sendSuccess(res, { data: { request, allocation, assignments, paymentSummary, quotation } })
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

  const previousStatus = request.status
  request.status = status
  if (adminNote != null) request.adminNote = String(adminNote).trim()
  if (req.body.paymentDeadlineExtendedAt !== undefined) {
    request.paymentDeadlineExtendedAt = req.body.paymentDeadlineExtendedAt ? new Date(req.body.paymentDeadlineExtendedAt) : null
  }
  request.reviewedBy = req.user._id
  request.reviewedAt = new Date()
  await request.save()

  // Log audit trail
  await logAudit({
    adminId: req.user._id,
    action: 'Update Booking Status',
    previousValue: { status: previousStatus },
    newValue: { status },
    module: 'Operations',
    req
  })

  // Trigger Commission if completed
  if (status === 'completed' && request.revenueModel === 'platform_fee_plus_commission' && request.commissionTrigger === 'after_project_completed') {
    try {
      const quotation = await Quotation.findOne({ requestId: request._id, status: 'approved' })
      if (quotation) {
        await CommissionService.generateCommission(request, quotation)
      }
    } catch (err) {
      console.error('Failed to generate commission on project completion:', err)
    }
  }

  // Trigger Notification to client
  await triggerNotification({
    userId: request.clientId,
    title: 'Booking Update',
    body: `Your booking status has been updated to ${status}.`,
    type: 'BOOKING_UPDATED',
    relatedId: request._id,
    relatedModel: 'WorkforceRequest'
  })
  
  emitToUser('individual', request.clientId?.toString(), 'request_updated', { requestId: request._id.toString() })
  
  if (request.sourceType === REQUEST_SOURCE.CORPORATE) {
    emitToCorporate(request.clientId?.toString(), 'request_status_update', { requestId: request._id.toString(), status: request.status })
    
    // Also notify the vendor if one is allocated
    Allocation.findOne({ requestId: request._id }).then(allocation => {
      if (allocation && allocation.vendorId) {
        emitToVendor(allocation.vendorId.toString(), 'request_status_update', { requestId: request._id.toString(), status: request.status })
      }
    }).catch(err => console.error(err))
  }
  
  sendSuccess(res, { data: { request } })
})

export const sendPaymentReminderAdmin = asyncHandler(async (req, res) => {
  const request = await WorkforceRequest.findById(req.params.id)
  if (!request) return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })

  // Send notification to corporate client
  sendNotificationToUser(
    request.clientId.toString(),
    'Payment Reminder',
    `This is a reminder to complete your pending payment for project "${request.projectId?.name || request.reference}".`,
    { url: `/corporate/requests/${request._id}` }
  )

  sendSuccess(res, { message: 'Payment reminder sent successfully' })
})

export const recordOfflinePaymentAdmin = asyncHandler(async (req, res) => {
  const request = await WorkforceRequest.findById(req.params.id)
  if (!request) return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })

  if (request.status === 'payment_pending') {
    request.advancePaymentStatus = 'paid'
    request.status = 'advance_paid'
    const startDate = new Date(request.startDate)
    if (new Date() >= startDate) {
      request.status = 'project_active'
    }

    if (request.sourceType === REQUEST_SOURCE.CORPORATE) {
      try {
        const { SystemPricing } = await import('../models/SystemPricing.js')
        const pricing = await SystemPricing.findOne().lean()
        const advancePercent = pricing?.corporate?.advancePercentage || 30

        const allocation = await Allocation.findOne({ requestId: request._id })
        if (allocation && allocation.vendorId) {
          const totalLabourCost = allocation.totalLabourCost || 0
          const vendorAdvance = Math.round((totalLabourCost * advancePercent) / 100)

          allocation.vendorAdvancePaidAmount = vendorAdvance
          await allocation.save()

          const { Settlement } = await import('../models/Settlement.js')
          await Settlement.create({
            reference: `STL-ADV-${Date.now()}`,
            requestId: request._id,
            vendorId: allocation.vendorId,
            clientId: request.clientId,
            projectId: request.projectId,
            milestone: 'advance',
            status: 'settlement_completed',
            financials: {
              grossEarnings: vendorAdvance,
              platformFee: 0,
              gst: 0,
              otherDeductions: 0,
              netSettlement: vendorAdvance
            }
          })

          await User.findByIdAndUpdate(allocation.vendorId, {
            $inc: { walletBalance: vendorAdvance }
          })

          const { WalletTransaction } = await import('../models/WalletTransaction.js')
          await WalletTransaction.create({
            transactionId: `TXN-ADV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            bookingId: request._id,
            payerId: request.clientId,
            payerName: 'Admin Offline Record',
            payerType: 'corporate',
            labourId: allocation.vendorId,
            type: 'Settlement',
            source: 'Project Advance Offline Credit (Vendor Share)',
            amount: vendorAdvance,
            status: 'Completed'
          })
        }
      } catch (err) {
        console.error('[recordOfflinePaymentAdmin] Vendor advance credit failed:', err.message)
      }
    }
  } else if (request.status === 'completed' || request.status === 'settlement_pending') {
    request.finalPaymentStatus = 'paid'
    request.status = 'settlement_completed'
  } else {
    return sendError(res, { message: `Payment is not pending for current status: ${request.status}`, statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  await request.save()
  
  if (request.sourceType === REQUEST_SOURCE.CORPORATE) {
    emitToCorporate(request.clientId?.toString(), 'request_status_update', { requestId: request._id.toString(), status: request.status })
    Allocation.findOne({ requestId: request._id }).then(allocation => {
      if (allocation && allocation.vendorId) {
        emitToVendor(allocation.vendorId.toString(), 'request_status_update', { requestId: request._id.toString(), status: request.status })
      }
    }).catch(err => console.error(err))
  }

  sendSuccess(res, { message: 'Offline payment recorded successfully', request })
})

export const releaseVendorSettlementAdmin = asyncHandler(async (req, res) => {
  const request = await WorkforceRequest.findById(req.params.id)
  if (!request) return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })

  if (request.status !== 'completed' && request.status !== 'settlement_pending' && request.status !== 'settlement_completed') {
    return sendError(res, { message: 'Project must be completed or pending settlement to release payout', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const pricing = await SystemPricing.findOne().lean()
  const commissionConfig = pricing?.vendor?.platformCommission || { type: 'percentage', value: 2 }

  const allocation = await Allocation.findOne({ requestId: request._id }).lean()
  if (!allocation) {
    return sendError(res, { message: 'No workforce allocation found for this project', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const totalLabourCost = allocation.totalLabourCost || 0
  let vendorPlatformFee = 0
  if (commissionConfig.type === 'percentage') {
    vendorPlatformFee = Math.round((totalLabourCost * (commissionConfig.value ?? 2)) / 100)
  } else {
    vendorPlatformFee = commissionConfig.value ?? 20
  }

  const extraWorkRequests = await ExtraWorkRequest.find({ bookingId: request._id, status: 'accepted' }).lean()
  let extraCost = 0
  extraWorkRequests.forEach(ew => {
    extraCost += ew.revisedAmount != null ? ew.revisedAmount : ew.extraAmount
  })

  const vendorAdvancePaidAmount = allocation.vendorAdvancePaidAmount || 0
  const netAmountToVendor = totalLabourCost + extraCost - vendorPlatformFee - vendorAdvancePaidAmount

  if (allocation.vendorId) {
    const { WalletTransaction } = await import('../models/WalletTransaction.js')

    const existingTx = await WalletTransaction.findOne({
      bookingId: request._id,
      type: 'Settlement',
      source: /Final Settlement/
    })

    if (existingTx) {
      return sendError(res, { message: 'Final settlement already released for this project', statusCode: HTTP_STATUS.BAD_REQUEST })
    }

    await User.findByIdAndUpdate(allocation.vendorId, {
      $inc: { walletBalance: netAmountToVendor }
    })

    await WalletTransaction.create({
      transactionId: `TXN-VND-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      bookingId: request._id,
      payerId: request.clientId,
      payerName: 'System Release',
      payerType: 'corporate',
      labourId: allocation.vendorId,
      type: 'Settlement',
      source: 'Admin Final Settlement Manual Release (Vendor Share)',
      amount: netAmountToVendor,
      status: 'Completed'
    })
    
    request.settlementLedger.push({
      amount: netAmountToVendor,
      type: 'Final',
      method: req.body.method || 'RazorpayX',
      reference: req.body.reference || `TXN-VND-${Date.now()}`,
      adminName: req.user?.firstName ? `${req.user.firstName} ${req.user.lastName}` : 'System Admin',
      date: new Date()
    })
  }

  request.finalPaymentStatus = 'paid'
  request.status = 'settlement_completed'
  await request.save()

  await logAudit({
    adminId: req.user._id,
    action: 'Final Settlement Released',
    previousValue: null,
    newValue: { amount: netAmountToVendor },
    module: 'Finance',
    req
  })

  if (request.sourceType === REQUEST_SOURCE.CORPORATE) {
    emitToCorporate(request.clientId?.toString(), 'request_status_update', { requestId: request._id.toString(), status: request.status })
    emitToVendor(allocation.vendorId.toString(), 'request_status_update', { requestId: request._id.toString(), status: request.status })
  }

  sendSuccess(res, { message: 'Settlement released to vendor wallet successfully', request })
})

export const releasePartialSettlementAdmin = asyncHandler(async (req, res) => {
  const { amount, method, reference, notes } = req.body
  const request = await WorkforceRequest.findById(req.params.id)
  if (!request) return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })

  const allocation = await Allocation.findOne({ requestId: request._id }).lean()
  if (!allocation || !allocation.vendorId) {
    return sendError(res, { message: 'No workforce allocation found for this project', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  request.settlementLedger.push({
    amount: Number(amount),
    type: 'Partial',
    method: method || 'Manual Bank Transfer',
    reference: reference || '',
    adminName: req.user?.firstName ? `${req.user.firstName} ${req.user.lastName}` : 'System Admin',
    date: new Date()
  })

  request.status = 'partially_released'
  await request.save()

  const { WalletTransaction } = await import('../models/WalletTransaction.js')
  await WalletTransaction.create({
    transactionId: `TXN-PRT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    bookingId: request._id,
    payerId: request.clientId,
    payerName: 'Admin Partial Release',
    payerType: 'system',
    labourId: allocation.vendorId,
    type: 'Settlement',
    source: 'Partial Settlement',
    amount: Number(amount),
    status: 'Completed'
  })

  await User.findByIdAndUpdate(allocation.vendorId, {
    $inc: { walletBalance: Number(amount) }
  })

  await logAudit({
    adminId: req.user._id,
    action: 'Partial Settlement Released',
    previousValue: null,
    newValue: { amount },
    reason: notes,
    module: 'Finance',
    req
  })

  sendSuccess(res, { message: 'Partial settlement released', request })
})

export const holdSettlementAdmin = asyncHandler(async (req, res) => {
  const { holdReason, holdNotes, expectedResumeDate, status } = req.body
  const request = await WorkforceRequest.findById(req.params.id)
  if (!request) return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })

  if (status) {
    request.status = status
    if (status !== 'settlement_on_hold') {
      request.holdReason = null
      request.holdNotes = null
      request.expectedResumeDate = null
    }
  } else {
    request.status = 'settlement_on_hold'
    request.holdReason = holdReason
    request.holdNotes = holdNotes
    request.expectedResumeDate = expectedResumeDate ? new Date(expectedResumeDate) : null
  }
  await request.save()

  await logAudit({
    adminId: req.user._id,
    action: status === 'settlement_pending' ? 'Settlement Resumed' : 'Settlement Placed On Hold',
    previousValue: null,
    newValue: { holdReason, expectedResumeDate, status: request.status },
    reason: holdNotes,
    module: 'Finance',
    req
  })

  sendSuccess(res, { message: status === 'settlement_pending' ? 'Settlement resumed' : 'Settlement placed on hold', request })
})

export const addFinanceNoteAdmin = asyncHandler(async (req, res) => {
  const { note } = req.body
  const request = await WorkforceRequest.findById(req.params.id)
  if (!request) return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })

  request.adminFinanceNotes.push({
    note,
    adminName: req.user?.firstName ? `${req.user.firstName} ${req.user.lastName}` : 'System Admin',
    date: new Date()
  })
  await request.save()

  sendSuccess(res, { message: 'Finance note added', request })
})

export const payPlatformFee = asyncHandler(async (req, res) => {
  const request = await WorkforceRequest.findById(req.params.id)
  if (!request) return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })

  const user = await User.findById(req.user._id)
  if (!user) return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND })

  const { WalletTransaction } = await import('../models/WalletTransaction.js')

  let feeAmount = 0
  let isCorporate = false

  if (req.user.role === USER_ROLES.CONTRACTOR) {
    if (request.vendorPlatformFeeStatus === 'paid') {
      return sendError(res, { message: 'Vendor platform fee already paid', statusCode: HTTP_STATUS.BAD_REQUEST })
    }
    feeAmount = request.vendorPlatformFeeAmount || 111
  } else if (req.user.role === USER_ROLES.CORPORATE) {
    isCorporate = true
    if (request.corporatePlatformFeeStatus === 'paid') {
      return sendError(res, { message: 'Corporate platform fee already paid', statusCode: HTTP_STATUS.BAD_REQUEST })
    }
    feeAmount = request.corporatePlatformFeeAmount || 99
  } else {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  if (user.walletBalance < feeAmount) {
    return sendError(res, { message: 'Insufficient wallet balance to pay platform fee', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  user.walletBalance -= feeAmount
  await user.save()

  await WalletTransaction.create({
    transactionId: `FEE-${isCorporate ? 'CORP' : 'VEND'}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    bookingId: request._id,
    payerId: user._id,
    payerName: user.fullName || (isCorporate ? 'Corporate' : 'Vendor'),
    payerType: isCorporate ? 'corporate' : 'vendor',
    labourId: user._id,
    type: 'Debit',
    source: 'Lead Generation Platform Fee',
    amount: feeAmount,
    status: 'Completed'
  })
  

  if (isCorporate) {
    request.corporatePlatformFeeStatus = 'paid'
    request.corporatePlatformFeePaidAt = new Date()
    
    if (request.vendorPlatformFeeStatus === 'paid') {
      request.quotationUnlocked = true
      request.status = REQUEST_STATUS.QUOTATION_UNLOCKED
      Allocation.findOne({ requestId: request._id }).then(allocation => {
        if (allocation && allocation.vendorId) {
           emitToVendor(allocation.vendorId.toString(), 'quotation_unlocked', { requestId: request._id.toString() })
        }
      })
    } else {
      request.status = REQUEST_STATUS.VENDOR_PLATFORM_FEE_PENDING
    }
  } else {
    request.vendorPlatformFeeStatus = 'paid'
    request.vendorPlatformFeePaidAt = new Date()
    
    if (request.corporatePlatformFeeStatus === 'paid') {
      request.quotationUnlocked = true
      request.status = REQUEST_STATUS.QUOTATION_UNLOCKED
    } else {
      request.status = REQUEST_STATUS.CORPORATE_PLATFORM_FEE_PENDING
      emitToCorporate(request.clientId?.toString(), 'corporate_fee_pending', { requestId: request._id.toString() })
    }
  }

  await request.save()
  emitToCorporate(request.clientId?.toString(), 'request_status_update', { requestId: request._id.toString(), status: request.status })

  sendSuccess(res, { message: 'Platform fee paid successfully', request })
})
