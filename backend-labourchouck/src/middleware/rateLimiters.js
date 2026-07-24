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

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
})

export const otpRequestLimiter = (req, res, next) => next()

export const authVerifyLimiter = (req, res, next) => next()

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { success: false, message: 'Upload limit exceeded. You can upload up to 20 files per hour.' },
  standardHeaders: true,
  legacyHeaders: false,
})

export const bookingLimiter = (req, res, next) => next()

export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  keyGenerator,
  message: { success: false, message: 'Too many payment requests. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
})

export const withdrawalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  keyGenerator,
  message: { success: false, message: 'You can only request a withdrawal 3 times per hour.' },
  standardHeaders: true,
  legacyHeaders: false,
})
