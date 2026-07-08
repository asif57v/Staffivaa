import Razorpay from 'razorpay'
import crypto from 'crypto'
import mongoose from 'mongoose'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { USER_ROLES } from '../constants/roles.js'
import { emitRequestStatusUpdate, emitToVendor, emitToUser } from '../utils/socket.js'
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
  
  const isLabour = req.user.role === USER_ROLES.LABOUR;
  const isClient = String(request.clientId._id || request.clientId) === String(req.user._id);

  if (!isLabour && !isClient && req.user.role !== USER_ROLES.ADMIN) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  let totalAmount = 0;
  if (isLabour) {
    if (request.labourPaymentStatus === 'paid') return sendError(res, { message: 'Already paid by labour', statusCode: HTTP_STATUS.BAD_REQUEST });
    totalAmount = request.labourPlatformFee !== undefined ? request.labourPlatformFee : 20;
    
    // Bypass Razorpay if fee is exactly 0
    if (totalAmount === 0) {
      request.labourPaymentStatus = 'paid';
      if (request.userPaymentStatus === 'paid') {
        request.status = 'confirmed';
        emitRequestStatusUpdate(request._id.toString(), { requestStatus: request.status });
      }
      await request.save();
      return sendSuccess(res, { data: { bypassPayment: true } });
    }
  } else {
    if (request.sourceType === 'corporate') {
      const { SystemPricing } = await import('../models/SystemPricing.js')
      const { Allocation } = await import('../models/Allocation.js')
      const { ExtraWorkRequest } = await import('../models/ExtraWorkRequest.js')

      const pricing = await SystemPricing.findOne().lean()
      const advancePercent = pricing?.corporate?.advancePercentage || 30

      const allocation = await Allocation.findOne({ requestId: request._id }).lean()
      const extraWorkRequests = await ExtraWorkRequest.find({ bookingId: request._id, status: 'accepted' }).lean()

      let extraCost = 0
      extraWorkRequests.forEach(ew => {
        extraCost += ew.revisedAmount != null ? ew.revisedAmount : ew.extraAmount
      })

      const totalLabourCost = allocation?.totalLabourCost || 0
      const userPlatformFee = request.userPlatformFee !== undefined ? request.userPlatformFee : 0
      const convenienceFee = request.convenienceFee !== undefined ? request.convenienceFee : 0
      const gstRate = request.userGstRate !== undefined ? request.userGstRate : 18
      const gstAmount = Math.round((userPlatformFee * gstRate) / 100)
      const grandTotal = totalLabourCost + userPlatformFee + gstAmount + convenienceFee + extraCost

      if (request.status === 'payment_pending') {
        if (request.advancePaymentStatus === 'paid') {
          return sendError(res, { message: 'Advance payment already completed', statusCode: HTTP_STATUS.BAD_REQUEST })
        }
        totalAmount = Math.round((grandTotal * advancePercent) / 100)
      } else if (request.status === 'completed' || request.status === 'settlement_pending') {
        if (request.finalPaymentStatus === 'paid') {
          return sendError(res, { message: 'Final payment already completed', statusCode: HTTP_STATUS.BAD_REQUEST })
        }
        totalAmount = grandTotal - Math.round((grandTotal * advancePercent) / 100)
      } else {
        return sendError(res, { message: `Payment is not due or requested yet. Current status: ${request.status}`, statusCode: HTTP_STATUS.BAD_REQUEST })
      }
    } else {
      if (request.userPaymentStatus === 'paid') return sendError(res, { message: 'Already paid by user', statusCode: HTTP_STATUS.BAD_REQUEST });
      
      let platformFee = request.userPlatformFee || 49;
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

  if (generatedSignature !== razorpay_signature) {
    if (isLabourOrder) request.labourPaymentStatus = 'failed';
    else if (isUserOrder) request.userPaymentStatus = 'failed';
    else request.paymentStatus = 'failed';

    await request.save()
    sendNotificationToUser(req.user._id.toString(), 'Payment Failed', 'Your recent payment transaction failed. Please try again.', { url: '/app/wallet' })
    return sendError(res, { message: 'Payment verification failed', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  if (request.sourceType === 'corporate') {
    if (request.status === 'payment_pending') {
      request.advancePaymentStatus = 'paid';
      request.status = 'advance_paid';
      const startDate = new Date(request.startDate);
      if (new Date() >= startDate) {
        request.status = 'project_active';
      }

      // Credit advance share to vendor
      try {
        const { SystemPricing } = await import('../models/SystemPricing.js')
        const pricing = await SystemPricing.findOne().lean()
        const advancePercent = pricing?.corporate?.advancePercentage || 30

        const { Allocation } = await import('../models/Allocation.js')
        const allocation = await Allocation.findOne({ requestId: request._id })

        if (allocation && allocation.vendorId) {
          const totalLabourCost = allocation.totalLabourCost || 0
          const vendorAdvance = Math.round((totalLabourCost * advancePercent) / 100)

          allocation.vendorAdvancePaidAmount = vendorAdvance
          await allocation.save()

          const { User } = await import('../models/User.js')
          await User.findByIdAndUpdate(allocation.vendorId, {
            $inc: { walletBalance: vendorAdvance }
          })

          await WalletTransaction.create({
            transactionId: `TXN-ADV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            bookingId: request._id,
            payerId: request.clientId,
            payerName: req.user.fullName || 'Corporate Client',
            payerType: 'corporate',
            labourId: allocation.vendorId,
            type: 'Settlement',
            source: 'Project Advance Credit (Vendor Share)',
            amount: vendorAdvance,
            status: 'Completed'
          })
        }
      } catch (err) {
        console.error('[verifyRazorpayPayment] Vendor advance credit failed:', err.message)
      }

      emitRequestStatusUpdate(request._id.toString(), { requestStatus: request.status });
    } else if (request.status === 'completed' || request.status === 'settlement_pending') {
      request.finalPaymentStatus = 'paid';
      request.status = 'settlement_completed';
      
      try {
        const { SystemPricing } = await import('../models/SystemPricing.js')
        const pricing = await SystemPricing.findOne().lean()
        const commissionConfig = pricing?.vendor?.platformCommission || { type: 'percentage', value: 2 }

        const { Allocation } = await import('../models/Allocation.js')
        const allocation = await Allocation.findOne({ requestId: request._id })

        const totalLabourCost = allocation?.totalLabourCost || 0

        let vendorPlatformFee = 0
        if (commissionConfig.type === 'percentage') {
          vendorPlatformFee = Math.round((totalLabourCost * (commissionConfig.value ?? 2)) / 100)
        } else {
          vendorPlatformFee = commissionConfig.value ?? 20
        }

        const { ExtraWorkRequest } = await import('../models/ExtraWorkRequest.js')
        const extraWorkRequests = await ExtraWorkRequest.find({ bookingId: request._id, status: 'accepted' }).lean()
        let extraCost = 0
        extraWorkRequests.forEach(ew => {
          extraCost += ew.revisedAmount != null ? ew.revisedAmount : ew.extraAmount
        })

        const vendorAdvancePaidAmount = allocation?.vendorAdvancePaidAmount || 0
        const netAmountToVendor = totalLabourCost + extraCost - vendorPlatformFee - vendorAdvancePaidAmount

        if (allocation && allocation.vendorId) {
          const { User } = await import('../models/User.js')
          await User.findByIdAndUpdate(allocation.vendorId, {
            $inc: { walletBalance: netAmountToVendor }
          })

          await WalletTransaction.create({
            transactionId: `TXN-VND-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            bookingId: request._id,
            payerId: request.clientId,
            payerName: req.user.fullName || 'Corporate Client',
            payerType: 'corporate',
            labourId: allocation.vendorId,
            type: 'Settlement',
            source: 'Project Final Settlement Credit (Vendor Share)',
            amount: netAmountToVendor,
            status: 'Completed'
          })
        }
      } catch (err) {
        console.error('[verifyRazorpayPayment] Vendor settlement failed:', err.message)
      }
      
      emitRequestStatusUpdate(request._id.toString(), { requestStatus: request.status });
    }
  } else {
    if (isLabourOrder) {
      request.labourPaymentStatus = 'paid';
    } else if (isUserOrder) {
      request.userPaymentStatus = 'paid';
    } else {
      request.paymentStatus = 'paid';
    }
    
    // Overall status check
    if (request.userPaymentStatus === 'paid' && request.labourPaymentStatus === 'paid') {
      request.status = 'confirmed'; 
      emitRequestStatusUpdate(request._id.toString(), { requestStatus: request.status })
    }
  }

  request.razorpayPaymentId = razorpay_payment_id
  request.razorpaySignature = razorpay_signature

  await request.save()
  
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
          pendingSettlements: isUserOrder ? amountPaid : 0,
          platformEarnings: isLabourOrder ? amountPaid : 0,
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
