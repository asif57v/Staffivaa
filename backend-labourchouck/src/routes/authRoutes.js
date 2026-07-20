import { Router } from 'express'
import { validateRequest } from '../middleware/validateRequest.js'
import { protect } from '../middleware/auth.js'
import { otpRequestLimiter, authVerifyLimiter } from '../middleware/rateLimiters.js'
import * as auth from '../controllers/authController.js'
import {
  validatePhoneBody,
  validateRoleRegister,
  validateOtpCode,
  validateOtpChallengeId,
  validateFullNameOptional,
  validateFullNameRequired,
  validateCorporateFields,
  validateContractorBusiness,
  validateAdminLogin,
} from '../validators/authValidators.js'

const router = Router()

router.post(
  '/register/request-otp',
  otpRequestLimiter,
  [validatePhoneBody, validateRoleRegister, validateFullNameOptional],
  validateRequest,
  auth.registerRequestOtp,
)

router.post(
  '/register/verify',
  authVerifyLimiter,
  [
    validatePhoneBody,
    validateRoleRegister,
    validateOtpChallengeId,
    validateOtpCode,
    validateFullNameRequired,
    ...validateCorporateFields,
    validateContractorBusiness,
  ],
  validateRequest,
  auth.registerVerify,
)

router.post('/login/request-otp', otpRequestLimiter, [validatePhoneBody], validateRequest, auth.loginRequestOtp)

router.post('/login/verify', authVerifyLimiter, [validatePhoneBody, validateOtpChallengeId, validateOtpCode], validateRequest, auth.loginVerify)

router.post('/admin/login', authVerifyLimiter, validateAdminLogin, validateRequest, auth.adminLogin)

router.get('/me', protect, auth.getMe)

export default router
