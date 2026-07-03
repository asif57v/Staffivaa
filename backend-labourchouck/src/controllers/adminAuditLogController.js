import { AuditLog } from '../models/AuditLog.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/apiResponse.js'

export const getAuditLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, module, search } = req.query
  const query = {}

  if (module) query.module = module

  if (search) {
    query.$or = [
      { action: { $regex: search, $options: 'i' } },
      { ipAddress: { $regex: search, $options: 'i' } },
      { browser: { $regex: search, $options: 'i' } },
    ]
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const logs = await AuditLog.find(query)
    .populate('admin', 'fullName role email phone')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean()

  const total = await AuditLog.countDocuments(query)

  return sendSuccess(res, {
    data: {
      logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    },
  })
})
