import { EnterpriseJoiningInvoice } from '../models/EnterpriseJoiningInvoice.js'
import { EnterpriseEscrowTransaction } from '../models/EnterpriseEscrowTransaction.js'
import { EnterpriseApplication } from '../models/EnterpriseApplication.js'
import { EnterpriseWallet } from '../models/EnterpriseWallet.js'
import { EnterpriseWalletTransaction } from '../models/EnterpriseWalletTransaction.js'
import { EnterpriseFinancialAuditLog } from '../models/EnterpriseFinancialAuditLog.js'
import { User } from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { USER_ROLES } from '../constants/roles.js'
import { emitToRole } from '../utils/socket.js'
import { triggerNotification } from '../utils/notificationTrigger.js'

/** GET /api/admin/enterprise/joining-payments - List all joining payments & escrow transactions for Admin */
export const getAdminJoiningPayments = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ADMIN) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const { status, search } = req.query
  let invoiceQuery = {}

  if (status && status !== 'all') {
    if (status === 'pending_verification') {
      invoiceQuery.status = 'paid' // paid by enterprise, pending admin verification
    } else {
      invoiceQuery.status = status
    }
  }

  const invoices = await EnterpriseJoiningInvoice.find(invoiceQuery)
    .populate({
      path: 'enterpriseId',
      select: 'fullName profileImageUrl enterpriseProfile phone email',
    })
    .populate({
      path: 'workerId',
      select: 'fullName profileImageUrl phone email labourProfile',
    })
    .populate({
      path: 'jobId',
      select: 'jobTitle locationText salary salaryType department',
    })
    .populate({
      path: 'applicationId',
      select: 'status offerDetails interviewDetails joiningDetails',
    })
    .populate('escrowTransactionId')
    .sort({ createdAt: -1 })

  // Financial Metrics Summary
  const allInvoices = await EnterpriseJoiningInvoice.find({})
  const escrowTransactions = await EnterpriseEscrowTransaction.find({})

  const now = new Date()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const totalEscrowSecured = escrowTransactions
    .filter((e) => e.status === 'secured')
    .reduce((sum, e) => sum + (e.amount || 0), 0)

  const totalReleased = escrowTransactions
    .filter((e) => e.status === 'released')
    .reduce((sum, e) => sum + (e.amount || 0), 0)

  const totalRefunded = escrowTransactions
    .filter((e) => e.status === 'refunded')
    .reduce((sum, e) => sum + (e.amount || 0), 0)

  const pendingInvoices = allInvoices.filter((i) => i.status === 'payment_pending')
  const totalOutstandingAmount = pendingInvoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0)
  const pendingVerificationCount = allInvoices.filter((i) => i.status === 'paid').length
  const verifiedCount = escrowTransactions.filter((e) => e.status === 'released').length

  const dueTodayCount = pendingInvoices.filter((i) => {
    const due = new Date(i.dueDate)
    return due <= todayEnd && due >= new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }).length

  const dueThisWeekCount = pendingInvoices.filter((i) => {
    const due = new Date(i.dueDate)
    return due <= weekEnd && due >= now
  }).length

  const overdueCount = allInvoices.filter((i) => i.status === 'overdue' || (i.status === 'payment_pending' && new Date(i.dueDate) < now)).length

  return sendSuccess(res, {
    data: invoices,
    metrics: {
      totalEscrowSecured,
      totalReleased,
      totalRefunded,
      totalOutstandingAmount,
      pendingVerificationCount,
      verifiedCount,
      dueTodayCount,
      dueThisWeekCount,
      overdueCount,
      totalInvoicesCount: allInvoices.length,
    },
  })
})

