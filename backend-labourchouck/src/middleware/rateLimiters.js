import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

// Helper function to extract user ID if authenticated, else fallback to IP
const keyGenerator = (req, res) => {
  if (req.user && req.user._id) {
    return req.user._id.toString()
  }
  if (req.user && req.user.id) {
    return req.user.id.toString()
  }
  // Standard IP fallback using ipKeyGenerator to avoid IPv6 validation errors
  return ipKeyGenerator(req, res)
}

const isRateLimitEnabled = () => {
  return process.env.RATE_LIMIT_ENABLED !== 'false'
}

const createLimiter = (options) => {
  const { windowMsEnv, maxEnv, defaultWindowMs, defaultMax, message } = options

  const windowMs = Number(process.env[windowMsEnv]) || defaultWindowMs
  const max = Number(process.env[maxEnv]) || defaultMax

  const limiterInstance = rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    message: {
      success: false,
      message: message || 'Too many requests, please try again later.'
    }
  })

  return (req, res, next) => {
    if (!isRateLimitEnabled()) {
      return next()
    }
    return limiterInstance(req, res, next)
  }
}

export const globalLimiter = createLimiter({
  windowMsEnv: 'RATE_LIMIT_GLOBAL_WINDOW_MS',
  maxEnv: 'RATE_LIMIT_GLOBAL_MAX',
  defaultWindowMs: 15 * 60 * 1000,
  defaultMax: 300,
  message: 'Too many requests, please try again after 15 minutes.'
})

export const otpRequestLimiter = createLimiter({
  windowMsEnv: 'RATE_LIMIT_OTP_WINDOW_MS',
  maxEnv: 'RATE_LIMIT_OTP_MAX',
  defaultWindowMs: 1 * 60 * 1000,
  defaultMax: 5,
  message: 'Too many OTP requests. Please wait a minute before requesting again.'
})

export const authVerifyLimiter = createLimiter({
  windowMsEnv: 'RATE_LIMIT_AUTH_WINDOW_MS',
  maxEnv: 'RATE_LIMIT_AUTH_MAX',
  defaultWindowMs: 15 * 60 * 1000,
  defaultMax: 10,
  message: 'Too many login attempts. Please try again after 15 minutes.'
})

export const uploadLimiter = createLimiter({
  windowMsEnv: 'RATE_LIMIT_UPLOAD_WINDOW_MS',
  maxEnv: 'RATE_LIMIT_UPLOAD_MAX',
  defaultWindowMs: 15 * 60 * 1000,
  defaultMax: 30,
  message: 'Upload limit reached. Please wait before uploading more files.'
})

export const bookingLimiter = createLimiter({
  windowMsEnv: 'RATE_LIMIT_BOOKING_WINDOW_MS',
  maxEnv: 'RATE_LIMIT_BOOKING_MAX',
  defaultWindowMs: 10 * 60 * 1000,
  defaultMax: 20,
  message: 'Booking request limit exceeded. Please wait a few minutes.'
})

export const paymentLimiter = createLimiter({
  windowMsEnv: 'RATE_LIMIT_PAYMENT_WINDOW_MS',
  maxEnv: 'RATE_LIMIT_PAYMENT_MAX',
  defaultWindowMs: 10 * 60 * 1000,
  defaultMax: 15,
  message: 'Payment attempt limit exceeded. Please try again in a few minutes.'
})

export const withdrawalLimiter = createLimiter({
  windowMsEnv: 'RATE_LIMIT_WITHDRAWAL_WINDOW_MS',
  maxEnv: 'RATE_LIMIT_WITHDRAWAL_MAX',
  defaultWindowMs: 10 * 60 * 1000,
  defaultMax: 10,
  message: 'Withdrawal request limit exceeded. Please try again later.'
})
