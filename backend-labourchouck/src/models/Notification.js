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
      trim: true,
      default: 'GENERAL',
      index: true,
      // Keep known values documented, but allow any string so new activity
      // types never silently fail Notification.create (and skip FCM).
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
