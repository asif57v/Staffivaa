import { Wallet } from '../models/Wallet.js'
import { User } from '../models/User.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { Withdrawal } from '../models/Withdrawal.js'
import { EnterpriseEscrowTransaction } from '../models/EnterpriseEscrowTransaction.js'
import { EnterpriseJoiningInvoice } from '../models/EnterpriseJoiningInvoice.js'
import { EnterprisePayroll } from '../models/EnterprisePayroll.js'
import { EnterpriseAttendance } from '../models/EnterpriseAttendance.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess, sendError, HTTP_STATUS } from '../utils/apiResponse.js'
import { logAudit } from '../utils/auditLogger.js'
import { triggerNotification } from '../utils/notificationTrigger.js'

export const getWalletSummary = asyncHandler(async (req, res) => {
  let wallet = await Wallet.findOne({ singletonId: 'ADMIN_WALLET' })
  if (!wallet) {
    wallet = await Wallet.create({ singletonId: 'ADMIN_WALLET' })
  }
  
  // Aggregate credits and debits
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

  // Real-time Escrow, Payroll & Withdrawal Widgets
  const escrowSecured = await EnterpriseEscrowTransaction.aggregate([
    { $match: { status: 'secured' } },
    { $group: { _id: null, total: { $sum: '$amount' }, platformFee: { $sum: '$platformRevenue' }, gst: { $sum: '$gstAmount' } } }
  ])

  const escrowReleased = await EnterpriseEscrowTransaction.aggregate([
    { $match: { status: 'released' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ])

  const paymentsReceived = await EnterpriseJoiningInvoice.aggregate([
    { $match: { status: 'paid' } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ])

  const pendingPayrolls = await EnterprisePayroll.aggregate([
    { $match: { status: { $in: ['under_review', 'approved'] } } },
    { $group: { _id: null, total: { $sum: '$netSalary' } } }
  ])

  const salaryCreditedAgg = await EnterprisePayroll.aggregate([
    { $match: { status: { $in: ['released', 'paid'] } } },
    { $group: { _id: null, total: { $sum: '$netSalary' } } }
  ])

  const pendingWithdrawalsAgg = await Withdrawal.aggregate([
    { $match: { status: { $in: ['Pending', 'Processing', 'Approved', 'Hold'] } } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ])

  const completedWithdrawalsAgg = await Withdrawal.aggregate([
    { $match: { status: 'Completed' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ])

  const failedWithdrawalsCount = await Withdrawal.countDocuments({ status: 'Rejected' })

  const totalEscrowBalance = escrowSecured[0]?.total || 0
  const enterprisePaymentsReceived = paymentsReceived[0]?.total || 0
  const payrollPending = pendingPayrolls[0]?.total || 0
  const salaryCredited = salaryCreditedAgg[0]?.total || 0
  const pendingWithdrawals = pendingWithdrawalsAgg[0]?.total || 0
  const completedWithdrawals = completedWithdrawalsAgg[0]?.total || 0
  const platformRevenue = (escrowSecured[0]?.platformFee || 0) + (wallet.platformEarnings || 0)
  const gstCollected = escrowSecured[0]?.gst || 0
  const totalRefunds = stats.totalRefunds || 0

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
      totalRefunds,
      // Enterprise Real-Time Widgets
      totalEscrowBalance,
      enterprisePaymentsReceived,
      payrollPending,
      salaryCredited,
      pendingWithdrawals,
      completedWithdrawals,
      platformRevenue,
      gstCollected,
      refunds: totalRefunds,
      failedWithdrawals: failedWithdrawalsCount,
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
  const { page = 1, limit = 10, status, search, payoutType } = req.query
  const skip = (parseInt(page) - 1) * parseInt(limit)
  const query = {}

  if (status && status !== 'all') {
    query.status = status
  }

  if (payoutType && payoutType !== 'all') {
    query.payoutType = payoutType
  }

  const withdrawals = await Withdrawal.find(query)
    .populate({
      path: 'requestedBy',
      select: 'fullName email phone role profileImageUrl labourProfile bankAccountDetails upiDetails walletBalance',
    })
    .populate('enterpriseId', 'fullName companyName enterpriseProfile')
    .populate('jobId', 'jobTitle workLocation')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))

  const total = await Withdrawal.countDocuments(query)

  sendSuccess(res, {
    data: {
      withdrawals,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    },
  })
})

export const getWithdrawalDetailsById = asyncHandler(async (req, res) => {
  const { id } = req.params
  const withdrawal = await Withdrawal.findById(id)
    .populate({
      path: 'requestedBy',
      select: 'fullName email phone role profileImageUrl labourProfile bankAccountDetails upiDetails walletBalance createdAt',
    })
    .populate('enterpriseId', 'fullName companyName enterpriseProfile email phone')
    .populate('jobId', 'jobTitle workLocation department salary')
    .populate('reviewedBy', 'fullName email')

  if (!withdrawal) {
    return sendError(res, { message: 'Withdrawal request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const worker = withdrawal.requestedBy || {}

  // Fetch salary history for this worker
  const salaryHistory = await EnterprisePayroll.find({ workerId: worker._id })
    .populate('enterpriseId', 'fullName companyName')
    .sort({ year: -1, month: -1 })
    .limit(12)

  // Fetch attendance summary across all enterprise jobs for this worker
  const attendanceLogs = await EnterpriseAttendance.find({ workerId: worker._id })
  let presentDays = 0
  let absentDays = 0
  let halfDays = 0
  let totalOvertimeHours = 0
  attendanceLogs.forEach((log) => {
    if (log.status === 'present' || log.status === 'late') presentDays++
    if (log.status === 'absent') absentDays++
    if (log.status === 'half-day') halfDays++
    if (log.overtimeHours) totalOvertimeHours += Number(log.overtimeHours)
  })

  // Fetch transaction history
  const transactions = await WalletTransaction.find({
    $or: [{ payerId: worker._id }, { userId: worker._id }, { labourId: worker._id }],
  })
    .sort({ createdAt: -1 })
    .limit(20)

  // Fetch withdrawal history
  const withdrawalHistory = await Withdrawal.find({ requestedBy: worker._id })
    .sort({ createdAt: -1 })

  const totalSalaryCredited = salaryHistory
    .filter((s) => ['released', 'paid'].includes(s.status))
    .reduce((sum, s) => sum + (s.netSalary || 0), 0)

  const pendingSalary = salaryHistory
    .filter((s) => ['under_review', 'approved'].includes(s.status))
    .reduce((sum, s) => sum + (s.netSalary || 0), 0)

  const totalWithdrawn = withdrawalHistory
    .filter((w) => w.status === 'Completed')
    .reduce((sum, w) => sum + (w.amount || 0), 0)

  sendSuccess(res, {
    data: {
      withdrawal,
      worker,
      bankDetails: withdrawal.bankDetails || worker.bankAccountDetails || null,
      upiDetails: withdrawal.upiDetails || worker.upiDetails || null,
      kycStatus: worker.labourProfile?.kycStatus || 'pending',
      kycDetails: {
        aadhaarMasked: worker.labourProfile?.aadhaarMasked,
        panMasked: worker.labourProfile?.panMasked,
        kycVideoUrl: worker.labourProfile?.kycVideoUrl,
        kycFrontImageUrl: worker.labourProfile?.kycFrontImageUrl,
        kycBackImageUrl: worker.labourProfile?.kycBackImageUrl,
      },
      walletSummary: {
        availableBalance: worker.walletBalance || 0,
        totalSalaryCredited,
        pendingSalary,
        totalWithdrawn,
      },
      attendanceSummary: {
        totalRecords: attendanceLogs.length,
        presentDays,
        absentDays,
        halfDays,
        totalOvertimeHours,
      },
      salaryHistory,
      transactionHistory: transactions,
      withdrawalHistory,
    },
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
  const { status, utrNumber, rejectionReason, adminNotes, payoutMethod } = req.body

  if (!status || !['Completed', 'Approved', 'Rejected', 'Hold'].includes(status)) {
    return sendError(res, { message: 'Invalid status. Must be Completed, Approved, Rejected, or Hold', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const withdrawal = await Withdrawal.findById(id)
  if (!withdrawal) {
    return sendError(res, { message: 'Withdrawal request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (['Completed', 'Rejected'].includes(withdrawal.status)) {
    return sendError(res, { message: `Withdrawal request is already ${withdrawal.status}`, statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const user = await User.findById(withdrawal.requestedBy)
  if (!user) {
    return sendError(res, { message: 'Requester user account not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Find the matching transaction
  const transaction = await WalletTransaction.findOne({
    $or: [{ referenceId: withdrawal._id }, { payerId: withdrawal.requestedBy, amount: withdrawal.amount, type: 'Withdrawal' }],
    status: { $in: ['Pending', 'Processing', 'Hold'] },
  }).sort({ createdAt: -1 })

  if (status === 'Completed' || status === 'Approved') {
    let finalUtr = utrNumber

    if (payoutMethod === 'razorpay') {
      const keyId = process.env.RAZORPAY_KEY_ID
      const keySecret = process.env.RAZORPAY_KEY_SECRET
      let razorpayXAccount = process.env.RAZORPAYX_ACCOUNT_NUMBER || (keyId?.startsWith('rzp_test_') ? '2334455667788' : null)

      if (!keyId || !keySecret) {
        return sendError(res, { message: 'Razorpay API credentials not configured in environment', statusCode: HTTP_STATUS.BAD_REQUEST })
      }

      if (withdrawal.payoutType === 'bank_transfer' && (!withdrawal.bankDetails || !withdrawal.bankDetails.accountNumber || !withdrawal.bankDetails.ifscCode)) {
        return sendError(res, { message: 'Incomplete bank details for automatic payout', statusCode: HTTP_STATUS.BAD_REQUEST })
      }

      const isTestKey = keyId.startsWith('rzp_test_')

      try {
        let contactId = user.razorpayContactId
        if (!contactId) {
          const contactRes = await fetch('https://api.razorpay.com/v1/contacts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64')
            },
            body: JSON.stringify({
              name: user.fullName || 'Worker Payout',
              email: user.email || `${user._id}@staffivaa.internal`,
              contact: user.phone || '9999999999',
              type: 'vendor',
              reference_id: user._id.toString()
            })
          })
          const contactData = await contactRes.json()
          if (contactData.id) {
            contactId = contactData.id
            user.razorpayContactId = contactId
            await user.save()
          }
        }

        let fundAccountId = user.razorpayFundAccountId
        if (!fundAccountId && contactId) {
          const fundRes = await fetch('https://api.razorpay.com/v1/fund_accounts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64')
            },
            body: JSON.stringify({
              contact_id: contactId,
              account_type: withdrawal.payoutType === 'upi' ? 'vpa' : 'bank_account',
              bank_account: withdrawal.payoutType === 'bank_transfer' ? {
                name: withdrawal.bankDetails?.accountHolderName || user.fullName || 'Account',
                ifsc: withdrawal.bankDetails?.ifscCode,
                account_number: withdrawal.bankDetails?.accountNumber
              } : undefined,
              vpa: withdrawal.payoutType === 'upi' ? {
                address: withdrawal.upiDetails?.upiId
              } : undefined
            })
          })
          const fundData = await fundRes.json()
          if (fundData.id) {
            fundAccountId = fundData.id
            user.razorpayFundAccountId = fundAccountId
            await user.save()
          }
        }

        let payoutSuccess = false
        if (contactId && fundAccountId) {
          const payoutRes = await fetch('https://api.razorpay.com/v1/payouts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64')
            },
            body: JSON.stringify({
              account_number: razorpayXAccount,
              fund_account_id: fundAccountId,
              amount: withdrawal.amount * 100,
              currency: 'INR',
              mode: withdrawal.payoutType === 'upi' ? 'UPI' : 'IMPS',
              purpose: 'payout',
              queue_if_low_balance: true,
              reference_id: withdrawal._id.toString()
            })
          })
          const payoutData = await payoutRes.json()
          if (!payoutData.error && (payoutData.id || payoutData.utr)) {
            finalUtr = payoutData.utr || payoutData.id
            payoutSuccess = true
          }
        }

        if (!payoutSuccess) {
          if (isTestKey) {
            // In test mode, fallback to generated test UTR for seamless end-to-end testing
            finalUtr = `RXP-TEST-${Date.now().toString().slice(-6)}`
          } else {
            return sendError(res, {
              message: 'RazorpayX Payouts is not activated on your live Razorpay account. Enable RazorpayX or select Manual Bank Transfer.',
              statusCode: HTTP_STATUS.BAD_REQUEST
            })
          }
        }
      } catch (razorpayErr) {
        if (isTestKey) {
          finalUtr = `RXP-TEST-${Date.now().toString().slice(-6)}`
        } else {
          return sendError(res, { message: `Razorpay Payout error: ${razorpayErr.message}`, statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR })
        }
      }
    } else {
      if (!utrNumber) {
        return sendError(res, { message: 'UTR / Reference Number is required for manual bank payouts', statusCode: HTTP_STATUS.BAD_REQUEST })
      }
    }

    withdrawal.status = 'Completed'
    withdrawal.utrNumber = finalUtr
    withdrawal.reviewedBy = req.user._id
    withdrawal.reviewedAt = new Date()
    if (adminNotes) withdrawal.adminNotes = adminNotes
    await withdrawal.save()

    if (transaction) {
      transaction.status = 'Completed'
      transaction.utrNumber = finalUtr
      await transaction.save()
    }

    // Trigger Notification for worker
    await triggerNotification({
      userId: user._id,
      title: 'Withdrawal Approved & Transferred! 🎉',
      body: `₹${withdrawal.amount.toLocaleString('en-IN')} has been transferred to your bank account successfully. UTR: ${finalUtr}`,
      type: 'WITHDRAWAL_APPROVED',
      relatedId: withdrawal._id,
      relatedModel: 'Withdrawal'
    })

    await logAudit({
      adminId: req.user._id,
      action: 'Withdrawal Approved',
      previousValue: { status: withdrawal.status },
      newValue: { status: 'Completed', utrNumber: finalUtr },
      module: 'Finance',
      req
    })

  } else if (status === 'Hold') {
    withdrawal.status = 'Hold'
    if (adminNotes) withdrawal.adminNotes = adminNotes
    withdrawal.reviewedBy = req.user._id
    withdrawal.reviewedAt = new Date()
    await withdrawal.save()

    if (transaction) {
      transaction.status = 'Pending'
      await transaction.save()
    }

    await triggerNotification({
      userId: user._id,
      title: 'Withdrawal Request On Hold ⏳',
      body: `Your withdrawal request of ₹${withdrawal.amount.toLocaleString('en-IN')} has been placed on hold for verification.`,
      type: 'WITHDRAWAL_ON_HOLD',
      relatedId: withdrawal._id,
      relatedModel: 'Withdrawal'
    })

    await logAudit({
      adminId: req.user._id,
      action: 'Withdrawal On Hold',
      previousValue: { status: 'Pending' },
      newValue: { status: 'Hold', adminNotes },
      module: 'Finance',
      req
    })

  } else if (status === 'Rejected') {
    withdrawal.status = 'Rejected'
    if (rejectionReason) withdrawal.rejectionReason = rejectionReason
    if (adminNotes) withdrawal.adminNotes = adminNotes
    withdrawal.reviewedBy = req.user._id
    withdrawal.reviewedAt = new Date()
    await withdrawal.save()

    if (transaction) {
      transaction.status = 'Failed'
      await transaction.save()
    }

    // Refund locked amount back to worker wallet balance
    user.walletBalance = (user.walletBalance || 0) + withdrawal.amount
    await user.save()

    // Create a Refund transaction
    await WalletTransaction.create({
      transactionId: `RFD-${user.role.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`,
      payerId: user._id,
      userId: user._id,
      labourId: user._id,
      payerName: 'System Refund',
      payerType: user.role,
      type: 'Credit',
      source: `Refund: Rejected Withdrawal (${rejectionReason || 'Verification Issue'})`,
      amount: withdrawal.amount,
      status: 'Completed'
    })

    await triggerNotification({
      userId: user._id,
      title: 'Withdrawal Request Rejected ❌',
      body: `Your withdrawal request of ₹${withdrawal.amount.toLocaleString('en-IN')} has been rejected. Reason: ${rejectionReason || 'Verification issue'}. Funds restored to wallet balance.`,
      type: 'WITHDRAWAL_REJECTED',
      relatedId: withdrawal._id,
      relatedModel: 'Withdrawal'
    })

    await logAudit({
      adminId: req.user._id,
      action: 'Withdrawal Rejected',
      previousValue: { status: 'Pending' },
      newValue: { status: 'Rejected', rejectionReason },
      module: 'Finance',
      req
    })
  }

  sendSuccess(res, { data: { withdrawal } })
})
