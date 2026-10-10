import mongoose from 'mongoose'

const pushCampaignSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 65 },
    body: { type: String, required: true, trim: true, maxlength: 240 },
    audience: {
      mode: { type: String, enum: ['ALL', 'ROLES', 'INDIVIDUAL'], required: true },
      roles: [{ type: String, enum: ['individual', 'labour', 'corporate', 'contractor', 'enterprise'] }],
      userIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    },
    // Click action: where the app should open when the notification is tapped.
    action: {
      type: { type: String, enum: ['NONE', 'SCREEN', 'SKILL_BOOKING'], default: 'NONE' },
      screen: { type: String, trim: true },
      skillId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabourCategory' },
    },
    status: {
      type: String,
      enum: ['scheduled', 'sending', 'sent', 'failed'],
      default: 'sending',
      index: true,
    },
    scheduledAt: { type: Date, index: true },
    sentAt: Date,
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    counts: {
      targeted: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    errorMessage: String,
  },
  { timestamps: true },
)

export const PushCampaign =
  mongoose.models.PushCampaign || mongoose.model('PushCampaign', pushCampaignSchema)
