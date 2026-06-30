import { SystemPricing } from '../models/SystemPricing.js'
import { SystemPricingHistory } from '../models/SystemPricingHistory.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { getIO } from '../utils/socket.js'

// Deep helper to find changes between two plain objects
function getObjectDiff(oldObj, newObj, prefix = '') {
  const changes = []
  
  for (const key in newObj) {
    if (newObj.hasOwnProperty(key)) {
      const path = prefix ? `${prefix}.${key}` : key
      const oldVal = oldObj ? oldObj[key] : undefined
      const newVal = newObj[key]
      
      if (newVal && typeof newVal === 'object' && !Array.isArray(newVal)) {
        changes.push(...getObjectDiff(oldVal, newVal, path))
      } else {
        const oldStr = oldVal !== undefined && oldVal !== null ? String(oldVal) : ''
        const newStr = newVal !== undefined && newVal !== null ? String(newVal) : ''
        if (oldStr !== newStr) {
          changes.push({
            path,
            oldValue: oldVal,
            newValue: newVal
          })
        }
      }
    }
  }
  return changes
}

export const getSystemPricing = asyncHandler(async (req, res) => {
  let pricing = await SystemPricing.findOne().lean()
  if (!pricing) {
    pricing = await SystemPricing.create({})
    pricing = pricing.toObject()
  }

  const history = await SystemPricingHistory.find()
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('updatedBy', 'fullName email role')
    .lean()

  sendSuccess(res, { data: { pricing, history } })
})

export const getPricingHistory = asyncHandler(async (req, res) => {
  const history = await SystemPricingHistory.find()
    .sort({ createdAt: -1 })
    .populate('updatedBy', 'fullName email role')
    .lean()
  sendSuccess(res, { data: { history } })
})

export const getSettlementRules = asyncHandler(async (req, res) => {
  let pricing = await SystemPricing.findOne().lean()
  if (!pricing) {
    pricing = await SystemPricing.create({})
  }
  sendSuccess(res, { data: { settlementRules: pricing.settlementRules } })
})

export const updateSettlementRules = asyncHandler(async (req, res) => {
  const { settlementRules, reason } = req.body

  if (!reason || !reason.trim()) {
    return sendError(res, {
      message: 'Reason for update is required',
      statusCode: HTTP_STATUS.BAD_REQUEST
    })
  }

  if (!settlementRules) {
    return sendError(res, {
      message: 'Settlement rules configuration is required',
      statusCode: HTTP_STATUS.BAD_REQUEST
    })
  }

  let pricingDoc = await SystemPricing.findOne()
  if (!pricingDoc) {
    pricingDoc = new SystemPricing({})
  }

  const oldObject = pricingDoc.toObject()

  // Update settlementRules block
  pricingDoc.settlementRules = {
    ...pricingDoc.settlementRules,
    ...settlementRules
  }

  await pricingDoc.save()
  const newObject = pricingDoc.toObject()

  const changes = getObjectDiff(oldObject, newObject)
  if (changes.length > 0) {
    await SystemPricingHistory.create({
      updatedBy: req.user._id,
      reason: reason.trim(),
      changes,
      snapshot: newObject
    })
  }

  sendSuccess(res, { data: { settlementRules: newObject.settlementRules } })
})

