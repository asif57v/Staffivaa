import mongoose from 'mongoose'

const campaignAnalyticsSchema = new mongoose.Schema(
  {
    campaignType: { 
      type: String, 
      required: true,
      enum: ['OFFER', 'AD', 'BANNER'],
      index: true
    },
    campaignId: { 
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    date: { 
      type: Date, 
      required: true,
      index: true
    },
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  { timestamps: true }
)

// Compound index for fast upserts and daily queries
campaignAnalyticsSchema.index({ campaignId: 1, date: 1 }, { unique: true })

export const CampaignAnalytics = mongoose.models.CampaignAnalytics || mongoose.model('CampaignAnalytics', campaignAnalyticsSchema)
