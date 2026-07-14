import mongoose from 'mongoose'

const bannerSchema = new mongoose.Schema(
  {
    image: { type: String, required: true },
    position: { 
      type: String, 
      required: true,
      enum: ['TOP', 'MIDDLE', 'BOTTOM', 'POPUP', 'CAROUSEL'],
      index: true
    },
    priority: { type: Number, default: 0, index: true },
    startDate: { type: Date },
    endDate: { type: Date },
    redirectScreen: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
)

// Index for fetching active banners by position sorted by priority
bannerSchema.index({ isActive: 1, position: 1, priority: -1 })

export const Banner = mongoose.models.Banner || mongoose.model('Banner', bannerSchema)
