import Razorpay from 'razorpay'
import crypto from 'crypto'
import mongoose from 'mongoose'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { Offer } from '../models/Offer.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { USER_ROLES } from '../constants/roles.js'
import { emitRequestStatusUpdate, emitToVendor, emitToUser, emitToCorporate } from '../utils/socket.js'
import { sendNotificationToUser } from '../services/notificationService.js'

// Cache the instance
let razorpayInstance = null
function getRazorpayInstance() {
  if (!razorpayInstance) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay keys not configured')
    }
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  }
  return razorpayInstance
}

export const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { id } = req.params
  const request = await WorkforceRequest.findById(id)
  
  if (!request) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  
  const isLabour = req.user.role === USER_ROLES.LABOUR || req.user.role === USER_ROLES.CONTRACTOR;
  const isClient = String(request.clientId._id || request.clientId) === String(req.user._id);

  if (!isLabour && !isClient && req.user.role !== USER_ROLES.ADMIN) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  let totalAmount = 0;
  let isVendorFee = false;
  let isCorporateFee = false;

  const { SystemPricing } = await import('../models/SystemPricing.js')
  const pricingDoc = await SystemPricing.findOne().lean()
  
  if (request.vendorPlatformFeeStatus !== 'paid') {
    request.vendorPlatformFeeAmount = pricingDoc?.vendor?.platformCommission?.value ?? 0;
  }
  if (request.corporatePlatformFeeStatus !== 'paid') {
    request.corporatePlatformFeeAmount = pricingDoc?.corporate?.platformFee?.value ?? 0;
  }

  if (isLabour) {
    if (request.status === 'vendor_platform_fee_pending') {
      if (request.vendorPlatformFeeStatus === 'paid') return sendError(res, { message: 'Already paid vendor fee', statusCode: HTTP_STATUS.BAD_REQUEST });
      totalAmount = request.vendorPlatformFeeAmount ?? 0;
      isVendorFee = true;
    } else {
      if (request.labourPaymentStatus === 'paid') return sendError(res, { message: 'Already paid by labour', statusCode: HTTP_STATUS.BAD_REQUEST });
      totalAmount = request.labourPlatformFee !== undefined ? request.labourPlatformFee : 20;
      
      // Bypass Razorpay if fee is exactly 0
      if (totalAmount === 0) {
        request.labourPaymentStatus = 'paid';
        if (request.userPaymentStatus === 'paid') {
          request.platformFeePaymentLifecycle = 'completed';
          request.status = 'confirmed';
          emitRequestStatusUpdate(request._id.toString(), { requestStatus: request.status });
        } else {
          request.platformFeePaymentLifecycle = 'partial';
        }
        await request.save();
        return sendSuccess(res, { data: { bypassPayment: true } });
      }
    }
  } else {
    if (request.sourceType === 'corporate') {
      if (request.status === 'corporate_platform_fee_pending') {
        if (request.corporatePlatformFeeStatus === 'paid') return sendError(res, { message: 'Already paid corporate fee', statusCode: HTTP_STATUS.BAD_REQUEST });
        totalAmount = request.corporatePlatformFeeAmount ?? 0;
        isCorporateFee = true;
      } else {
        const userPlatformFee = request.userPlatformFee !== undefined ? request.userPlatformFee : 0
        const convenienceFee = request.convenienceFee !== undefined ? request.convenienceFee : 0
        const gstRate = request.userGstRate !== undefined ? request.userGstRate : 18
        const gstAmount = Math.round((userPlatformFee * gstRate) / 100)

        if (request.status === 'platform_fee_pending' || request.status === 'payment_pending') {
          if (request.userPaymentStatus === 'paid') {
            return sendError(res, { message: 'Platform fee already completed', statusCode: HTTP_STATUS.BAD_REQUEST })
          }
          totalAmount = userPlatformFee + gstAmount + convenienceFee
        } else {
          return sendError(res, { message: `Payment is not due or requested yet. Current status: ${request.status}`, statusCode: HTTP_STATUS.BAD_REQUEST })
        }
      }
    } else {
      if (request.userPaymentStatus === 'paid') return sendError(res, { message: 'Already paid by user', statusCode: HTTP_STATUS.BAD_REQUEST });
      
      let platformFee = request.userPlatformFee ?? 0;
      totalAmount = platformFee;
    }
  }

  const razorpay = getRazorpayInstance()
  
  const options = {
    amount: totalAmount * 100, // Amount in paise
    currency: 'INR',
    receipt: `${request.reference}-${isLabour ? 'LAB' : 'USR'}`,
  }

  const order = await razorpay.orders.create(options)

  if (isLabour) {
    request.labourRazorpayOrderId = order.id;
  } else {
    request.userRazorpayOrderId = order.id;
  }
  await request.save()

  sendSuccess(res, { data: { keyId: process.env.RAZORPAY_KEY_ID, orderId: order.id, amount: options.amount, currency: options.currency } })
})

