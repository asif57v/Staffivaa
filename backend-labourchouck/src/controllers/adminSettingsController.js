import { SystemSettings } from '../models/SystemSettings.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/apiResponse.js'
import { logAudit } from '../utils/auditLogger.js'

export const getSettings = asyncHandler(async (req, res) => {
  let settings = await SystemSettings.findOne({ singletonId: 'SYSTEM_SETTINGS' })
  if (!settings) {
    settings = await SystemSettings.create({ singletonId: 'SYSTEM_SETTINGS' })
  }
  return sendSuccess(res, { data: { settings } })
})

export const updateSettings = asyncHandler(async (req, res) => {
  let settings = await SystemSettings.findOne({ singletonId: 'SYSTEM_SETTINGS' })
  if (!settings) {
    settings = await SystemSettings.create({ singletonId: 'SYSTEM_SETTINGS' })
  }

  const oldSettings = settings.toObject()

  const { 
    otpProvider, 
    paymentGateway, 
    enableVendorAutoAssignment, 
    maintenanceMode, 
    supportEmail,
    revenueModel,
    commissionEnabled,
    commissionType,
    commissionValue,
    commissionTrigger,
    commissionDueDays,
    minimumEnterpriseSecurityBalance,
    isEnterpriseSecurityBalanceEnabled,
    advancePaymentPercentage,
    remainingPaymentPercentage,
    platformFeeType,
    platformFeeValue,
    isGstEnabled,
    gstPercentage,
    paymentDueRule,
    advanceInvoiceDueDays,
    remainingInvoiceDueDays,
    remainingAttendanceDaysTrigger,
    enterpriseInvoiceDueDays,
    enterpriseInvoiceGracePeriodDays,
    reminderFrequencyHours,
    enableEnterpriseOverdueRestrictions,
    restrictJobCreationOnOverdue,
    restrictOfferSendOnOverdue,
    freezeAccountOnOverdue,
    blockAttendanceOnOverdue,
    requireManualApprovalOnOverdue,
    radiusConfig,
    timelineConfig
  } = req.body

  if (otpProvider != null) settings.otpProvider = otpProvider
  if (paymentGateway != null) settings.paymentGateway = paymentGateway
  if (enableVendorAutoAssignment != null) settings.enableVendorAutoAssignment = Boolean(enableVendorAutoAssignment)
  if (maintenanceMode != null) settings.maintenanceMode = Boolean(maintenanceMode)
  if (supportEmail != null) settings.supportEmail = String(supportEmail).trim()
  
  if (revenueModel != null) settings.revenueModel = String(revenueModel)
  if (commissionEnabled != null) settings.commissionEnabled = Boolean(commissionEnabled)
  if (commissionType != null) settings.commissionType = String(commissionType)
  if (commissionValue != null) settings.commissionValue = Number(commissionValue)
  if (commissionTrigger != null) settings.commissionTrigger = String(commissionTrigger)
  if (commissionDueDays != null) settings.commissionDueDays = Number(commissionDueDays)

  if (minimumEnterpriseSecurityBalance != null) settings.minimumEnterpriseSecurityBalance = Number(minimumEnterpriseSecurityBalance)
  if (isEnterpriseSecurityBalanceEnabled != null) settings.isEnterpriseSecurityBalanceEnabled = Boolean(isEnterpriseSecurityBalanceEnabled)
  if (advancePaymentPercentage != null) settings.advancePaymentPercentage = Number(advancePaymentPercentage)
  if (remainingPaymentPercentage != null) settings.remainingPaymentPercentage = Number(remainingPaymentPercentage)
  if (platformFeeType != null) settings.platformFeeType = String(platformFeeType)
  if (platformFeeValue != null) settings.platformFeeValue = Number(platformFeeValue)
  if (isGstEnabled != null) settings.isGstEnabled = Boolean(isGstEnabled)
  if (gstPercentage != null) settings.gstPercentage = Number(gstPercentage)
  if (paymentDueRule != null) settings.paymentDueRule = String(paymentDueRule)
  if (advanceInvoiceDueDays != null) settings.advanceInvoiceDueDays = Number(advanceInvoiceDueDays)
  if (remainingInvoiceDueDays != null) settings.remainingInvoiceDueDays = Number(remainingInvoiceDueDays)
  if (remainingAttendanceDaysTrigger != null) settings.remainingAttendanceDaysTrigger = Number(remainingAttendanceDaysTrigger)
  if (enterpriseInvoiceDueDays != null) settings.enterpriseInvoiceDueDays = Number(enterpriseInvoiceDueDays)
  if (enterpriseInvoiceGracePeriodDays != null) settings.enterpriseInvoiceGracePeriodDays = Number(enterpriseInvoiceGracePeriodDays)
  if (reminderFrequencyHours != null) settings.reminderFrequencyHours = Number(reminderFrequencyHours)
  if (enableEnterpriseOverdueRestrictions != null) settings.enableEnterpriseOverdueRestrictions = Boolean(enableEnterpriseOverdueRestrictions)
  if (restrictJobCreationOnOverdue != null) settings.restrictJobCreationOnOverdue = Boolean(restrictJobCreationOnOverdue)
  if (restrictOfferSendOnOverdue != null) settings.restrictOfferSendOnOverdue = Boolean(restrictOfferSendOnOverdue)
  if (freezeAccountOnOverdue != null) settings.freezeAccountOnOverdue = Boolean(freezeAccountOnOverdue)
  if (blockAttendanceOnOverdue != null) settings.blockAttendanceOnOverdue = Boolean(blockAttendanceOnOverdue)
  if (requireManualApprovalOnOverdue != null) settings.requireManualApprovalOnOverdue = Boolean(requireManualApprovalOnOverdue)

  if (radiusConfig != null && typeof radiusConfig === 'object') {
    settings.radiusConfig = {
      ...settings.radiusConfig,
      ...radiusConfig
    }
  }

  if (timelineConfig != null && typeof timelineConfig === 'object') {
    settings.timelineConfig = {
      ...settings.timelineConfig,
      ...timelineConfig
    }
  }

  const { jobNotificationConfig } = req.body
  if (jobNotificationConfig != null && typeof jobNotificationConfig === 'object') {
    settings.jobNotificationConfig = {
      ...settings.jobNotificationConfig,
      ...jobNotificationConfig
    }
  }

  await settings.save()

  // Log audit trail
  await logAudit({
    adminId: req.user._id,
    action: 'Settings Changed',
    previousValue: oldSettings,
    newValue: settings.toObject(),
    module: 'System Settings',
    req
  })

  return sendSuccess(res, { data: { settings }, message: 'System configurations updated successfully.' })
})
