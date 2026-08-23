import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { User } from '../models/User.js'
import { logAudit } from '../utils/auditLogger.js'
import { USER_ROLES, CORPORATE_STATUS, ENTERPRISE_STATUS } from '../constants/roles.js'
import { createOtpChallenge, validateOtpChallenge, deleteOtpChallengeDoc } from '../services/otpService.js'
import { signAccessToken } from '../services/tokenService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { populateLabourCategories } from '../utils/populateLabourCategories.js'
import { triggerNotification } from '../utils/notificationTrigger.js'
import { getIO } from '../utils/socket.js'
import { normalizeRole } from '../utils/roleUtils.js'

function buildAuthPayload(user, token) {
  const safe = user.toSafeObject()
  let flags = {}
  if (user.role === USER_ROLES.CORPORATE && user.corporateProfile) {
    flags = {
      corporateApprovalStatus: user.corporateProfile.status,
    }
  }
  if (user.role === USER_ROLES.ENTERPRISE && user.enterpriseProfile) {
    flags = {
      enterpriseApprovalStatus: user.enterpriseProfile.status,
    }
  }
  const platform = user.role === USER_ROLES.ADMIN ? 'web' : 'app'
  return {
    role: user.role,
    platform,
    user: safe,
    token,
    flags,
  }
}

/** Helper to notify previous device/browser sessions on socket */
function broadcastSessionTermination(user) {
  try {
    const io = getIO()
    if (io && user?._id && user?.role) {
      const uId = user._id.toString()
      const canonicalRole = normalizeRole(user.role)
      io.to(`${canonicalRole}_${uId}`).emit('session:terminated', {
        message: 'You have been logged in from another device. Your session has ended.',
        reason: 'logged_in_elsewhere',
        timestamp: new Date().toISOString(),
      })
      console.log(`[Auth] Broadcasted session:terminated to ${canonicalRole}_${uId}`)
    }
  } catch (err) {
    // Socket server may not be initialized yet
  }
}

/** POST /auth/register/request-otp */
export const registerRequestOtp = asyncHandler(async (req, res) => {
  const { phone, role } = req.body
  const existing = await User.findOne({ phone })
  if (existing) {
    return sendError(res, {
      message: 'An account with this phone number already exists. Please log in.',
      statusCode: HTTP_STATUS.CONFLICT,
      code: 'USER_EXISTS',
    })
  }
  const { challengeId, expiresAt } = await createOtpChallenge(phone, 'register')
  return sendSuccess(res, {
    message: 'OTP sent for registration',
    data: {
      phone,
      role,
      challengeId,
      expiresAt,
    },
  })
})

/** POST /auth/register/verify */
export const registerVerify = asyncHandler(async (req, res) => {
  const { phone, code, role, fullName, companyName, businessName, businessCategory, gstNumber, challengeId } = req.body

  const existing = await User.findOne({ phone })
  if (existing) {
    return sendError(res, {
      message: 'Account already registered',
      statusCode: HTTP_STATUS.CONFLICT,
      code: 'USER_EXISTS',
    })
  }

  const otp = await validateOtpChallenge({ phone, purpose: 'register', code, challengeId })
  if (!otp.ok) {
    const map = {
      INVALID_CHALLENGE: 'OTP session invalid — request a new OTP',
      NO_OTP: 'Request OTP first',
      EXPIRED: 'OTP expired — request a new one',
      TOO_MANY_ATTEMPTS: 'Too many attempts — request a new OTP',
      INVALID_CODE: 'Invalid OTP',
    }
    return sendError(res, {
      message: map[otp.reason] || 'OTP verification failed',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: otp.reason,
    })
  }

  const sessionId = crypto.randomUUID()

  const doc = {
    phone,
    role,
    fullName: fullName || undefined,
    isPhoneVerified: true,
    activeSessionId: sessionId,
    lastLoginAt: new Date(),
    lastLoginDevice: req.headers['user-agent'] || 'Unknown',
    lastLoginIp: req.ip || req.connection?.remoteAddress || null,
  }

  if (role === USER_ROLES.CORPORATE) {
    doc.corporateProfile = {
      companyName,
      businessCategory: businessCategory || undefined,
      gstNumber: gstNumber || undefined,
      status: CORPORATE_STATUS.PENDING,
    }
  }
  if (role === USER_ROLES.ENTERPRISE) {
    doc.enterpriseProfile = {
      companyName,
      businessCategory: businessCategory || undefined,
      gstNumber: gstNumber || undefined,
      status: ENTERPRISE_STATUS.PENDING,
    }
  }
  if (role === USER_ROLES.CONTRACTOR) {
    doc.contractorProfile = { businessName, verificationStatus: 'pending' }
  }
  if (role === USER_ROLES.LABOUR) {
    doc.labourProfile = {}
  }

  let user
  try {
    user = await User.create(doc)
  } catch (e) {
    if (e?.code === 11000) {
      return sendError(res, {
        message: 'Account already registered',
        statusCode: HTTP_STATUS.CONFLICT,
        code: 'USER_EXISTS',
      })
    }
    return sendError(res, {
      message: 'Could not create account — try again',
      statusCode: HTTP_STATUS.SERVER_ERROR,
      code: 'REGISTER_FAILED',
    })
  }
  await deleteOtpChallengeDoc(otp.doc)
  const token = signAccessToken(user, sessionId)

  if (role === USER_ROLES.LABOUR) {
    triggerNotification({
      userId: user._id,
      title: 'Complete Your KYC to Unlock Jobs! 🆔',
      body: 'Welcome to Staffivaa! Complete your Aadhaar & PAN verification now to start accepting jobs and getting paid.',
      type: 'KYC_REMINDER',
      relatedId: user._id,
      relatedModel: 'User',
      recipientRole: 'labour',
    }).catch((err) => console.error('[Notification Error]:', err.message))
  }

  return sendSuccess(res, {
    message: 'Account created',
    statusCode: HTTP_STATUS.CREATED,
    data: buildAuthPayload(user, token),
  })
})

