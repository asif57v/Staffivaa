import mongoose from 'mongoose'
import { USER_ROLES } from '../constants/roles.js'
import { ATTENDANCE_STATUS, REQUEST_STATUS } from '../constants/workforceConstants.js'
import { User } from '../models/User.js'
import { Assignment } from '../models/Assignment.js'
import { AttendanceRecord } from '../models/AttendanceRecord.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

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
  if (!record) {
    const request = await WorkforceRequest.findById(assignment.requestId).lean()
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
      billableUnits: 0,
      verifiedBy: 'labour',
    })
  } else {
    record.checkInAt = new Date()
    record.attendanceStatus = ATTENDANCE_STATUS.PRESENT
    record.projectStatus = 'working'
    await record.save()
  }

  assignment.status = 'on_site'
  await assignment.save()

  request.status = 'on_site'
  await WorkforceRequest.findByIdAndUpdate(request._id, { status: 'on_site' })

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

  sendSuccess(res, { data: { record } })
})

export const checkOut = asyncHandler(async (req, res) => {
  const { assignmentId } = req.body
  const assignment = await Assignment.findOne({ _id: assignmentId, labourId: req.user._id })
  if (!assignment) return sendError(res, { message: 'Assignment not found', statusCode: HTTP_STATUS.NOT_FOUND })

  // Find the most recent attendance record for this assignment
  const record = await AttendanceRecord.findOne({ assignmentId }).sort({ shiftDate: -1 })
  if (!record) return sendError(res, { message: 'No check-in found', statusCode: HTTP_STATUS.BAD_REQUEST })

  record.checkOutAt = new Date()
  const checkInTime = record.checkInAt ? record.checkInAt.getTime() : record.shiftDate.getTime()
  const hours = (record.checkOutAt.getTime() - checkInTime) / (1000 * 60 * 60)
  record.totalHours = parseFloat(hours.toFixed(2))
  record.projectStatus = 'completed'
  record.billableUnits = billableUnitsForStatus(record.attendanceStatus)
  await record.save()

  // Mark the assignment as completed so it moves to the history tab for the worker
  assignment.status = 'completed'
  await assignment.save()

  // Note: We do not mark the overall WorkforceRequest as completed here for corporate requests,
  // as other workers might still be assigned.
  const request = await WorkforceRequest.findById(assignment.requestId)
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
    .lean()
  sendSuccess(res, { data: { records } })
})

export const verifyAttendanceAdmin = asyncHandler(async (req, res) => {
  const { status, notes } = req.body
  const record = await AttendanceRecord.findById(req.params.id)
  if (!record) return sendError(res, { message: 'Not found', statusCode: HTTP_STATUS.NOT_FOUND })
  if (status && Object.values(ATTENDANCE_STATUS).includes(status)) {
    record.attendanceStatus = status
    record.billableUnits = billableUnitsForStatus(status)
  }
  if (notes != null) record.notes = String(notes).trim()
  record.verifiedBy = req.user.role === USER_ROLES.CONTRACTOR ? 'vendor_supervisor' : 'admin'
  record.verifiedAt = new Date()
  await record.save()
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
        status: latestRecord.attendanceStatus || latestRecord.projectStatus,
        records: workerRecords
      })
    }
  }

  const projects = Object.values(projectGroups)
  
  sendSuccess(res, { data: { projects } })
})