/** POST /api/admin/enterprise/joining-payments/:id/extend-due-date - Extend Invoice Due Date */
export const extendInvoiceDueDate = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ADMIN) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const { extensionDays, newDueDate, adminNotes } = req.body
  const invoice = await EnterpriseJoiningInvoice.findById(req.params.id).populate('jobId', 'jobTitle')

  if (!invoice) {
    return sendError(res, { message: 'Invoice not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const currentDue = new Date(invoice.dueDate || invoice.createdAt)
  let updatedDue = new Date()

  if (newDueDate) {
    updatedDue = new Date(newDueDate)
  } else if (extensionDays) {
    updatedDue = new Date(currentDue.getTime() + Number(extensionDays) * 24 * 60 * 60 * 1000)
  } else {
    updatedDue = new Date(currentDue.getTime() + 7 * 24 * 60 * 60 * 1000) // Default +7 days
  }

  invoice.extendedDueDate = updatedDue
  invoice.dueDate = updatedDue
  if (invoice.status === 'overdue') invoice.status = 'payment_pending'
  if (adminNotes) invoice.adminNotes = adminNotes
  await invoice.save()

  // Notify Enterprise HR
  const jobTitle = invoice.jobId?.jobTitle || 'Requirement'
  triggerNotification({
    userId: invoice.enterpriseId,
    title: 'Invoice Due Date Extended 📅',
    body: `Admin extended the due date for Invoice #${invoice.invoiceNumber} ("${jobTitle}") to ${updatedDue.toLocaleDateString('en-IN')}.`,
    type: 'INVOICE_DUE_DATE_EXTENDED',
    relatedId: invoice._id,
    relatedModel: 'EnterpriseJoiningInvoice',
  }).catch((err) => console.error('[Notification Error]:', err.message))

  return sendSuccess(res, {
    message: `Invoice due date extended to ${updatedDue.toLocaleDateString('en-IN')} successfully!`,
    data: invoice,
  })
})

/** POST /api/admin/enterprise/joining-payments/:id/mark-paid-offline - Admin Mark Paid Offline */
export const markInvoicePaidOffline = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ADMIN) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const { paymentReference, adminNotes } = req.body
  const invoice = await EnterpriseJoiningInvoice.findById(req.params.id)

  if (!invoice) {
    return sendError(res, { message: 'Invoice not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (invoice.status === 'paid' || invoice.status === 'refunded') {
    return sendError(res, { message: `Invoice is already ${invoice.status}`, statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Create Escrow Transaction (Funds Secured by Staffivaa)
  const escrowNumber = `ESC-OFFLINE-${Date.now().toString().slice(-6)}`
  const escrowTxn = await EnterpriseEscrowTransaction.create({
    escrowNumber,
    enterpriseId: invoice.enterpriseId,
    invoiceId: invoice._id,
    applicationId: invoice.applicationId,
    workerId: invoice.workerId,
    amount: invoice.totalAmount,
    status: 'released', // Direct release since Admin verified offline
    adminVerifiedAt: new Date(),
    adminVerifiedBy: req.user._id,
    adminNotes: adminNotes || `Offline Payment Verified. Ref: ${paymentReference || 'N/A'}`,
  })

  invoice.status = 'paid'
  invoice.paidAt = new Date()
  invoice.paymentMethod = 'offline_bank_transfer'
  invoice.escrowTransactionId = escrowTxn._id
  if (adminNotes) invoice.adminNotes = adminNotes
  await invoice.save()

  // Update Application Status & Activate Joining
  const application = await EnterpriseApplication.findById(invoice.applicationId)
  if (application) {
    application.status = 'joining_activated'
    if (!application.joiningDetails) application.joiningDetails = {}
    application.joiningDetails.markedJoinedAt = new Date()
    await application.save()
  }

  // Audit Log
  await EnterpriseFinancialAuditLog.create({
    enterpriseId: invoice.enterpriseId,
    action: 'admin_verified',
    amount: invoice.totalAmount,
    performedBy: req.user._id,
    relatedInvoiceId: invoice._id,
    relatedApplicationId: invoice.applicationId,
    relatedEscrowId: escrowTxn._id,
    details: {
      offlinePayment: true,
      paymentReference,
      adminNotes,
    },
  })

  triggerNotification({
    userId: invoice.enterpriseId,
    title: 'Offline Payment Confirmed 💳',
    body: `Admin confirmed offline payment for Invoice #${invoice.invoiceNumber}. Candidate joining activated!`,
    type: 'INVOICE_PAID_OFFLINE',
    relatedId: invoice._id,
    relatedModel: 'EnterpriseJoiningInvoice',
  }).catch((err) => console.error('[Notification Error]:', err.message))

  return sendSuccess(res, {
    message: 'Invoice marked as paid offline successfully and joining activated!',
    data: { invoice, escrow: escrowTxn },
  })
})

/** POST /api/admin/enterprise/joining-payments/:id/cancel-invoice - Admin Cancel Invoice */
export const cancelInvoice = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ADMIN) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const { cancellationReason } = req.body
  const invoice = await EnterpriseJoiningInvoice.findById(req.params.id)

  if (!invoice) {
    return sendError(res, { message: 'Invoice not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  invoice.status = 'cancelled'
  invoice.failureReason = cancellationReason || 'Cancelled by Admin'
  await invoice.save()

  return sendSuccess(res, { message: 'Invoice cancelled successfully.', data: invoice })
})

/** POST /api/admin/enterprise/joining-payments/:id/verify-approve - Verify Payment & Activate Joining */
export const verifyApproveJoining = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ADMIN) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const { adminNotes } = req.body
  const invoice = await EnterpriseJoiningInvoice.findById(req.params.id)
    .populate('jobId', 'jobTitle locationText')
    .populate('enterpriseId', 'fullName enterpriseProfile')
    .populate('workerId', 'fullName phone')

  if (!invoice) {
    return sendError(res, { message: 'Invoice not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const escrow = await EnterpriseEscrowTransaction.findOne({ invoiceId: invoice._id })
  if (!escrow) {
    return sendError(res, { message: 'Escrow record not found for this invoice', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (escrow.status === 'released') {
    return sendError(res, { message: 'Escrow funds already released and joining approved', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Update Escrow Status to released
  escrow.status = 'released'
  escrow.releasedAt = new Date()
  escrow.adminVerifiedAt = new Date()
  escrow.adminVerifiedBy = req.user._id
  if (adminNotes) escrow.adminNotes = adminNotes
  await escrow.save()

  // Activate Application & Worker Joining
  const application = await EnterpriseApplication.findById(invoice.applicationId)
  if (application) {
    application.status = 'joining_activated'
    if (!application.joiningDetails) application.joiningDetails = {}
    application.joiningDetails.markedJoinedAt = new Date()
    await application.save()
  }

  // Financial Audit Log
  await EnterpriseFinancialAuditLog.create({
    enterpriseId: invoice.enterpriseId._id || invoice.enterpriseId,
    action: 'admin_verified',
    amount: invoice.totalAmount,
    performedBy: req.user._id,
    relatedInvoiceId: invoice._id,
    relatedApplicationId: invoice.applicationId,
    relatedEscrowId: escrow._id,
    details: {
      verifiedBy: req.user.fullName,
      invoiceNumber: invoice.invoiceNumber,
      adminNotes,
    },
  })

  // Emit Real-time Sockets
  emitToRole('labour', 'enterprise_application_updated', {
    type: 'joining_confirmed',
    applicationId: invoice.applicationId,
    workerId: invoice.workerId._id || invoice.workerId,
  })

  emitToRole('enterprise', 'enterprise_application_updated', {
    type: 'joining_verified_by_admin',
    applicationId: invoice.applicationId,
    invoiceId: invoice._id,
  })

  // Real-time Push Notifications to Worker and Enterprise (Event 5)
  const companyName = invoice.enterpriseId?.enterpriseProfile?.companyName || invoice.enterpriseId?.fullName || 'Employer'
  const jobTitle = invoice.jobId?.jobTitle || 'Role'
  const workerName = invoice.workerId?.fullName || 'Worker'

  // 1. Worker Notification
  triggerNotification({
    userId: invoice.workerId._id || invoice.workerId,
    title: 'Joining Confirmed! 🎉',
    body: `Employer has completed the joining payment. Joining has been confirmed for "${jobTitle}" at ${companyName}. Please report on your designated joining date.`,
    type: 'JOINING_CONFIRMED',
    relatedId: invoice.applicationId,
    relatedModel: 'EnterpriseApplication',
  }).catch((err) => console.error('[Notification Error]:', err.message))

  // 2. Enterprise HR Notification
  triggerNotification({
    userId: invoice.enterpriseId._id || invoice.enterpriseId,
    title: 'Candidate Joining Confirmed Successfully 🚀',
    body: `Joining payment verified for candidate ${workerName} on "${jobTitle}". Candidate can now report for work. Attendance & Payroll are now active.`,
    type: 'ENTERPRISE_JOINING_CONFIRMED',
    relatedId: invoice._id,
    relatedModel: 'EnterpriseJoiningInvoice',
  }).catch((err) => console.error('[Notification Error]:', err.message))

  // Auto-generate Remaining Milestone Invoice if this was an Advance Invoice
  let remainingInvoice = null
  if (invoice.invoiceType === 'advance_50' && invoice.remainingAmount > 0) {
    const existingRemaining = await EnterpriseJoiningInvoice.findOne({ parentInvoiceId: invoice._id })
    if (!existingRemaining) {
      let settings = await SystemSettings.findOne({ singletonId: 'SYSTEM_SETTINGS' })
      const remainingDueDays = settings?.remainingInvoiceDueDays || 15
      const graceDays = settings?.enterpriseInvoiceGracePeriodDays || 3
      const isGstEnabled = settings?.isGstEnabled ?? true
      const gstRate = settings?.gstPercentage ?? 18

      const baseRemaining = invoice.remainingAmount
      let remGstAmount = 0
      if (isGstEnabled) {
        remGstAmount = Math.round(baseRemaining * (gstRate / 100))
      }
      const remTotalAmount = baseRemaining + remGstAmount

      const remInvoiceDate = new Date()
      const remDueDate = new Date(remInvoiceDate.getTime() + remainingDueDays * 24 * 60 * 60 * 1000)
      const remGracePeriodEndDate = new Date(remDueDate.getTime() + graceDays * 24 * 60 * 60 * 1000)
      const remInvNumber = `INV-REM-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`

      remainingInvoice = await EnterpriseJoiningInvoice.create({
        invoiceNumber: remInvNumber,
        invoiceType: 'remaining_50',
        parentInvoiceId: invoice._id,
        enterpriseId: invoice.enterpriseId._id || invoice.enterpriseId,
        jobId: invoice.jobId._id || invoice.jobId,
        applicationId: invoice.applicationId,
        workerId: invoice.workerId._id || invoice.workerId,
        totalProjectValue: invoice.totalProjectValue,
        advancePercentage: invoice.advancePercentage,
        remainingPercentage: invoice.remainingPercentage ?? (100 - (invoice.advancePercentage ?? 50)),
        advanceAmount: invoice.advanceAmount,
        remainingAmount: baseRemaining,
        platformFeeType: invoice.platformFeeType,
        platformFeeValue: invoice.platformFeeValue,
        platformFee: 0,
        grossSubtotal: baseRemaining,
        isGstApplied: isGstEnabled,
        gstRate: isGstEnabled ? gstRate : 0,
        gstAmount: remGstAmount,
        totalAmount: remTotalAmount,
        invoiceDate: remInvoiceDate,
        configuredDueDays: remainingDueDays,
        configuredGracePeriodDays: graceDays,
        dueDate: remDueDate,
        gracePeriodEndDate: remGracePeriodEndDate,
        status: 'payment_pending',
      })
    } else {
      remainingInvoice = existingRemaining
    }
  }

  return sendSuccess(res, {
    message: 'Payment verified and candidate joining activated successfully! Worker attendance & payroll are now active.',
    data: { invoice, escrow, application, remainingInvoice },
  })
})

/** POST /api/admin/enterprise/joining-payments/:id/refund - Refund Payment to Enterprise Wallet */
export const refundJoiningPayment = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ADMIN) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const { refundReason, partialAmount } = req.body
  const invoice = await EnterpriseJoiningInvoice.findById(req.params.id)
  if (!invoice) {
    return sendError(res, { message: 'Invoice not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const escrow = await EnterpriseEscrowTransaction.findOne({ invoiceId: invoice._id })
  if (!escrow) {
    return sendError(res, { message: 'Escrow record not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (escrow.status === 'refunded') {
    return sendError(res, { message: 'Payment has already been refunded', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const refundAmount = partialAmount ? Number(partialAmount) : invoice.totalAmount

  // Credit Refund Amount Back to Enterprise Wallet
  let wallet = await EnterpriseWallet.findOne({ enterpriseId: invoice.enterpriseId })
  if (!wallet) {
    wallet = await EnterpriseWallet.create({ enterpriseId: invoice.enterpriseId, balance: 0 })
  }

  wallet.balance += refundAmount
  await wallet.save()

  // Create Wallet Refund Credit Transaction
  const walletTxn = await EnterpriseWalletTransaction.create({
    enterpriseId: invoice.enterpriseId,
    type: 'credit',
    category: 'refund',
    amount: refundAmount,
    balanceAfter: wallet.balance,
    referenceId: invoice._id,
    referenceModel: 'EnterpriseJoiningInvoice',
    description: `Refund for Joining Invoice #${invoice.invoiceNumber}. Reason: ${refundReason || 'Admin Approved Refund'}`,
    status: 'completed',
  })

  // Update Escrow & Invoice Status
  escrow.status = 'refunded'
  escrow.refundedAt = new Date()
  escrow.refundReason = refundReason || 'Admin Refund'
  await escrow.save()

  invoice.status = 'refunded'
  await invoice.save()

  // Update Application Status
  const application = await EnterpriseApplication.findById(invoice.applicationId)
  if (application) {
    application.status = 'rejected'
    await application.save()
  }

  // Audit Log
  await EnterpriseFinancialAuditLog.create({
    enterpriseId: invoice.enterpriseId,
    action: 'refund_issued',
    amount: refundAmount,
    performedBy: req.user._id,
    relatedInvoiceId: invoice._id,
    relatedApplicationId: invoice.applicationId,
    relatedEscrowId: escrow._id,
    details: {
      refundAmount,
      refundReason,
      newWalletBalance: wallet.balance,
    },
  })

  // Socket & Push Notifications to Enterprise HR
  triggerNotification({
    userId: invoice.enterpriseId,
    title: 'Refund Processed 💰',
    body: `₹${refundAmount.toLocaleString('en-IN')} refunded to your Enterprise Wallet for Invoice #${invoice.invoiceNumber}.`,
    type: 'REFUND_COMPLETED',
    relatedId: invoice._id,
    relatedModel: 'EnterpriseJoiningInvoice',
  }).catch((err) => console.error('[Notification Error]:', err.message))

  return sendSuccess(res, {
    message: `₹${refundAmount.toLocaleString('en-IN')} refunded successfully to Enterprise Wallet.`,
    data: { invoice, escrow, walletBalance: wallet.balance },
  })
})

/** POST /api/admin/enterprise/joining-payments/:id/remind - Send Payment Reminder */
export const sendPaymentReminder = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.ADMIN) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const invoice = await EnterpriseJoiningInvoice.findById(req.params.id).populate('jobId', 'jobTitle')
  if (!invoice) {
    return sendError(res, { message: 'Invoice not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const jobTitle = invoice.jobId?.jobTitle || 'Requirement'

  triggerNotification({
    userId: invoice.enterpriseId,
    title: 'Urgent: Payment Reminder ⚠️',
    body: `Payment for Joining Invoice #${invoice.invoiceNumber} (₹${invoice.totalAmount.toLocaleString('en-IN')}) for "${jobTitle}" is pending. Please complete payment to confirm worker joining.`,
    type: 'PAYMENT_REMINDER',
    relatedId: invoice._id,
    relatedModel: 'EnterpriseJoiningInvoice',
  }).catch((err) => console.error('[Notification Error]:', err.message))

  invoice.remindersSent.push({ type: '24h', sentAt: new Date() })
  await invoice.save()

  return sendSuccess(res, { message: 'Payment reminder notification sent to Enterprise HR.' })
})