export const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body

  const request = await WorkforceRequest.findById(id)
  
  if (!request) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const secret = process.env.RAZORPAY_KEY_SECRET
  
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(razorpay_order_id + "|" + razorpay_payment_id)
  const generatedSignature = hmac.digest('hex')

  const isLabourOrder = request.labourRazorpayOrderId === razorpay_order_id;
  const isUserOrder = request.userRazorpayOrderId === razorpay_order_id;

  let isAuthentic = false;
  try {
    const generatedBuffer = Buffer.from(generatedSignature, 'hex');
    const providedBuffer = Buffer.from(razorpay_signature, 'hex');
    if (generatedBuffer.length === providedBuffer.length) {
      isAuthentic = crypto.timingSafeEqual(generatedBuffer, providedBuffer);
    }
  } catch (err) {
    isAuthentic = false;
  }

  if (!isAuthentic) {
    if (isLabourOrder) {
      if (request.status === 'vendor_platform_fee_pending') {
        request.vendorPlatformFeeStatus = 'failed';
      } else {
        request.labourPaymentStatus = 'failed';
      }
    } else if (isUserOrder) {
      if (request.status === 'corporate_platform_fee_pending') {
        request.corporatePlatformFeeStatus = 'failed';
      } else {
        request.userPaymentStatus = 'failed';
      }
    } else {
      request.paymentStatus = 'failed';
    }

    await request.save()
    sendNotificationToUser(req.user._id.toString(), 'Payment Failed', 'Your recent payment transaction failed. Please try again.', { url: '/app/wallet' })
    return sendError(res, { message: 'Payment verification failed', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  if (isLabourOrder) {
    if (request.status === 'vendor_platform_fee_pending') {
      request.vendorPlatformFeeStatus = 'paid';
      request.vendorPlatformFeePaidAt = new Date();
      if (request.corporatePlatformFeeStatus === 'paid') {
        request.quotationUnlocked = true;
        request.status = 'quotation_unlocked';
      } else {
        request.status = 'corporate_platform_fee_pending';
        emitToCorporate(request.clientId?.toString(), 'corporate_fee_pending', { requestId: request._id.toString() });
      }
    } else {
      request.labourPaymentStatus = 'paid';
    }
  } else if (isUserOrder) {
    if (request.status === 'corporate_platform_fee_pending') {
      request.corporatePlatformFeeStatus = 'paid';
      request.corporatePlatformFeePaidAt = new Date();
      if (request.vendorPlatformFeeStatus === 'paid') {
        request.quotationUnlocked = true;
        request.status = 'quotation_unlocked';
        import('../models/Allocation.js').then(({ Allocation }) => {
          Allocation.findOne({ requestId: request._id }).then(allocation => {
            if (allocation && allocation.vendorId) {
              emitToVendor(allocation.vendorId.toString(), 'quotation_unlocked', { requestId: request._id.toString() });
            }
          }).catch(err => console.error(err));
        }).catch(err => console.error(err));
      }
    } else {
      request.userPaymentStatus = 'paid';
    }
  } else {
    request.paymentStatus = 'paid';
  }
  
  // Overall status check for older flow
  if (request.userPaymentStatus === 'paid' && request.labourPaymentStatus === 'paid') {
    request.platformFeePaymentLifecycle = 'completed';
    if (request.status !== 'quotation_unlocked') {
      request.status = request.sourceType === 'corporate' ? 'project_active' : 'confirmed'; 
      emitRequestStatusUpdate(request._id.toString(), { requestStatus: request.status })
    }
  } else if (request.userPaymentStatus === 'paid' || request.labourPaymentStatus === 'paid') {
    request.platformFeePaymentLifecycle = 'partial';
  }

  request.razorpayPaymentId = razorpay_payment_id
  request.razorpaySignature = razorpay_signature

  // Increment Offer Usage if applicable and this is the first successful payment
  if (isUserOrder && request.appliedOfferId && request.userPaymentStatus === 'paid' && !request.offerUsageIncremented) {
    try {
      await Offer.findByIdAndUpdate(request.appliedOfferId, { $inc: { currentUsageCount: 1 } })
      request.offerUsageIncremented = true
    } catch (err) {
      console.error('Failed to increment offer usage', err)
    }
  }

  await request.save()
  
  // Emit status update for any status change
  emitRequestStatusUpdate(request._id.toString(), { 
    requestId: request._id.toString(), 
    requestStatus: request.status 
  })
  
  sendNotificationToUser(req.user._id.toString(), 'Payment Successful', 'Your payment was successfully processed.', { url: '/corporate/requests' })

  if (isUserOrder) {
    import('../models/Allocation.js').then(({ Allocation }) => {
      Allocation.findOne({ requestId: request._id }).then(allocation => {
        if (allocation && allocation.vendorId) {
          emitToVendor(allocation.vendorId.toString(), 'payment_status_update', { requestId: request._id.toString() });
        }
      });
    }).catch(err => console.error(err));
    
    if (request.labourId) {
      emitToUser('labour', request.labourId.toString(), 'payment_status_update', { requestId: request._id.toString() });
    }
    
    emitRequestStatusUpdate(request._id.toString(), { 
      requestId: request._id.toString(), 
      requestStatus: request.status,
      userPaymentStatus: request.userPaymentStatus,
      labourPaymentStatus: request.labourPaymentStatus
    });
  }

  // --- Wallet Ledger Integration ---
  try {
    const razorpay = getRazorpayInstance()
    const order = await razorpay.orders.fetch(razorpay_order_id)
    const amountPaid = (order.amount_paid ? order.amount_paid : order.amount) / 100

    if (amountPaid > 0) {
      let payerType = 'system';
      if (req.user.role === 'individual') payerType = 'user';
      else if (req.user.role === 'labour') payerType = 'labour';
      else if (req.user.role === 'contractor') payerType = 'vendor';
      else if (req.user.role === 'corporate') payerType = 'corporate';

      const updatePayload = {
        $inc: {
          balance: amountPaid,
          totalRevenue: amountPaid,
          totalCredits: amountPaid,
          totalPlatformRevenue: amountPaid,
          pendingSettlements: (isUserOrder && request.sourceType !== 'corporate') ? amountPaid : 0,
          platformEarnings: (isLabourOrder || request.sourceType === 'corporate') ? amountPaid : 0,
        }
      }

      if (payerType === 'user') updatePayload.$inc.userRevenue = amountPaid;
      if (payerType === 'labour') updatePayload.$inc.labourRevenue = amountPaid;
      if (payerType === 'vendor') updatePayload.$inc.vendorRevenue = amountPaid;
      if (payerType === 'corporate') updatePayload.$inc.corporateRevenue = amountPaid;

      await Wallet.findOneAndUpdate(
        { singletonId: 'ADMIN_WALLET' },
        updatePayload,
        { new: true, upsert: true }
      )

      await WalletTransaction.create({
        transactionId: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        bookingId: request._id,
        clientId: request.clientId,
        payerId: req.user._id,
        payerName: req.user.fullName || req.user.companyName || 'Unknown',
        payerType,
        platform_fee: true,
        type: 'Credit',
        source: `${payerType.charAt(0).toUpperCase() + payerType.slice(1)} Platform Fee`,
        amount: amountPaid,
        status: 'Completed',
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id
      })
    }
  } catch (err) {
    console.error('Wallet Ledger Error:', err)
  }
  // --- End Wallet Ledger ---

  sendSuccess(res, { data: { request } })
})
