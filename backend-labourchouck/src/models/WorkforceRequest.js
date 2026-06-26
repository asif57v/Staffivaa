import mongoose from 'mongoose'
import {
  REQUEST_SOURCE,
  REQUEST_STATUS,
  SCHEDULE_TYPE,
  BILLING_MODE,
} from '../constants/workforceConstants.js'

const requestLineSchema = new mongoose.Schema(
  {
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabourCategory', required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: true },
)

const workforceRequestSchema = new mongoose.Schema(
  {
    reference: { type: String, unique: true, index: true },
    sourceType: {
      type: String,
      enum: Object.values(REQUEST_SOURCE),
      required: true,
      index: true,
    },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site' },
    scheduleType: {
      type: String,
      enum: Object.values(SCHEDULE_TYPE),
      default: SCHEDULE_TYPE.DAILY,
    },
    startDate: { type: Date, required: true },
    endDate: Date,
    shiftStart: String,
    shiftEnd: String,
    lines: [requestLineSchema],
    locationText: { type: String, trim: true },
    locationLat: { type: Number },
    locationLng: { type: Number },
    notes: { type: String, trim: true, maxlength: 2000 },
    billingMode: {
      type: String,
      enum: Object.values(BILLING_MODE),
      default: BILLING_MODE.POSTPAID,
    },
    labourCharge: { type: Number },
    userPlatformFee: { type: Number, default: 49 },
    labourPlatformFee: { type: Number },
    userGstRate: { type: Number },
    convenienceFee: { type: Number },
    platformFeeType: { type: String },
    platformFeeValue: { type: Number },
    distanceKm: { type: Number },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
    userPaymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
    labourPaymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
    userRazorpayOrderId: String,
    labourRazorpayOrderId: String,
    razorpayOrderId: String, // Legacy, kept for backward compatibility if needed
    razorpayPaymentId: String,
    razorpaySignature: String,
    status: {
      type: String,
      enum: Object.values(REQUEST_STATUS),
      default: REQUEST_STATUS.PENDING_REVIEW,
      index: true,
    },
    bookingType: { type: String, trim: true },
    adminNote: { type: String, trim: true, maxlength: 500 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    labourId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    labourName: { type: String, trim: true },
    labourPhone: { type: String, trim: true },
    acceptedAt: Date,
    expiresAt: Date,
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    declinedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true },
)

workforceRequestSchema.index({ status: 1, expiresAt: 1 })
workforceRequestSchema.index({ status: 1, createdAt: 1 })

export const WorkforceRequest = mongoose.model('WorkforceRequest', workforceRequestSchema)

export function generateRequestReference(prefix = 'WR') {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`
}
