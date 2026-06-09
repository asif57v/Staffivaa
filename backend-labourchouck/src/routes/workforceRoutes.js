import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES, APP_ROLES } from '../constants/roles.js'
import {
  createRequest,
  listMyRequests,
  getRequest,
} from '../controllers/requestController.js'
import {
  listLabourAssignments,
  respondToAssignment,
} from '../controllers/allocationController.js'
import {
  checkIn,
  checkOut,
  listAttendance,
  markAttendanceVendor,
  monitorAttendance
} from '../controllers/attendanceController.js'
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
} from '../controllers/paymentController.js'
import {
  createExtraWork,
  getExtraWorkForBooking,
  updateExtraWorkStatus,
} from '../controllers/extraWorkController.js'

const router = Router()

router.use(protect)

router.post('/requests', restrictTo(USER_ROLES.INDIVIDUAL, USER_ROLES.CORPORATE), createRequest)
router.get('/requests', restrictTo(...APP_ROLES), listMyRequests)
router.get('/requests/:id', restrictTo(...APP_ROLES, USER_ROLES.ADMIN), getRequest)

router.post('/requests/:id/payment/order', restrictTo(USER_ROLES.INDIVIDUAL), createRazorpayOrder)
router.post('/requests/:id/payment/verify', restrictTo(USER_ROLES.INDIVIDUAL), verifyRazorpayPayment)

router.post('/requests/:id/extra-work', restrictTo(USER_ROLES.INDIVIDUAL), createExtraWork)
router.get('/requests/:id/extra-work', restrictTo(...APP_ROLES), getExtraWorkForBooking)
router.patch('/extra-work/:id/status', restrictTo(...APP_ROLES), updateExtraWorkStatus)

router.get('/assignments', restrictTo(USER_ROLES.LABOUR), listLabourAssignments)
router.patch('/assignments/:id/respond', restrictTo(USER_ROLES.LABOUR), respondToAssignment)

router.post('/attendance/check-in', restrictTo(USER_ROLES.LABOUR), checkIn)
router.post('/attendance/check-out', restrictTo(USER_ROLES.LABOUR), checkOut)
router.get('/attendance', restrictTo(...APP_ROLES, USER_ROLES.ADMIN), listAttendance)
router.get('/attendance/monitor', restrictTo(USER_ROLES.CONTRACTOR, USER_ROLES.CORPORATE, USER_ROLES.ADMIN), monitorAttendance)
router.post('/attendance/vendor-mark', restrictTo(USER_ROLES.CONTRACTOR), markAttendanceVendor)

export default router
