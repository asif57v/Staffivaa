import { Wallet } from '../models/Wallet.js'
import { User } from '../models/User.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { Withdrawal } from '../models/Withdrawal.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess, sendError, HTTP_STATUS } from '../utils/apiResponse.js'
import { logAudit } from '../utils/auditLogger.js'
import { triggerNotification } from '../utils/notificationTrigger.js'

export const getWalletSummary = asyncHandler(async (req, res) => {
  let wallet = await Wallet.findOne({ singletonId: 'ADMIN_WALLET' })
  if (!wallet) {
    wallet = await Wallet.create({ singletonId: 'ADMIN_WALLET' })
  }
  
  // Aggregate credits and debits to ensure accurate totals if needed
  const totals = await WalletTransaction.aggregate([
    {
      $group: {
        _id: null,
        totalCredits: { $sum: { $cond: [{ $eq: ['$type', 'Credit'] }, '$amount', 0] } },
        totalDebits: { $sum: { $cond: [{ $in: ['$type', ['Debit', 'Withdrawal', 'Settlement', 'Refund']] }, '$amount', 0] } },
        totalRefunds: { $sum: { $cond: [{ $eq: ['$type', 'Refund'] }, '$amount', 0] } },
      }
    }
  ])

  const stats = totals[0] || { totalCredits: 0, totalDebits: 0, totalRefunds: 0 }
  
  sendSuccess(res, {
    data: {
      availableBalance: wallet.balance,
      totalRevenue: wallet.totalRevenue,
      pendingSettlements: wallet.pendingSettlements,
      platformEarnings: wallet.platformEarnings,
      userRevenue: wallet.userRevenue,
      labourRevenue: wallet.labourRevenue,
      vendorRevenue: wallet.vendorRevenue,
      corporateRevenue: wallet.corporateRevenue,
      totalCredits: stats.totalCredits,
      totalDebits: stats.totalDebits,
      totalRefunds: stats.totalRefunds,
    }
  })
})

export const getTransactions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, type, status, dateFrom, dateTo, search, payerType } = req.query
  const query = {}

  if (type) query.type = type
  if (status) query.status = status
  if (payerType) query.payerType = payerType
  
  if (dateFrom || dateTo) {
    query.createdAt = {}
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom)
    if (dateTo) {
      const end = new Date(dateTo)
      end.setHours(23, 59, 59, 999)
      query.createdAt.$lte = end
    }
  }

  if (search) {
    query.$or = [
      { transactionId: { $regex: search, $options: 'i' } },
      { source: { $regex: search, $options: 'i' } },
      { payerName: { $regex: search, $options: 'i' } },
      { razorpayPaymentId: { $regex: search, $options: 'i' } },
    ]
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)
  
  const transactions = await WalletTransaction.find(query)
    .populate('bookingId', 'title reference projectName')
    .populate('clientId', 'fullName email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean()

  const total = await WalletTransaction.countDocuments(query)

  sendSuccess(res, {
    data: {
      transactions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    }
  })
})

