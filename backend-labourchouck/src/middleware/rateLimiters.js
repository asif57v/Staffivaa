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

export const globalLimiter = (req, res, next) => next()

export const otpRequestLimiter = (req, res, next) => next()

export const authVerifyLimiter = (req, res, next) => next()

export const uploadLimiter = (req, res, next) => next()

export const bookingLimiter = (req, res, next) => next()

export const paymentLimiter = (req, res, next) => next()

export const withdrawalLimiter = (req, res, next) => next()
