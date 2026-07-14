import mongoose from 'mongoose'

const sponsoredAdSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    logo: { type: String },
    banner: { type: String, required: true },
    ctaText: { type: String, trim: true },
    redirectUrl: { type: String, trim: true },
    startDate: { type: Date },
    endDate: { type: Date },
    priority: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
    dailyBudget: { type: Number, default: 0 },
    totalBudget: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  { timestamps: true }
)

// Index for fetching active ads sorted by priority
sponsoredAdSchema.index({ isActive: 1, priority: -1 })

export const SponsoredAd = mongoose.models.SponsoredAd || mongoose.model('SponsoredAd', sponsoredAdSchema)
