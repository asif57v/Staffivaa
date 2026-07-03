import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'NEW_USER',
        'NEW_LABOUR',
        'NEW_VENDOR',
        'NEW_CORPORATE',
        'KYC_SUBMITTED',
        'KYC_APPROVED',
        'KYC_REJECTED',
        'BOOKING_CREATED',
        'BOOKING_UPDATED',
        'BOOKING_CANCELLED',
        'LABOUR_ASSIGNED',
        'LABOUR_CHECK_IN',
        'LABOUR_CHECK_OUT',
        'ATTENDANCE_EXCEPTION',
        'PAYMENT_RECEIVED',
        'SETTLEMENT_PENDING',
        'SETTLEMENT_COMPLETED',
        'REFUND_REQUESTED',
        'SUPPORT_TICKET_CREATED',
        'PRICING_CHANGED',
        'SYSTEM_ALERT',
        'GENERAL',
      ],
      default: 'GENERAL',
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    relatedModel: {
      type: String,
    },
  },
  { timestamps: true }
)

export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema)
