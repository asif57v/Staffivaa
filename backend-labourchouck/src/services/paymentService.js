import crypto from 'crypto'
import mongoose from 'mongoose'
import { razorpay } from '../config/razorpay.js'
import { Payment } from '../models/Payment.js'
import { User } from '../models/User.js'
import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { EnterpriseWallet } from '../models/EnterpriseWallet.js'
import { EnterpriseWalletTransaction } from '../models/EnterpriseWalletTransaction.js'
import { AttendanceRecord } from '../models/AttendanceRecord.js'
import { EnterprisePayroll } from '../models/EnterprisePayroll.js'
import { EnterpriseJob } from '../models/EnterpriseJob.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { Commission } from '../models/Commission.js'
import { AuditLog } from '../models/AuditLog.js'
import { logRazorpayPaymentSuccess, logRazorpayPaymentFailure } from '../utils/paymentLogger.js'
import CommissionService from './CommissionService.js'
import { emitToUser, emitToVendor, emitToCorporate, emitRequestStatusUpdate } from '../utils/socket.js'
import { triggerNotification } from '../utils/notificationTrigger.js'
import { triggerBookingNotif } from '../utils/triggerBookingNotif.js'
import {
  paymentFailedNotif,
  paymentSuccessUserNotif,
  paymentSuccessLabourNotif,
  counterpartPaidUserNotif,
  counterpartPaidLabourNotif,
  bookingConfirmedUserNotif,
  bookingConfirmedLabourNotif,
  labourProceedToSiteNotif,
} from '../utils/bookingNotificationCopy.js'

class PaymentService {
  /**
   * Generates a unique system order ID
   */
  generateOrderId(prefix = 'ORD') {
    return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`
  }

  /**
   * Create or retrieve an existing payment record with idempotency handling.
   * If idempotencyKey exists and matches an existing record, the existing order is returned.
   */
  async createOrGetPayment({
    userId,
    amount,
    currency = 'INR',
    purpose,
    idempotencyKey = null,
    metadata = {},
    paymentMethod = 'razorpay',
    createGatewayOrder = true,
  }) {
    if (idempotencyKey) {
      const existing = await Payment.findOne({ idempotencyKey })
      if (existing) {
        if (existing.status === 'SUCCESS') {
          return { payment: existing, isExisting: true, isCompleted: true }
        }
        if (['CREATED', 'PENDING'].includes(existing.status)) {
          return { payment: existing, isExisting: true, isCompleted: false }
        }
      }
    }

    const orderId = this.generateOrderId(purpose ? purpose.substring(0, 3).toUpperCase() : 'PAY')
    let gatewayOrderId = null
    let gatewayOrderData = null

    if (createGatewayOrder) {
      const receipt = `rcpt_${orderId.slice(-14)}`
      const options = {
        amount: Math.round(Number(amount) * 100), // Razorpay accepts paise
        currency: currency.toUpperCase(),
        receipt,
        notes: {
          orderId,
          userId: String(userId),
          purpose,
          ...metadata,
        },
      }

      const gatewayOrder = await razorpay.orders.create(options)
      gatewayOrderId = gatewayOrder.id
      gatewayOrderData = gatewayOrder
    }

    const payment = await Payment.create({
      orderId,
      gatewayOrderId,
      userId,
      amount: Number(amount),
      currency: currency.toUpperCase(),
      status: 'CREATED',
      paymentMethod,
      idempotencyKey: idempotencyKey || null,
      purpose,
      metadata,
      gatewayResponse: gatewayOrderData,
      retryCount: 0,
    })

    return { payment, isExisting: false, isCompleted: false }
  }

  /**
   * Verifies Razorpay HMAC SHA256 signature
   */
  verifyPaymentSignature({ gatewayOrderId, gatewayPaymentId, gatewaySignature }) {
    if (!gatewayOrderId || !gatewayPaymentId || !gatewaySignature) {
      return false
    }

    const secret = process.env.RAZORPAY_KEY_SECRET
    if (!secret) {
      console.error('[PaymentService] RAZORPAY_KEY_SECRET is not configured!')
      return false
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${gatewayOrderId}|${gatewayPaymentId}`)
      .digest('hex')

