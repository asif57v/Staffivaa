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
    title: { type: String, trim: true },
    subtitle: { type: String, trim: true },
    price: { type: String, trim: true },
    startDate: { type: Date },
    endDate: { type: Date },
    ctaText: { type: String, trim: true },
    redirectScreen: { type: String, trim: true },
    // Roles that can see this banner. Empty array = visible to everyone.
    targetRoles: {
      type: [String],
      default: [],
      enum: ['individual', 'labour', 'corporate', 'contractor', 'enterprise'],
    },
    // What happens on click. SKILL_BOOKING opens the role's booking/hiring flow
    // with skillIds (+ presets) pre-selected.
    action: {
      type: {
        type: String,
        enum: ['NONE', 'SKILL_BOOKING', 'SCREEN', 'URL'],
        default: 'NONE',
      },
      skillIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LabourCategory' }],
      presets: {
        quantity: { type: Number, min: 1 },
        duration: { type: String, trim: true },
        city: { type: String, trim: true },
        discountPercentage: { type: Number, min: 0, max: 100 },
        bookingType: { type: String, trim: true },
      },
      url: { type: String, trim: true },
    },
    linkedGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'LabourCategoryGroup' },
    isActive: { type: Boolean, default: true, index: true },
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  { timestamps: true }
)

// Index for fetching active banners by position sorted by priority
bannerSchema.index({ isActive: 1, position: 1, priority: -1 })

export const Banner = mongoose.models.Banner || mongoose.model('Banner', bannerSchema)
