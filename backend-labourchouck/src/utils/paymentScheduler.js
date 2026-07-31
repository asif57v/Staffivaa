import { EnterpriseJoiningInvoice } from '../models/EnterpriseJoiningInvoice.js'
import { EnterpriseApplication } from '../models/EnterpriseApplication.js'
import { EnterpriseFinancialAuditLog } from '../models/EnterpriseFinancialAuditLog.js'
import { triggerNotification } from './notificationTrigger.js'

/**
  Checks pending joining invoices every hour for 24h/48h reminders and 72h auto-expiration.
 */
export async function runPaymentSchedulerChecks() {
  try {
    const now = new Date()

    // 1. Fetch all pending joining invoices
    const pendingInvoices = await EnterpriseJoiningInvoice.find({ status: 'payment_pending' })
      .populate('jobId', 'jobTitle')
      .populate('workerId', 'fullName')
      .populate('enterpriseId', 'fullName enterpriseProfile')

    for (const invoice of pendingInvoices) {
      const createdAt = new Date(invoice.createdAt)
      const hoursPassed = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
      const reminders = invoice.remindersSent || []
      const dueDate = new Date(invoice.dueDate || invoice.createdAt)
      const gracePeriodEndDate = invoice.gracePeriodEndDate
        ? new Date(invoice.gracePeriodEndDate)
        : new Date(dueDate.getTime() + (invoice.configuredGracePeriodDays || 3) * 24 * 60 * 60 * 1000)

      const jobTitle = invoice.jobId?.jobTitle || 'Role'

      // 1. Check if invoice is past Grace Period End Date -> Transition to Overdue
      if (now > gracePeriodEndDate) {
        invoice.status = 'overdue'
        invoice.overdueRestrictedAt = now
        await invoice.save()

        // Audit Log
        await EnterpriseFinancialAuditLog.create({
          enterpriseId: invoice.enterpriseId._id || invoice.enterpriseId,
          action: 'payment_reminder_sent',
          amount: invoice.totalAmount,
          relatedInvoiceId: invoice._id,
          relatedApplicationId: invoice.applicationId,
          details: {
            reason: 'Invoice past due date & grace period -> Overdue hiring restrictions applied',
            invoiceNumber: invoice.invoiceNumber,
            gracePeriodEndDate,
          },
        })

        // Notify Enterprise HR
        triggerNotification({
          userId: invoice.enterpriseId._id || invoice.enterpriseId,
          title: '🚨 Payment Overdue: Hiring Restricted',
          body: `Invoice #${invoice.invoiceNumber} (₹${invoice.totalAmount.toLocaleString('en-IN')}) for "${jobTitle}" is overdue. Clear your outstanding payment to continue hiring on Staffivaa.`,
          type: 'INVOICE_OVERDUE_RESTRICTED',
          relatedId: invoice._id,
          relatedModel: 'EnterpriseJoiningInvoice',
        }).catch((err) => console.error('[Notification Error]:', err.message))

        // Notify Staffivaa Admin
        const companyName = invoice.enterpriseId?.enterpriseProfile?.companyName || invoice.enterpriseId?.fullName || 'Enterprise Client'
        triggerNotification({
          userId: null,
          title: '⚠️ Enterprise Payment Overdue Alert',
          body: `Invoice #${invoice.invoiceNumber} (₹${invoice.totalAmount.toLocaleString('en-IN')}) for ${companyName} is past due date and grace period. Hiring restrictions applied.`,
          type: 'ADMIN_OVERDUE_ALERT',
          relatedId: invoice._id,
          relatedModel: 'EnterpriseJoiningInvoice',
        }).catch((err) => console.error('[Notification Error]:', err.message))

        continue
      }

      // 48-Hour Urgent Reminder
      const has48h = reminders.some((r) => r.type === '48h')
      if (hoursPassed >= 48 && !has48h) {
        invoice.remindersSent.push({ type: '48h', sentAt: now })
        await invoice.save()

        triggerNotification({
          userId: invoice.enterpriseId._id || invoice.enterpriseId,
          title: 'Urgent: Payment Expiring Soon! ⏰',
          body: `Joining Invoice #${invoice.invoiceNumber} (₹${invoice.totalAmount.toLocaleString('en-IN')}) will expire in 24 hours. Complete payment to secure worker joining.`,
          type: 'PAYMENT_REMINDER_48H',
          relatedId: invoice._id,
          relatedModel: 'EnterpriseJoiningInvoice',
        }).catch((err) => console.error('[Notification Error]:', err.message))

        continue
      }

      // 24-Hour Reminder
      const has24h = reminders.some((r) => r.type === '24h')
      if (hoursPassed >= 24 && !has24h) {
        invoice.remindersSent.push({ type: '24h', sentAt: now })
        await invoice.save()

        triggerNotification({
          userId: invoice.enterpriseId._id || invoice.enterpriseId,
          title: 'Payment Pending: Joining Invoice 📜',
          body: `Joining Confirmation Invoice #${invoice.invoiceNumber} is pending payment. Complete payment from Enterprise Wallet to activate candidate joining.`,
          type: 'PAYMENT_REMINDER_24H',
          relatedId: invoice._id,
          relatedModel: 'EnterpriseJoiningInvoice',
        }).catch((err) => console.error('[Notification Error]:', err.message))
      }
    }
  } catch (error) {
    console.error('[Payment Scheduler Error]:', error.message)
  }
}
