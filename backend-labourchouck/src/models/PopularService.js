import mongoose from 'mongoose'

const popularServiceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    image: { type: String, required: true },
    rating: { type: String, default: '4.8' },
    reviews: { type: String, default: '10k' },
    price: { type: Number, required: true },
    originalPrice: { type: Number },
    discount: { type: String, trim: true },
    isInstant: { type: Boolean, default: true },
    priority: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
    linkedGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'LabourCategoryGroup' },
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  { timestamps: true }
)

popularServiceSchema.index({ isActive: 1, priority: -1 })

export const PopularService =
  mongoose.models.PopularService || mongoose.model('PopularService', popularServiceSchema)
