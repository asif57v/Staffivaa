import express from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import {
  getPublicLegalPages,
  getPublicLegalPageBySlug,
  getAdminLegalPages,
  getAdminLegalPageById,
  createLegalPage,
  updateLegalPage,
  toggleLegalPageStatus,
  deleteLegalPage,
} from '../controllers/legalController.js'

const router = express.Router()

// ── Public Routes (Everyone can read published legal pages) ───────────────────
router.get('/public', getPublicLegalPages)
router.get('/public/:slug', getPublicLegalPageBySlug)

// ── Admin Routes (Super Admin Only) ──────────────────────────────────────────
router.get('/admin', protect, restrictTo(USER_ROLES.ADMIN), getAdminLegalPages)
router.get('/admin/:id', protect, restrictTo(USER_ROLES.ADMIN), getAdminLegalPageById)
router.post('/admin', protect, restrictTo(USER_ROLES.ADMIN), createLegalPage)
router.put('/admin/:id', protect, restrictTo(USER_ROLES.ADMIN), updateLegalPage)
router.patch('/admin/:id/status', protect, restrictTo(USER_ROLES.ADMIN), toggleLegalPageStatus)
router.delete('/admin/:id', protect, restrictTo(USER_ROLES.ADMIN), deleteLegalPage)

export default router
