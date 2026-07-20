import { Commission } from '../models/Commission.js'
import { sendNotificationToUser } from './notificationService.js'

class CommissionService {
  /**
   * Generates a commission idempotently based on the request snapshot.
   */
  async generateCommission(request, quotation) {
    if (!request.commissionEnabled) return null

    // Idempotency check
    const existing = await Commission.findOne({ requestId: request._id, quotationId: quotation._id })
    if (existing) return existing

    const quotationAmount = quotation.grandTotal
    let commissionAmount = 0
    if (request.commissionType === 'percentage') {
      commissionAmount = Math.round((quotationAmount * request.commissionValue) / 100)
    } else {
      commissionAmount = request.commissionValue
    }

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + (request.commissionDueDays || 7))

    const commission = await Commission.create({
      requestId: request._id,
      quotationId: quotation._id,
      vendorId: quotation.vendorId,
      clientId: request.clientId,
      quotationAmount,
      commissionType: request.commissionType,
      commissionValue: request.commissionValue,
      commissionAmount,
      status: 'pending_payment',
      dueDate
    })

    // Notify Vendor
    await sendNotificationToUser(
      quotation.vendorId.toString(),
      'Commission Generated',
      `Success Commission of ₹${commissionAmount.toLocaleString()} has been generated for project ${request.reference}. Please pay by ${dueDate.toLocaleDateString()}.`,
      { url: '/vendor/commission' }
    )

    return commission
  }

  /**
   * Marks a commission as paid in a gateway-agnostic way.
   */
  async processPayment(commissionId, amount, method, transactionData) {
    const commission = await Commission.findById(commissionId)
    if (!commission) throw new Error('Commission not found')
    if (commission.status === 'paid') return commission

    commission.status = 'paid'
    commission.paidAt = new Date()
    commission.paymentMethod = method
    commission.transactionId = transactionData?.transactionId
    commission.paymentGatewayOrderId = transactionData?.orderId
    await commission.save()

    await sendNotificationToUser(
      commission.vendorId.toString(),
      'Commission Paid',
      `Payment of ₹${commission.commissionAmount.toLocaleString()} for Success Commission received successfully.`,
      { url: '/vendor/commission' }
    )

    return commission
  }

  /**
   * Finds overdue commissions and updates their status.
   */
  async markOverdueCommissions() {
    const now = new Date()
    const overdueCommissions = await Commission.find({
      status: 'pending_payment',
      dueDate: { $lt: now }
    }).populate('requestId', 'reference')

    for (const commission of overdueCommissions) {
      commission.status = 'overdue'
      await commission.save()

      await sendNotificationToUser(
        commission.vendorId.toString(),
        'Commission Overdue',
        `Success Commission of ₹${commission.commissionAmount.toLocaleString()} for project ${commission.requestId?.reference || 'Unknown'} is overdue. Please pay immediately to avoid service interruption.`,
        { url: '/vendor/commission' }
      )
    }

    return overdueCommissions.length
  }
}

export default new CommissionService()
