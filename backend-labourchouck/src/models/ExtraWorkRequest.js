import mongoose from 'mongoose'

const extraWorkRequestSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkforceRequest',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    labourId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    workType: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    extraAmount: {
      type: Number,
      required: true,
    },
    extraTime: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'negotiating'],
      default: 'pending',
    },
    revisedAmount: {
      type: Number,
    },
    revisedTime: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
)

export const ExtraWorkRequest = mongoose.model('ExtraWorkRequest', extraWorkRequestSchema)
