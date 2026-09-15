import mongoose from 'mongoose'

const paymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    paymentId: {
      type: String,
      index: true,
    },
    gatewayOrderId: {
      type: String,
      index: true,
      sparse: true,
    },
    gatewayPaymentId: {
      type: String,
      index: true,
      sparse: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['CREATED', 'PENDING', 'SUCCESS', 'FAILED', 'EXPIRED'],
      default: 'CREATED',
      index: true,
    },
    paymentMethod: {
      type: String,
      default: 'razorpay',
    },
    idempotencyKey: {
      type: String,
      index: true,
      sparse: true,
    },
    webhookReceived: {
      type: Boolean,
      default: false,
    },
    webhookStatus: {
      type: String,
      enum: ['NONE', 'SUCCESS', 'FAILED', 'IGNORED'],
      default: 'NONE',
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    lastCheckedAt: {
      type: Date,
    },
    failureReason: {
      type: String,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    purpose: {
      type: String,
      enum: [
        'WALLET_TOPUP',
        'ENTERPRISE_WALLET_RECHARGE',
        'WORKFORCE_REQUEST_PLATFORM_FEE',
        'COMMISSION',
        'OTHER',
      ],
      required: true,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

paymentSchema.index({ userId: 1, createdAt: -1 })
paymentSchema.index({ status: 1, createdAt: -1 })
paymentSchema.index({ gatewayOrderId: 1, status: 1 })

export const Payment = mongoose.model('Payment', paymentSchema)
