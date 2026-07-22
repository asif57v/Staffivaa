import { Router } from 'express'
import authRoutes from './authRoutes.js'
import userRoutes from './userRoutes.js'
import labourCategoryRoutes from './labourCategoryRoutes.js'
import adminLabourCategoryRoutes from './adminLabourCategoryRoutes.js'
import buildmartRoutes from './buildmartRoutes.js'
import adminBuildmartRoutes from './adminBuildmartRoutes.js'
import uploadRoutes from './uploadRoutes.js'
import corporateRoutes from './corporateRoutes.js'
import vendorRoutes from './vendorRoutes.js'
import workforceRoutes from './workforceRoutes.js'
import adminWorkforceRoutes from './adminWorkforceRoutes.js'
import adminWalletRoutes from './adminWalletRoutes.js'
import walletRoutes from './walletRoutes.js'
import notificationRoutes from './notificationRoutes.js'
import adminDashboardRoutes from './adminDashboardRoutes.js'
import adminSearchRoutes from './adminSearchRoutes.js'
import adminAuditLogRoutes from './adminAuditLogRoutes.js'
import adminSupportTicketRoutes from './adminSupportTicketRoutes.js'
import adminSettingsRoutes from './adminSettingsRoutes.js'
import adminMarketingRoutes from './adminMarketingRoutes.js'
import marketingRoutes from './marketingRoutes.js'
import payrollRoutes from './payrollRouter.js'
import adminCommissionRoutes from './adminCommissionRoutes.js'
import webhookRoutes from './webhookRoutes.js'
import refundRoutes from './refundRoutes.js'
import adminRefundRoutes from './adminRefundRoutes.js'

const router = Router()

router.use('/webhooks', webhookRoutes)

router.use('/auth', authRoutes)
router.use('/users', userRoutes)
router.use('/wallet', walletRoutes)
router.use('/uploads', uploadRoutes)
router.use('/labour-categories', labourCategoryRoutes)
router.use('/buildmart', buildmartRoutes)
router.use('/corporate', corporateRoutes)
router.use('/vendor', vendorRoutes)
router.use('/workforce', workforceRoutes)
router.use('/admin', adminLabourCategoryRoutes)
router.use('/admin', adminBuildmartRoutes)
router.use('/admin/workforce', adminWorkforceRoutes)
router.use('/admin/wallet', adminWalletRoutes)
router.use('/notifications', notificationRoutes)
router.use('/admin/dashboard', adminDashboardRoutes)
router.use('/admin/search', adminSearchRoutes)
router.use('/admin/audit-logs', adminAuditLogRoutes)
router.use('/admin/tickets', adminSupportTicketRoutes)
router.use('/admin/settings', adminSettingsRoutes)
router.use('/admin/marketing', adminMarketingRoutes)
router.use('/marketing', marketingRoutes)
router.use('/payroll', payrollRoutes)
router.use('/admin/commission', adminCommissionRoutes)
router.use('/wallet/refunds', refundRoutes)
router.use('/admin/refunds', adminRefundRoutes)

export default router
