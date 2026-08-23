import { verifyAccessToken } from '../services/tokenService.js'
import { User } from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError } from '../utils/apiResponse.js'

export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return sendError(res, {
      message: 'Authentication required',
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: 'UNAUTHORIZED',
    })
  }
  const token = header.slice(7)
  let payload
  try {
    payload = verifyAccessToken(token)
  } catch {
    return sendError(res, {
      message: 'Invalid or expired token',
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: 'INVALID_TOKEN',
    })
  }

  const user = await User.findById(payload.sub)
  if (!user || !user.isActive) {
    return sendError(res, {
      message: 'User not found or inactive',
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: 'UNAUTHORIZED',
    })
  }

  // Single active session enforcement:
  // If token has a session ID (`payload.sid`), the user's activeSessionId in DB must match it.
  // If user has logged out (activeSessionId is null/cleared) or logged in on another device (different activeSessionId), reject.
  if (payload.sid && user.activeSessionId !== payload.sid) {
    return sendError(res, {
      message: 'You have been logged in from another device. Your session has ended.',
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: 'SESSION_TERMINATED',
      data: {
        reason: 'logged_in_elsewhere',
      },
    })
  }

  req.user = user
  req.tokenPayload = payload
  next()
})

export const optionalAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return next()
  }
  const token = header.slice(7)
  try {
    const payload = verifyAccessToken(token)
    const user = await User.findById(payload.sub)
    if (user && user.isActive) {
      if (!payload.sid || user.activeSessionId === payload.sid) {
        req.user = user
        req.tokenPayload = payload
      }
    }
  } catch {
    // Ignore invalid tokens for optional auth
  }
  next()
})

export function restrictTo(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, {
        message: 'Authentication required',
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: 'UNAUTHORIZED',
      })
    }
    if (!roles.includes(req.user.role)) {
      return sendError(res, {
        message: 'You do not have permission for this action',
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: 'FORBIDDEN',
      })
    }
    next()
  }
}

export function requireActiveAccount() {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, {
        message: 'Authentication required',
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: 'UNAUTHORIZED',
      })
    }
    if (req.user.accountStatus && req.user.accountStatus !== 'active') {
      const statusText =
        req.user.accountStatus === 'on_hold' ? 'On Hold' :
        req.user.accountStatus === 'suspended' ? 'Suspended' :
        req.user.accountStatus === 'blocked' ? 'Blocked' : req.user.accountStatus
      return sendError(res, {
        message: `Action denied: Your account is currently put ${statusText} by Admin. You cannot create requests or accept jobs.`,
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: 'ACCOUNT_NOT_ACTIVE',
      })
    }
    next()
  }
}
