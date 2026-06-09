import { ExtraWorkRequest } from '../models/ExtraWorkRequest.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { getIO } from '../utils/socket.js'

export const createExtraWork = asyncHandler(async (req, res) => {
  const { id } = req.params // bookingId
  const { workType, description, extraAmount, extraTime } = req.body

  const booking = await WorkforceRequest.findById(id)
  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  
  if (String(booking.clientId) !== String(req.user._id)) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }
  
  if (!booking.labourId) {
    return sendError(res, { message: 'No labour assigned yet', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const extraWork = await ExtraWorkRequest.create({
    bookingId: booking._id,
    userId: req.user._id,
    labourId: booking.labourId,
    workType,
    description,
    extraAmount,
    extraTime,
    status: 'pending'
  })

  // Emit event
  const io = getIO()
  if (io) {
    io.to(`request_${booking._id}`).emit('extra_work_requested', extraWork)
    io.to(`request_${booking._id}`).emit('extra_work_updated')
  }

  sendSuccess(res, { data: { extraWork }, statusCode: HTTP_STATUS.CREATED })
})

export const getExtraWorkForBooking = asyncHandler(async (req, res) => {
  const { id } = req.params
  const extraWorks = await ExtraWorkRequest.find({ bookingId: id }).sort({ createdAt: -1 })
  sendSuccess(res, { data: { extraWorks } })
})

export const updateExtraWorkStatus = asyncHandler(async (req, res) => {
  const { id } = req.params // extra work request id
  const { status, revisedAmount, revisedTime } = req.body

  const extraWork = await ExtraWorkRequest.findById(id)
  if (!extraWork) {
    return sendError(res, { message: 'Extra work not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Authorize based on status change
  // Labourer can accept, reject, negotiate
  // User can accept, reject a negotiation
  
  extraWork.status = status
  if (status === 'negotiating') {
    extraWork.revisedAmount = revisedAmount
    extraWork.revisedTime = revisedTime
  }

  await extraWork.save()

  const io = getIO()
  if (io) {
    io.to(`request_${extraWork.bookingId}`).emit('extra_work_updated', extraWork)
  }

  sendSuccess(res, { data: { extraWork } })
})