    try {
      const generatedBuffer = Buffer.from(expectedSignature, 'hex')
      const providedBuffer = Buffer.from(gatewaySignature, 'hex')
      if (generatedBuffer.length === providedBuffer.length) {
        return crypto.timingSafeEqual(generatedBuffer, providedBuffer)
      }
    } catch (err) {
      console.error('[PaymentService] Signature verification exception:', err)
      return false
    }

    return false
  }

  /**
   * Atomically transitions payment to SUCCESS and fulfills business domain logic.
   * Guaranteed to be idempotent: duplicate calls (e.g. from frontend + webhook or retry webhooks)
   * will detect that status is already SUCCESS and skip secondary credits.
   */
  async processPaymentSuccess({
    gatewayOrderId,
    gatewayPaymentId,
    paymentMethod = 'razorpay',
    source = 'frontend',
    gatewayResponse = null,
  }) {
    let payment = await Payment.findOne({ gatewayOrderId })

    // Fallback: If payment record was not pre-created (e.g., legacy order), attempt to locate it
    if (!payment) {
      // Check if this belongs to WorkforceRequest
      const req = await WorkforceRequest.findOne({
        $or: [{ labourRazorpayOrderId: gatewayOrderId }, { userRazorpayOrderId: gatewayOrderId }],
      })
      if (req) {
        const isLabour = req.labourRazorpayOrderId === gatewayOrderId
        const userId = isLabour ? req.labourId : req.clientId
        const amount = isLabour ? req.labourPlatformFee : req.userPlatformFee
        payment = await Payment.create({
          orderId: `LEGACY-${Date.now()}`,
          gatewayOrderId,
          gatewayPaymentId,
          userId: userId || req.clientId,
          amount: amount || 0,
          currency: 'INR',
          status: 'CREATED',
          purpose: 'WORKFORCE_REQUEST_PLATFORM_FEE',
          metadata: { requestId: req._id, isLabour },
        })
      }
    }

    if (!payment) {
      console.warn(`[PaymentService] No Payment record found for gatewayOrderId: ${gatewayOrderId}`)
      return { success: false, error: 'Payment record not found' }
    }

    // Fetch live gateway payment details if missing
    let fetchedDetails = gatewayResponse
    if (!fetchedDetails && gatewayPaymentId && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      try {
        fetchedDetails = await razorpay.payments.fetch(gatewayPaymentId)
      } catch (fetchErr) {
        // Fallback gracefully if mock or offline
      }
    }

    const resolvedMethod =
      fetchedDetails?.method ||
      (paymentMethod && paymentMethod !== 'razorpay' ? paymentMethod : payment.paymentMethod || 'razorpay')
    const isUpiOrQr =
      resolvedMethod === 'upi' ||
      Boolean(fetchedDetails?.vpa) ||
      (typeof resolvedMethod === 'string' && resolvedMethod.toLowerCase().includes('qr'))

    // Atomic state update: only match if status is NOT already 'SUCCESS'
    const updatedPayment = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        status: { $ne: 'SUCCESS' },
      },
      {
        $set: {
          status: 'SUCCESS',
          gatewayPaymentId: gatewayPaymentId || payment.gatewayPaymentId,
          paymentId: gatewayPaymentId || payment.paymentId || payment.orderId,
          paymentMethod: isUpiOrQr ? 'upi' : (resolvedMethod || payment.paymentMethod),
          paidAt: new Date(),
          lastCheckedAt: new Date(),
          failureReason: null,
          webhookReceived: source === 'webhook' ? true : payment.webhookReceived,
          webhookStatus: source === 'webhook' ? 'SUCCESS' : payment.webhookStatus,
          gatewayResponse: fetchedDetails || gatewayResponse || payment.gatewayResponse,
        },
      },
      { new: true },
    )

    // If update returned null, it means another thread (webhook or frontend) already marked it SUCCESS!
    if (!updatedPayment) {
      const alreadySuccessDoc = await Payment.findById(payment._id)
      logRazorpayPaymentSuccess({
        orderId: gatewayOrderId,
        paymentId: gatewayPaymentId || alreadySuccessDoc?.gatewayPaymentId,
        amount: alreadySuccessDoc?.amount || payment.amount,
        currency: alreadySuccessDoc?.currency || 'INR',
        method: alreadySuccessDoc?.paymentMethod || resolvedMethod,
        vpa: fetchedDetails?.vpa || alreadySuccessDoc?.gatewayResponse?.vpa,
        contact: fetchedDetails?.contact || alreadySuccessDoc?.gatewayResponse?.contact,
        email: fetchedDetails?.email || alreadySuccessDoc?.gatewayResponse?.email,
        rrn: fetchedDetails?.acquirer_data?.rrn || alreadySuccessDoc?.gatewayResponse?.acquirer_data?.rrn,
        purpose: alreadySuccessDoc?.purpose || payment.purpose,
        userId: payment.userId,
        source,
        timestamp: alreadySuccessDoc?.paidAt || new Date(),
        alreadyProcessed: true,
      })
      return {
        success: true,
        alreadyProcessed: true,
        payment: alreadySuccessDoc,
        message: 'Payment was already processed and verified successfully.',
      }
    }

    // Retrieve user details for formatted logging
    let userDoc = null
    try {
      userDoc = await User.findById(updatedPayment.userId).select('fullName phone email role').lean()
    } catch (uErr) {}

    // 1. Output dedicated Razorpay & UPI QR payment log
    logRazorpayPaymentSuccess({
      orderId: gatewayOrderId,
      paymentId: gatewayPaymentId,
      amount: updatedPayment.amount,
      currency: updatedPayment.currency,
      method: resolvedMethod,
      vpa: fetchedDetails?.vpa || null,
      contact: fetchedDetails?.contact || userDoc?.phone || null,
      email: fetchedDetails?.email || userDoc?.email || null,
      rrn: fetchedDetails?.acquirer_data?.rrn || null,
      purpose: updatedPayment.purpose,
      userId: updatedPayment.userId,
      userName: userDoc?.fullName || null,
      userPhone: userDoc?.phone || null,
      userRole: userDoc?.role || null,
      source,
      timestamp: updatedPayment.paidAt || new Date(),
      alreadyProcessed: false,
    })

    // 2. Persist audit log entry for historical tracking
    AuditLog.create({
      action: 'PAYMENT_SUCCESS',
      module: 'PAYMENT',
      reason: `Razorpay payment ${isUpiOrQr ? 'via UPI QR / App' : `via ${resolvedMethod}`} of ₹${updatedPayment.amount} verified successfully`,
      targetUser: updatedPayment.userId,
      newValue: {
        orderId: gatewayOrderId,
        paymentId: gatewayPaymentId,
        amount: updatedPayment.amount,
        currency: updatedPayment.currency,
        method: resolvedMethod,
        isUpiOrQr,
        vpa: fetchedDetails?.vpa || null,
        purpose: updatedPayment.purpose,
        source,
      },
    }).catch((err) => console.warn('[PaymentService] AuditLog recording error:', err.message))

    // Execute business fulfillment logic based on purpose
    await this.fulfillBusinessLogic(updatedPayment, source)

    return {
      success: true,
      alreadyProcessed: false,
      payment: updatedPayment,
      message: 'Payment processed and fulfilled successfully.',
    }
  }

  /**
   * Business Domain Fulfillment (Wallet, Enterprise, Booking, Commission)
   */
  async fulfillBusinessLogic(payment, source = 'frontend') {
    const { purpose, userId, amount, gatewayOrderId, gatewayPaymentId, metadata } = payment

    try {
      if (purpose === 'WALLET_TOPUP') {
        // 1. Credit User / Labour / Contractor / Corporate Wallet
        const user = await User.findById(userId)
        if (user) {
          user.walletBalance = (user.walletBalance || 0) + Number(amount)
          await user.save()

          let payerType = 'user'
          if (user.role === 'labour') payerType = 'labour'
          else if (user.role === 'contractor' || user.role === 'vendor') payerType = 'vendor'
          else if (user.role === 'corporate') payerType = 'corporate'

          // Ledger Entry
          const transaction = await WalletTransaction.create({
            transactionId: gatewayPaymentId || `TXN-${Date.now()}`,
            payerId: user._id,
            payerName: user.fullName || user.phone,
            payerType,
            type: 'Credit',
            source: 'Razorpay Add Money',
            amount: Number(amount),
            balanceAfter: user.walletBalance,
            paymentMethod: payment.paymentMethod || 'razorpay',
            status: 'Completed',
            razorpayOrderId: gatewayOrderId,
            razorpayPaymentId: gatewayPaymentId,
          })

          try {
            emitToUser(user.role || 'labour', user._id.toString(), 'wallet_updated', {
              walletBalance: user.walletBalance,
              transaction,
            })
          } catch (err) {}
        }
      } else if (purpose === 'ENTERPRISE_WALLET_RECHARGE') {
        // 2. Credit Enterprise Wallet & Handle any wage settlements
        let wallet = await EnterpriseWallet.findOne({ enterpriseId: userId })
        if (!wallet) {
          wallet = await EnterpriseWallet.create({ enterpriseId: userId, balance: 0 })
        }

        wallet.balance += Number(amount)
        wallet.totalRecharged = (wallet.totalRecharged || 0) + Number(amount)
        wallet.lastRechargeAt = new Date()
        wallet.lastTransactionAt = new Date()
        await wallet.save()

        // Update or create EnterpriseWalletTransaction
        let txn = await EnterpriseWalletTransaction.findOne({ razorpayOrderId: gatewayOrderId })
        if (txn) {
          txn.status = 'success'
          txn.razorpayPaymentId = gatewayPaymentId
          txn.balanceAfter = wallet.balance
          txn.gatewayResponse = { status: 'captured', paymentId: gatewayPaymentId }
          await txn.save()
        } else {
          txn = await EnterpriseWalletTransaction.create({
            transactionId: `ENT-TXN-${Date.now()}`,
            enterpriseId: userId,
            amount: Number(amount),
            type: 'recharge',
            status: 'success',
            paymentMethod: payment.paymentMethod || 'Razorpay',
            description: 'Enterprise Wallet Recharge via Razorpay',
            razorpayOrderId: gatewayOrderId,
            razorpayPaymentId: gatewayPaymentId,
            balanceAfter: wallet.balance,
          })
        }

        // Check if settlement metadata exists (Job / Worker attendance)
        const { workerId, jobId, applicationId } = metadata || {}
        if (workerId || jobId || applicationId) {
          const query = {}
          if (workerId) query.workerId = workerId
          if (jobId || applicationId) {
            query.$or = []
            if (jobId) query.$or.push({ enterpriseJobId: jobId })
            if (applicationId) query.$or.push({ enterpriseApplicationId: applicationId })
          }

          await AttendanceRecord.updateMany(query, {
            $set: {
              paymentStatus: 'paid',
              settledAt: new Date(),
              settledAmount: Number(amount),
            },
          })

          if (workerId) {
            const now = new Date()
            const month = now.getMonth() + 1
            const year = now.getFullYear()

            await EnterprisePayroll.findOneAndUpdate(
              { workerId, month, year, enterpriseId: userId },
              {
                $set: {
                  enterpriseId: userId,
                  workerId,
                  jobId: jobId || undefined,
                  month,
                  year,
                  grossSalary: Number(amount),
                  netSalary: Number(amount),
                  status: 'approved',
                  paidAt: new Date(),
                  paymentReference: gatewayPaymentId || txn.transactionId,
                },
              },
              { upsert: true, new: true },
            )
          }
        }
      } else if (purpose === 'WORKFORCE_REQUEST_PLATFORM_FEE') {
        // 3. Fulfill Workforce Request platform fee
        const requestId = metadata?.requestId
        const request = requestId
          ? await WorkforceRequest.findById(requestId)
          : await WorkforceRequest.findOne({
              $or: [{ labourRazorpayOrderId: gatewayOrderId }, { userRazorpayOrderId: gatewayOrderId }],
            })

        if (request) {
          const isLabourOrder = request.labourRazorpayOrderId === gatewayOrderId || metadata?.isLabour === true
          const isUserOrder = request.userRazorpayOrderId === gatewayOrderId || (!isLabourOrder && String(request.clientId) === String(userId))

          if (isLabourOrder) {
            if (request.status === 'vendor_platform_fee_pending') {
              request.vendorPlatformFeeStatus = 'paid'
              request.vendorPlatformFeePaidAt = new Date()
            } else {
              request.labourPaymentStatus = 'paid'
            }
          } else if (isUserOrder) {
            if (request.status === 'corporate_platform_fee_pending') {
              request.corporatePlatformFeeStatus = 'paid'
              request.corporatePlatformFeePaidAt = new Date()
            } else {
              request.userPaymentStatus = 'paid'
            }
          }

          // Check overall lifecycle
          const isLabourPaidOrWaived =
            request.labourPaymentStatus === 'paid' ||
            (request.labourPlatformFee !== undefined && request.labourPlatformFee === 0)

          if (request.userPaymentStatus === 'paid' && isLabourPaidOrWaived) {
            request.platformFeePaymentLifecycle = 'completed'
            if (request.status !== 'quotation_unlocked') {
              request.status = request.sourceType === 'corporate' ? 'project_active' : 'confirmed'
            }
            request.cancelReason = null

            import('../models/Assignment.js')
              .then(({ Assignment }) => {
                Assignment.updateMany({ requestId: request._id, status: 'cancelled' }, { status: 'accepted' }).catch((e) =>
                  console.error(e),
                )
              })
              .catch((e) => console.error(e))
          } else if (request.userPaymentStatus === 'paid' || request.labourPaymentStatus === 'paid') {
            request.platformFeePaymentLifecycle = 'partial'
            if (request.sourceType !== 'corporate' && !['on_site', 'in_progress', 'completed'].includes(request.status)) {
              request.status = 'platform_fee_pending'
            }
          }

          request.razorpayPaymentId = gatewayPaymentId
          await request.save()

          emitRequestStatusUpdate(request._id.toString(), {
            requestId: request._id.toString(),
            requestStatus: request.status,
            userPaymentStatus: request.userPaymentStatus,
            labourPaymentStatus: request.labourPaymentStatus,
          })

          // Admin Ledger update
          try {
            await Wallet.findOneAndUpdate(
              { singletonId: 'ADMIN_WALLET' },
              {
                $inc: {
                  balance: Number(amount),
                  totalRevenue: Number(amount),
                  totalCredits: Number(amount),
                  totalPlatformRevenue: Number(amount),
                },
              },
              { upsert: true, new: true },
            )
          } catch (adminWalErr) {
            console.error('[PaymentService] Admin wallet ledger update error:', adminWalErr.message)
          }
        }
      } else if (purpose === 'COMMISSION') {
        // 4. Fulfill Vendor Commission Payment
        const commissionId = metadata?.commissionId
        const commission = commissionId
          ? await Commission.findById(commissionId)
          : await Commission.findOne({ paymentGatewayOrderId: gatewayOrderId })

        if (commission && commission.status !== 'paid') {
          await CommissionService.processPayment(
            commission._id,
            commission.commissionAmount || Number(amount),
            'razorpay',
            { transactionId: gatewayPaymentId, orderId: gatewayOrderId },
          )
        }
      }
    } catch (fulfillmentError) {
      console.error('[PaymentService] Business fulfillment error:', fulfillmentError)
    }
  }

  /**
   * Record payment failure
   */
  async recordPaymentFailure({ gatewayOrderId, failureReason, gatewayResponse = null }) {
    if (!gatewayOrderId) return null

    const payment = await Payment.findOneAndUpdate(
      {
        gatewayOrderId,
        status: { $in: ['CREATED', 'PENDING'] },
      },
      {
        $set: {
          status: 'FAILED',
          failureReason: failureReason || 'Payment failed or cancelled',
          lastCheckedAt: new Date(),
          gatewayResponse,
        },
      },
      { new: true },
    )

    logRazorpayPaymentFailure({
      orderId: gatewayOrderId,
      paymentId: payment?.gatewayPaymentId || null,
      amount: payment?.amount || null,
      currency: payment?.currency || 'INR',
      reason: failureReason,
      source: 'gateway_verification',
      userId: payment?.userId || null,
      timestamp: new Date(),
    })

    return payment
  }

  /**
   * Actively query Razorpay to reconcile ambiguous / pending payments
   */
  async reconcilePaymentWithGateway(orderIdOrGatewayId) {
    const payment = await Payment.findOne({
      $or: [{ orderId: orderIdOrGatewayId }, { gatewayOrderId: orderIdOrGatewayId }],
    })

    if (!payment) {
      return { success: false, message: 'Payment record not found' }
    }

    if (payment.status === 'SUCCESS') {
      return { success: true, payment, status: 'SUCCESS', message: 'Payment already verified as successful' }
    }

    if (!payment.gatewayOrderId) {
      return { success: true, payment, status: payment.status, message: 'No gateway order created yet' }
    }

    try {
      // Query Razorpay order payments
      const orderPayments = await razorpay.orders.fetchPayments(payment.gatewayOrderId)
      payment.lastCheckedAt = new Date()
      payment.retryCount = (payment.retryCount || 0) + 1

      if (orderPayments && orderPayments.items && orderPayments.items.length > 0) {
        // Look for any captured payment
        const captured = orderPayments.items.find((p) => p.status === 'captured')
        if (captured) {
          const result = await this.processPaymentSuccess({
            gatewayOrderId: payment.gatewayOrderId,
            gatewayPaymentId: captured.id,
            paymentMethod: captured.method,
            source: 'reconciliation',
            gatewayResponse: captured,
          })
          return {
            success: true,
            status: 'SUCCESS',
            payment: result.payment,
            message: 'Payment recovered and verified from gateway',
          }
        }

        const allFailed = orderPayments.items.every((p) => p.status === 'failed')
        if (allFailed) {
          payment.status = 'FAILED'
          payment.failureReason = orderPayments.items[0]?.error_description || 'Payment rejected by bank/gateway'
          await payment.save()
          return { success: true, status: 'FAILED', payment, message: 'Payment failed on gateway' }
        }
      }

      // Check if order is expired (older than 30 mins with no capture)
      const ageMinutes = (Date.now() - new Date(payment.createdAt).getTime()) / (1000 * 60)
      if (ageMinutes > 45 && payment.status === 'CREATED') {
        payment.status = 'EXPIRED'
        payment.failureReason = 'Payment session expired'
        await payment.save()
        return { success: true, status: 'EXPIRED', payment, message: 'Payment session expired' }
      }

      payment.status = 'PENDING'
      await payment.save()
      return { success: true, status: 'PENDING', payment, message: 'Payment is pending on gateway' }
    } catch (err) {
      console.error('[PaymentService] Reconcile error:', err.message)
      return { success: false, error: err.message, status: payment.status }
    }
  }
}

export const paymentService = new PaymentService()
export default paymentService
