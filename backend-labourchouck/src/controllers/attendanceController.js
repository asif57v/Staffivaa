import mongoose from 'mongoose'
import { USER_ROLES } from '../constants/roles.js'
import { ATTENDANCE_STATUS, REQUEST_STATUS } from '../constants/workforceConstants.js'
import { User } from '../models/User.js'
import { Assignment } from '../models/Assignment.js'
import { AttendanceRecord } from '../models/AttendanceRecord.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { AttendanceOTP } from '../models/AttendanceOTP.js'
import { OtpAuditLog } from '../models/OtpAuditLog.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { emitToCorporate, emitToVendor } from '../utils/socket.js'
import { Project } from '../models/Project.js'
import { sendNotificationToUser } from '../services/notificationService.js'
import { logAudit } from '../utils/auditLogger.js'
import { triggerNotification } from '../utils/notificationTrigger.js'

function billableUnitsForStatus(status) {
  if (status === ATTENDANCE_STATUS.PRESENT) return 1
  if (status === ATTENDANCE_STATUS.HALF_DAY) return 0.5
  if (status === ATTENDANCE_STATUS.LATE) return 1
  return 0
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null
  const R = 6371e3 // metres
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

export const checkIn = asyncHandler(async (req, res) => {
  const { assignmentId, lat, lng } = req.body
  const assignment = await Assignment.findOne({ _id: assignmentId, labourId: req.user._id })
  if (!assignment) return sendError(res, { message: 'Assignment not found', statusCode: HTTP_STATUS.NOT_FOUND })

  const request = await WorkforceRequest.findById(assignment.requestId).lean()
  if (!request) return sendError(res, { message: 'Workforce request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  
  if (request.status === 'platform_fee_pending' && request.labourPaymentStatus !== 'paid') {
    return sendError(res, { message: 'Platform fee must be paid before check-in', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  if (request.sourceType === 'corporate') {
    const allowedStatuses = ['advance_paid', 'project_active']
    if (!allowedStatuses.includes(request.status)) {
      return sendError(res, {
        message: `Check-in is blocked. Project status is "${request.status}" (Advance Payment must be completed first).`,
        statusCode: HTTP_STATUS.BAD_REQUEST
      })
    }
  }

  // Distance validation
  if (request.locationLat != null && request.locationLng != null) {
    if (lat == null || lng == null) {
      return sendError(res, { message: 'Location is required to check-in', statusCode: HTTP_STATUS.BAD_REQUEST })
    }
    const distance = calculateDistance(lat, lng, request.locationLat, request.locationLng)
    if (distance != null && distance > 120) {
      return sendError(res, { message: `You are ${Math.round(distance)} meters away from the job site. Move within 120 meters to mark check-in.`, statusCode: HTTP_STATUS.BAD_REQUEST })
    }
  }

  const shiftDate = new Date()
  shiftDate.setHours(0, 0, 0, 0)

  let record = await AttendanceRecord.findOne({ assignmentId, shiftDate })

  if (request.sourceType === 'corporate') {
    if (record && record.status === 'checked_in') {
      return sendError(res, { message: 'Already checked in for today', statusCode: HTTP_STATUS.BAD_REQUEST })
    }
    if (record && record.status === 'completed') {
      return sendError(res, { message: 'Shift already completed for today', statusCode: HTTP_STATUS.BAD_REQUEST })
    }

    if (!record) {
      record = await AttendanceRecord.create({
        assignmentId: assignment._id,
        requestId: assignment.requestId,
        workerId: req.user._id,
        projectId: request.projectId || request._id,
        siteId: request.siteId,
        vendorId: assignment.vendorId,
        corporateId: request.clientId,
        shiftDate,
        attendanceStatus: ATTENDANCE_STATUS.ABSENT,
        projectStatus: 'assigned',
        status: 'otp_pending',
        otpVerified: false,
        billableUnits: 0,
        verifiedBy: 'labour',
      })
    } else {
      record.status = 'otp_pending'
      record.otpVerified = false
      await record.save()
    }

    // Invalidate any previous OTPs for this attendance
    await AttendanceOTP.deleteMany({ attendanceId: record._id })

    // Generate random 6 Digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

    await AttendanceOTP.create({
      attendanceId: record._id,
      labourId: req.user._id,
      projectId: request.projectId || request._id,
      corporateId: request.clientId,
      vendorId: assignment.vendorId,
      otp,
      expiresAt,
      isVerified: false
    })

    // Send Push Notification to Corporate Client
    const workerName = req.user.fullName || 'A worker'
    let projectName = 'your project'
    if (request.projectId) {
      const projDoc = await Project.findById(request.projectId).lean()
      if (projDoc) projectName = projDoc.name || 'your project'
    }
    sendNotificationToUser(
      request.clientId.toString(),
      'Check-In Verification Required',
      `${workerName} has arrived at site for "${projectName}". Use OTP ${otp} to verify check-in.`,
      { url: `/corporate/attendance/${request.projectId || request._id}` }
    ).catch(err => console.error('FCM check-in initiation notify error:', err))

    // Emit Socket Event: attendance:otpGenerated
    const payload = {
      attendanceId: record._id.toString(),
      labourId: req.user._id.toString(),
      otp,
      expiresAt: expiresAt.toISOString()
    }

    import('../utils/socket.js').then(({ getIO }) => {
      try {
        const io = getIO()
        // Emit to corporate client personal room
        io.to(`corporate_${request.clientId.toString()}`).emit('attendance:otpGenerated', payload)
        // Also emit to general request room
        io.to(`request_${request._id.toString()}`).emit('attendance:otpGenerated', payload)
      } catch (err) {
        console.error('Socket emit error:', err)
      }
    })

    // Setup expiration emit timer
    setTimeout(async () => {
      try {
        const otpRecord = await AttendanceOTP.findOne({ attendanceId: record._id, otp, isVerified: false })
        if (otpRecord && new Date() > otpRecord.expiresAt) {
          const { getIO } = await import('../utils/socket.js')
          const io = getIO()
          io.to(`corporate_${request.clientId.toString()}`).emit('attendance:otpExpired', {
            attendanceId: record._id.toString(),
            labourId: req.user._id.toString()
          })
          io.to(`request_${request._id.toString()}`).emit('attendance:otpExpired', {
            attendanceId: record._id.toString(),
            labourId: req.user._id.toString()
          })
        }
      } catch (err) {
        console.error('OTP Expiration timer error:', err)
      }
    }, 5 * 60 * 1000 + 1000)

    return sendSuccess(res, {
      message: 'OTP verification pending',
      data: { record, requiresOtp: true, expiresAt }
    })
  }

  // Non-corporate (individual) normal flow
  if (!record) {
    record = await AttendanceRecord.create({
      assignmentId: assignment._id,
      requestId: assignment.requestId,
      workerId: req.user._id,
      projectId: request?.projectId,
      siteId: request?.siteId,
      vendorId: assignment.vendorId,
      corporateId: request?.clientId,
      shiftDate,
      checkInAt: new Date(),
      attendanceStatus: ATTENDANCE_STATUS.PRESENT,
      projectStatus: 'working',
      status: 'checked_in',
      otpVerified: false,
      workingHoursStartedAt: new Date(),
      billableUnits: 0,
      verifiedBy: 'labour',
    })
  } else {
    record.checkInAt = new Date()
    record.attendanceStatus = ATTENDANCE_STATUS.PRESENT
    record.projectStatus = 'working'
    record.status = 'checked_in'
    record.workingHoursStartedAt = new Date()
    await record.save()
  }

  assignment.status = 'on_site'
  await assignment.save()

  await WorkforceRequest.findByIdAndUpdate(request._id, { status: 'on_site' })

  import('../utils/socket.js').then(({ getIO }) => {
    try {
      const io = getIO()
      io.to(`request_${request._id.toString()}`).emit('request_status_update', {
        requestStatus: 'on_site',
      })
    } catch (err) {
      console.error('Socket emit error:', err)
    }
  })

  sendSuccess(res, { data: { record } })
})

export const startWork = asyncHandler(async (req, res) => {
  const { assignmentId } = req.body
  const assignment = await Assignment.findOne({ _id: assignmentId, labourId: req.user._id })
  if (!assignment) return sendError(res, { message: 'Assignment not found', statusCode: HTTP_STATUS.NOT_FOUND })

  const request = await WorkforceRequest.findById(assignment.requestId)
  if (!request) return sendError(res, { message: 'Workforce request not found', statusCode: HTTP_STATUS.NOT_FOUND })

  if (request.status === 'platform_fee_pending' && request.labourPaymentStatus !== 'paid') {
    return sendError(res, { message: 'Platform fee must be paid before starting work', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  assignment.status = 'in_progress'
  await assignment.save()

  request.status = 'in_progress'
  await request.save()

  import('../utils/socket.js').then(({ getIO }) => {
    try {
      const io = getIO()
      io.to(`request_${request._id.toString()}`).emit('request_status_update', {
        requestStatus: request.status,
      })
      if (request.sourceType === 'corporate') {
        if (request.clientId) emitToCorporate(request.clientId.toString(), 'work_progress_update', { requestId: request._id.toString() });
        if (assignment.vendorId) emitToVendor(assignment.vendorId.toString(), 'work_progress_update', { requestId: request._id.toString() });
      }
    } catch (err) {
      console.error('Socket emit error:', err)
    }
  })

  sendSuccess(res, { data: { assignment } })
})

export const checkOut = asyncHandler(async (req, res) => {
  const { assignmentId } = req.body
  const assignment = await Assignment.findOne({ _id: assignmentId, labourId: req.user._id })
  if (!assignment) return sendError(res, { message: 'Assignment not found', statusCode: HTTP_STATUS.NOT_FOUND })

  const record = await AttendanceRecord.findOne({ assignmentId }).sort({ shiftDate: -1 })
  if (!record) return sendError(res, { message: 'No check-in found', statusCode: HTTP_STATUS.BAD_REQUEST })

  const request = await WorkforceRequest.findById(assignment.requestId)
  if (request && request.status === 'platform_fee_pending' && request.labourPaymentStatus !== 'paid') {
    return sendError(res, { message: 'Platform fee must be paid before checking out', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  record.checkOutAt = new Date()
  const checkInTime = record.checkInAt ? record.checkInAt.getTime() : record.shiftDate.getTime()
  const hours = (record.checkOutAt.getTime() - checkInTime) / (1000 * 60 * 60)
  record.totalHours = parseFloat(hours.toFixed(2))
  record.projectStatus = 'completed'
  record.status = 'completed'
  record.workingHoursEndedAt = new Date()
  
  const workingStartedTime = record.workingHoursStartedAt ? record.workingHoursStartedAt.getTime() : checkInTime
  const diffMinutes = Math.max(0, Math.floor((record.workingHoursEndedAt.getTime() - workingStartedTime) / 60000))
  record.totalWorkingMinutes = diffMinutes

  record.billableUnits = billableUnitsForStatus(record.attendanceStatus)
  await record.save()

  // Mark the assignment as completed ONLY if it's an individual (1-day) project
  if (request && request.sourceType === 'individual') {
    assignment.status = 'completed'
    await assignment.save()
  }

  // Emit attendance:checkOut socket event
  import('../utils/socket.js').then(({ getIO }) => {
    try {
      const io = getIO()
      const payload = {
        attendanceId: record._id.toString(),
        labourId: req.user._id.toString(),
        status: 'completed',
        checkOutAt: record.checkOutAt.toISOString(),
        workingHoursEndedAt: record.workingHoursEndedAt.toISOString(),
        totalWorkingMinutes: record.totalWorkingMinutes
      }
      if (record.corporateId) io.to(`corporate_${record.corporateId.toString()}`).emit('attendance:checkOut', payload)
      if (record.vendorId) io.to(`vendor-${record.vendorId.toString()}`).emit('attendance:checkOut', payload)
      io.to(`request_${record.requestId.toString()}`).emit('attendance:checkOut', payload)
    } catch (err) {
      console.error('Socket emit error:', err)
    }
  })

  // Note: We do not mark the overall WorkforceRequest as completed here for corporate requests,
  // as other workers might still be assigned.
  if (request && request.sourceType === 'individual') {
    request.status = 'completed'
    await request.save()
    
    import('../utils/socket.js').then(({ getIO }) => {
      try {
        const io = getIO()
        io.to(`request_${request._id.toString()}`).emit('request_status_update', {
          requestStatus: request.status,
        })
      } catch (err) {
        console.error('Socket emit error:', err)
      }
    })
  } else if (request && request.sourceType === 'corporate') {
    if (request.clientId) emitToCorporate(request.clientId.toString(), 'work_completed', { requestId: request._id.toString(), assignmentId: assignment._id.toString() });
    if (assignment.vendorId) emitToVendor(assignment.vendorId.toString(), 'work_completed', { requestId: request._id.toString(), assignmentId: assignment._id.toString() });
  }

  sendSuccess(res, { data: { record } })
})

export const listAttendance = asyncHandler(async (req, res) => {
  const filter = {}
  if (req.user.role === USER_ROLES.LABOUR) {
    filter.workerId = req.user._id
  } else if (req.user.role === USER_ROLES.CORPORATE) {
    const requestIds = await WorkforceRequest.find({ clientId: req.user._id }).distinct('_id')
    filter.requestId = { $in: requestIds }
  } else if (req.user.role === USER_ROLES.CONTRACTOR) {
    const crewIds = await User.find({ vendorId: req.user._id }).distinct('_id')
    filter.workerId = { $in: crewIds }
  } else if (req.user.role === USER_ROLES.ADMIN) {
    // all
  } else {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  if (req.query.requestId && mongoose.Types.ObjectId.isValid(req.query.requestId)) {
    filter.requestId = req.query.requestId
  }
  if (req.query.projectId && mongoose.Types.ObjectId.isValid(req.query.projectId)) {
    filter.projectId = req.query.projectId
  }
  if (req.query.date) {
    const d = new Date(req.query.date)
    d.setHours(0, 0, 0, 0)
    const end = new Date(d)
    end.setDate(end.getDate() + 1)
    filter.shiftDate = { $gte: d, $lt: end }
  }

  const records = await AttendanceRecord.find(filter)
    .sort({ shiftDate: -1 })
    .limit(200)
    .populate('workerId', 'fullName phone')
    .populate('projectId', 'name')
    .populate('requestId', 'sourceType')
    .lean()

  const validRecords = records.filter(r => r.requestId?.sourceType !== 'individual')

  sendSuccess(res, { data: { records: validRecords } })
})

export const verifyAttendanceAdmin = asyncHandler(async (req, res) => {
  const { status, notes } = req.body
  const record = await AttendanceRecord.findById(req.params.id)
  if (!record) return sendError(res, { message: 'Not found', statusCode: HTTP_STATUS.NOT_FOUND })
  
  const previousStatus = record.attendanceStatus

  if (status && Object.values(ATTENDANCE_STATUS).includes(status)) {
    record.attendanceStatus = status
    record.billableUnits = billableUnitsForStatus(status)
  }
  if (notes != null) record.notes = String(notes).trim()
  record.verifiedBy = req.user.role === USER_ROLES.CONTRACTOR ? 'vendor_supervisor' : 'admin'
  record.verifiedAt = new Date()
  await record.save()

  // Log admin audit trail
  await logAudit({
    adminId: req.user._id,
    action: 'Verify Attendance',
    previousValue: { attendanceStatus: previousStatus },
    newValue: { attendanceStatus: record.attendanceStatus, notes: record.notes },
    module: 'Operations',
    req
  })

  // Trigger Notification to labour
  await triggerNotification({
    userId: record.workerId,
    title: 'Attendance Verified',
    body: `Your attendance for ${new Date(record.shiftDate).toLocaleDateString()} has been verified as ${record.attendanceStatus}.`,
    type: 'ATTENDANCE_UPDATED',
    relatedId: record._id,
    relatedModel: 'AttendanceRecord'
  })

  // Broadcast to other rooms via Socket
  const io = getIO()
  if (io) {
    io.emit('attendance:updated', { recordId: record._id })
  }

  sendSuccess(res, { data: { record } })
})

export const markAttendanceVendor = asyncHandler(async (req, res) => {
  const { assignmentId, shiftDate, status, notes } = req.body
  const assignment = await Assignment.findById(assignmentId).populate('labourId')
  if (!assignment || String(assignment.vendorId) !== String(req.user._id)) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }
  const d = shiftDate ? new Date(shiftDate) : new Date()
  d.setHours(0, 0, 0, 0)
  const attStatus = Object.values(ATTENDANCE_STATUS).includes(status) ? status : ATTENDANCE_STATUS.PRESENT

  let record = await AttendanceRecord.findOne({ assignmentId, shiftDate: d })
  if (!record) {
    const request = await WorkforceRequest.findById(assignment.requestId).lean()
    record = await AttendanceRecord.create({
      assignmentId,
      requestId: assignment.requestId,
      workerId: assignment.labourId,
      projectId: request?.projectId,
      siteId: request?.siteId,
      vendorId: assignment.vendorId,
      corporateId: request?.clientId,
      shiftDate: d,
      attendanceStatus: attStatus,
      projectStatus: 'completed',
      billableUnits: billableUnitsForStatus(attStatus),
      verifiedBy: 'vendor_supervisor',
      verifiedAt: new Date(),
      notes,
    })
  } else {
    record.attendanceStatus = attStatus
    record.billableUnits = billableUnitsForStatus(attStatus)
    record.verifiedBy = 'vendor_supervisor'
    record.verifiedAt = new Date()
    if (notes != null) record.notes = notes
    await record.save()
  }
  sendSuccess(res, { data: { record } })
})

export const monitorAttendance = asyncHandler(async (req, res) => {
  const { startDate, endDate, date, projectId, corporateId, vendorId } = req.query
  const userRole = req.user.role

  // Determine Assignment match criteria
  let assignmentQuery = { status: { $in: ['accepted', 'on_site', 'completed'] } }
  
  if (userRole === USER_ROLES.CONTRACTOR) {
    assignmentQuery.vendorId = req.user._id
  } else if (userRole === USER_ROLES.CORPORATE) {
    const requests = await WorkforceRequest.find({ clientId: req.user._id }).distinct('_id')
    assignmentQuery.requestId = { $in: requests }
  } else if (userRole === USER_ROLES.ADMIN) {
    if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
      assignmentQuery.vendorId = vendorId
    }
    if (corporateId && mongoose.Types.ObjectId.isValid(corporateId)) {
      const requests = await WorkforceRequest.find({ clientId: corporateId }).distinct('_id')
      assignmentQuery.requestId = { $in: requests }
    }
  } else {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const assignments = await Assignment.find(assignmentQuery)
    .populate('labourId', 'fullName phone')
    .populate('categoryId', 'name')
    .lean()

  const assignmentIds = assignments.map(a => a._id)
  const requestIds = [...new Set(assignments.map(a => String(a.requestId)))]

  const requests = await WorkforceRequest.find({ _id: { $in: requestIds } })
    .populate('clientId', 'corporateProfile.companyName fullName')
    .populate('projectId', 'name')
    .lean()

  const requestMap = {}
  requests.forEach(r => requestMap[String(r._id)] = r)

  let recordQuery = { assignmentId: { $in: assignmentIds } }
  
  let targetStart, targetEnd
  if (startDate && endDate) {
    targetStart = new Date(startDate)
    targetStart.setHours(0,0,0,0)
    targetEnd = new Date(endDate)
    targetEnd.setHours(23,59,59,999)
  } else {
    const d = date ? new Date(date) : new Date()
    targetStart = new Date(d)
    targetStart.setHours(0,0,0,0)
    targetEnd = new Date(d)
    targetEnd.setHours(23,59,59,999)
  }
  recordQuery.shiftDate = { $gte: targetStart, $lte: targetEnd }

  const records = await AttendanceRecord.find(recordQuery).sort({ shiftDate: -1 }).lean()

  for (const r of records) {
    if (r.status === 'otp_pending') {
      const otpRecord = await AttendanceOTP.findOne({ attendanceId: r._id, isVerified: false })
      if (otpRecord) {
        r.otp = otpRecord.otp
        r.otpExpiresAt = otpRecord.expiresAt
      }
    }
  }

  const projectGroups = {}

  for (const assignment of assignments) {
    const reqData = requestMap[String(assignment.requestId)]
    if (!reqData) continue
    
    if (projectId && String(reqData.projectId?._id) !== String(projectId) && String(reqData._id) !== String(projectId)) {
      continue
    }

    const projIdStr = reqData.projectId ? String(reqData.projectId._id) : String(reqData._id)
    const projName = reqData.projectId?.name || 'Supply Job'
    const corporateName = reqData.clientId?.corporateProfile?.companyName || reqData.clientId?.fullName || 'Corporate Client'
    const projectLocation = reqData.locationText || 'Location TBD'
    const status = reqData.status

    if (!projectGroups[projIdStr]) {
      let requiredWorkers = 0
      reqData.lines?.forEach(l => requiredWorkers += l.quantity || 1)

      projectGroups[projIdStr] = {
        projectId: projIdStr,
        projectName: projName,
        corporateName,
        projectLocation,
        projectStatus: status,
        startDate: reqData.startDate,
        endDate: reqData.endDate,
        requiredWorkers,
        assignedWorkers: 0,
        present: 0,
        absent: 0,
        late: 0,
        weeklyOff: 0,
        workingNow: 0,
        completedToday: 0,
        workers: []
      }
    }

    const pg = projectGroups[projIdStr]
    
    // Exclude assignment if it officially ended before targetStart
    if (reqData.endDate && new Date(reqData.endDate).getTime() < targetStart.getTime()) {
      continue
    }
    
    pg.assignedWorkers++

    const workerRecords = records.filter(r => String(r.assignmentId) === String(assignment._id))
    
    if (workerRecords.length === 0) {
      pg.absent++
      pg.workers.push({
        assignmentId: assignment._id,
        workerId: assignment.labourId?._id,
        workerName: assignment.labourId?.fullName || 'Unknown Worker',
        role: assignment.categoryId?.name || 'Worker',
        status: 'Absent',
        assignedAt: assignment.acceptedAt || assignment.createdAt,
        records: []
      })
    } else {
      const latestRecord = workerRecords[0] // Sorted descending
      if (latestRecord.projectStatus === 'working') pg.workingNow++
      if (latestRecord.projectStatus === 'completed') pg.completedToday++
      
      if (latestRecord.attendanceStatus === 'Late') pg.late++
      else if (latestRecord.attendanceStatus === 'Weekly Off') pg.weeklyOff++
      else if (latestRecord.attendanceStatus === 'Present' || latestRecord.attendanceStatus === 'Half Day') pg.present++
      else pg.absent++ // fallback if unknown but recorded

      pg.workers.push({
        assignmentId: assignment._id,
        workerId: assignment.labourId?._id,
        workerName: assignment.labourId?.fullName || 'Unknown Worker',
        role: assignment.categoryId?.name || 'Worker',
        status: latestRecord.status || latestRecord.attendanceStatus || latestRecord.projectStatus,
        otp: latestRecord.otp,
        otpExpiresAt: latestRecord.otpExpiresAt,
        assignedAt: assignment.acceptedAt || assignment.createdAt,
        records: workerRecords
      })
    }
  }

  const projects = Object.values(projectGroups)
  
  sendSuccess(res, { data: { projects } })
})

export const verifyCheckInOtp = asyncHandler(async (req, res) => {
  const { attendanceId, otp } = req.body
  const ipAddress = req.ip || req.connection.remoteAddress
  const userAgent = req.headers['user-agent']

  if (!attendanceId || !otp) {
    return sendError(res, { message: 'Attendance ID and OTP are required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const record = await AttendanceRecord.findById(attendanceId)
  if (!record) {
    return sendError(res, { message: 'Attendance record not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const request = await WorkforceRequest.findById(record.requestId).lean()
  if (request && request.sourceType === 'corporate') {
    const allowedStatuses = ['advance_paid', 'project_active']
    if (!allowedStatuses.includes(request.status)) {
      return sendError(res, {
        message: `OTP verification is blocked. Project status is "${request.status}" (Advance Payment must be completed first).`,
        statusCode: HTTP_STATUS.BAD_REQUEST
      })
    }
  }

  if (record.status === 'checked_in') {
    return sendError(res, { message: 'Attendance already checked in', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Find valid OTP record
  const otpRecord = await AttendanceOTP.findOne({ attendanceId, labourId: req.user._id })
  if (!otpRecord) {
    await OtpAuditLog.create({
      userId: req.user._id,
      attendanceId,
      otpAttempted: otp,
      result: 'not_found',
      ipAddress,
      userAgent
    })
    return sendError(res, { message: 'OTP verification request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (new Date() > otpRecord.expiresAt) {
    await OtpAuditLog.create({
      userId: req.user._id,
      attendanceId,
      otpAttempted: otp,
      result: 'expired',
      ipAddress,
      userAgent
    })
    return sendError(res, { message: 'OTP Expired. Please request a new OTP.', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  if (otpRecord.otp !== String(otp).trim()) {
    await OtpAuditLog.create({
      userId: req.user._id,
      attendanceId,
      otpAttempted: otp,
      result: 'incorrect_otp',
      ipAddress,
      userAgent
    })
    return sendError(res, { message: 'Incorrect OTP. Please try again.', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // OTP is correct! Update OTP Record
  otpRecord.isVerified = true
  otpRecord.verifiedAt = new Date()
  await otpRecord.save()

  // Update Attendance Record
  record.status = 'checked_in'
  record.attendanceStatus = ATTENDANCE_STATUS.PRESENT
  record.projectStatus = 'working'
  record.checkInAt = new Date()
  record.workingHoursStartedAt = new Date()
  record.otpVerified = true
  await record.save()

  // Clean up OTPs for this attendance
  await AttendanceOTP.deleteMany({ attendanceId })

  // Log successful attempt
  await OtpAuditLog.create({
    userId: req.user._id,
    attendanceId,
    otpAttempted: otp,
    result: 'success',
    ipAddress,
    userAgent
  })

  // Update Assignment Status
  const assignment = await Assignment.findById(record.assignmentId)
  if (assignment) {
    assignment.status = 'on_site'
    await assignment.save()
  }

  // Update Request Status
  const requestDoc = await WorkforceRequest.findById(record.requestId)
  if (requestDoc) {
    requestDoc.status = 'on_site'
    await requestDoc.save()
  }

  // Send Push Notification to Worker and Vendor
  let projectName = 'your project'
  if (requestDoc && requestDoc.projectId) {
    const projDoc = await Project.findById(requestDoc.projectId).lean()
    if (projDoc) projectName = projDoc.name || 'your project'
  }

  sendNotificationToUser(
    record.workerId.toString(),
    'Check-In Verified',
    `Your check-in for "${projectName}" has been verified. Have a safe shift!`,
    { url: '/app' }
  ).catch(err => console.error('FCM check-in verification notify error (worker):', err))

  if (record.vendorId) {
    const workerName = req.user.fullName || 'A worker'
    sendNotificationToUser(
      record.vendorId.toString(),
      'Worker Checked In',
      `${workerName} has checked in successfully at "${projectName}".`,
      { url: '/vendor/attendance' }
    ).catch(err => console.error('FCM check-in verification notify error (vendor):', err))
  }

  // Emit socket events to Corporate, Vendor, Labour and Project Room
  import('../utils/socket.js').then(({ getIO }) => {
    try {
      const io = getIO()
      const payload = {
        attendanceId: record._id.toString(),
        labourId: req.user._id.toString(),
        status: 'checked_in',
        checkedInAt: record.checkInAt.toISOString(),
        workingHoursStartedAt: record.workingHoursStartedAt.toISOString()
      }

      // To specific users/rooms
      if (record.corporateId) io.to(`corporate_${record.corporateId.toString()}`).emit('attendance:checkedIn', payload)
      if (record.vendorId) io.to(`vendor-${record.vendorId.toString()}`).emit('attendance:checkedIn', payload)
      io.to(`labour_${req.user._id.toString()}`).emit('attendance:checkedIn', payload)
      
      // Project room
      io.to(`request_${record.requestId.toString()}`).emit('attendance:checkedIn', payload)
      io.to(`request_${record.requestId.toString()}`).emit('request_status_update', {
        requestStatus: 'on_site',
      })
    } catch (err) {
      console.error('Socket emit error:', err)
    }
  })

  sendSuccess(res, { message: 'Successfully Checked In', data: { record } })
})

export const regenerateCheckInOtp = asyncHandler(async (req, res) => {
  const { attendanceId } = req.body
  if (!attendanceId) {
    return sendError(res, { message: 'Attendance ID is required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const record = await AttendanceRecord.findById(attendanceId)
  if (!record) {
    return sendError(res, { message: 'Attendance record not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Only the corporate client assigned to this project request can regenerate the OTP
  if (req.user.role !== USER_ROLES.CORPORATE || String(record.corporateId) !== String(req.user._id)) {
    return sendError(res, { message: 'Forbidden: Only the corporate client can regenerate the OTP', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  // Invalidate previous OTPs
  await AttendanceOTP.deleteMany({ attendanceId })

  // Generate new OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

  await AttendanceOTP.create({
    attendanceId: record._id,
    labourId: record.workerId,
    projectId: record.projectId || record.requestId,
    corporateId: record.corporateId,
    vendorId: record.vendorId,
    otp,
    expiresAt,
    isVerified: false
  })

  // Send Push Notification to Worker
  sendNotificationToUser(
    record.workerId.toString(),
    'New Check-In OTP Generated',
    'Your supervisor has generated a new check-in OTP. Please request it from them to check in.',
    { url: '/app' }
  ).catch(err => console.error('FCM check-in OTP regeneration notify error:', err))

  const payload = {
    attendanceId: record._id.toString(),
    labourId: record.workerId.toString(),
    otp,
    expiresAt: expiresAt.toISOString()
  }

  import('../utils/socket.js').then(({ getIO }) => {
    try {
      const io = getIO()
      // Emit to corporate client
      io.to(`corporate_${record.corporateId.toString()}`).emit('attendance:otpGenerated', payload)
      // Emit to request room
      io.to(`request_${record.requestId.toString()}`).emit('attendance:otpGenerated', payload)
      // Notify the labour client
      io.to(`labour_${record.workerId.toString()}`).emit('attendance:otpGenerated', {
        attendanceId: record._id.toString(),
        expiresAt: expiresAt.toISOString(),
        message: 'New OTP Generated. Please ask supervisor for updated OTP.'
      })
    } catch (err) {
      console.error('Socket emit error:', err)
    }
  })

  // Set setTimeout to emit attendance:otpExpired if still pending after 5 minutes
  setTimeout(async () => {
    try {
      const otpRecord = await AttendanceOTP.findOne({ attendanceId: record._id, otp, isVerified: false })
      if (otpRecord && new Date() > otpRecord.expiresAt) {
        const { getIO } = await import('../utils/socket.js')
        const io = getIO()
        io.to(`corporate_${record.corporateId.toString()}`).emit('attendance:otpExpired', {
          attendanceId: record._id.toString(),
          labourId: record.workerId.toString()
        })
        io.to(`request_${record.requestId.toString()}`).emit('attendance:otpExpired', {
          attendanceId: record._id.toString(),
          labourId: record.workerId.toString()
        })
      }
    } catch (err) {
      console.error('OTP Expiration timer error:', err)
    }
  }, 5 * 60 * 1000 + 1000)

  sendSuccess(res, { message: 'OTP regenerated successfully', data: { expiresAt } })
})