export const createWithdrawal = asyncHandler(async (req, res) => {
  const { amount, bankDetails } = req.body
  
  if (!amount || amount <= 0) {
    return sendError(res, { message: 'Invalid amount', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const wallet = await Wallet.findOne({ singletonId: 'ADMIN_WALLET' })
  if (!wallet || wallet.balance < amount) {
    return sendError(res, { message: 'Insufficient balance', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const withdrawal = await Withdrawal.create({
    amount,
    bankDetails,
    requestedBy: req.user._id,
    status: 'Pending'
  })

  // Deduct from wallet balance and create a transaction immediately as pending
  wallet.balance -= amount
  await wallet.save()

  await WalletTransaction.create({
    transactionId: `WD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type: 'Withdrawal',
    source: 'Admin Withdrawal',
    amount,
    status: 'Pending'
  })

  sendSuccess(res, { data: { withdrawal } })
})

export const getWithdrawals = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query
  const skip = (parseInt(page) - 1) * parseInt(limit)
  
  const withdrawals = await Withdrawal.find()
    .populate('requestedBy', 'fullName email phone role')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))

  const total = await Withdrawal.countDocuments()

  sendSuccess(res, {
    data: {
      withdrawals,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    }
  })
})

export const getReports = asyncHandler(async (req, res) => {
  const now = new Date()
  
  // Today
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  // Weekly
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0,0,0,0)

  // Monthly
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  
  // Yearly
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  const getRevenue = async (startDate) => {
    const result = await WalletTransaction.aggregate([
      { $match: { type: 'Credit', status: 'Completed', createdAt: { $gte: startDate } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])
    return result[0]?.total || 0
  }

  const todayRevenue = await getRevenue(startOfToday)
  const weeklyRevenue = await getRevenue(startOfWeek)
  const monthlyRevenue = await getRevenue(startOfMonth)
  const yearlyRevenue = await getRevenue(startOfYear)

  // Dynamic segment aggregator helper
  const getSegmentAnalytics = async (matchQuery, distGroupField = 'type') => {
    const runSum = async (startDate, endDate = null) => {
      const match = { ...matchQuery, status: 'Completed' }
      if (startDate || endDate) {
        match.createdAt = {}
        if (startDate) match.createdAt.$gte = startDate
        if (endDate) match.createdAt.$lte = endDate
      }
      const res = await WalletTransaction.aggregate([
        { $match: match },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
      return res[0]?.total || 0
    }

    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

    const today = await runSum(startOfToday)
    const weekly = await runSum(startOfWeek)
    const monthly = await runSum(startOfMonth)
    const lastMonth = await runSum(startOfLastMonth, endOfLastMonth)

    // Trend (6 months)
    const trend = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const sum = await runSum(d, new Date(nextD.getTime() - 1))
      trend.push({
        name: d.toLocaleString('default', { month: 'short' }),
        value: sum
      })
    }

    // Distribution donut
    const distRaw = await WalletTransaction.aggregate([
      { $match: { ...matchQuery, status: 'Completed' } },
      { $group: { _id: `$${distGroupField}`, value: { $sum: '$amount' } } }
    ])

    const distribution = distRaw.map(item => ({
      name: item._id ? String(item._id).charAt(0).toUpperCase() + String(item._id).slice(1) : 'General',
      value: item.value
    }))

    // Fill placeholder donut data if empty to keep charts beautiful
    if (distribution.length === 0) {
      distribution.push({ name: 'Transactions', value: 0 })
    }

    return {
      stats: { today, weekly, monthly, lastMonth },
      trend,
      distribution
    }
  }

  // Define segments
  const platform = await getSegmentAnalytics({ $or: [{ platform_fee: true }, { type: 'Commission' }] }, 'source')
  const user = await getSegmentAnalytics({ payerType: 'user' }, 'type')
  const corporate = await getSegmentAnalytics({ payerType: 'corporate' }, 'type')
  const vendor = await getSegmentAnalytics({ payerType: 'vendor' }, 'type')
  const labour = await getSegmentAnalytics({ payerType: 'labour' }, 'type')

  // Overall charts (backward compatibility)
  const trend = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const mRev = await WalletTransaction.aggregate([
      { $match: { type: 'Credit', status: 'Completed', createdAt: { $gte: d, $lt: nextD } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])
    trend.push({
      name: d.toLocaleString('default', { month: 'short' }),
      revenue: mRev[0]?.total || 0
    })
  }

  const overall = await WalletTransaction.aggregate([
    { $match: { status: 'Completed' } },
    { $group: { 
        _id: '$type', 
        total: { $sum: '$amount' } 
    }}
  ])

  let credits = 0
  let debits = 0
  overall.forEach(item => {
    if (item._id === 'Credit') credits += item.total
    else debits += item.total
  })

  const creditsVsDebits = [
    { name: 'Credits', value: credits },
    { name: 'Debits', value: debits }
  ]

  const payerBreakdown = await WalletTransaction.aggregate([
    { $match: { status: 'Completed', platform_fee: true } },
    { $group: {
        _id: '$payerType',
        total: { $sum: '$amount' }
    }}
  ])

  const revenueByPayerType = payerBreakdown.map(item => ({
    name: item._id ? item._id.charAt(0).toUpperCase() + item._id.slice(1) : 'Unknown',
    value: item.total
  }))

  sendSuccess(res, {
    data: {
      cards: {
        todayRevenue,
        weeklyRevenue,
        monthlyRevenue,
        yearlyRevenue
      },
      charts: {
        revenueTrend: trend,
        creditsVsDebits,
        revenueByPayerType
      },
      segments: {
        platform,
        user,
        corporate,
        vendor,
        labour
      }
    }
  })
})

export const reviewWithdrawal = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { status, utrNumber, rejectionReason, payoutMethod } = req.body

  if (!status || !['Completed', 'Rejected'].includes(status)) {
    return sendError(res, { message: 'Invalid status. Must be Completed or Rejected', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const withdrawal = await Withdrawal.findById(id)
  if (!withdrawal) {
    return sendError(res, { message: 'Withdrawal request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (withdrawal.status !== 'Pending') {
    return sendError(res, { message: 'Withdrawal request is already processed', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const user = await User.findById(withdrawal.requestedBy)
  if (!user) {
    return sendError(res, { message: 'Requester user not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Find the matching transaction
  const transaction = await WalletTransaction.findOne({
    payerId: withdrawal.requestedBy,
    type: 'Withdrawal',
    amount: withdrawal.amount,
    status: 'Pending'
  }).sort({ createdAt: -1 })

  if (status === 'Completed') {
    let finalUtr = utrNumber

    if (payoutMethod === 'razorpay') {
      const keyId = process.env.RAZORPAY_KEY_ID
      const keySecret = process.env.RAZORPAY_KEY_SECRET
      const razorpayXAccount = process.env.RAZORPAYX_ACCOUNT_NUMBER

      if (!keyId || !keySecret) {
        return sendError(res, { message: 'Razorpay API credentials not configured', statusCode: HTTP_STATUS.BAD_REQUEST })
      }
      if (!razorpayXAccount) {
        return sendError(res, { message: 'RazorpayX Account Number is not configured (RAZORPAYX_ACCOUNT_NUMBER)', statusCode: HTTP_STATUS.BAD_REQUEST })
      }

      if (!withdrawal.bankDetails || !withdrawal.bankDetails.accountNumber || !withdrawal.bankDetails.ifscCode) {
        return sendError(res, { message: 'Vendor has incomplete bank details for automatic payout', statusCode: HTTP_STATUS.BAD_REQUEST })
      }

      try {
        // Step 1: Create/Get Razorpay Contact
        let contactId = user.razorpayContactId
        if (!contactId) {
          const contactRes = await fetch('https://api.razorpay.com/v1/contacts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64')
            },
            body: JSON.stringify({
              name: user.fullName || 'Vendor Payout',
              email: user.email || '',
              contact: user.phone || '',
              type: 'vendor',
              reference_id: user._id.toString()
            })
          })
          const contactData = await contactRes.json()
          if (contactData.error) {
            return sendError(res, { message: `Razorpay Contact creation failed: ${contactData.error.description}`, statusCode: HTTP_STATUS.BAD_REQUEST })
          }
          contactId = contactData.id
          user.razorpayContactId = contactId
          await user.save()
        }

        // Step 2: Create Fund Account
        let fundAccountId = user.razorpayFundAccountId
        if (!fundAccountId) {
          const fundRes = await fetch('https://api.razorpay.com/v1/fund_accounts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64')
            },
            body: JSON.stringify({
              contact_id: contactId,
              account_type: 'bank_account',
              bank_account: {
                name: withdrawal.bankDetails.accountHolderName || user.fullName || 'Vendor Account',
                ifsc: withdrawal.bankDetails.ifscCode,
                account_number: withdrawal.bankDetails.accountNumber
              }
            })
          })
          const fundData = await fundRes.json()
          if (fundData.error) {
            return sendError(res, { message: `Razorpay Fund Account failed: ${fundData.error.description}`, statusCode: HTTP_STATUS.BAD_REQUEST })
          }
          fundAccountId = fundData.id
          user.razorpayFundAccountId = fundAccountId
          await user.save()
        }

        // Step 3: Create Payout
        const payoutRes = await fetch('https://api.razorpay.com/v1/payouts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64')
          },
          body: JSON.stringify({
            account_number: razorpayXAccount,
            fund_account_id: fundAccountId,
            amount: withdrawal.amount * 100, // in paise
            currency: 'INR',
            mode: 'IMPS',
            purpose: 'payout',
            queue_if_low_balance: true,
            reference_id: withdrawal._id.toString()
          })
        })
        const payoutData = await payoutRes.json()
        if (payoutData.error) {
          return sendError(res, { message: `Razorpay Payout trigger failed: ${payoutData.error.description}`, statusCode: HTTP_STATUS.BAD_REQUEST })
        }

        finalUtr = payoutData.id || payoutData.utr || `RXP-${Date.now()}`
      } catch (razorpayErr) {
        return sendError(res, { message: `Razorpay Payout integration error: ${razorpayErr.message}`, statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR })
      }
    } else {
      if (!utrNumber) {
        return sendError(res, { message: 'UTR / Reference Number is required for manual payouts', statusCode: HTTP_STATUS.BAD_REQUEST })
      }
    }

    withdrawal.status = 'Completed'
    withdrawal.utrNumber = finalUtr
    await withdrawal.save()

    if (transaction) {
      transaction.status = 'Completed'
      transaction.utrNumber = finalUtr
      await transaction.save()
    }

    // Trigger Notification for vendor/contractor
    await triggerNotification({
      userId: user._id,
      title: 'Withdrawal Completed',
      body: `Your withdrawal of ₹${withdrawal.amount} has been approved and processed. UTR: ${finalUtr}`,
      type: 'SETTLEMENT_COMPLETED',
      relatedId: withdrawal._id,
      relatedModel: 'Withdrawal'
    })

    // Log admin audit trail
    await logAudit({
      adminId: req.user._id,
      action: 'Settlement Approved',
      previousValue: { status: 'Pending' },
      newValue: { status: 'Completed', utrNumber: finalUtr },
      module: 'Finance',
      req
    })

  } else if (status === 'Rejected') {
    withdrawal.status = 'Rejected'
    if (rejectionReason) {
      withdrawal.rejectionReason = rejectionReason
    }
    await withdrawal.save()

    if (transaction) {
      transaction.status = 'Failed'
      await transaction.save()
    }

    user.walletBalance += withdrawal.amount
    await user.save()

    // Create a Refund transaction
    await WalletTransaction.create({
      transactionId: `RFD-VND-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      payerId: user._id,
      payerName: 'System Refund',
      payerType: user.role === 'vendor' || user.role === 'contractor' ? 'vendor' : 'labour',
      labourId: user._id,
      type: 'Credit',
      source: `Refund: Rejected Withdrawal (${rejectionReason || 'No reason specified'})`,
      amount: withdrawal.amount,
      status: 'Completed'
    })

    // Trigger Notification for vendor/contractor
    await triggerNotification({
      userId: user._id,
      title: 'Withdrawal Rejected',
      body: `Your withdrawal of ₹${withdrawal.amount} was rejected. Reason: ${rejectionReason || 'No reason specified'}`,
      type: 'REFUND_REQUESTED', // maps to refund / reject
      relatedId: withdrawal._id,
      relatedModel: 'Withdrawal'
    })

    // Log admin audit trail
    await logAudit({
      adminId: req.user._id,
      action: 'Settlement Rejected',
      previousValue: { status: 'Pending' },
      newValue: { status: 'Rejected', rejectionReason },
      module: 'Finance',
      req
    })
  }

  sendSuccess(res, { data: { withdrawal } })
})