/** POST /auth/login/request-otp */
export const loginRequestOtp = asyncHandler(async (req, res) => {
  const { phone } = req.body
  const user = await User.findOne({ phone })
  if (!user) {
    return sendError(res, {
      message: 'No account found with this phone number. Please register first.',
      statusCode: HTTP_STATUS.NOT_FOUND,
      code: 'USER_NOT_FOUND',
    })
  }
  if (!user.isActive) {
    return sendError(res, {
      message: 'Your account is disabled. Contact support.',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'ACCOUNT_DISABLED',
    })
  }
  if (user.role === USER_ROLES.ADMIN) {
    return sendError(res, {
      message: 'Admin accounts must use email login on the admin panel',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'USE_ADMIN_LOGIN',
    })
  }
  
  const { challengeId, expiresAt } = await createOtpChallenge(phone, 'login')
  
  // Platform is strictly based on role
  const platform = user.role === USER_ROLES.ADMIN ? 'web' : 'app'

  return sendSuccess(res, {
    message: 'OTP sent',
    data: { 
      phone, 
      role: user.role, 
      platform, 
      challengeId,
      expiresAt,
    },
  })
})

/** POST /auth/login/verify */
export const loginVerify = asyncHandler(async (req, res) => {
  const { phone, code, challengeId } = req.body
  const user = await User.findOne({ phone })
  if (!user) {
    return sendError(res, {
      message: 'Account not found',
      statusCode: HTTP_STATUS.NOT_FOUND,
      code: 'USER_NOT_FOUND',
    })
  }
  if (!user.isActive) {
    return sendError(res, {
      message: 'Account disabled',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'ACCOUNT_DISABLED',
    })
  }

  const otp = await validateOtpChallenge({ phone, purpose: 'login', code, challengeId })
  if (!otp.ok) {
    const map = {
      INVALID_CHALLENGE: 'OTP session invalid — request a new OTP',
      NO_OTP: 'Request OTP first',
      EXPIRED: 'OTP expired — request a new one',
      TOO_MANY_ATTEMPTS: 'Too many attempts — request a new OTP',
      INVALID_CODE: 'Invalid OTP',
    }
    return sendError(res, {
      message: map[otp.reason] || 'OTP verification failed',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: otp.reason,
    })
  }

  // Terminate any previous active session across other devices/browsers
  broadcastSessionTermination(user)

  // Generate new unique activeSessionId
  const sessionId = crypto.randomUUID()
  user.activeSessionId = sessionId
  user.isPhoneVerified = true
  user.lastLoginAt = new Date()
  user.lastLoginDevice = req.headers['user-agent'] || 'Unknown'
  user.lastLoginIp = req.ip || req.connection?.remoteAddress || null

  // Reset push tokens so old device stops receiving notifications until new device syncs
  user.fcmTokensWeb = []
  user.fcmTokensMobile = []

  await user.save()
  await deleteOtpChallengeDoc(otp.doc)
  
  if (user.role === USER_ROLES.LABOUR && user.labourProfile?.kycStatus !== 'verified') {
    triggerNotification({
      userId: user._id,
      title: 'Complete Your KYC to Unlock Jobs! 🆔',
      body: 'Your KYC is incomplete. Verify your Aadhaar & PAN now to receive job assignments and daily payouts.',
      type: 'KYC_REMINDER',
      relatedId: user._id,
      relatedModel: 'User',
      recipientRole: 'labour',
    }).catch((err) => console.error('[Notification Error]:', err.message))
  }

  const token = signAccessToken(user, sessionId)
  const payload = buildAuthPayload(user, token)

  return sendSuccess(res, {
    message: 'Login successful',
    data: payload,
  })
})

/** POST /auth/admin/login — web admin panel */
export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body
  const user = await User.findOne({ email, role: USER_ROLES.ADMIN }).select('+passwordHash')
  if (!user || !user.passwordHash) {
    return sendError(res, {
      message: 'Invalid credentials',
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: 'INVALID_CREDENTIALS',
    })
  }
  const ok = await user.comparePassword(password)
  if (!ok) {
    return sendError(res, {
      message: 'Invalid credentials',
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: 'INVALID_CREDENTIALS',
    })
  }
  if (!user.isActive) {
    return sendError(res, {
      message: 'Account disabled',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'ACCOUNT_DISABLED',
    })
  }

  // Terminate any previous active admin session
  broadcastSessionTermination(user)

  const sessionId = crypto.randomUUID()
  user.activeSessionId = sessionId
  user.lastLoginAt = new Date()
  user.lastLoginDevice = req.headers['user-agent'] || 'Unknown'
  user.lastLoginIp = req.ip || req.connection?.remoteAddress || null
  await user.save()
  
  const token = signAccessToken(user, sessionId)
  
  // Log Admin Login
  await logAudit({
    adminId: user._id,
    action: 'Admin Login',
    module: 'Auth',
    req
  })

  const payload = buildAuthPayload(user, token)

  return sendSuccess(res, {
    message: 'Admin login successful',
    data: payload,
  })
})

/** GET /auth/me */
export const getMe = asyncHandler(async (req, res) => {
  await populateLabourCategories(req.user)
  return sendSuccess(res, { data: { user: req.user.toSafeObject() } })
})
