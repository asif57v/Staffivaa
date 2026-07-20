import { Router } from 'express'
import { protect } from '../middleware/auth.js'
import {
  handleMulterError,
  uploadDocumentMulter,
  uploadMediaMulter,
} from '../middleware/uploadMiddleware.js'
import * as upload from '../controllers/uploadController.js'
import { uploadLimiter } from '../middleware/rateLimiters.js'

const router = Router()

router.use(protect)

router.get('/config', upload.getUploadConfig)

router.post(
  '/media',
  uploadLimiter,
  (req, res, next) => {
    uploadMediaMulter(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next)
      next()
    })
  },
  upload.uploadMedia,
)

router.post(
  '/document',
  uploadLimiter,
  (req, res, next) => {
    uploadDocumentMulter(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next)
      next()
    })
  },
  upload.uploadDocument,
)

export default router
