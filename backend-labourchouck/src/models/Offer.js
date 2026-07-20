import mongoose from 'mongoose'

const offerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    ctaText: { type: String, trim: true },
    redirectScreen: { type: String, trim: true },
    image: { type: String, required: true },
    priority: { type: Number, default: 0, index: true },
    startDate: { type: Date },
    endDate: { type: Date },
    isActive: { type: Boolean, default: true, index: true },
    targetAudience: { type: String, default: 'ALL' },
    targetLocation: { type: String },
    categories: [{ type: String }],
    discountPercentage: { type: Number, min: 0, max: 100, default: 0 },
    maxUsageLimit: { type: Number, default: 0 },
    currentUsageCount: { type: Number, default: 0 },
  },
  { timestamps: true }
)

// Index for fetching active offers sorted by priority
offerSchema.index({ isActive: 1, priority: -1 })

export const Offer = mongoose.models.Offer || mongoose.model('Offer', offerSchema)
