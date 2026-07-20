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
    radiusConfig
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

  if (radiusConfig != null && typeof radiusConfig === 'object') {
    settings.radiusConfig = {
      ...settings.radiusConfig,
      ...radiusConfig
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