export const updateSystemPricing = asyncHandler(async (req, res) => {
  const { config, reason } = req.body

  if (!reason || !reason.trim()) {
    return sendError(res, {
      message: 'Reason for update is required',
      statusCode: HTTP_STATUS.BAD_REQUEST
    })
  }

  if (!config) {
    return sendError(res, {
      message: 'Configuration body is required',
      statusCode: HTTP_STATUS.BAD_REQUEST
    })
  }

  const validateField = (val, max = null, label = '') => {
    if (val !== undefined && val !== null && val !== '') {
      const num = Number(val)
      if (num < 0) throw new Error(`${label} cannot be negative`)
      if (max !== null && num > max) throw new Error(`${label} cannot exceed ${max}`)
    }
  }

  try {
    // User Booking
    const ub = config.userBooking || {}
    if (ub.platformFee) {
      validateField(ub.platformFee.value, ub.platformFee.type === 'percentage' ? 100 : null, 'User Platform Fee')
      validateField(ub.platformFee.minFee, null, 'User Minimum Fee')
      validateField(ub.platformFee.maxFee, null, 'User Maximum Fee')
      if (ub.platformFee.minFee && ub.platformFee.maxFee && Number(ub.platformFee.minFee) > Number(ub.platformFee.maxFee)) {
        throw new Error('User minimum fee cannot exceed maximum fee')
      }
    }
    if (ub.gst) validateField(ub.gst.rate, 100, 'User GST')
    if (ub.convenienceFee) validateField(ub.convenienceFee.amount, null, 'User Convenience Fee')
    if (ub.cancellation) {
      validateField(ub.cancellation.user, null, 'User cancellation charge')
      validateField(ub.cancellation.labour, null, 'Labour cancellation charge')
    }

    // Corporate
    const corp = config.corporate || {}
    if (corp.platformFee) {
      validateField(corp.platformFee.value, corp.platformFee.type === 'percentage' ? 100 : null, 'Corporate Platform Fee')
      validateField(corp.platformFee.minFee, null, 'Corporate Minimum Fee')
      validateField(corp.platformFee.maxFee, null, 'Corporate Maximum Fee')
      if (corp.platformFee.minFee && corp.platformFee.maxFee && Number(corp.platformFee.minFee) > Number(corp.platformFee.maxFee)) {
        throw new Error('Corporate minimum fee cannot exceed maximum fee')
      }
    }
    validateField(corp.advancePercentage, 100, 'Corporate Advance Percentage')
    validateField(corp.latePenalty, 100, 'Corporate Penalty')
    if (corp.gst) validateField(corp.gst.rate, 100, 'Corporate GST')

    if (corp.paymentDueBeforeStartHours !== undefined && corp.paymentDueBeforeStartHours !== null) {
      if (![24, 48, 72].includes(Number(corp.paymentDueBeforeStartHours))) {
        throw new Error('Corporate payment due hours must be 24, 48, or 72 hours')
      }
    }
    if (corp.autoReminder !== undefined && corp.autoReminder !== null) {
      corp.autoReminder = Boolean(corp.autoReminder)
    }

    // Vendor
    const vend = config.vendor || {}
    validateField(vend.registrationFee, null, 'Vendor Registration Fee')
    validateField(vend.renewalFee, null, 'Vendor Renewal Fee')
    if (vend.platformCommission) {
      validateField(vend.platformCommission.value, vend.platformCommission.type === 'percentage' ? 100 : null, 'Vendor Commission')
    }
    validateField(vend.settlementProcessingFee, null, 'Vendor Settlement Processing Fee')
    validateField(vend.withdrawalFee, null, 'Vendor Withdrawal Fee')
    if (vend.gst) validateField(vend.gst.rate, 100, 'Vendor GST')

    // Labour
    const lab = config.labour || {}
    validateField(lab.verificationFee, null, 'Labour Verification Fee')
    validateField(lab.walletWithdrawalFee, null, 'Labour Withdrawal Fee')
    validateField(lab.walletTransferFee, null, 'Labour Wallet Transfer Fee')
    if (lab.platformFee) {
      if (lab.platformFee.type === 'distance') {
        const slabs = lab.platformFee.slabs || [];
        if (slabs.length === 0) {
          throw new Error('Distance slabs cannot be empty when Distance Based mode is selected');
        }
        const sortedSlabs = [...slabs].sort((a, b) => Number(a.minDistance || 0) - Number(b.minDistance || 0));
        
        for (let i = 0; i < sortedSlabs.length; i++) {
          const slab = sortedSlabs[i];
          const min = Number(slab.minDistance || 0);
          const fee = Number(slab.fee || 0);
          if (min < 0) throw new Error('Min distance cannot be negative');
          if (fee < 0) throw new Error('Slab fee cannot be negative');
          
          if (slab.maxDistance !== null && slab.maxDistance !== undefined && slab.maxDistance !== '') {
            const max = Number(slab.maxDistance);
            if (min >= max) {
              throw new Error(`Invalid slab range: ${min} km to ${max} km`);
            }
          }
          
          if (i > 0) {
            const prev = sortedSlabs[i - 1];
            if (prev.maxDistance === null || prev.maxDistance === undefined || prev.maxDistance === '') {
              throw new Error('Only the last distance slab can have an unlimited end range');
            }
            if (Number(prev.maxDistance) !== min) {
              throw new Error(`Distance slabs must be continuous. Gap detected between ${prev.maxDistance} km and ${min} km`);
            }
          }
        }
        
        const lastSlab = sortedSlabs[sortedSlabs.length - 1];
        if (lastSlab.maxDistance !== null && lastSlab.maxDistance !== undefined && lastSlab.maxDistance !== '') {
          throw new Error('The last distance slab must have an unlimited end range (To Distance left blank)');
        }
      } else {
        validateField(lab.platformFee.value, lab.platformFee.type === 'percentage' ? 100 : null, 'Labour Platform Fee')
      }
    }
    if (lab.gst) validateField(lab.gst.rate, 100, 'Labour GST')

    // GST Settings
    const gstS = config.gstSettings || {}
    validateField(gstS.percentage, 100, 'GST Settings Rate')

    // Settlement Rules
    const sr = config.settlementRules || {}
    validateField(sr.minWithdrawal, null, 'Minimum Withdrawal')
    validateField(sr.maxWithdrawal, null, 'Maximum Withdrawal')
    if (sr.minWithdrawal && sr.maxWithdrawal && Number(sr.minWithdrawal) > Number(sr.maxWithdrawal)) {
      throw new Error('Minimum withdrawal cannot exceed maximum withdrawal')
    }

  } catch (err) {
    return sendError(res, {
      message: err.message || 'Validation error',
      statusCode: HTTP_STATUS.BAD_REQUEST
    })
  }

  let pricingDoc = await SystemPricing.findOne()
  if (!pricingDoc) {
    pricingDoc = new SystemPricing({})
  }

  const oldObject = pricingDoc.toObject()
  
  pricingDoc.userBooking = config.userBooking
  pricingDoc.corporate = config.corporate
  pricingDoc.vendor = config.vendor
  pricingDoc.labour = config.labour
  pricingDoc.gstSettings = config.gstSettings
  pricingDoc.settlementRules = config.settlementRules

  await pricingDoc.save()
  const newObject = pricingDoc.toObject()

  const changes = getObjectDiff(oldObject, newObject)

  if (changes.length > 0) {
    await SystemPricingHistory.create({
      updatedBy: req.user._id,
      reason: reason.trim(),
      changes,
      snapshot: newObject
    })

    try {
      const io = getIO()
      io.emit('platformFeeConfigurationUpdated', { pricing: newObject })
      console.log('[Socket.io] Emitted platformFeeConfigurationUpdated')
    } catch (err) {
      console.error('Socket emit platformFeeConfigurationUpdated failed:', err.message)
    }
  }

  const history = await SystemPricingHistory.find()
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('updatedBy', 'fullName email role')
    .lean()

  sendSuccess(res, { data: { pricing: newObject, history }, statusCode: HTTP_STATUS.OK })
})
