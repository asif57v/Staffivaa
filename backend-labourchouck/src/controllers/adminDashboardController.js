import { User } from '../models/User.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { AttendanceRecord } from '../models/AttendanceRecord.js'
import { Project } from '../models/Project.js'
import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { SupportTicket } from '../models/SupportTicket.js'
import { Assignment } from '../models/Assignment.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/apiResponse.js'

export const getDashboardStats = asyncHandler(async (req, res) => {
  const totalUsers = await User.countDocuments({ role: 'individual' })
  const totalLabour = await User.countDocuments({ role: 'labour' })
  const totalVendors = await User.countDocuments({ role: 'contractor' })
  const totalCorporateClients = await User.countDocuments({ role: 'corporate' })
  
  const activeWorkforce = await Assignment.countDocuments({ status: { $in: ['accepted', 'on_site'] } })
  const activeProjects = await Project.countDocuments({ status: 'active' })
  
  const pendingRequests = await WorkforceRequest.countDocuments({ status: 'pending_review' })
  
  const pendingLabourKyc = await User.countDocuments({ role: 'labour', 'labourProfile.kycStatus': 'pending' })
  const pendingVendorKyc = await User.countDocuments({ role: 'contractor', 'contractorProfile.verificationStatus': 'pending' })
  const pendingCorporateKyc = await User.countDocuments({ role: 'corporate', 'corporateProfile.status': 'pending' })
  const pendingKyc = pendingLabourKyc + pendingVendorKyc + pendingCorporateKyc
  
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  
  const todayAttendance = await AttendanceRecord.countDocuments({ shiftDate: { $gte: startOfToday, $lte: endOfToday } })
  const todayCheckIns = await AttendanceRecord.countDocuments({ checkInAt: { $gte: startOfToday, $lte: endOfToday } })
  const todayCheckOuts = await AttendanceRecord.countDocuments({ checkOutAt: { $gte: startOfToday, $lte: endOfToday } })
  
  const totalBookings = await WorkforceRequest.countDocuments({})
  
  // Revenue
  const dailyRevAgg = await WalletTransaction.aggregate([
    { $match: { type: 'Credit', status: 'Completed', createdAt: { $gte: startOfToday, $lte: endOfToday } } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ])
  const dailyRevenue = dailyRevAgg[0]?.total || 0
  
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthlyRevAgg = await WalletTransaction.aggregate([
    { $match: { type: 'Credit', status: 'Completed', createdAt: { $gte: startOfMonth } } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ])
  const monthlyRevenue = monthlyRevAgg[0]?.total || 0
  
  // Platform Earnings
  const earningsAgg = await WalletTransaction.aggregate([
    { $match: { status: 'Completed', $or: [{ type: 'Commission' }, { platform_fee: true }] } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ])
  const platformEarnings = earningsAgg[0]?.total || 0
  
  // Settlements
  const settledAgg = await WalletTransaction.aggregate([
    { $match: { type: 'Settlement', status: 'Completed' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ])
  const vendorSettlements = settledAgg[0]?.total || 0
  
  const pendingSettledAgg = await WalletTransaction.aggregate([
    { $match: { type: 'Settlement', status: 'Pending' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ])
  const pendingSettlements = pendingSettledAgg[0]?.total || 0
  
  // Wallet Balance
  let adminWallet = await Wallet.findOne({ singletonId: 'ADMIN_WALLET' })
  if (!adminWallet) {
    adminWallet = await Wallet.create({ singletonId: 'ADMIN_WALLET' })
  }
  const walletBalance = adminWallet.balance
  
  // Support Tickets
  const supportTickets = await SupportTicket.countDocuments({ status: 'open' })
  
  return sendSuccess(res, {
    data: {
      totalUsers,
      totalLabour,
      totalVendors,
      totalCorporateClients,
      activeWorkforce,
      activeProjects,
      pendingRequests,
      pendingKyc,
      todayAttendance,
      todayCheckIns,
      todayCheckOuts,
      totalBookings,
      monthlyRevenue,
      dailyRevenue,
      platformEarnings,
      vendorSettlements,
      pendingSettlements,
      walletBalance,
      supportTickets,
    }
  })
})

export const getDashboardAnalytics = asyncHandler(async (req, res) => {
  const now = new Date()
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  // Growth Trend (registrations by role per month)
  const growthAgg = await User.aggregate([
    { $match: { createdAt: { $gte: sixMonthsAgo } } },
    { $group: {
        _id: {
          month: { $month: '$createdAt' },
          year: { $year: '$createdAt' },
          role: '$role'
        },
        count: { $sum: 1 }
    }},
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ])

  // Revenue Trend per month
  const revenueTrendAgg = await WalletTransaction.aggregate([
    { $match: { type: 'Credit', status: 'Completed', createdAt: { $gte: sixMonthsAgo } } },
    { $group: {
        _id: {
          month: { $month: '$createdAt' },
          year: { $year: '$createdAt' }
        },
        total: { $sum: '$amount' }
    }},
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ])

  // Booking Trend per month
  const bookingTrendAgg = await WorkforceRequest.aggregate([
    { $match: { createdAt: { $gte: sixMonthsAgo } } },
    { $group: {
        _id: {
          month: { $month: '$createdAt' },
          year: { $year: '$createdAt' }
        },
        count: { $sum: 1 }
    }},
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ])

  // Attendance stats for last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(now.getDate() - 30)
  const attendanceStatsAgg = await AttendanceRecord.aggregate([
    { $match: { shiftDate: { $gte: thirtyDaysAgo } } },
    { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$shiftDate' } },
        present: { $sum: { $cond: [{ $eq: ['$attendanceStatus', 'present'] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ['$attendanceStatus', 'absent'] }, 1, 0] } }
    }},
    { $sort: { _id: 1 } }
  ])

  // Map into final arrays formatted for charting
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      monthName: d.toLocaleString('default', { month: 'short' }),
      monthNum: d.getMonth() + 1,
      year: d.getFullYear(),
    })
  }

  const userGrowth = months.map(m => {
    const matching = growthAgg.filter(g => g._id.month === m.monthNum && g._id.year === m.year)
    return {
      name: m.monthName,
      labour: matching.find(g => g._id.role === 'labour')?.count || 0,
      vendor: matching.find(g => g._id.role === 'contractor')?.count || 0,
      corporate: matching.find(g => g._id.role === 'corporate')?.count || 0,
      user: matching.find(g => g._id.role === 'individual')?.count || 0,
    }
  })

  const revenueTrend = months.map(m => {
    const matching = revenueTrendAgg.find(r => r._id.month === m.monthNum && r._id.year === m.year)
    return {
      name: m.monthName,
      revenue: matching?.total || 0,
    }
  })

  const bookingTrend = months.map(m => {
    const matching = bookingTrendAgg.find(b => b._id.month === m.monthNum && b._id.year === m.year)
    return {
      name: m.monthName,
      bookings: matching?.count || 0,
    }
  })

  const attendanceStats = attendanceStatsAgg.map(a => ({
    date: a._id,
    present: a.present,
    absent: a.absent
  }))

  return sendSuccess(res, {
    data: {
      userGrowth,
      revenueTrend,
      bookingTrend,
      attendanceStats
    }
  })
})
